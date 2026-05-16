import json
from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.configuracao import ConfiguracaoModel

IA_ACTIVE_PROVIDER_KEY = "ia_active_provider"
IA_PROVIDER_KEY_PREFIX = "ia_provider_"
IA_AGENT_KEY_PREFIX = "ia_agent_"

DEFAULT_PROMPT_EXTRACAO = (
    "Voce e um especialista em licitacoes publicas brasileiras.\n"
    "Analise o texto do edital a seguir e extraia APENAS os itens da licitacao.\n"
    "Considere como item apenas produto, material, equipamento ou servico efetivamente contratado.\n"
    "NAO extraia declaracoes, exigencias de habilitacao, clausulas juridicas, documentos, anexos administrativos, criterios de julgamento, condicoes de pagamento, obrigacoes do licitante ou textos de minuta contratual.\n\n"
    "ATENCAO — NOME EXATO DOS CAMPOS (nao use outros nomes, nao use abreviacoes, nao use acentos nos nomes dos campos):\n"
    "- numero_item  (inteiro: numero sequencial do item)\n"
    "- descricao    (string: descricao completa e fiel do item)\n"
    "- quantidade   (numero ou null)\n"
    "- unidade      (string: ex: unidade, resma, caixa, frasco; ou null)\n"
    "- especificacoes (array de strings com especificacoes tecnicas exigidas; pode ser [])\n"
    "- marcas_fabricantes (array de strings com possiveis marcas ou fabricantes; pode ser [])\n\n"
    "EXEMPLO DE SAIDA ESPERADA:\n"
    "[\n"
    "  {\"numero_item\": 1, \"descricao\": \"Ventilador pulmonar eletronico...\", \"quantidade\": 5, \"unidade\": \"unidade\", \"especificacoes\": [\"modo CPAP\", \"alarme apneia\"], \"marcas_fabricantes\": []}\n"
    "]\n\n"
    "Retorne APENAS um array JSON valido, sem texto adicional, sem markdown, sem comentarios.\n"
    "Seja preciso e nao omita nenhum item do edital.\n\n"
    "TEXTO DO EDITAL:\n{texto_edital}"
)

DEFAULT_PROMPT_BUSCA = (
    "Voce e um agente de busca inteligente de licitacoes brasileiras.\n"
    "Interprete a necessidade do usuario, transforme em estrategia de busca objetiva e priorize oportunidades aderentes.\n"
    "Considere palavras-chave, contexto de uso, localidade, prazo e compatibilidade comercial.\n"
    "Responda de forma estruturada e sem inventar filtros que nao facam sentido."
)

DEFAULT_PROMPT_RESUMO = (
    "Voce e um analista de licitacoes publicas.\n"
    "Resuma cada licitacao com foco em objeto, escopo, risco, prazo e valor para decisao rapida.\n"
    "Seja claro, pragmatico e objetivo em portugues do Brasil."
)

DEFAULT_PROMPT_FORNECEDORES = (
    "Voce e um agente de mercado B2B para licitacoes.\n"
    "Analise itens e resultados web para encontrar fornecedores, fabricantes, distribuidores e representantes com maior aderencia.\n"
    "Priorize evidencias comerciais reais, localidade relevante e compatibilidade objetiva com o item."
)

DEFAULT_PROMPT_PROPOSTAS_ITEM = (
    "Voce e um agente especializado em extrair propostas cadastradas por item em licitacoes publicas brasileiras.\n"
    "Sua funcao e organizar, em estrutura tabular, os itens da licitacao e todas as propostas apresentadas por empresa em cada item.\n"
    "Considere apenas dados realmente presentes nas fontes fornecidas pelo sistema, como portal oficial, pagina da licitacao, documentos e tabelas de propostas.\n\n"
    "REGRA FUNDAMENTAL — NUNCA INVENTE DADOS\n"
    "Se uma informacao nao estiver explicitamente disponivel, retorne [NAO INFORMADO].\n"
    "Nunca estime, complete, infira CNPJ, nome da empresa, valor unitario, quantidade ou item vencedor sem evidencia explicita.\n\n"
    "ESTRUTURA ESPERADA\n"
    "Para cada item da licitacao, identifique e organize:\n"
    "- numero_item\n"
    "- descricao\n"
    "- descricao_detalhada\n"
    "- quantidade_solicitada\n"
    "- valor_estimado_unitario\n"
    "- propostas: lista com cnpj, nome_empresa e valor_unitario_ofertado\n\n"
    "REGRAS DE EXTRACAO\n"
    "- Preserve a descricao tecnica completa do item quando ela existir.\n"
    "- Colete todas as propostas visiveis do item, nao apenas a vencedora.\n"
    "- Se um item tiver menos propostas que outros itens, mantenha a lista real daquele item sem inventar linhas vazias.\n"
    "- Se houver conflito entre pagina principal, anexo e tabela do portal, priorize a fonte oficial mais detalhada e registre isso no campo de observacoes quando aplicavel.\n"
    "- Preserve acentuacao, numeros e formatacao relevante dos textos originais.\n\n"
    "PORTAIS SUPORTADOS NO CONTEXTO DO SISTEMA\n"
    "- Compras.gov.br\n"
    "- PNCP\n"
    "- Compras Manaus\n"
    "- e-Compras AM\n"
    "- Petronect\n"
    "- Licitanet\n\n"
    "FORMATO DE SAIDA\n"
    "Responda de forma estruturada, pronta para exportacao em planilha.\n"
    "Se o sistema solicitar JSON, responda APENAS com JSON valido.\n"
    "Se o sistema solicitar colunas, mantenha a ordem e os nomes definidos pelo fluxo chamador."
)

SUPPORTED_IA_PROVIDERS = {
    "openai": {
        "id": "openai",
        "vendor": "openai",
        "nome": "OpenAI",
        "descricao": "Modelos equilibrados para raciocinio, ranking, extracao estruturada e texto de alta qualidade.",
        "modelo_padrao": "gpt-4o",
        "api_key_env": "openai_api_key",
    },
    "anthropic": {
        "id": "anthropic",
        "vendor": "anthropic",
        "nome": "Anthropic",
        "descricao": "Claude e forte em leitura cuidadosa, instrucoes longas e analise com linguagem natural.",
        "modelo_padrao": "claude-3-5-sonnet-latest",
        "api_key_env": "anthropic_api_key",
    },
    "gemini": {
        "id": "gemini",
        "vendor": "gemini",
        "nome": "Google Gemini",
        "descricao": "Opcao do Google com bom custo-beneficio para classificacao, resumo e geracao estruturada.",
        "modelo_padrao": "gemini-2.0-flash-lite",
        "api_key_env": "gemini_api_key",
    },
    "deepseek": {
        "id": "deepseek",
        "vendor": "deepseek",
        "nome": "DeepSeek",
        "descricao": "Boa relacao custo x capacidade, com suporte util para respostas JSON e raciocinio.",
        "modelo_padrao": "deepseek-chat",
        "api_key_env": "deepseek_api_key",
    },
    "groq": {
        "id": "groq",
        "vendor": "groq",
        "nome": "Groq",
        "descricao": "Resposta muito rapida com modelos open-source fortes para fluxos operacionais do dia a dia.",
        "modelo_padrao": "llama-3.3-70b-versatile",
        "api_key_env": "groq_api_key",
    },
}

SUPPORTED_IA_AGENTS = {
    "busca_inteligente": {
        "id": "busca_inteligente",
        "nome": "Busca inteligente de oportunidades",
        "descricao": "Entende o que o usuario quer comprar ou vender, monta a estrategia de busca e reranqueia as licitacoes.",
        "provider_padrao": "groq",
        "modelo_padrao": "llama-3.3-70b-versatile",
        "prompt_padrao": DEFAULT_PROMPT_BUSCA,
    },
    "resumo_licitacao": {
        "id": "resumo_licitacao",
        "nome": "Resumo da licitacao",
        "descricao": "Lê a oportunidade e gera um resumo executivo claro para decisao rapida.",
        "provider_padrao": "groq",
        "modelo_padrao": "llama-3.3-70b-versatile",
        "prompt_padrao": DEFAULT_PROMPT_RESUMO,
    },
    "extracao_itens": {
        "id": "extracao_itens",
        "nome": "Extracao de itens do edital",
        "descricao": "Analisa o edital e extrai os itens contratados com quantidade, unidade e especificacoes.",
        "provider_padrao": "groq",
        "modelo_padrao": "llama-3.3-70b-versatile",
        "prompt_padrao": DEFAULT_PROMPT_EXTRACAO,
    },
    "fornecedores_item": {
        "id": "fornecedores_item",
        "nome": "Busca de fornecedores por item",
        "descricao": "Acha fornecedores e fabricantes relevantes para cada item, usando web e evidencias comerciais.",
        "provider_padrao": "groq",
        "modelo_padrao": "llama-3.3-70b-versatile",
        "prompt_padrao": DEFAULT_PROMPT_FORNECEDORES,
    },
    "propostas_item": {
        "id": "propostas_item",
        "nome": "Extracao de propostas por item",
        "descricao": "Organiza os itens da licitacao e todas as propostas cadastradas por empresa em cada item.",
        "provider_padrao": "groq",
        "modelo_padrao": "llama-3.3-70b-versatile",
        "prompt_padrao": DEFAULT_PROMPT_PROPOSTAS_ITEM,
    },
}


def mask_api_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "***"
    return key[:8] + "..." + key[-4:]


def get_active_provider_id(db: Session, agent_id: str = "extracao_itens") -> str:
    agent_config = get_ai_agent_internal_config(db, agent_id)
    provider_id = agent_config["provider_id"]
    if provider_id in SUPPORTED_IA_PROVIDERS:
        return provider_id

    active_provider_id = _get_config_value(db, IA_ACTIVE_PROVIDER_KEY, "openai")
    if active_provider_id not in SUPPORTED_IA_PROVIDERS:
        return "openai"
    return active_provider_id


def list_ai_providers(db: Session, settings: Settings) -> list[dict[str, object]]:
    providers = []
    for provider_id in SUPPORTED_IA_PROVIDERS:
        internal_config = get_ai_provider_internal_config(db, provider_id, settings)
        providers.append(
            {
                "id": internal_config["id"],
                "vendor": internal_config["vendor"],
                "nome": internal_config["nome"],
                "descricao": internal_config["descricao"],
                "modelo_padrao": internal_config["modelo"],
                "api_key_masked": mask_api_key(str(internal_config["api_key"])),
                "configurada": bool(internal_config["api_key"]),
            },
        )
    return providers


def list_ai_agents(db: Session) -> list[dict[str, object]]:
    agents = []
    for agent_id, meta in SUPPORTED_IA_AGENTS.items():
        internal = get_ai_agent_internal_config(db, agent_id)
        agents.append(
            {
                "id": agent_id,
                "nome": meta["nome"],
                "descricao": meta["descricao"],
                "provider_id": internal["provider_id"],
                "modelo": internal["modelo"],
                "prompt": internal["prompt"],
            }
        )
    return agents


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
        "modelo": str(payload.get("modelo") or _get_legacy_modelo(db, provider_id) or provider_meta["modelo_padrao"]),
        "api_key": str(payload.get("api_key") or legacy_api_key or env_api_key or ""),
    }


def get_ai_agent_internal_config(db: Session, agent_id: str) -> dict[str, str]:
    if agent_id not in SUPPORTED_IA_AGENTS:
        raise ValueError(f"Agente de IA nao suportado: {agent_id}")

    agent_meta = deepcopy(SUPPORTED_IA_AGENTS[agent_id])
    raw_payload = _get_config_value(db, _agent_key(agent_id), "")
    payload: dict[str, str]
    if raw_payload:
        try:
            parsed = json.loads(raw_payload)
            payload = parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            payload = {}
    else:
        payload = {}

    return {
        "id": agent_id,
        "nome": str(agent_meta["nome"]),
        "descricao": str(agent_meta["descricao"]),
        "provider_id": str(payload.get("provider_id") or agent_meta["provider_padrao"]),
        "modelo": str(payload.get("modelo") or agent_meta["modelo_padrao"]),
        "prompt": str(payload.get("prompt") or agent_meta["prompt_padrao"]),
    }


def resolve_ai_agent_runtime_config(db: Session, agent_id: str, settings: Settings) -> tuple[str, dict[str, str]]:
    agent_config = get_ai_agent_internal_config(db, agent_id)
    requested_provider_id = agent_config["provider_id"]
    provider_id, provider = _resolve_best_provider_for_agent(db, settings, requested_provider_id)
    if provider_id == requested_provider_id:
        provider["modelo"] = agent_config["modelo"] or provider["modelo"]
    provider["prompt_extracao"] = agent_config["prompt"]
    provider["agent_id"] = agent_id
    provider["agent_nome"] = agent_config["nome"]
    return provider_id, provider


def save_ai_provider_config(
    db: Session,
    provider_id: str,
    settings: Settings,
    *,
    modelo: str | None = None,
    api_key: str | None = None,
) -> None:
    current = get_ai_provider_internal_config(db, provider_id, settings)
    payload = {
        "modelo": modelo if modelo is not None else current["modelo"],
        "api_key": api_key if api_key is not None else current["api_key"],
    }
    _set_config_value(db, _provider_key(provider_id), json.dumps(payload, ensure_ascii=False))


def save_ai_agent_config(
    db: Session,
    agent_id: str,
    *,
    provider_id: str | None = None,
    modelo: str | None = None,
    prompt: str | None = None,
) -> None:
    current = get_ai_agent_internal_config(db, agent_id)
    next_provider_id = provider_id if provider_id is not None else current["provider_id"]
    if next_provider_id not in SUPPORTED_IA_PROVIDERS:
        raise ValueError(f"IA nao suportada: {next_provider_id}")

    payload = {
        "provider_id": next_provider_id,
        "modelo": modelo if modelo is not None else current["modelo"],
        "prompt": prompt if prompt is not None else current["prompt"],
    }
    _set_config_value(db, _agent_key(agent_id), json.dumps(payload, ensure_ascii=False))


def activate_ai_provider(db: Session, provider_id: str) -> None:
    if provider_id not in SUPPORTED_IA_PROVIDERS:
        raise ValueError(f"IA nao suportada: {provider_id}")
    _set_config_value(db, IA_ACTIVE_PROVIDER_KEY, provider_id)


def seed_ai_provider_defaults(existing_values: dict[str, str]) -> dict[str, str]:
    defaults: dict[str, str] = {}
    defaults.setdefault(IA_ACTIVE_PROVIDER_KEY, "groq")

    for provider_id, provider_meta in SUPPORTED_IA_PROVIDERS.items():
        legacy_api_key = existing_values.get("openai_api_key", "") if provider_id == "openai" else ""
        legacy_modelo = existing_values.get("openai_modelo", "") if provider_id == "openai" else ""
        payload = {
            "modelo": legacy_modelo or provider_meta["modelo_padrao"],
            "api_key": legacy_api_key,
        }
        defaults.setdefault(_provider_key(provider_id), json.dumps(payload, ensure_ascii=False))

    for agent_id, agent_meta in SUPPORTED_IA_AGENTS.items():
        payload = {
            "provider_id": agent_meta["provider_padrao"],
            "modelo": agent_meta["modelo_padrao"],
            "prompt": agent_meta["prompt_padrao"],
        }
        if agent_id == "extracao_itens":
            payload["prompt"] = existing_values.get("prompt_extracao", "") or agent_meta["prompt_padrao"]
        defaults.setdefault(_agent_key(agent_id), json.dumps(payload, ensure_ascii=False))

    return defaults


def _resolve_best_provider_for_agent(
    db: Session,
    settings: Settings,
    requested_provider_id: str,
) -> tuple[str, dict[str, str]]:
    candidate_ids: list[str] = []

    if requested_provider_id in SUPPORTED_IA_PROVIDERS:
        candidate_ids.append(requested_provider_id)

    active_provider_id = _get_config_value(db, IA_ACTIVE_PROVIDER_KEY, "groq")
    if active_provider_id in SUPPORTED_IA_PROVIDERS and active_provider_id not in candidate_ids:
        candidate_ids.append(active_provider_id)

    for provider_id in SUPPORTED_IA_PROVIDERS:
        if provider_id not in candidate_ids:
            candidate_ids.append(provider_id)

    first_provider: tuple[str, dict[str, str]] | None = None
    for provider_id in candidate_ids:
        provider = get_ai_provider_internal_config(db, provider_id, settings)
        if first_provider is None:
            first_provider = (provider_id, provider)
        if provider["api_key"]:
            return provider_id, provider

    if first_provider is not None:
        return first_provider

    fallback_provider_id = requested_provider_id if requested_provider_id in SUPPORTED_IA_PROVIDERS else "groq"
    return fallback_provider_id, get_ai_provider_internal_config(db, fallback_provider_id, settings)


def _provider_key(provider_id: str) -> str:
    return f"{IA_PROVIDER_KEY_PREFIX}{provider_id}"


def _agent_key(agent_id: str) -> str:
    return f"{IA_AGENT_KEY_PREFIX}{agent_id}"


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
