import asyncio
import json
import re
import unicodedata
from html import unescape
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from urllib.parse import urljoin

import httpx
import pdfplumber
from openai import OpenAI
from pydantic import BaseModel, Field, RootModel  # noqa: F401 (RootModel usado por ItensExtraidosSchema)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.edital import EditalModel
from app.models.item import ItemModel
from app.models.licitacao import LicitacaoModel
from app.services.ia_config_service import resolve_ai_agent_runtime_config
from app.services.storage_service import StorageError, StorageService

_SUMMARY_SYSTEM_INSTRUCTION = (
    "Voce e um analista de licitacoes publicas brasileiras. "
    "Resuma a oportunidade em portugues do Brasil, de forma objetiva, clara e util para decisao."
)

_CHAT_SYSTEM_INSTRUCTION = (
    "Voce e um assistente especialista em licitacoes publicas brasileiras. "
    "Responda em portugues do Brasil, de forma pratica, objetiva e fiel ao contexto da licitacao. "
    "Nao invente informacoes ausentes. Quando algo nao estiver claro, diga explicitamente."
)

_SMART_SEARCH_SYSTEM_INSTRUCTION = (
    "Voce e um agente de busca inteligente de licitacoes brasileiras. "
    "Recebera a intencao do usuario e deve convertela em um plano de busca objetivo, pratico e reutilizavel. "
    "Responda APENAS com JSON valido, sem markdown, sem comentarios e sem texto fora do JSON."
)

_BRAND_SYSTEM_INSTRUCTION = (
    "Voce e um analista de mercado B2B brasileiro. "
    "Recebera resultados reais de busca na web sobre um item de licitacao. "
    "Identifique somente marcas ou fabricantes plausiveis que PRODUZAM o item descrito. "
    "Nao retorne lojas, marketplaces, distribuidores, categorias genericas ou empresas nao relacionadas. "
    "Responda APENAS em JSON."
)

_SUMMARY_PROMPT_TEMPLATE = """Crie um resumo executivo curto desta licitacao.

Regras:
- escreva em portugues do Brasil
- use no maximo 8 linhas
- destaque objeto, escopo, principais itens ou servicos, quantidade relevante quando existir e data de abertura
- se houver risco ou ponto de atencao evidente, mencione em uma linha
- nao invente informacoes ausentes

DADOS DA LICITACAO:
{contexto}
"""


class ExtracaoItensError(Exception):
    pass


class ItemExtraidoSchema(BaseModel):
    class BrandCandidateSchema(BaseModel):
        nome: str
        preco_unitario_medio: float | None = None
        quantidade_referencias_preco: int = 0
        observacao: str | None = None

    numero_item: int
    descricao: str
    quantidade: float | None = None
    unidade: str | None = None
    especificacoes: list[str] = Field(default_factory=list)
    marcas_fabricantes: list[str | BrandCandidateSchema] = Field(default_factory=list)

    def especificacoes_json(self) -> str:
        return json.dumps(self.especificacoes, ensure_ascii=False)

    def marcas_fabricantes_json(self) -> str:
        serialized: list[dict[str, object] | str] = []
        for entry in self.marcas_fabricantes:
            if isinstance(entry, ItemExtraidoSchema.BrandCandidateSchema):
                serialized.append(entry.model_dump())
            else:
                serialized.append(entry)
        return json.dumps(serialized, ensure_ascii=False)


class ItensExtraidosSchema(RootModel[list[ItemExtraidoSchema]]):
    pass


# O OpenAI Structured Outputs exige que o schema raiz seja um 'object'.
# Usamos este wrapper apenas na chamada OpenAI e desempacotamos .itens depois.
class ItensExtraidosWrapper(BaseModel):
    itens: list[ItemExtraidoSchema]


class PropostaEmpresaSchema(BaseModel):
    cnpj: str = "[NAO INFORMADO]"
    nome_empresa: str = "[NAO INFORMADO]"
    valor_unitario_ofertado: str | float | int = "[NAO INFORMADO]"


class PropostaItemSchema(BaseModel):
    numero_item: int
    descricao: str
    descricao_detalhada: str = "[NAO INFORMADO]"
    quantidade_solicitada: str | float | int = "[NAO INFORMADO]"
    valor_estimado_unitario: str | float | int = "[NAO INFORMADO]"
    propostas: list[PropostaEmpresaSchema] = Field(default_factory=list)
    observacoes: str | None = None


class PropostasExtraidasPayload(BaseModel):
    portal: str = "[NAO INFORMADO]"
    numero_processo: str = "[NAO INFORMADO]"
    itens: list[PropostaItemSchema]


class PropostasExtraidasWrapper(BaseModel):
    resultado: PropostasExtraidasPayload


# Limite de caracteres para o texto do edital enviado a IA.
# ~120k chars = aprox. 30k tokens — margem segura para todos os provedores suportados.
_TEXTO_MAX_CHARS = 120_000

# Instrucao de sistema reutilizada pelos provedores que aceitam separacao de papeis.
_SYSTEM_INSTRUCTION = (
    "Voce e especialista em licitacoes publicas brasileiras. "
    "Extraia os itens do edital e responda APENAS com o JSON solicitado, sem texto adicional."
)

_GEMINI_FREE_MAX_CHARS = 9_000
_GEMINI_FREE_MAX_CHUNKS = 5
_GEMINI_CHUNK_DELAY_SECONDS = 1.5

_PROVIDER_CHUNK_CONFIG = {
    "openai": {"max_chars": 18_000, "max_chunks": 6, "delay_seconds": 0.2},
    "deepseek": {"max_chars": 12_000, "max_chunks": 6, "delay_seconds": 0.4},
    "groq": {"max_chars": 6_000, "max_chunks": 4, "delay_seconds": 1.0},
    "anthropic": {"max_chars": 16_000, "max_chunks": 6, "delay_seconds": 0.5},
    "gemini": {"max_chars": _GEMINI_FREE_MAX_CHARS, "max_chunks": _GEMINI_FREE_MAX_CHUNKS, "delay_seconds": _GEMINI_CHUNK_DELAY_SECONDS},
}

_PROPOSTAS_CONTEXT_CONFIG = {
    "openai": {"max_chars": 8_000, "max_chunks": 3},
    "deepseek": {"max_chars": 6_000, "max_chunks": 3},
    "groq": {"max_chars": 3_500, "max_chunks": 2},
    "anthropic": {"max_chars": 8_000, "max_chunks": 3},
    "gemini": {"max_chars": 5_000, "max_chunks": 3},
}

_CHAT_DOCUMENT_CHUNK_SIZE = 4_500
_CHAT_MAX_CONTEXT_CHUNKS = 6
_INVALID_ITEM_PATTERNS = (
    r"\bdeclarac",
    r"\bproposta de prec",
    r"\bhabilita",
    r"\bdocumenta",
    r"\bcumprimento dos requisitos",
    r"\bmitigac",
    r"\blei complementar",
    r"\bdecis[aã]o transitada",
    r"\bsocio",
    r"\bcriterio de julgamento",
    r"\bcondic(?:ao|oes) de pagamento",
    r"\bminuta contratual",
    r"\bobriga[cç][aã]o do licitante",
    r"\bproduto com no minimo de",
)
_WEB_BRAND_SEARCH_URL = "https://html.duckduckgo.com/html/"
_WEB_BRAND_BING_URL = "https://www.bing.com/search"
_WEB_BRAND_MAX_RESULTS = 6
_WEB_BRAND_MAX_ITEMS_PER_EXTRACTION = 12
_WEB_BRAND_CONCURRENCY = 2
_WEB_BRAND_MAX_PRICE_SEARCH_RESULTS = 5
_WEB_BRAND_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
_PRICE_PATTERN = re.compile(r"R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})", re.I)
_WEB_BRAND_EXCLUDED_DOMAINS = (
    "mercadolivre.",
    "amazon.",
    "shopee.",
    "olx.",
    "magazineluiza.",
    "americanas.",
    "superepi.",
    "lojadomecanico.",
    "fg.com.br",
    "drogaraia.",
    "drogasil.",
    "paguemenos.",
    "ultrafarma.",
    "zhihu.",
    "baidu.",
)
_WEB_BRAND_EXCLUDED_TITLE_TERMS = (
    "mercado livre",
    "loja do mecânico",
    "loja do mecanico",
    "drogaria",
    "droga raia",
    "farmácia",
    "farmacia",
)
_DENTAL_BRAND_FALLBACK_CANDIDATES = (
    {
        "nome": "Golgran",
        "observacao": "Fabricante do segmento odontologico com linha de instrumentais e brocas.",
    },
    {
        "nome": "Kerr Dental",
        "observacao": "Fabricante internacional do segmento odontologico com linha de operative carbides.",
    },
)
_WEB_BRAND_STOPWORDS = {
    "a",
    "o",
    "e",
    "de",
    "da",
    "do",
    "das",
    "dos",
    "para",
    "com",
    "sem",
    "tipo",
    "material",
    "cor",
    "personalizacao",
    "personalização",
    "caracteristicas",
    "características",
    "adicionais",
    "dimensoes",
    "dimensões",
    "classificacao",
    "anvisa",
    "classe",
    "embalagem",
    "fornecimento",
    "comprimento",
    "minimo",
    "minima",
    "minimas",
    "externa",
    "interna",
    "interno",
    "involucro",
    "grau",
    "abertura",
    "petala",
    "quantidade",
    "adequada",
    "excelente",
    "resistente",
    "atoxica",
    "atoxico",
    "hipoalergenica",
    "hipoalergenico",
    "unidade",
    "formato",
    "definida",
    "corpo",
}


class IaService:
    def __init__(self, db: Session | None = None) -> None:
        self.settings = get_settings()
        self.db = db
        self.storage = StorageService()

    async def salvar_edital(self, licitacao_id: int, arquivo) -> str:
        content = await arquivo.read()
        try:
            return self.storage.save_edital(licitacao_id, arquivo.filename or "edital.pdf", content)
        except StorageError as exc:
            raise ExtracaoItensError(f"Nao foi possivel salvar o edital no storage configurado: {exc}") from exc

    async def baixar_edital_principal(self, licitacao: LicitacaoModel) -> tuple[str, str]:
        edital_url = await self._resolve_edital_principal_url(licitacao)
        if not edital_url:
            raise ExtracaoItensError("Esta licitacao nao possui edital principal acessivel para download automatico.")

        try:
            async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
                response = await client.get(edital_url)
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise ExtracaoItensError("O portal demorou mais que o esperado para liberar o edital principal.") from exc
        except httpx.HTTPStatusError as exc:
            raise ExtracaoItensError("O portal rejeitou o download do edital principal desta licitacao.") from exc
        except httpx.HTTPError as exc:
            raise ExtracaoItensError("Nao foi possivel baixar o edital principal desta licitacao no momento.") from exc

        arquivo_nome = self._resolve_remote_pdf_name(edital_url, response.headers.get("content-disposition"))
        try:
            reference = self.storage.save_edital(licitacao.id, arquivo_nome, response.content)
        except StorageError as exc:
            raise ExtracaoItensError(f"Nao foi possivel persistir o edital principal no storage configurado: {exc}") from exc
        return reference, arquivo_nome

    async def _resolve_edital_principal_url(self, licitacao: LicitacaoModel) -> str | None:
        if licitacao.link_edital:
            return licitacao.link_edital

        if not licitacao.link_site:
            return None

        discovered_url = await self._discover_pdf_from_detail_page(licitacao.link_site)
        if discovered_url:
            licitacao.link_edital = discovered_url
            if self.db is not None:
                self.db.add(licitacao)
                self.db.commit()
                self.db.refresh(licitacao)
        return discovered_url

    async def _discover_pdf_from_detail_page(self, detail_url: str) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(detail_url)
                response.raise_for_status()
        except httpx.HTTPError:
            return None

        html = response.text
        candidates = self._extract_pdf_candidates_from_html(html, detail_url)
        if not candidates:
            return None

        preferred = next(
            (
                url
                for nome, url in candidates
                if any(token in nome.upper() for token in ("EDITAL", "AVISO", "ARQUIVO PRINCIPAL"))
            ),
            None,
        )
        return preferred or candidates[0][1]

    async def extrair_itens_do_edital(
        self,
        arquivo_path: str,
        *,
        include_brand_enrichment: bool = True,
    ) -> list[ItemExtraidoSchema]:
        if self.db is None:
            raise ExtracaoItensError("Servico de IA sem acesso ao banco para carregar a configuracao ativa.")

        try:
            arquivo_bytes, arquivo_path_efetivo = await self._read_edital_bytes_with_recovery(arquivo_path)
        except StorageError as exc:
            raise ExtracaoItensError(f"Nao foi possivel ler o edital no storage configurado: {exc}") from exc

        texto = self._extrair_texto_pdf_bytes(arquivo_bytes)
        texto = await self._enriquecer_texto_com_anexos(arquivo_path_efetivo, texto)
        if not texto.strip():
            raise ExtracaoItensError(
                "Nao foi possivel ler texto deste PDF. Se o edital estiver escaneado como imagem, a extracao com IA nao vai funcionar nesta etapa."
            )

        provider_id, provider = resolve_ai_agent_runtime_config(self.db, "extracao_itens", self.settings)
        if not provider["api_key"]:
            raise ExtracaoItensError(
                f"A chave da IA ativa ({provider['nome']}) nao esta configurada. Configure-a antes de extrair itens."
            )

        if provider_id == "openai":
            itens = await self._extract_with_chunking(
                provider_id,
                provider,
                provider["prompt_extracao"],
                texto,
                self._extract_with_openai,
            )
            itens_finalizados = self._finalize_extracted_items(itens, texto)
            if not include_brand_enrichment:
                return itens_finalizados
            return await self._enrich_items_with_web_brand_candidates(itens_finalizados, provider_id, provider)
        if provider_id == "deepseek":
            itens = await self._extract_with_chunking(
                provider_id,
                provider,
                provider["prompt_extracao"],
                texto,
                self._extract_with_deepseek,
            )
            itens_finalizados = self._finalize_extracted_items(itens, texto)
            if not include_brand_enrichment:
                return itens_finalizados
            return await self._enrich_items_with_web_brand_candidates(itens_finalizados, provider_id, provider)
        if provider_id == "groq":
            itens = await self._extract_with_chunking(
                provider_id,
                provider,
                provider["prompt_extracao"],
                texto,
                self._extract_with_groq,
            )
            itens_finalizados = self._finalize_extracted_items(itens, texto)
            if not include_brand_enrichment:
                return itens_finalizados
            return await self._enrich_items_with_web_brand_candidates(itens_finalizados, provider_id, provider)
        if provider_id == "anthropic":
            itens = await self._extract_with_chunking(
                provider_id,
                provider,
                provider["prompt_extracao"],
                texto,
                self._extract_with_anthropic,
            )
            itens_finalizados = self._finalize_extracted_items(itens, texto)
            if not include_brand_enrichment:
                return itens_finalizados
            return await self._enrich_items_with_web_brand_candidates(itens_finalizados, provider_id, provider)
        if provider_id == "gemini":
            itens = await self._extract_with_chunking(
                provider_id,
                provider,
                provider["prompt_extracao"],
                texto,
                self._extract_with_gemini_single_request,
            )
            itens_finalizados = self._finalize_extracted_items(itens, texto)
            if not include_brand_enrichment:
                return itens_finalizados
            return await self._enrich_items_with_web_brand_candidates(itens_finalizados, provider_id, provider)

        raise ExtracaoItensError(f"IA ativa nao suportada: {provider['nome']}.")

    async def enriquecer_marcas_fabricantes_licitacao(self, licitacao_id: int) -> None:
        if self.db is None:
            raise ExtracaoItensError("Servico de IA sem acesso ao banco para enriquecer marcas dos itens.")

        provider_id, provider = resolve_ai_agent_runtime_config(self.db, "resumo_licitacao", self.settings)
        if not provider["api_key"]:
            return

        item_models = self.db.scalars(
            select(ItemModel)
            .where(ItemModel.licitacao_id == licitacao_id)
            .order_by(ItemModel.numero_item.asc(), ItemModel.id.asc()),
        ).all()
        if not item_models:
            return

        candidates: list[tuple[ItemModel, ItemExtraidoSchema]] = []
        for item_model in item_models:
            existing_payload = item_model.marcas_fabricantes or "[]"
            if existing_payload.strip() not in {"", "[]"}:
                continue
            try:
                especificacoes = json.loads(item_model.especificacoes or "[]")
            except json.JSONDecodeError:
                especificacoes = []
            candidates.append(
                (
                    item_model,
                    ItemExtraidoSchema(
                        numero_item=item_model.numero_item,
                        descricao=item_model.descricao,
                        quantidade=item_model.quantidade,
                        unidade=item_model.unidade,
                        especificacoes=especificacoes if isinstance(especificacoes, list) else [],
                        marcas_fabricantes=[],
                    ),
                ),
            )

        if not candidates:
            return

        enriched = await self._enrich_items_with_web_brand_candidates(
            [schema for _, schema in candidates],
            provider_id,
            provider,
        )

        by_key = {
            (schema.numero_item, schema.descricao): schema
            for schema in enriched
        }
        updated = False
        for item_model, schema in candidates:
            enriched_schema = by_key.get((schema.numero_item, schema.descricao))
            if enriched_schema is None:
                continue
            payload = enriched_schema.marcas_fabricantes_json()
            if payload == (item_model.marcas_fabricantes or "[]"):
                continue
            item_model.marcas_fabricantes = payload
            self.db.add(item_model)
            updated = True

        if updated:
            self.db.commit()

    async def gerar_resumo_licitacao(self, licitacao: LicitacaoModel) -> str:
        if self.db is None:
            raise ExtracaoItensError("Servico de IA sem acesso ao banco para gerar resumo da licitacao.")

        provider_id, provider = resolve_ai_agent_runtime_config(self.db, "resumo_licitacao", self.settings)
        if not provider["api_key"]:
            raise ExtracaoItensError(
                f"A chave da IA ativa ({provider['nome']}) nao esta configurada. Configure-a antes de gerar o resumo."
            )

        contexto = self._build_licitacao_summary_context(licitacao)
        prompt = _SUMMARY_PROMPT_TEMPLATE.format(contexto=contexto)

        if provider_id == "openai":
            return self._summarize_with_openai(provider, prompt)
        if provider_id == "deepseek":
            return self._summarize_with_deepseek(provider, prompt)
        if provider_id == "groq":
            return self._summarize_with_groq(provider, prompt)
        if provider_id == "anthropic":
            return await self._summarize_with_anthropic(provider, prompt)
        if provider_id == "gemini":
            return await self._summarize_with_gemini(provider, prompt)

        raise ExtracaoItensError(f"IA ativa nao suportada: {provider['nome']}.")

    async def responder_chat_licitacao(
        self,
        licitacao: LicitacaoModel,
        historico: list[tuple[str, str]],
        pergunta: str,
    ) -> str:
        if self.db is None:
            raise ExtracaoItensError("Servico de IA sem acesso ao banco para responder o chat da licitacao.")

        provider_id, provider = resolve_ai_agent_runtime_config(self.db, "busca_inteligente", self.settings)
        if not provider["api_key"]:
            raise ExtracaoItensError(
                f"A chave da IA ativa ({provider['nome']}) nao esta configurada. Configure-a antes de usar o chat."
            )

        contexto = self._build_licitacao_summary_context(licitacao)
        documentos = await self._load_licitacao_documents_for_chat(licitacao)
        blocos_contexto = self._select_chat_context_chunks(documentos, pergunta)
        prompt = self._build_chat_prompt(contexto, blocos_contexto, historico, pergunta)

        if provider_id == "openai":
            return self._generate_text_openai(provider, prompt, _CHAT_SYSTEM_INSTRUCTION)
        if provider_id == "deepseek":
            return self._generate_text_openai_compatible_chat(
                provider,
                prompt,
                _CHAT_SYSTEM_INSTRUCTION,
                base_url="https://api.deepseek.com/v1",
            )
        if provider_id == "groq":
            return self._generate_text_openai_compatible_chat(
                provider,
                prompt,
                _CHAT_SYSTEM_INSTRUCTION,
                base_url="https://api.groq.com/openai/v1",
            )
        if provider_id == "anthropic":
            return await self._generate_text_anthropic(provider, prompt, _CHAT_SYSTEM_INSTRUCTION)
        if provider_id == "gemini":
            return await self._generate_text_gemini(provider, prompt, _CHAT_SYSTEM_INSTRUCTION)

        raise ExtracaoItensError(f"IA ativa nao suportada: {provider['nome']}.")

    async def extrair_propostas_por_item(self, licitacao: LicitacaoModel) -> PropostasExtraidasPayload:
        if self.db is None:
            raise ExtracaoItensError("Servico de IA sem acesso ao banco para extrair propostas por item.")

        provider_id, provider = resolve_ai_agent_runtime_config(self.db, "propostas_item", self.settings)
        if not provider["api_key"]:
            raise ExtracaoItensError(
                f"A chave da IA configurada para este agente ({provider['nome']}) nao esta disponivel."
            )

        contexto = await self._build_propostas_item_context(licitacao, provider_id)
        prompt = self._build_propostas_item_prompt(provider["prompt_extracao"], contexto)
        resultado = await self._extract_propostas_payload(provider_id, provider, prompt)
        if not resultado.portal or resultado.portal == "[NAO INFORMADO]":
            resultado.portal = str(licitacao.fonte or "[NAO INFORMADO]")
        if not resultado.numero_processo or resultado.numero_processo == "[NAO INFORMADO]":
            resultado.numero_processo = str(licitacao.numero_processo or licitacao.numero_controle or "[NAO INFORMADO]")
        if not resultado.itens:
            raise ExtracaoItensError("A IA nao conseguiu identificar itens com propostas nesta licitacao.")
        return resultado

    async def gerar_texto_estruturado(self, prompt: str, system_instruction: str) -> str:
        if self.db is None:
            raise ExtracaoItensError("Servico de IA sem acesso ao banco para gerar texto estruturado.")

        provider_id, provider = resolve_ai_agent_runtime_config(self.db, "extracao_itens", self.settings)
        if not provider["api_key"]:
            raise ExtracaoItensError(
                f"A chave da IA ativa ({provider['nome']}) nao esta configurada. Configure-a antes de usar a busca inteligente."
            )

        if provider_id == "openai":
            return self._generate_text_openai(provider, prompt, system_instruction)
        if provider_id == "deepseek":
            return self._generate_text_openai_compatible_chat(
                provider,
                prompt,
                system_instruction,
                base_url="https://api.deepseek.com/v1",
            )
        if provider_id == "groq":
            return self._generate_text_openai_compatible_chat(
                provider,
                prompt,
                system_instruction,
                base_url="https://api.groq.com/openai/v1",
            )
        if provider_id == "anthropic":
            return await self._generate_text_anthropic(provider, prompt, system_instruction)
        if provider_id == "gemini":
            return await self._generate_text_gemini(provider, prompt, system_instruction)

        raise ExtracaoItensError(f"IA ativa nao suportada: {provider['nome']}.")

    def _extract_with_openai(self, provider: dict[str, str], prompt: str) -> list[ItemExtraidoSchema]:
        client = OpenAI(api_key=provider["api_key"])

        # OpenAI Structured Outputs exige schema raiz do tipo 'object'.
        # Usamos ItensExtraidosWrapper (com campo 'itens') e desempacotamos depois.
        prompt_com_instrucao = (
            prompt
            + "\n\nIMPORTANTE: retorne um objeto JSON com a chave 'itens' contendo o array de itens extraidos."
        )

        try:
            response = client.responses.parse(
                model=provider["modelo"],
                input=[
                    {"role": "system", "content": _SYSTEM_INSTRUCTION},
                    {"role": "user", "content": prompt_com_instrucao},
                ],
                text_format=ItensExtraidosWrapper,
            )
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Nao foi possivel extrair os itens com {provider['nome']}: {exc}") from exc

        parsed = response.output_parsed
        if parsed is None or not parsed.itens:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) nao retornou itens validos para este edital.")

        return parsed.itens

    def _extract_with_deepseek(self, provider: dict[str, str], prompt: str) -> list[ItemExtraidoSchema]:
        client = OpenAI(api_key=provider["api_key"], base_url="https://api.deepseek.com/v1")

        # DeepSeek beta nao aceita o metodo response.parse 100% igual a API v1 da OpenAI.
        # Mas ele suporta json_object formating padrao com instrucao no prompt.
        prompt_com_instrucao = (
            prompt
            + "\n\nIMPORTANTE: voce deve retornar EXCLUSIVAMENTE um objeto JSON valido, "
            + "que contenha exatamente uma chave 'itens' com o array de objetos JSON extraidos."
        )

        try:
            response = client.chat.completions.create(
                model=provider["modelo"],
                messages=[
                    {"role": "system", "content": _SYSTEM_INSTRUCTION},
                    {"role": "user", "content": prompt_com_instrucao},
                ],
                response_format={"type": "json_object"},
            )
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Nao foi possivel extrair os itens com {provider['nome']}: {exc}") from exc

        content = response.choices[0].message.content
        if not content:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) retornou uma resposta vazia.")

        try:
            parsed = json.loads(content)
            lista_itens = parsed.get("itens", [])
            return [ItemExtraidoSchema(**self._normalize_item_dict(item)) for item in lista_itens]
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Falha ao interpretar a resposta da IA como JSON: {exc}") from exc

    def _extract_with_groq(self, provider: dict[str, str], prompt: str) -> list[ItemExtraidoSchema]:
        client = OpenAI(api_key=provider["api_key"], base_url="https://api.groq.com/openai/v1")

        prompt_com_instrucao = (
            prompt
            + "\n\nIMPORTANTE: voce deve retornar EXCLUSIVAMENTE um objeto JSON valido, "
            + "que contenha exatamente uma chave 'itens' com o array de objetos JSON extraidos."
        )

        try:
            response = client.chat.completions.create(
                model=provider["modelo"],
                messages=[
                    {"role": "system", "content": _SYSTEM_INSTRUCTION},
                    {"role": "user", "content": prompt_com_instrucao},
                ],
                response_format={"type": "json_object"},
            )
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Nao foi possivel extrair os itens com {provider['nome']}: {exc}") from exc

        content = response.choices[0].message.content
        if not content:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) retornou uma resposta vazia.")

        try:
            parsed = json.loads(content)
            lista_itens = parsed.get("itens", [])
            return [ItemExtraidoSchema(**self._normalize_item_dict(item)) for item in lista_itens]
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Falha ao interpretar a resposta da IA como JSON: {exc}") from exc

    async def _extract_with_anthropic(self, provider: dict[str, str], prompt: str) -> list[ItemExtraidoSchema]:
        headers = {
            "x-api-key": provider["api_key"],
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": provider["modelo"],
            "max_tokens": 4096,
            "system": _SYSTEM_INSTRUCTION,
            "messages": [{"role": "user", "content": prompt}],
        }

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:300] if exc.response else ""
            raise ExtracaoItensError(
                f"Nao foi possivel extrair os itens com {provider['nome']}: "
                f"status {exc.response.status_code}" + (f" - {body}" if body else "")
            ) from exc
        except httpx.HTTPError as exc:
            raise ExtracaoItensError(
                f"Nao foi possivel extrair os itens com {provider['nome']}: erro de conexao."
            ) from exc

        data = response.json()
        content = "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if isinstance(block, dict) and block.get("type") == "text"
        )
        return self._parse_items_from_text(content, provider["nome"])

    async def _extract_with_chunking(
        self,
        provider_id: str,
        provider: dict[str, str],
        prompt_template: str,
        texto_edital: str,
        extractor,
    ) -> list[ItemExtraidoSchema]:
        config = _PROVIDER_CHUNK_CONFIG.get(provider_id, {"max_chars": 12_000, "max_chunks": 5, "delay_seconds": 0.5})
        blocos = self._prepare_text_chunks(
            texto_edital,
            max_chars=int(config["max_chars"]),
            max_chunks=int(config["max_chunks"]),
        )
        itens_por_bloco: list[ItemExtraidoSchema] = []

        for index, bloco in enumerate(blocos):
            prompt = self._build_chunk_prompt(prompt_template, bloco)
            resultado = extractor(provider, prompt)
            itens_bloco = await resultado if asyncio.iscoroutine(resultado) else resultado
            itens_por_bloco.extend(itens_bloco)

            if index < len(blocos) - 1:
                await asyncio.sleep(float(config["delay_seconds"]))

        itens_unicos = self._merge_items(itens_por_bloco)
        return itens_unicos

    async def _extract_with_gemini_single_request(self, provider: dict[str, str], prompt: str) -> list[ItemExtraidoSchema]:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{provider['modelo']}:generateContent"
        params = {"key": provider["api_key"]}

        # O responseSchema do Gemini segue o subconjunto OpenAPI 3.0.
        # Campos opcionais NAO usam "nullable" — omitir o campo do "required" e suficiente.
        payload = {
            "systemInstruction": {
                "parts": [{"text": _SYSTEM_INSTRUCTION}]
            },
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "numero_item": {
                                "type": "integer",
                                "description": "Numero sequencial do item no edital",
                            },
                            "descricao": {
                                "type": "string",
                                "description": "Descricao completa do item",
                            },
                            "quantidade": {
                                "type": "number",
                                "description": "Quantidade solicitada",
                            },
                            "unidade": {
                                "type": "string",
                                "description": "Unidade de medida, ex: unidade, resma, caixa",
                            },
                            "especificacoes": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Lista de especificacoes tecnicas minimas exigidas",
                            },
                        },
                        "required": ["numero_item", "descricao", "especificacoes"],
                    },
                },
            },
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(endpoint, params=params, json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:400] if exc.response else ""
            raise ExtracaoItensError(
                f"Nao foi possivel extrair os itens com {provider['nome']}: "
                f"status {exc.response.status_code}" + (f" - {body}" if body else "")
            ) from exc
        except httpx.HTTPError as exc:
            raise ExtracaoItensError(
                f"Nao foi possivel extrair os itens com {provider['nome']}: erro de conexao."
            ) from exc

        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) nao retornou candidatos para este edital.")

        parts = candidates[0].get("content", {}).get("parts", [])
        content = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
        return self._parse_items_from_text(content, provider["nome"])

    def _summarize_with_openai(self, provider: dict[str, str], prompt: str) -> str:
        return self._generate_text_openai(provider, prompt, _SUMMARY_SYSTEM_INSTRUCTION)

    def _generate_text_openai(self, provider: dict[str, str], prompt: str, system_instruction: str) -> str:
        client = OpenAI(api_key=provider["api_key"])
        try:
            response = client.responses.create(
                model=provider["modelo"],
                input=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt},
                ],
            )
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Nao foi possivel gerar o resumo com {provider['nome']}: {exc}") from exc

        text = (getattr(response, "output_text", "") or "").strip()
        if not text:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) nao retornou um resumo valido.")
        return text

    def _summarize_with_deepseek(self, provider: dict[str, str], prompt: str) -> str:
        return self._generate_text_openai_compatible_chat(
            provider,
            prompt,
            _SUMMARY_SYSTEM_INSTRUCTION,
            base_url="https://api.deepseek.com/v1",
        )

    def _summarize_with_groq(self, provider: dict[str, str], prompt: str) -> str:
        return self._generate_text_openai_compatible_chat(
            provider,
            prompt,
            _SUMMARY_SYSTEM_INSTRUCTION,
            base_url="https://api.groq.com/openai/v1",
        )

    def _generate_text_openai_compatible_chat(
        self,
        provider: dict[str, str],
        prompt: str,
        system_instruction: str,
        *,
        base_url: str,
    ) -> str:
        client = OpenAI(api_key=provider["api_key"], base_url=base_url)
        try:
            response = client.chat.completions.create(
                model=provider["modelo"],
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt},
                ],
            )
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Nao foi possivel gerar o texto com {provider['nome']}: {exc}") from exc

        content = response.choices[0].message.content if response.choices else ""
        if not content:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) nao retornou um texto valido.")
        return content.strip()

    async def _summarize_with_anthropic(self, provider: dict[str, str], prompt: str) -> str:
        return await self._generate_text_anthropic(provider, prompt, _SUMMARY_SYSTEM_INSTRUCTION)

    async def _generate_text_anthropic(
        self,
        provider: dict[str, str],
        prompt: str,
        system_instruction: str,
    ) -> str:
        headers = {
            "x-api-key": provider["api_key"],
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": provider["modelo"],
            "max_tokens": 800,
            "system": system_instruction,
            "messages": [{"role": "user", "content": prompt}],
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:300] if exc.response else ""
            raise ExtracaoItensError(
                f"Nao foi possivel gerar o resumo com {provider['nome']}: "
                f"status {exc.response.status_code}" + (f" - {body}" if body else "")
            ) from exc
        except httpx.HTTPError as exc:
            raise ExtracaoItensError(f"Nao foi possivel gerar o resumo com {provider['nome']}: erro de conexao.") from exc

        data = response.json()
        content = "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if isinstance(block, dict) and block.get("type") == "text"
        ).strip()
        if not content:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) nao retornou um resumo valido.")
        return content

    async def _summarize_with_gemini(self, provider: dict[str, str], prompt: str) -> str:
        return await self._generate_text_gemini(provider, prompt, _SUMMARY_SYSTEM_INSTRUCTION)

    async def _generate_text_gemini(
        self,
        provider: dict[str, str],
        prompt: str,
        system_instruction: str,
    ) -> str:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{provider['modelo']}:generateContent"
        params = {"key": provider["api_key"]}
        payload = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(endpoint, params=params, json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:400] if exc.response else ""
            raise ExtracaoItensError(
                f"Nao foi possivel gerar o resumo com {provider['nome']}: "
                f"status {exc.response.status_code}" + (f" - {body}" if body else "")
            ) from exc
        except httpx.HTTPError as exc:
            raise ExtracaoItensError(f"Nao foi possivel gerar o resumo com {provider['nome']}: erro de conexao.") from exc

        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) nao retornou um resumo valido.")

        parts = candidates[0].get("content", {}).get("parts", [])
        content = "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
        if not content:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) nao retornou um resumo valido.")
        return content

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

        # Normaliza aliases de campos antes de validar
        if isinstance(payload, list):
            payload = [self._normalize_item_dict(item) if isinstance(item, dict) else item for item in payload]
        elif isinstance(payload, dict):
            # Pode ser {"itens": [...]}
            if "itens" in payload and isinstance(payload["itens"], list):
                payload = [self._normalize_item_dict(item) if isinstance(item, dict) else item for item in payload["itens"]]

        try:
            parsed = ItensExtraidosSchema.model_validate(payload)
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(
                f"A IA ativa ({provider_name}) retornou um JSON em formato inesperado: {exc}"
            ) from exc

        if not parsed.root:
            raise ExtracaoItensError(f"A IA ativa ({provider_name}) nao retornou itens validos para este edital.")

        return parsed.root

    @staticmethod
    def _normalize_item_field_name(value: str) -> str:
        raw = (value or "").strip()
        raw = raw.replace("Nº", "numero ").replace("nº", "numero ")
        raw = raw.replace("N°", "numero ").replace("n°", "numero ")
        raw = raw.replace("No.", "numero ").replace("no.", "numero ")
        raw = raw.replace("Nro.", "numero ").replace("nro.", "numero ")
        normalized = unicodedata.normalize("NFKD", raw)
        without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
        lowered = without_accents.lower().strip()
        lowered = re.sub(r"[^a-z0-9]+", "_", lowered)
        lowered = re.sub(r"_+", "_", lowered).strip("_")
        return lowered

    @staticmethod
    def _coerce_item_number(value: object) -> int | None:
        if value is None:
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        match = re.search(r'\d+', str(value))
        if not match:
            return None
        try:
            return int(match.group(0))
        except ValueError:
            return None

    @staticmethod
    def _coerce_optional_number(value: object) -> float | None:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip()
        if not text or text.upper() in {"[NAO INFORMADO]", "[NÃO INFORMADO]", "NAO INFORMADO", "NÃO INFORMADO", "-"}:
            return None
        cleaned = text.replace(".", "").replace(",", ".")
        match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
        if not match:
            return None
        try:
            return float(match.group(0))
        except ValueError:
            return None

    @staticmethod
    def _coerce_string_list(value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(entry).strip() for entry in value if str(entry).strip()]
        text = str(value).strip()
        if not text or text.upper() in {"[NAO INFORMADO]", "[NÃO INFORMADO]", "NAO INFORMADO", "NÃO INFORMADO", "-"}:
            return []
        for separator in ("\n", ";", " | "):
            if separator in text:
                return [part.strip() for part in text.split(separator) if part.strip()]
        return [text]

    @staticmethod
    def _normalize_item_dict(raw: dict) -> dict:
        normalized_result: dict = {}
        descricao_completa: object | None = None
        grupo_value: object | None = None

        numero_aliases = {
            "numero_item", "numero_do_item", "numero", "item_numero", "num_item", "num", "id", "item",
            "n_do_item", "no_do_item", "nro_do_item", "numero_item_item",
        }
        descricao_aliases = {
            "descricao", "descricao_resumida", "descricao_item", "nome", "title", "objeto", "item_descricao",
        }
        descricao_completa_aliases = {
            "descricao_completa",
            "descricao_completa_especificacao",
            "descricao_detalhada",
            "descricao_detalhada_especificacao",
            "especificacao",
            "especificacao_tecnica",
            "especificacoes_tecnicas",
            "detalhes",
        }
        quantidade_aliases = {"qtd", "quant", "qty", "quantidade", "quantidade_total", "quantidade_solicitada"}
        unidade_aliases = {"un", "und", "unit", "unidade", "unidade_de_fornecimento"}
        especificacoes_aliases = {"especificacoes", "specs"}
        marcas_aliases = {"marcas", "fabricantes", "brands", "marcas_fabricantes"}

        for key, value in raw.items():
            normalized_key = IaService._normalize_item_field_name(str(key))
            if (
                normalized_key in numero_aliases
                or normalized_key.startswith("numero_do_item")
                or normalized_key.startswith("numero_item")
            ):
                normalized_result.setdefault('numero_item', value)
            elif (
                normalized_key in descricao_aliases
                or ("descr" in normalized_key and "resum" in normalized_key)
                or normalized_key.startswith("descricao_")
            ):
                normalized_result.setdefault('descricao', value)
            elif (
                normalized_key in descricao_completa_aliases
                or ("descr" in normalized_key and ("completa" in normalized_key or "detalh" in normalized_key))
                or ("especific" in normalized_key and "descricao" in normalized_key)
            ):
                descricao_completa = value
            elif normalized_key in quantidade_aliases:
                normalized_result.setdefault('quantidade', value)
            elif normalized_key in unidade_aliases:
                normalized_result.setdefault('unidade', value)
            elif normalized_key in especificacoes_aliases:
                normalized_result.setdefault('especificacoes', value)
            elif normalized_key in marcas_aliases:
                normalized_result.setdefault('marcas_fabricantes', value)
            elif normalized_key == "grupo":
                grupo_value = value
            else:
                normalized_result[key] = value

        numero_item = IaService._coerce_item_number(normalized_result.get('numero_item'))
        if numero_item is not None:
            normalized_result['numero_item'] = numero_item

        normalized_result['quantidade'] = IaService._coerce_optional_number(normalized_result.get('quantidade'))

        if "unidade" in normalized_result and normalized_result["unidade"] is not None:
            unidade = str(normalized_result["unidade"]).strip()
            normalized_result["unidade"] = unidade or None

        especificacoes = IaService._coerce_string_list(normalized_result.get('especificacoes'))
        if descricao_completa is not None:
            detalhes = IaService._coerce_string_list(descricao_completa)
            especificacoes.extend(detalhe for detalhe in detalhes if detalhe and detalhe not in especificacoes)
        if grupo_value not in (None, "", "[NAO INFORMADO]", "[NÃO INFORMADO]"):
            grupo_texto = f"Grupo: {str(grupo_value).strip()}"
            if grupo_texto not in especificacoes:
                especificacoes.append(grupo_texto)
        normalized_result["especificacoes"] = especificacoes

        if not normalized_result.get("descricao") and descricao_completa is not None:
            detalhes = IaService._coerce_string_list(descricao_completa)
            if detalhes:
                normalized_result["descricao"] = detalhes[0]

        marcas = normalized_result.get("marcas_fabricantes")
        if marcas is None:
            normalized_result["marcas_fabricantes"] = []
        elif not isinstance(marcas, list):
            normalized_result["marcas_fabricantes"] = IaService._coerce_string_list(marcas)

        if "descricao" in normalized_result and normalized_result["descricao"] is not None:
            normalized_result["descricao"] = str(normalized_result["descricao"]).strip()

        return normalized_result

    async def _extract_propostas_payload(
        self,
        provider_id: str,
        provider: dict[str, str],
        prompt: str,
    ) -> PropostasExtraidasPayload:
        if provider_id == "openai":
            return self._extract_propostas_with_openai(provider, prompt)
        if provider_id == "deepseek":
            return self._extract_propostas_with_openai_compatible(
                provider,
                prompt,
                base_url="https://api.deepseek.com/v1",
            )
        if provider_id == "groq":
            return self._extract_propostas_with_openai_compatible(
                provider,
                prompt,
                base_url="https://api.groq.com/openai/v1",
            )
        if provider_id == "anthropic":
            raw = await self._generate_text_anthropic(provider, prompt, _SYSTEM_INSTRUCTION)
            return self._parse_propostas_payload_from_text(raw, provider["nome"])
        if provider_id == "gemini":
            raw = await self._generate_text_gemini(provider, prompt, _SYSTEM_INSTRUCTION)
            return self._parse_propostas_payload_from_text(raw, provider["nome"])

        raise ExtracaoItensError(f"IA ativa nao suportada: {provider['nome']}.")

    def _extract_propostas_with_openai(self, provider: dict[str, str], prompt: str) -> PropostasExtraidasPayload:
        client = OpenAI(api_key=provider["api_key"])
        prompt_com_instrucao = (
            prompt
            + "\n\nIMPORTANTE: retorne um objeto JSON com a chave 'resultado', contendo portal, numero_processo e itens."
        )

        try:
            response = client.responses.parse(
                model=provider["modelo"],
                input=[
                    {"role": "system", "content": _SYSTEM_INSTRUCTION},
                    {"role": "user", "content": prompt_com_instrucao},
                ],
                text_format=PropostasExtraidasWrapper,
            )
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Nao foi possivel extrair as propostas com {provider['nome']}: {exc}") from exc

        parsed = response.output_parsed
        if parsed is None or not parsed.resultado.itens:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) nao retornou propostas validas.")
        return parsed.resultado

    def _extract_propostas_with_openai_compatible(
        self,
        provider: dict[str, str],
        prompt: str,
        *,
        base_url: str,
    ) -> PropostasExtraidasPayload:
        client = OpenAI(api_key=provider["api_key"], base_url=base_url)
        prompt_com_instrucao = (
            prompt
            + "\n\nIMPORTANTE: voce deve retornar EXCLUSIVAMENTE um objeto JSON valido com a chave 'resultado'."
        )

        try:
            response = client.chat.completions.create(
                model=provider["modelo"],
                messages=[
                    {"role": "system", "content": _SYSTEM_INSTRUCTION},
                    {"role": "user", "content": prompt_com_instrucao},
                ],
                response_format={"type": "json_object"},
            )
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Nao foi possivel extrair as propostas com {provider['nome']}: {exc}") from exc

        content = response.choices[0].message.content if response.choices else ""
        if not content:
            raise ExtracaoItensError(f"A IA ativa ({provider['nome']}) retornou uma resposta vazia.")
        return self._parse_propostas_payload_from_text(content, provider["nome"])

    def _parse_propostas_payload_from_text(self, raw_text: str, provider_name: str) -> PropostasExtraidasPayload:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start == -1 or end == -1:
                start = cleaned.find("[")
                end = cleaned.rfind("]")
                if start == -1 or end == -1:
                    raise ExtracaoItensError(
                        f"A IA ativa ({provider_name}) nao retornou um JSON valido para propostas por item."
                    ) from None
                payload = json.loads(cleaned[start : end + 1])
            else:
                payload = json.loads(cleaned[start : end + 1])

        if isinstance(payload, list):
            payload = {"resultado": {"itens": payload}}
        elif isinstance(payload, dict) and isinstance(payload.get("resultado"), list):
            payload = {"resultado": {"itens": payload.get("resultado")}}

        try:
            parsed = PropostasExtraidasWrapper.model_validate(payload)
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(
                f"A IA ativa ({provider_name}) retornou propostas em formato inesperado: {exc}"
            ) from exc

        if not parsed.resultado.itens:
            raise ExtracaoItensError(f"A IA ativa ({provider_name}) nao retornou itens validos com propostas.")
        return parsed.resultado

    async def _build_propostas_item_context(self, licitacao: LicitacaoModel, provider_id: str) -> str:
        partes = [
            "DADOS GERAIS DA LICITACAO",
            f"Portal/Fonte: {licitacao.fonte}",
            f"Orgao: {licitacao.orgao}",
            f"Numero de controle: {licitacao.numero_controle}",
            f"Numero do processo: {licitacao.numero_processo or '[NAO INFORMADO]'}",
            f"Modalidade: {licitacao.modalidade or '[NAO INFORMADO]'}",
            f"Objeto: {licitacao.objeto}",
            f"Data de abertura: {licitacao.data_abertura or '[NAO INFORMADO]'}",
            f"Link do portal: {licitacao.link_site or '[NAO INFORMADO]'}",
            f"Link do edital: {licitacao.link_edital or '[NAO INFORMADO]'}",
        ]

        itens_existentes = self.db.scalars(
            select(ItemModel)
            .where(ItemModel.licitacao_id == licitacao.id)
            .order_by(ItemModel.numero_item.asc(), ItemModel.id.asc())
        ).all()
        if itens_existentes:
            partes.append("\nITENS JA EXTRAIDOS NO SISTEMA")
            for item in itens_existentes[:40]:
                quantidade = item.quantidade if item.quantidade is not None else "[NAO INFORMADO]"
                unidade = item.unidade or ""
                partes.append(
                    f"- Item {item.numero_item}: {item.descricao} | Quantidade: {quantidade} {unidade}".strip()
                )

        texto_portal = await self._collect_portal_text_for_propostas(licitacao, itens_existentes)
        if texto_portal:
            partes.append("\nCONTEUDO COLETADO NO PORTAL")
            partes.append(texto_portal)

        texto_edital = await self._load_latest_edital_text_for_licitacao(licitacao)
        if texto_edital:
            partes.append("\nTEXTO DO EDITAL E ANEXOS")
            partes.append(texto_edital)

        contexto = "\n".join(parte for parte in partes if parte)
        return self._compress_propostas_context(contexto, provider_id)

    def _build_propostas_item_prompt(self, template: str, contexto: str) -> str:
        return (
            f"{template}\n\n"
            "CONTEXTO DA LICITACAO E DAS FONTES COLETADAS:\n"
            f"{contexto}"
        )

    async def _load_latest_edital_text_for_licitacao(self, licitacao: LicitacaoModel) -> str:
        edital = self.db.scalar(
            select(EditalModel)
            .where(EditalModel.licitacao_id == licitacao.id)
            .order_by(EditalModel.created_at.desc(), EditalModel.id.desc())
        )

        arquivo_path = edital.arquivo_path if edital and edital.arquivo_path else None
        if not arquivo_path and licitacao.link_edital:
            try:
                arquivo_path, _ = await self.baixar_edital_principal(licitacao)
            except ExtracaoItensError:
                arquivo_path = None

        if not arquivo_path:
            return ""

        try:
            arquivo_bytes, arquivo_path_efetivo = await self._read_edital_bytes_with_recovery(arquivo_path)
        except StorageError:
            return ""

        texto = self._extrair_texto_pdf_bytes(arquivo_bytes)
        if not texto.strip():
            return ""
        return await self._enriquecer_texto_com_anexos(arquivo_path_efetivo, texto)

    async def _collect_portal_text_for_propostas(
        self,
        licitacao: LicitacaoModel,
        itens_existentes: list[ItemModel],
    ) -> str:
        if not licitacao.link_site:
            return ""

        urls: list[str] = [licitacao.link_site]
        if "cnetmobile.estaleiro.serpro.gov.br" in licitacao.link_site or "compras.gov.br" in licitacao.link_site:
            item_urls = self._build_compras_gov_item_urls(licitacao.link_site, itens_existentes)
            urls.extend(item_urls[:20])

        blocos: list[str] = []
        for url in urls[:21]:
            texto = await self._fetch_visible_text_from_url(url)
            if texto:
                blocos.append(f"[URL: {url}]\n{texto}")

        return "\n\n".join(blocos)

    def _build_compras_gov_item_urls(self, detail_url: str, itens_existentes: list[ItemModel]) -> list[str]:
        parsed = urlparse(detail_url)
        query = parse_qs(parsed.query)
        compra = query.get("compra", [None])[0]
        if not compra:
            return []

        base = detail_url.split("/acompanhamento-compra", 1)[0]
        urls: list[str] = []
        for item in itens_existentes:
            urls.append(f"{base}/acompanhamento-compra/item/{item.numero_item}?compra={compra}")
        return urls

    async def _fetch_visible_text_from_url(self, url: str) -> str:
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers={"User-Agent": _WEB_BRAND_USER_AGENT})
                response.raise_for_status()
        except httpx.HTTPError:
            return ""

        return self._html_to_visible_text(response.text)

    def _html_to_visible_text(self, html: str) -> str:
        cleaned = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html)
        cleaned = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", cleaned)
        cleaned = re.sub(r"(?is)<noscript[^>]*>.*?</noscript>", " ", cleaned)
        cleaned = re.sub(r"(?i)<br\\s*/?>", "\n", cleaned)
        cleaned = re.sub(r"(?i)</(p|div|tr|li|h1|h2|h3|h4|h5|h6|td|th)>", "\n", cleaned)
        cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
        cleaned = unescape(cleaned)
        cleaned = cleaned.replace("\xa0", " ")
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    def _compress_propostas_context(self, contexto: str, provider_id: str) -> str:
        config = _PROPOSTAS_CONTEXT_CONFIG.get(provider_id, {"max_chars": 5_000, "max_chunks": 3})
        blocos = self._prepare_text_chunks(
            contexto,
            max_chars=int(config["max_chars"]),
            max_chunks=int(config["max_chunks"]),
        )
        return "\n\n".join(blocos)

    def _build_prompt(self, template: str, texto_edital: str) -> str:
        if "{texto_edital}" in template:
            return template.replace("{texto_edital}", texto_edital)
        return f"{template}\n\nTEXTO DO EDITAL:\n{texto_edital}"

    def _build_licitacao_summary_context(self, licitacao: LicitacaoModel) -> str:
        linhas = [
            f"Orgao: {licitacao.orgao}",
            f"Numero de controle: {licitacao.numero_controle}",
            f"Modalidade: {licitacao.modalidade or 'Nao informada'}",
            f"Objeto: {licitacao.objeto}",
            f"Data de abertura: {licitacao.data_abertura or 'Nao informada'}",
            f"Local: {' - '.join([parte for parte in [licitacao.cidade, licitacao.estado] if parte]) or 'Nao informado'}",
            f"Valor estimado: {licitacao.valor_estimado if licitacao.valor_estimado is not None else 'Nao informado'}",
        ]

        itens = list(getattr(licitacao, "itens", []) or [])
        if itens:
            linhas.append("Itens extraidos:")
            for item in itens[:12]:
                quantidade = item.quantidade if item.quantidade is not None else "Nao informada"
                unidade = item.unidade or ""
                linhas.append(
                    f"- Item {item.numero_item}: {item.descricao} | Quantidade: {quantidade} {unidade}".strip()
                )

        return "\n".join(linhas)

    def _build_chat_prompt(
        self,
        contexto: str,
        blocos_documentos: list[str],
        historico: list[tuple[str, str]],
        pergunta: str,
    ) -> str:
        linhas = [
            "CONTEXTO DA LICITACAO:",
            contexto,
            "",
            "DOCUMENTOS ANALISADOS:",
        ]

        if blocos_documentos:
            linhas.extend(blocos_documentos)
        else:
            linhas.append("Nenhum documento textual adicional foi encontrado para esta licitacao.")

        linhas.extend(
            [
                "",
            "HISTORICO RECENTE DA CONVERSA:",
            ]
        )

        if historico:
            for role, content in historico[-10:]:
                autor = "Usuario" if role == "user" else "Assistente"
                linhas.append(f"{autor}: {content}")
        else:
            linhas.append("Sem mensagens anteriores.")

        linhas.extend(
            [
                "",
                f"PERGUNTA ATUAL DO USUARIO: {pergunta}",
                "",
                "Responda de forma objetiva e util para analise da oportunidade.",
            ]
        )
        return "\n".join(linhas)

    async def _load_licitacao_documents_for_chat(self, licitacao: LicitacaoModel) -> list[tuple[str, str]]:
        documentos: list[tuple[str, str]] = []
        editais = list(getattr(licitacao, "editais", []) or [])

        for edital in editais:
            arquivo_path = getattr(edital, "arquivo_path", None)
            arquivo_nome = getattr(edital, "arquivo_nome", None) or "edital.pdf"
            if not arquivo_path:
                continue

            try:
                arquivo_bytes, _ = await self._read_edital_bytes_with_recovery(arquivo_path)
            except StorageError:
                continue
            texto = self._extrair_texto_pdf_bytes(arquivo_bytes)
            if texto.strip():
                documentos.append((f"Edital enviado: {arquivo_nome}", texto))

        if not documentos and licitacao.link_edital and licitacao.link_edital.lower().endswith(".pdf"):
            texto_remoto = await self._fetch_remote_pdf_text(licitacao.link_edital)
            if texto_remoto.strip():
                documentos.append(("Edital do portal", texto_remoto))

        if licitacao.link_site and "e-compras.am.gov.br" in licitacao.link_site:
            anexos = await self._collect_ecompras_am_annex_texts(licitacao.link_site, licitacao.link_edital)
            for nome, conteudo in anexos:
                if conteudo.strip():
                    documentos.append((f"Anexo: {nome}", conteudo))

        return documentos

    async def _fetch_remote_pdf_text(self, url: str) -> str:
        try:
            async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
        except httpx.HTTPError:
            return ""

        return self._extrair_texto_pdf_bytes(response.content)

    def _select_chat_context_chunks(self, documentos: list[tuple[str, str]], pergunta: str) -> list[str]:
        blocos_scored: list[tuple[int, int, str]] = []
        index = 0

        for nome, conteudo in documentos:
            nome_legivel = self._humanize_document_name(nome)
            for bloco in self._split_text_into_chunks(conteudo, _CHAT_DOCUMENT_CHUNK_SIZE):
                texto_bloco = f"[DOCUMENTO: {nome_legivel}]\n{bloco}"
                score = self._score_chat_relevance(texto_bloco, pergunta)
                blocos_scored.append((score, index, texto_bloco))
                index += 1

        if not blocos_scored:
            return []

        blocos_scored.sort(key=lambda item: (-item[0], item[1]))
        selecionados = sorted(blocos_scored[:_CHAT_MAX_CONTEXT_CHUNKS], key=lambda item: item[1])
        return [bloco for _, _, bloco in selecionados]

    def _score_chat_relevance(self, texto: str, pergunta: str) -> int:
        normalized_text = texto.lower()
        normalized_question = pergunta.lower()
        termos = [termo for termo in re.findall(r"\w+", normalized_question) if len(termo) >= 3]

        score = 0
        for termo in termos:
            score += normalized_text.count(termo) * 4

        boosted_patterns = [
            r"\btermo de referencia\b",
            r"\bestudo tecnico\b",
            r"\betp\b",
            r"\bedital\b",
            r"\bobjeto\b",
            r"\bitem\b",
            r"\bquantidade\b",
            r"\bespecific",
            r"\bprazo\b",
            r"\bexig",
            r"\bcriterio\b",
            r"\bhabilit",
        ]
        for pattern in boosted_patterns:
            if re.search(pattern, normalized_text):
                score += 2

        if any(token in normalized_question for token in ("termo de referencia", "tr", "referencia")):
            if "termo de referencia" in normalized_text or "tr " in normalized_text or " tr]" in normalized_text:
                score += 30

        if any(token in normalized_question for token in ("etp", "estudo tecnico", "estudo técnico")):
            if "etp" in normalized_text or "estudo tecnico" in normalized_text:
                score += 30

        if "edital" in normalized_question and "edital" in normalized_text:
            score += 20

        if "[documento: anexo:" in normalized_text:
            score += 4

        return score

    def _humanize_document_name(self, nome: str) -> str:
        humanized = nome.replace("_", " ").replace("-", " ")
        replacements = {
            "TERMODEREFERENCIA": "TERMO DE REFERENCIA",
            "ESTUDOTECNICO": "ESTUDO TECNICO",
            "ESTUDOTECNICOPRELIMINAR": "ESTUDO TECNICO PRELIMINAR",
        }
        for raw, pretty in replacements.items():
            humanized = humanized.replace(raw, pretty)
        return humanized

    def _build_chunk_prompt(self, template: str, texto_edital: str) -> str:
        return self._build_prompt(
            template,
            texto_edital
            + "\n\nIMPORTANTE: extraia apenas os itens presentes NESTE TRECHO do edital. "
            + "Nao invente itens ausentes neste bloco. "
            + "Ignore declaracoes, exigencias administrativas, clausulas juridicas, modelos de proposta e textos de minuta contratual.",
        )

    def _finalize_extracted_items(self, itens: list[ItemExtraidoSchema], texto_edital: str) -> list[ItemExtraidoSchema]:
        itens_filtrados = self._filter_extracted_items(itens)
        if itens_filtrados:
            return itens_filtrados

        item_objeto = self._build_fallback_item_from_object(texto_edital)
        if item_objeto:
            return [item_objeto]

        raise ExtracaoItensError("A IA ativa nao retornou itens validos para este edital.")

    def _filter_extracted_items(self, itens: list[ItemExtraidoSchema]) -> list[ItemExtraidoSchema]:
        filtrados: list[ItemExtraidoSchema] = []

        for item in itens:
            descricao = " ".join((item.descricao or "").split())
            if not descricao:
                continue

            if self._is_invalid_procurement_item(descricao, item.especificacoes):
                continue

            quantidade = item.quantidade
            if quantidade == 0:
                quantidade = None

            filtrados.append(
                ItemExtraidoSchema(
                    numero_item=item.numero_item,
                    descricao=descricao,
                    quantidade=quantidade,
                    unidade=item.unidade,
                    especificacoes=item.especificacoes,
                    marcas_fabricantes=self._normalize_brand_candidates(item.marcas_fabricantes),
                )
            )

        if not filtrados:
            return []

        renumerados: list[ItemExtraidoSchema] = []
        for index, item in enumerate(filtrados, start=1):
            renumerados.append(
                ItemExtraidoSchema(
                    numero_item=item.numero_item or index,
                    descricao=item.descricao,
                    quantidade=item.quantidade,
                    unidade=item.unidade,
                    especificacoes=item.especificacoes,
                    marcas_fabricantes=item.marcas_fabricantes,
                )
            )
        return renumerados

    def _normalize_brand_candidates(
        self,
        marcas_fabricantes: list[str | ItemExtraidoSchema.BrandCandidateSchema | dict[str, object]],
    ) -> list[ItemExtraidoSchema.BrandCandidateSchema]:
        normalized: list[ItemExtraidoSchema.BrandCandidateSchema] = []
        seen: set[str] = set()

        for marca in marcas_fabricantes:
            candidate = self._coerce_brand_candidate(marca)
            if candidate is None:
                continue
            key = candidate.nome.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(candidate)

        return normalized[:8]

    def _coerce_brand_candidate(
        self,
        marca: str | ItemExtraidoSchema.BrandCandidateSchema | dict[str, object] | None,
    ) -> ItemExtraidoSchema.BrandCandidateSchema | None:
        if marca is None:
            return None

        if isinstance(marca, ItemExtraidoSchema.BrandCandidateSchema):
            nome = " ".join(marca.nome.split()).strip(" ,.;:-")
            if not nome:
                return None
            return ItemExtraidoSchema.BrandCandidateSchema(
                nome=nome,
                preco_unitario_medio=marca.preco_unitario_medio,
                quantidade_referencias_preco=max(int(marca.quantidade_referencias_preco or 0), 0),
                observacao=marca.observacao,
            )

        if isinstance(marca, dict):
            nome = " ".join(str(marca.get("nome", "")).split()).strip(" ,.;:-")
            if not nome:
                return None
            preco = marca.get("preco_unitario_medio")
            quantidade = marca.get("quantidade_referencias_preco", 0)
            observacao = marca.get("observacao")
            return ItemExtraidoSchema.BrandCandidateSchema(
                nome=nome,
                preco_unitario_medio=float(preco) if isinstance(preco, (int, float)) else None,
                quantidade_referencias_preco=int(quantidade) if isinstance(quantidade, (int, float)) else 0,
                observacao=str(observacao).strip() if observacao else None,
            )

        cleaned = " ".join(str(marca).split()).strip(" ,.;:-")
        if not cleaned:
            return None
        return ItemExtraidoSchema.BrandCandidateSchema(nome=cleaned)

    async def _enrich_items_with_web_brand_candidates(
        self,
        itens: list[ItemExtraidoSchema],
        provider_id: str,
        provider: dict[str, str],
    ) -> list[ItemExtraidoSchema]:
        if not itens:
            return itens

        semaphore = asyncio.Semaphore(_WEB_BRAND_CONCURRENCY)
        enriched_items: list[ItemExtraidoSchema] = []

        async def enrich_single(item: ItemExtraidoSchema) -> ItemExtraidoSchema:
            existing = self._normalize_brand_candidates(item.marcas_fabricantes)
            category_fallback = self._build_category_brand_fallback_candidates(item)
            query = self._build_brand_search_query(item)
            if not query:
                if category_fallback:
                    merged_fallback = self._merge_brand_candidates(category_fallback, existing)
                    return ItemExtraidoSchema(
                        numero_item=item.numero_item,
                        descricao=item.descricao,
                        quantidade=item.quantidade,
                        unidade=item.unidade,
                        especificacoes=item.especificacoes,
                        marcas_fabricantes=merged_fallback,
                    )
                return item

            async with semaphore:
                search_results = await self._search_brand_candidates_on_web(query)
            search_results = [result for result in search_results if self._is_brand_search_result_relevant(item, result)]

            if not search_results:
                fallback_query = self._build_brand_fallback_query(item)
                if fallback_query and fallback_query != query:
                    async with semaphore:
                        search_results = await self._search_brand_candidates_on_web(fallback_query)
                    search_results = [result for result in search_results if self._is_brand_search_result_relevant(item, result)]

            if not search_results:
                if category_fallback:
                    merged_fallback = self._merge_brand_candidates(category_fallback, existing)
                    return ItemExtraidoSchema(
                        numero_item=item.numero_item,
                        descricao=item.descricao,
                        quantidade=item.quantidade,
                        unidade=item.unidade,
                        especificacoes=item.especificacoes,
                        marcas_fabricantes=merged_fallback,
                    )
                return ItemExtraidoSchema(
                    numero_item=item.numero_item,
                    descricao=item.descricao,
                    quantidade=item.quantidade,
                    unidade=item.unidade,
                    especificacoes=item.especificacoes,
                    marcas_fabricantes=existing,
                )

            web_brands = await self._extract_brands_from_search_results(
                provider_id,
                provider,
                item,
                search_results,
            )
            if not web_brands and category_fallback:
                web_brands = category_fallback
            price_enriched_brands = await self._enrich_brand_candidates_with_prices(item, web_brands)
            merged_brands = self._merge_brand_candidates(price_enriched_brands, existing)
            return ItemExtraidoSchema(
                numero_item=item.numero_item,
                descricao=item.descricao,
                quantidade=item.quantidade,
                unidade=item.unidade,
                especificacoes=item.especificacoes,
                marcas_fabricantes=merged_brands,
            )

        prioritarios = itens[:_WEB_BRAND_MAX_ITEMS_PER_EXTRACTION]
        restantes = itens[_WEB_BRAND_MAX_ITEMS_PER_EXTRACTION :]
        enriched_items.extend(await asyncio.gather(*(enrich_single(item) for item in prioritarios)))
        enriched_items.extend(restantes)
        return enriched_items

    def _build_category_brand_fallback_candidates(
        self,
        item: ItemExtraidoSchema,
    ) -> list[ItemExtraidoSchema.BrandCandidateSchema]:
        text = self._normalize_web_query_text(" ".join([item.descricao, *item.especificacoes]))
        if "broca" in text and ("rotacao" in text or "carbide" in text or "tungstenio" in text):
            return [
                ItemExtraidoSchema.BrandCandidateSchema(
                    nome=candidate["nome"],
                    observacao=candidate["observacao"],
                )
                for candidate in _DENTAL_BRAND_FALLBACK_CANDIDATES
            ]
        return []

    def _merge_brand_candidates(
        self,
        primary: list[ItemExtraidoSchema.BrandCandidateSchema],
        secondary: list[ItemExtraidoSchema.BrandCandidateSchema],
    ) -> list[ItemExtraidoSchema.BrandCandidateSchema]:
        merged: dict[str, ItemExtraidoSchema.BrandCandidateSchema] = {}
        for candidate in [*primary, *secondary]:
            key = candidate.nome.lower()
            current = merged.get(key)
            if current is None:
                merged[key] = candidate
                continue
            if current.preco_unitario_medio is None and candidate.preco_unitario_medio is not None:
                merged[key] = candidate
        return list(merged.values())[:8]

    def _build_brand_search_query(self, item: ItemExtraidoSchema) -> str:
        termos = self._extract_brand_query_terms(item)
        if not termos:
            return ""

        hint = self._build_brand_context_hint(item)
        query = f"{' '.join(termos)} {hint} fabricante brasil".strip()
        query = re.sub(r"\s+", " ", query).strip()
        return query[:220]

    def _extract_brand_query_terms(self, item: ItemExtraidoSchema) -> list[str]:
        segmentos_descricao = [segmento.strip() for segmento in re.split(r"[;,]", item.descricao) if segmento.strip()]
        bruto = " ".join(
            [
                *segmentos_descricao[:4],
                *item.especificacoes[:4],
            ]
        )
        tokens = re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", self._normalize_web_query_text(bruto))
        termos: list[str] = []
        seen: set[str] = set()
        for token in tokens:
            cleaned = token.strip().strip("-")
            if len(cleaned) < 3:
                continue
            lowered = cleaned.lower()
            if lowered in _WEB_BRAND_STOPWORDS:
                continue
            if lowered in seen:
                continue
            seen.add(lowered)
            termos.append(cleaned)
            if len(termos) >= 7:
                break

        return termos

    def _normalize_web_query_text(self, text: str) -> str:
        normalized = unicodedata.normalize("NFKD", text or "")
        without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
        return without_accents.lower()

    def _build_brand_context_hint(self, item: ItemExtraidoSchema) -> str:
        text = self._normalize_web_query_text(" ".join([item.descricao, *item.especificacoes]))
        if "broca" in text and ("rotacao" in text or "carbide" in text or "tungstenio" in text):
            return "odontologica dental"
        if "luva" in text and "cirurgica" in text:
            return "hospitalar"
        if "seringa" in text or "agulha" in text:
            return "hospitalar medico"
        return ""

    def _build_brand_fallback_query(self, item: ItemExtraidoSchema) -> str:
        text = self._normalize_web_query_text(" ".join([item.descricao, *item.especificacoes]))
        if "broca" in text and ("rotacao" in text or "carbide" in text or "tungstenio" in text):
            return "broca carbide odontologica dental alta rotacao fabricante brasil"
        if "luva" in text and "cirurgica" in text:
            return "luva cirurgica latex hospitalar fabricante brasil"
        return ""

    def _get_brand_relevance_terms(self, item: ItemExtraidoSchema) -> list[str]:
        base_terms = self._extract_brand_query_terms(item)
        text = self._normalize_web_query_text(" ".join([item.descricao, *item.especificacoes]))
        extras: list[str] = []
        if "broca" in text:
            extras.extend(["broca", "carbide", "rotacao", "odontologica", "dental", "tungstenio"])
        if "luva" in text:
            extras.extend(["luva", "latex", "cirurgica", "hospitalar"])
        if "seringa" in text:
            extras.extend(["seringa", "agulha", "hospitalar"])

        merged: list[str] = []
        seen: set[str] = set()
        for term in [*base_terms, *extras]:
            normalized = self._normalize_web_query_text(term)
            if len(normalized) < 3 or normalized in seen or normalized in _WEB_BRAND_STOPWORDS:
                continue
            seen.add(normalized)
            merged.append(normalized)
        return merged[:10]

    def _is_brand_search_result_relevant(self, item: ItemExtraidoSchema, result: dict[str, str]) -> bool:
        haystack = self._normalize_web_query_text(
            " ".join([result.get("title", ""), result.get("snippet", ""), result.get("url", "")]),
        )
        terms = self._get_brand_relevance_terms(item)
        matches = [term for term in terms if term in haystack]
        if len(matches) >= 2:
            return True
        if any(term in haystack for term in ("fabricante", "industria", "dental", "odontologica", "hospitalar")) and matches:
            return True
        return False

    async def _search_brand_candidates_on_web(self, query: str) -> list[dict[str, str]]:
        headers = {"user-agent": _WEB_BRAND_USER_AGENT}
        params = {"q": query, "kl": "br-pt"}
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=headers) as client:
                response = await client.get(_WEB_BRAND_SEARCH_URL, params=params)
                response.raise_for_status()
        except httpx.HTTPError:
            return await self._search_brand_candidates_on_bing(query)

        html = response.text
        if "anomaly-modal" in html or "Unfortunately, bots use DuckDuckGo too." in html:
            return await self._search_brand_candidates_on_bing(query)

        matches = re.findall(
            r'<a[^>]*class="result__a"[^>]*href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>',
            html,
            flags=re.I | re.S,
        )

        snippets = re.findall(
            r'<a[^>]*class="result__snippet"[^>]*>(?P<snippet>.*?)</a>',
            html,
            flags=re.I | re.S,
        )

        results: list[dict[str, str]] = []
        for index, (href, title_html) in enumerate(matches[:_WEB_BRAND_MAX_RESULTS]):
            results.append(
                {
                    "title": self._clean_search_html_fragment(title_html),
                    "url": self._resolve_duckduckgo_result_url(href),
                    "snippet": self._clean_search_html_fragment(snippets[index]) if index < len(snippets) else "",
                }
            )
        cleaned_results = [result for result in results if result["title"] or result["snippet"]]
        if cleaned_results:
            return cleaned_results
        return await self._search_brand_candidates_on_bing(query)

    async def _search_brand_candidates_on_bing(self, query: str) -> list[dict[str, str]]:
        headers = {"user-agent": _WEB_BRAND_USER_AGENT}
        params = {"q": query, "setlang": "pt-BR", "format": "rss"}
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=headers) as client:
                response = await client.get(_WEB_BRAND_BING_URL, params=params)
                response.raise_for_status()
        except httpx.HTTPError:
            return []

        xml = response.text
        items = re.findall(r"<item>(.*?)</item>", xml, flags=re.I | re.S)
        results: list[dict[str, str]] = []
        for item_xml in items[:_WEB_BRAND_MAX_RESULTS]:
            title_match = re.search(r"<title>(.*?)</title>", item_xml, flags=re.I | re.S)
            link_match = re.search(r"<link>(.*?)</link>", item_xml, flags=re.I | re.S)
            snippet_match = re.search(r"<description>(.*?)</description>", item_xml, flags=re.I | re.S)
            if not title_match or not link_match:
                continue
            results.append(
                {
                    "title": self._clean_search_html_fragment(title_match.group(1)),
                    "url": unescape(link_match.group(1)).strip(),
                    "snippet": self._clean_search_html_fragment(snippet_match.group(1)) if snippet_match else "",
                }
            )
        return [result for result in results if result["title"] or result["snippet"]]

    def _clean_search_html_fragment(self, value: str) -> str:
        no_tags = re.sub(r"<.*?>", " ", value or "")
        cleaned = unescape(no_tags)
        return re.sub(r"\s+", " ", cleaned).strip()

    def _resolve_duckduckgo_result_url(self, href: str) -> str:
        if href.startswith("http://") or href.startswith("https://"):
            return href
        if "uddg=" in href:
            parsed = urlparse(href)
            params = parse_qs(parsed.query or href.split("?", 1)[-1])
            if "uddg" in params and params["uddg"]:
                return unquote(params["uddg"][0])
        return href

    async def _extract_brands_from_search_results(
        self,
        provider_id: str,
        provider: dict[str, str],
        item: ItemExtraidoSchema,
        search_results: list[dict[str, str]],
    ) -> list[ItemExtraidoSchema.BrandCandidateSchema]:
        resultados_texto = "\n".join(
            f"{index}. TITULO: {resultado['title']}\nURL: {resultado['url']}\nSNIPPET: {resultado['snippet']}"
            for index, resultado in enumerate(search_results, start=1)
        )
        especificacoes = "\n".join(f"- {spec}" for spec in item.especificacoes[:8]) or "- Nao informadas"
        prompt = (
            "Analise os resultados de busca abaixo e identifique somente marcas ou fabricantes plausiveis "
            "que produzam o item descrito. Considere as especificacoes minimas. "
            "Ignore distribuidores, atacadistas, lojas, marketplaces, orgaos publicos e categorias genericas.\n\n"
            f"ITEM: {item.descricao}\n"
            f"ESPECIFICACOES MINIMAS:\n{especificacoes}\n\n"
            f"RESULTADOS WEB:\n{resultados_texto}\n\n"
            "Retorne APENAS um objeto JSON neste formato:\n"
            '{"marcas_fabricantes": ["Marca 1", "Fabricante 2"]}\n'
            "Se nao houver evidencias suficientes nos resultados, retorne array vazio."
        )

        try:
            if provider_id == "openai":
                raw = self._generate_text_openai(provider, prompt, _BRAND_SYSTEM_INSTRUCTION)
            elif provider_id == "deepseek":
                raw = self._generate_text_openai_compatible_chat(
                    provider,
                    prompt,
                    _BRAND_SYSTEM_INSTRUCTION,
                    base_url="https://api.deepseek.com/v1",
                )
            elif provider_id == "groq":
                raw = self._generate_text_openai_compatible_chat(
                    provider,
                    prompt,
                    _BRAND_SYSTEM_INSTRUCTION,
                    base_url="https://api.groq.com/openai/v1",
                )
            elif provider_id == "anthropic":
                raw = await self._generate_text_anthropic(provider, prompt, _BRAND_SYSTEM_INSTRUCTION)
            elif provider_id == "gemini":
                raw = await self._generate_text_gemini(provider, prompt, _BRAND_SYSTEM_INSTRUCTION)
            else:
                return []
        except ExtracaoItensError:
            return self._extract_brand_candidates_heuristic(search_results)

        parsed = self._parse_brand_candidates_from_text(raw)
        if parsed:
            return parsed
        return self._extract_brand_candidates_heuristic(search_results)

    def _extract_brand_candidates_heuristic(
        self,
        search_results: list[dict[str, str]],
    ) -> list[ItemExtraidoSchema.BrandCandidateSchema]:
        candidatos: list[ItemExtraidoSchema.BrandCandidateSchema] = []
        vistos: set[str] = set()

        for resultado in search_results:
            url = (resultado.get("url") or "").strip()
            title = self._clean_search_html_fragment(resultado.get("title", ""))
            hostname = (urlparse(url).hostname or "").lower()
            if not hostname:
                continue
            if any(fragment in hostname for fragment in _WEB_BRAND_EXCLUDED_DOMAINS):
                continue

            candidate_name = ""
            title_parts = [part.strip() for part in re.split(r"[|\-–:]", title) if part.strip()]
            for part in title_parts[:2]:
                normalized = self._normalize_web_query_text(part)
                if normalized in _WEB_BRAND_STOPWORDS or len(normalized) < 3:
                    continue
                if any(term in normalized for term in _WEB_BRAND_EXCLUDED_TITLE_TERMS):
                    continue
                if any(word in normalized for word in ("luva", "carimbo", "seringa", "hospitalar", "produto", "categoria")):
                    continue
                candidate_name = part
                break

            if not candidate_name:
                domain_label = hostname.replace("www.", "").split(".")[0].replace("-", " ").strip()
                if len(domain_label) < 3:
                    continue
                candidate_name = domain_label.title()

            normalized_name = self._normalize_web_query_text(candidate_name)
            if normalized_name in vistos or len(normalized_name) < 3:
                continue
            vistos.add(normalized_name)
            candidatos.append(ItemExtraidoSchema.BrandCandidateSchema(nome=candidate_name))

        return candidatos[:5]

    async def _enrich_brand_candidates_with_prices(
        self,
        item: ItemExtraidoSchema,
        brands: list[ItemExtraidoSchema.BrandCandidateSchema],
    ) -> list[ItemExtraidoSchema.BrandCandidateSchema]:
        enriched: list[ItemExtraidoSchema.BrandCandidateSchema] = []
        for brand in brands:
            average_price, evidence_count = await self._estimate_brand_unit_price(item, brand.nome)
            enriched.append(
                ItemExtraidoSchema.BrandCandidateSchema(
                    nome=brand.nome,
                    preco_unitario_medio=average_price,
                    quantidade_referencias_preco=evidence_count,
                    observacao=brand.observacao,
                )
            )
        return enriched

    async def _estimate_brand_unit_price(
        self,
        item: ItemExtraidoSchema,
        brand_name: str,
    ) -> tuple[float | None, int]:
        query = self._build_brand_price_search_query(item, brand_name)
        if not query:
            return None, 0

        search_results = await self._search_brand_candidates_on_web(query)
        if not search_results:
            return None, 0

        prices: list[float] = []
        for result in search_results[:_WEB_BRAND_MAX_PRICE_SEARCH_RESULTS]:
            prices.extend(self._extract_brl_prices_from_text(" ".join([result.get("title", ""), result.get("snippet", "")])))

        filtered_prices = [price for price in prices if 0.5 <= price <= 50000]
        if not filtered_prices:
            return None, 0

        average = round(sum(filtered_prices) / len(filtered_prices), 2)
        return average, len(filtered_prices)

    def _build_brand_price_search_query(self, item: ItemExtraidoSchema, brand_name: str) -> str:
        base = self._build_brand_search_query(item).replace(" fabricante marca brasil", "").strip()
        query = f"{base} {brand_name} preco"
        return re.sub(r"\s+", " ", query).strip()[:220]

    def _extract_brl_prices_from_text(self, text: str) -> list[float]:
        values: list[float] = []
        for match in _PRICE_PATTERN.findall(text or ""):
            numeric = match.replace(".", "").replace(",", ".")
            try:
                values.append(float(numeric))
            except ValueError:
                continue
        return values

    def _parse_brand_candidates_from_text(self, raw_text: str) -> list[ItemExtraidoSchema.BrandCandidateSchema]:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start == -1 or end == -1:
                return []
            try:
                payload = json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError:
                return []

        marcas = payload.get("marcas_fabricantes", []) if isinstance(payload, dict) else []
        if not isinstance(marcas, list):
            return []
        return self._normalize_brand_candidates([str(marca) for marca in marcas])

    def _is_invalid_procurement_item(self, descricao: str, especificacoes: list[str]) -> bool:
        texto = self._normalize_text_for_item_checks(" ".join([descricao, *especificacoes]))

        if any(re.search(pattern, texto, re.I) for pattern in _INVALID_ITEM_PATTERNS):
            return True

        if texto.startswith(("declaracao", "proposta de precos", "documentacao", "criterio de", "produto com no minimo de")):
            return True

        return False

    def _build_fallback_item_from_object(self, texto_edital: str) -> ItemExtraidoSchema | None:
        patterns = [
            r"tem por objeto\s+(.*?)(?:, de acordo com|, conforme|, para atender|\. )",
            r"objeto\s*[:\-]\s*(.*?)(?:, de acordo com|, conforme|, para atender|\. )",
        ]

        trecho = None
        for pattern in patterns:
            match = re.search(pattern, texto_edital, re.I | re.S)
            if match:
                trecho = " ".join(match.group(1).split())
                break

        if not trecho:
            return None

        trecho = re.sub(
            r"^(aquisicao|contratacao|registro de precos|prestacao de servicos)\s*,?\s*(pelo menor preco por item,?\s*)?(de\s+)?",
            "",
            trecho,
            flags=re.I,
        )
        trecho = re.split(r",\s*para\b|,\s*destinado\b|,\s*visando\b", trecho, maxsplit=1, flags=re.I)[0]
        texto_normalizado = self._normalize_text_for_item_checks(trecho)
        if texto_normalizado.startswith(("aquisicao", "contratacao", "prestacao de servicos", "registro de precos")):
            trecho = re.sub(r"^.*?\bde\b\s+", "", trecho, count=1, flags=re.I)
        trecho = re.sub(r"\s+", " ", trecho).strip(" .,-")
        if not trecho:
            return None

        return ItemExtraidoSchema(
            numero_item=1,
            descricao=trecho.upper() if len(trecho.split()) <= 8 else trecho,
            quantidade=None,
            unidade=None,
            especificacoes=[],
        )

    def _normalize_text_for_item_checks(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value)
        without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
        return without_accents.lower()

    def _prepare_text_chunks(self, texto: str, *, max_chars: int, max_chunks: int) -> list[str]:
        # Como todos os provedores agora operam em blocos, nao devemos truncar o
        # edital inteiro antes da divisao. Isso poderia descartar justamente o
        # Termo de Referencia ou anexos onde os itens detalhados aparecem.
        blocos = self._split_text_into_chunks(texto, max_chars)
        if len(blocos) <= max_chunks:
            return blocos

        scored = [
            (self._score_item_relevance(bloco), index, bloco)
            for index, bloco in enumerate(blocos)
        ]
        scored.sort(key=lambda item: (-item[0], item[1]))
        selecionados = sorted(scored[:max_chunks], key=lambda item: item[1])
        return [bloco for _, _, bloco in selecionados]

    def _split_text_into_chunks(self, texto: str, max_chars: int) -> list[str]:
        paragrafos = [parte.strip() for parte in re.split(r"\n{2,}", texto) if parte.strip()]
        if not paragrafos:
            return [texto[:max_chars]]

        blocos: list[str] = []
        atual: list[str] = []
        tamanho_atual = 0

        for paragrafo in paragrafos:
            adicional = len(paragrafo) + (2 if atual else 0)
            if atual and tamanho_atual + adicional > max_chars:
                blocos.append("\n\n".join(atual))
                atual = [paragrafo]
                tamanho_atual = len(paragrafo)
                continue

            atual.append(paragrafo)
            tamanho_atual += adicional

        if atual:
            blocos.append("\n\n".join(atual))

        return blocos or [texto[:max_chars]]

    def _score_item_relevance(self, texto: str) -> int:
        normalized = texto.lower()
        score = 0
        score += len(re.findall(r"\bitem\b", normalized)) * 3
        score += len(re.findall(r"\blote\b", normalized)) * 2
        score += len(re.findall(r"\bdescricao\b", normalized)) * 2
        score += len(re.findall(r"\bquantidade\b", normalized)) * 2
        score += len(re.findall(r"\bunidade\b", normalized)) * 2
        score += len(re.findall(r"\bespecific", normalized)) * 2
        score += len(re.findall(r"(?:^|\n)\s*\d+\)", texto)) * 3
        score += len(re.findall(r"(?:^|\n)\s*item\s*\d+", normalized)) * 3
        score += len(re.findall(r"\(id-\d+\)", normalized)) * 6
        score += len(re.findall(r"\bforma farmac", normalized)) * 4
        score += len(re.findall(r"\bconcentra", normalized)) * 3
        score += len(re.findall(r"\b(?:mg|ml|mcg|g)\b", normalized)) * 2
        score += len(re.findall(r"\bampola\b|\bcomprimido\b|\bfrasco\b|\bcapsula\b|\bsolucao injetavel\b", normalized)) * 3
        if "item descritivo quant" in normalized:
            score += 12
        return score

    def _merge_items(self, itens: list[ItemExtraidoSchema]) -> list[ItemExtraidoSchema]:
        merged: dict[tuple[int, str], ItemExtraidoSchema] = {}

        for item in itens:
            chave = (item.numero_item, item.descricao.strip().lower())
            existente = merged.get(chave)
            if existente is None:
                merged[chave] = item
                continue

            if not existente.quantidade and item.quantidade is not None:
                existente.quantidade = item.quantidade
            if not existente.unidade and item.unidade:
                existente.unidade = item.unidade

            especificacoes = list(existente.especificacoes)
            for especificacao in item.especificacoes:
                if especificacao not in especificacoes:
                    especificacoes.append(especificacao)
            existente.especificacoes = especificacoes

        return sorted(merged.values(), key=lambda item: item.numero_item)

    def _truncar_texto(self, texto: str) -> str:
        """Trunca o texto do edital ate o limite seguro de caracteres."""
        if len(texto) <= _TEXTO_MAX_CHARS:
            return texto
        # Tenta truncar em uma quebra de linha para nao cortar no meio de uma sentenca.
        truncado = texto[:_TEXTO_MAX_CHARS]
        ultimo_newline = truncado.rfind("\n")
        if ultimo_newline > _TEXTO_MAX_CHARS // 2:
            truncado = truncado[:ultimo_newline]
        return truncado + "\n\n[TEXTO TRUNCADO PELO SISTEMA - edital muito longo]"

    def _extrair_texto_pdf(self, arquivo_path: Path) -> str:
        try:
            with pdfplumber.open(arquivo_path) as pdf:
                paginas = [pagina.extract_text() or "" for pagina in pdf.pages]
        except Exception as exc:  # noqa: BLE001
            raise ExtracaoItensError(f"Nao foi possivel ler o PDF enviado: {exc}") from exc

        # Sanitiza o texto: remove linhas que sao so espacos/tabulacoes e
        # colapsa sequencias de mais de 2 quebras de linha consecutivas.
        partes: list[str] = []
        for parte in paginas:
            if not parte or not parte.strip():
                continue
            linhas_limpas = [linha for linha in parte.splitlines() if linha.strip()]
            partes.append("\n".join(linhas_limpas))

        return "\n\n".join(partes)

    def _resolve_remote_pdf_name(self, url: str, content_disposition: str | None) -> str:
        if content_disposition:
            match = re.search(r'filename="?([^";]+)"?', content_disposition, re.I)
            if match:
                nome = Path(match.group(1)).name
                if nome.lower().endswith(".pdf"):
                    return nome

        path_name = Path(urlparse(url).path).name
        if path_name.lower().endswith(".pdf"):
            return path_name

        return "edital_principal.pdf"

    async def _enriquecer_texto_com_anexos(self, arquivo_path: str, texto_base: str) -> str:
        if self.db is None:
            return texto_base

        licitacao = self._find_licitacao_by_edital_path(arquivo_path)
        if licitacao is None or not licitacao.link_site or "e-compras.am.gov.br" not in licitacao.link_site:
            return texto_base

        anexos = await self._collect_ecompras_am_annex_texts(licitacao.link_site, licitacao.link_edital)
        if not anexos:
            return texto_base

        # Colocamos os anexos primeiro porque, nesses editais, o detalhe dos
        # itens costuma estar no Termo de Referencia e nao no corpo principal.
        partes: list[str] = []
        for nome, conteudo in anexos:
            if not conteudo.strip():
                continue
            partes.append(f"[ANEXO COMPLEMENTAR: {nome}]\n{conteudo}")
        partes.append(texto_base)

        return "\n\n".join(partes)

    def _find_licitacao_by_edital_path(self, arquivo_path: str) -> LicitacaoModel | None:
        from app.models.edital import EditalModel
        from sqlalchemy import select

        edital = self.db.scalar(select(EditalModel).where(EditalModel.arquivo_path == arquivo_path))
        if edital is None:
            return None
        return self.db.get(LicitacaoModel, edital.licitacao_id)

    def _find_edital_by_path(self, arquivo_path: str) -> EditalModel | None:
        from sqlalchemy import select

        if self.db is None:
            return None
        return self.db.scalar(select(EditalModel).where(EditalModel.arquivo_path == arquivo_path))

    async def _read_edital_bytes_with_recovery(self, arquivo_path: str) -> tuple[bytes, str]:
        try:
            return self.storage.read_bytes(arquivo_path), arquivo_path
        except StorageError as original_exc:
            if self.db is None:
                raise

            edital = self._find_edital_by_path(arquivo_path)
            if edital is None:
                raise

            licitacao = self.db.get(LicitacaoModel, edital.licitacao_id)
            if licitacao is None or (not licitacao.link_edital and not licitacao.link_site):
                raise

            try:
                novo_arquivo_path, novo_arquivo_nome = await self.baixar_edital_principal(licitacao)
                arquivo_bytes = self.storage.read_bytes(novo_arquivo_path)
            except (ExtracaoItensError, StorageError):
                raise original_exc

            edital.arquivo_path = novo_arquivo_path
            if not edital.arquivo_nome:
                edital.arquivo_nome = novo_arquivo_nome
            if edital.status_extracao == "erro" and edital.erro_mensagem and "storage configurado" in edital.erro_mensagem:
                edital.status_extracao = "pendente"
                edital.erro_mensagem = None

            self.db.add(edital)
            self.db.commit()
            self.db.refresh(edital)
            return arquivo_bytes, novo_arquivo_path

    def _texto_ja_parece_detalhado(self, texto: str) -> bool:
        normalized = texto.lower()
        score = 0

        # Evidencias fortes de tabela/lista de materiais reais.
        strong_patterns = [
            r"\bcomprimido\b",
            r"\bampola\b",
            r"\bfrasco\b",
            r"\bcaixa\b",
            r"\bml\b",
            r"\bmg\b",
            r"\bquantidade\b",
            r"\bdescricao\b",
            r"\bunidade\b",
        ]
        for pattern in strong_patterns:
            if re.search(pattern, normalized):
                score += 1

        # Linhas de item so contam quando parecem item de compra, nao mera
        # referencia juridica como "item 2 deste edital".
        item_table_patterns = [
            r"(?im)^\s*item\s+\d+\s*[-:.]",
            r"(?im)^\s*\d+\s*[-.)]\s+[a-z0-9].{10,}",
            r"(?im)^\s*\d+\s+[A-Z][A-Z0-9 /(),.-]{15,}",
        ]
        for pattern in item_table_patterns:
            if re.search(pattern, texto):
                score += 2

        return score >= 3

    async def _collect_ecompras_am_annex_texts(
        self,
        detail_url: str,
        main_pdf_url: str | None,
    ) -> list[tuple[str, str]]:
        try:
            async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
                detail_response = await client.get(detail_url)
                detail_response.raise_for_status()
                html = detail_response.text
                candidates = self._extract_ecompras_am_annex_candidates(html, detail_url, main_pdf_url)
                anexos: list[tuple[str, str]] = []
                for nome, url in candidates[:3]:
                    pdf_response = await client.get(url)
                    pdf_response.raise_for_status()
                    texto = self._extrair_texto_pdf_bytes(pdf_response.content)
                    if texto.strip():
                        anexos.append((nome, texto))
                return anexos
        except httpx.HTTPError:
            return []

    def _extract_ecompras_am_annex_candidates(
        self,
        html: str,
        base_url: str,
        main_pdf_url: str | None,
    ) -> list[tuple[str, str]]:
        section_match = re.search(
            r"Documentos,\s*Anexos\s*e\s*Oficios-Circulares\s*do\s*Edital:(.*?)Documentos\s*Avulsos:",
            html,
            re.S | re.I,
        )
        search_area = section_match.group(1) if section_match else html
        matches = re.findall(r'href="([^"]+\.pdf)".*?>([^<]+\.PDF)<', search_area, re.I | re.S)

        candidatos: list[tuple[str, str]] = []
        main_url_normalized = (main_pdf_url or "").strip().lower()
        for href, nome in matches:
            full_url = urljoin(base_url, href)
            nome_limpo = nome.strip()
            if main_url_normalized and full_url.strip().lower() == main_url_normalized:
                continue
            nome_upper = nome_limpo.upper()
            if any(
                token in nome_upper
                for token in ("TERMO", "TR", "ETP", "ESTUDO", "PROJETO", "ANEXO", "MAPA", "PLANILHA")
            ):
                candidatos.append((nome_limpo, full_url))

        return candidatos

    def _extract_pdf_candidates_from_html(self, html: str, base_url: str) -> list[tuple[str, str]]:
        candidates: list[tuple[str, str]] = []
        seen: set[str] = set()

        for href, nome in re.findall(r'href="([^"]+\.pdf)"[^>]*>(.*?)</a>', html, re.I | re.S):
            full_url = urljoin(base_url, href)
            normalized_url = full_url.strip()
            if normalized_url in seen:
                continue

            seen.add(normalized_url)
            label = self._clean_html_fragment(nome) or Path(urlparse(full_url).path).name or "arquivo.pdf"
            candidates.append((label, full_url))

        return candidates

    def _clean_html_fragment(self, value: str) -> str:
        cleaned = re.sub(r"<[^>]+>", " ", value)
        cleaned = unescape(cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.strip()

    def _extrair_texto_pdf_bytes(self, content: bytes) -> str:
        try:
            with pdfplumber.open(BytesIO(content)) as pdf:
                paginas = [pagina.extract_text() or "" for pagina in pdf.pages]
        except Exception:
            return ""

        partes: list[str] = []
        for parte in paginas:
            if not parte or not parte.strip():
                continue
            linhas_limpas = [linha for linha in parte.splitlines() if linha.strip()]
            partes.append("\n".join(linhas_limpas))

        return "\n\n".join(partes)
