import json
from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.configuracao import ConfiguracaoModel

IA_ACTIVE_PROVIDER_KEY = "ia_active_provider"
IA_PROVIDER_KEY_PREFIX = "ia_provider_"

DEFAULT_PROMPT_EXTRACAO = (
    "Voce e um especialista em licitacoes publicas brasileiras.\n"
    "Analise o texto do edital a seguir e extraia TODOS os itens listados.\n"
    "Para cada item, retorne um JSON com os campos:\n"
    "- numero_item (inteiro)\n"
    "- descricao (string: descricao completa do item)\n"
    "- quantidade (numero)\n"
    "- unidade (string: unidade de medida, ex: \"unidade\", \"resma\", \"caixa\")\n"
    "- especificacoes (array de strings: especificacoes tecnicas minimas exigidas)\n\n"
    "Retorne APENAS um array JSON valido, sem texto adicional.\n"
    "Seja preciso e nao omita nenhum item do edital.\n\n"
    "TEXTO DO EDITAL:\n{texto_edital}"
)

SUPPORTED_IA_PROVIDERS = {
    "openai": {
        "id": "openai",
        "vendor": "openai",
        "nome": "OpenAI",
        "descricao": "Boa opcao geral para extracao estruturada de itens com resposta em JSON.",
        "modelo_padrao": "gpt-4o",
        "api_key_env": "openai_api_key",
    },
    "anthropic": {
        "id": "anthropic",
        "vendor": "anthropic",
        "nome": "Anthropic",
        "descricao": "Alternativa com Claude para leitura cuidadosa de texto longo e saida estruturada.",
        "modelo_padrao": "claude-3-5-sonnet-latest",
        "api_key_env": "anthropic_api_key",
    },
    "gemini": {
        "id": "gemini",
        "vendor": "gemini",
        "nome": "Google Gemini",
        "descricao": "Opcao do Google com suporte a resposta JSON estruturada via API Gemini.",
        "modelo_padrao": "gemini-2.0-flash",
        "api_key_env": "gemini_api_key",
    },
}


def mask_api_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "***"
    return key[:8] + "..." + key[-4:]


def get_active_provider_id(db: Session) -> str:
    active_provider_id = _get_config_value(db, IA_ACTIVE_PROVIDER_KEY, "openai")
    if active_provider_id not in SUPPORTED_IA_PROVIDERS:
        return "openai"
    return active_provider_id


def list_ai_providers(db: Session, settings: Settings) -> tuple[str, list[dict[str, object]]]:
    active_provider_id = get_active_provider_id(db)
    providers = []

    for provider_id in SUPPORTED_IA_PROVIDERS:
        internal_config = get_ai_provider_internal_config(db, provider_id, settings)
        providers.append(
            {
                "id": internal_config["id"],
                "vendor": internal_config["vendor"],
                "nome": internal_config["nome"],
                "descricao": internal_config["descricao"],
                "modelo": internal_config["modelo"],
                "api_key_masked": mask_api_key(str(internal_config["api_key"])),
                "prompt_extracao": internal_config["prompt_extracao"],
                "ativo": provider_id == active_provider_id,
                "configurada": bool(internal_config["api_key"]),
            },
        )

    return active_provider_id, providers


def get_ai_provider_internal_config(db: Session, provider_id: str, settings: Settings) -> dict[str, str]:
    if provider_id not in SUPPORTED_IA_PROVIDERS:
        raise ValueError(f"IA nao suportada: {provider_id}")

    provider_meta = deepcopy(SUPPORTED_IA_PROVIDERS[provider_id])
    raw_payload = _get_config_value(db, _provider_key(provider_id), "")

    payload: dict[str, str]
    if raw_payload:
        try:
            parsed = json.loads(raw_payload)
            payload = parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            payload = {}
    else:
        payload = {}

    legacy_api_key = _get_legacy_api_key(db, provider_id)
    env_api_key = getattr(settings, provider_meta["api_key_env"], "")

    return {
        "id": provider_id,
        "vendor": str(provider_meta["vendor"]),
        "nome": str(provider_meta["nome"]),
        "descricao": str(provider_meta["descricao"]),
        "modelo": str(
            payload.get("modelo")
            or _get_legacy_modelo(db, provider_id)
            or provider_meta["modelo_padrao"]
        ),
        "api_key": str(payload.get("api_key") or legacy_api_key or env_api_key or ""),
        "prompt_extracao": str(
            payload.get("prompt_extracao")
            or _get_legacy_prompt(db, provider_id)
            or DEFAULT_PROMPT_EXTRACAO
        ),
    }


def save_ai_provider_config(
    db: Session,
    provider_id: str,
    settings: Settings,
    *,
    modelo: str | None = None,
    api_key: str | None = None,
    prompt_extracao: str | None = None,
) -> None:
    current = get_ai_provider_internal_config(db, provider_id, settings)

    payload = {
        "modelo": modelo if modelo is not None else current["modelo"],
        "api_key": api_key if api_key is not None else current["api_key"],
        "prompt_extracao": prompt_extracao if prompt_extracao is not None else current["prompt_extracao"],
    }

    _set_config_value(db, _provider_key(provider_id), json.dumps(payload, ensure_ascii=False))


def activate_ai_provider(db: Session, provider_id: str) -> None:
    if provider_id not in SUPPORTED_IA_PROVIDERS:
        raise ValueError(f"IA nao suportada: {provider_id}")

    _set_config_value(db, IA_ACTIVE_PROVIDER_KEY, provider_id)


def seed_ai_provider_defaults(existing_values: dict[str, str]) -> dict[str, str]:
    defaults: dict[str, str] = {}
    defaults.setdefault(IA_ACTIVE_PROVIDER_KEY, "openai")

    for provider_id, provider_meta in SUPPORTED_IA_PROVIDERS.items():
        legacy_api_key = existing_values.get("openai_api_key", "") if provider_id == "openai" else ""
        legacy_modelo = existing_values.get("openai_modelo", "") if provider_id == "openai" else ""
        legacy_prompt = existing_values.get("prompt_extracao", "") if provider_id == "openai" else ""

        payload = {
            "modelo": legacy_modelo or provider_meta["modelo_padrao"],
            "api_key": legacy_api_key,
            "prompt_extracao": legacy_prompt or DEFAULT_PROMPT_EXTRACAO,
        }
        defaults.setdefault(_provider_key(provider_id), json.dumps(payload, ensure_ascii=False))

    return defaults


def _provider_key(provider_id: str) -> str:
    return f"{IA_PROVIDER_KEY_PREFIX}{provider_id}"


def _get_config_value(db: Session, chave: str, default: str = "") -> str:
    row = db.scalar(select(ConfiguracaoModel).where(ConfiguracaoModel.chave == chave))
    return row.valor if row else default


def _set_config_value(db: Session, chave: str, valor: str) -> None:
    row = db.scalar(select(ConfiguracaoModel).where(ConfiguracaoModel.chave == chave))
    if row:
        row.valor = valor
    else:
        db.add(ConfiguracaoModel(chave=chave, valor=valor))


def _get_legacy_api_key(db: Session, provider_id: str) -> str:
    if provider_id == "openai":
        return _get_config_value(db, "openai_api_key", "")
    return ""


def _get_legacy_modelo(db: Session, provider_id: str) -> str:
    if provider_id == "openai":
        return _get_config_value(db, "openai_modelo", "")
    return ""


def _get_legacy_prompt(db: Session, provider_id: str) -> str:
    if provider_id == "openai":
        return _get_config_value(db, "prompt_extracao", "")
    return ""
