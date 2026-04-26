import json
from pathlib import Path

import httpx
import pdfplumber
from openai import OpenAI
from pydantic import BaseModel, Field, RootModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.ia_config_service import get_active_provider_id, get_ai_provider_internal_config


class ExtracaoItensError(Exception):
    pass


class ItemExtraidoSchema(BaseModel):
    numero_item: int
    descricao: str
    quantidade: float | None = None
    unidade: str | None = None
    especificacoes: list[str] = Field(default_factory=list)

    def especificacoes_json(self) -> str:
        return json.dumps(self.especificacoes, ensure_ascii=False)


class ItensExtraidosSchema(RootModel[list[ItemExtraidoSchema]]):
    pass


class IaService:
    def __init__(self, db: Session | None = None) -> None:
        self.settings = get_settings()
        self.db = db

    async def salvar_edital(self, licitacao_id: int, arquivo) -> Path:
        uploads_root = Path(__file__).resolve().parents[2] / self.settings.uploads_dir / str(licitacao_id)
        uploads_root.mkdir(parents=True, exist_ok=True)

        destination = uploads_root / Path(arquivo.filename or "edital.pdf").name
        content = await arquivo.read()
        destination.write_bytes(content)
        return destination

    async def extrair_itens_do_edital(self, arquivo_path: str) -> list[ItemExtraidoSchema]:
        if self.db is None:
            raise ExtracaoItensError("Servico de IA sem acesso ao banco para carregar a configuracao ativa.")

        texto = self._extrair_texto_pdf(Path(arquivo_path))
        if not texto.strip():
            raise ExtracaoItensError(
                "Nao foi possivel ler texto deste PDF. Se o edital estiver escaneado como imagem, a extracao com IA nao vai funcionar nesta etapa."
            )

        provider_id = get_active_provider_id(self.db)
        provider = get_ai_provider_internal_config(self.db, provider_id, self.settings)
        if not provider["api_key"]:
            raise ExtracaoItensError(
                f"A chave da IA ativa ({provider['nome']}) nao esta configurada. Configure-a antes de extrair itens."
            )

        prompt = self._build_prompt(provider["prompt_extracao"], texto[:160000])

        if provider_id == "openai":
            return self._extract_with_openai(provider, prompt)
        if provider_id == "anthropic":
            return await self._extract_with_anthropic(provider, prompt)
        if provider_id == "gemini":
            return await self._extract_with_gemini(provider, prompt)

        raise ExtracaoItensError(f"IA ativa nao suportada: {provider['nome']}.")

    def _extract_with_openai(self, provider: dict[str, str], prompt: str) -> list[ItemExtraidoSchema]:
        client = OpenAI(api_key=provider["api_key"])

        try:
            response = client.responses.parse(
                model=provider["modelo"],
                input=[
                    {"role": "system", "content": "Extraia itens de editais e responda em JSON estruturado."},
                    {"role": "user", "content": prompt},
                ],
                text_format=ItensExtraidosSchema,
            )
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Nao foi possivel extrair os itens com {provider['nome']}: {exc}") from exc

        parsed = response.output_parsed
        if parsed is None or not parsed.root:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) nao retornou itens validos para este edital.")

        return parsed.root

    async def _extract_with_anthropic(self, provider: dict[str, str], prompt: str) -> list[ItemExtraidoSchema]:
        headers = {
            "x-api-key": provider["api_key"],
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": provider["modelo"],
            "max_tokens": 4096,
            "system": "Extraia itens de editais e responda apenas com um array JSON valido.",
            "messages": [{"role": "user", "content": prompt}],
        }

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ExtracaoItensError(f"Nao foi possivel extrair os itens com {provider['nome']}: {exc}") from exc

        data = response.json()
        content = "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if isinstance(block, dict) and block.get("type") == "text"
        )
        return self._parse_items_from_text(content, provider["nome"])

    async def _extract_with_gemini(self, provider: dict[str, str], prompt: str) -> list[ItemExtraidoSchema]:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{provider['modelo']}:generateContent"
        params = {"key": provider["api_key"]}
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "numero_item": {"type": "integer"},
                            "descricao": {"type": "string"},
                            "quantidade": {"type": "number", "nullable": True},
                            "unidade": {"type": "string", "nullable": True},
                            "especificacoes": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["numero_item", "descricao", "especificacoes"],
                    },
                },
            },
        }

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(endpoint, params=params, json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ExtracaoItensError(f"Nao foi possivel extrair os itens com {provider['nome']}: {exc}") from exc

        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) nao retornou candidatos para este edital.")

        parts = candidates[0].get("content", {}).get("parts", [])
        content = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
        return self._parse_items_from_text(content, provider["nome"])

    def _parse_items_from_text(self, raw_text: str, provider_name: str) -> list[ItemExtraidoSchema]:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError:
            start = cleaned.find("[")
            end = cleaned.rfind("]")
            if start == -1 or end == -1:
                raise ExtracaoItensError(
                    f"A IA ativa ({provider_name}) nao retornou um JSON valido para os itens do edital."
                ) from None
            payload = json.loads(cleaned[start : end + 1])

        try:
            parsed = ItensExtraidosSchema.model_validate(payload)
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(
                f"A IA ativa ({provider_name}) retornou um JSON em formato inesperado: {exc}"
            ) from exc

        if not parsed.root:
            raise ExtracaoItensError(f"A IA ativa ({provider_name}) nao retornou itens validos para este edital.")

        return parsed.root

    def _build_prompt(self, template: str, texto_edital: str) -> str:
        if "{texto_edital}" in template:
            return template.replace("{texto_edital}", texto_edital)
        return f"{template}\n\nTEXTO DO EDITAL:\n{texto_edital}"

    def _extrair_texto_pdf(self, arquivo_path: Path) -> str:
        try:
            with pdfplumber.open(arquivo_path) as pdf:
                paginas = [pagina.extract_text() or "" for pagina in pdf.pages]
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Nao foi possivel ler o PDF enviado: {exc}") from exc

        return "\n\n".join(parte.strip() for parte in paginas if parte and parte.strip())
