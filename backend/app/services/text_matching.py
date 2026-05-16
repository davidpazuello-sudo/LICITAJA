from __future__ import annotations

import unicodedata

TERM_ALIASES = {
    "alimentacao": [
        "alimentacao",
        "alimento",
        "alimentos",
        "alimenticio",
        "alimenticios",
        "generos alimenticios",
        "merenda",
        "refeicao",
        "refeicoes",
        "nutricao",
        "nutricional",
    ],
    "alimentos": [
        "alimentos",
        "alimento",
        "alimentacao",
        "alimenticio",
        "alimenticios",
        "generos alimenticios",
    ],
    "alimenticios": [
        "alimenticios",
        "alimenticio",
        "alimentacao",
        "alimentos",
        "generos alimenticios",
    ],
    "hospitalar": [
        "hospitalar",
        "hospitalares",
        "saude",
        "clinico",
        "clinicos",
        "medico",
        "medicos",
        "ambulatorial",
        "laboratorial",
    ],
    "informatica": [
        "informatica",
        "tecnologia",
        "ti",
        "software",
        "hardware",
        "notebook",
        "computador",
        "servidor",
        "rede",
    ],
    "limpeza": [
        "limpeza",
        "higienizacao",
        "saneante",
        "saneantes",
        "asseio",
        "zeladoria",
        "limpeza urbana",
        "capina",
        "varrição",
        "varricao",
    ],
    # --- novos grupos ---
    "manutencao": [
        "manutencao",
        "manutenção",
        "conservacao",
        "conservação",
        "reparo",
        "reparos",
        "assistencia tecnica",
        "assistência técnica",
        "reforma",
        "reformas",
        "restauracao",
        "restauração",
    ],
    "seguranca": [
        "seguranca",
        "segurança",
        "vigilancia",
        "vigilância",
        "monitoramento",
        "ronda",
        "portaria",
        "controle de acesso",
        "guarda",
    ],
    "transporte": [
        "transporte",
        "frete",
        "logistica",
        "logística",
        "distribuicao",
        "distribuição",
        "coleta",
        "entrega",
        "remocao",
        "remoção",
        "mudanca",
        "mudança",
    ],
    "construcao": [
        "construcao",
        "construção",
        "obra",
        "obras",
        "edificacao",
        "edificação",
        "engenharia",
        "pavimentacao",
        "pavimentação",
        "saneamento",
        "infraestrutura",
    ],
    "veiculos": [
        "veiculo",
        "veículo",
        "veiculos",
        "veículos",
        "carro",
        "carros",
        "onibus",
        "ônibus",
        "caminhao",
        "caminhão",
        "frota",
        "ambulancia",
        "ambulância",
        "locacao de veiculo",
        "locação de veículo",
    ],
    "combustivel": [
        "combustivel",
        "combustível",
        "combustiveis",
        "combustíveis",
        "gasolina",
        "diesel",
        "etanol",
        "alcool",
        "álcool",
        "abastecimento",
    ],
    "mobiliario": [
        "mobiliario",
        "mobiliário",
        "movel",
        "móvel",
        "moveis",
        "móveis",
        "cadeira",
        "mesa",
        "armario",
        "armário",
        "estante",
        "bancada",
        "gaveteiro",
    ],
    "papelaria": [
        "papelaria",
        "papel",
        "resma",
        "caneta",
        "lapis",
        "lápis",
        "toner",
        "cartucho",
        "copiadora",
        "impressora",
        "material de escritorio",
        "material de expediente",
    ],
    "uniforme": [
        "uniforme",
        "uniformes",
        "fardamento",
        "vestuario",
        "vestuário",
        "roupa",
        "roupas",
        "epi",
        "equipamento de protecao individual",
        "calçado",
        "calcado",
        "bota",
        "capacete",
    ],
    "saude": [
        "saude",
        "saúde",
        "medicamento",
        "medicamentos",
        "farmacia",
        "farmácia",
        "insumo hospitalar",
        "material medico",
        "material médico",
        "equipamento medico",
        "equipamento médico",
        "laboratorial",
        "clinico",
        "clínico",
    ],
}


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char)).lower()


def contains_all_terms(values: list[str | None | object], query: str) -> bool:
    haystack = normalize_text(" ".join(str(value or "") for value in values))
    term_groups = _query_term_groups(query)
    return all(any(alias in haystack for alias in group) for group in term_groups)


def contains_any_term(values: list[str | None | object], query: str) -> bool:
    haystack = normalize_text(" ".join(str(value or "") for value in values))
    term_groups = _query_term_groups(query)
    return any(any(alias in haystack for alias in group) for group in term_groups)


def _query_term_groups(query: str) -> list[list[str]]:
    terms = [term for term in normalize_text(query).split() if term]
    groups: list[list[str]] = []
    for term in terms:
        aliases = TERM_ALIASES.get(term)
        if aliases:
            groups.append([normalize_text(alias) for alias in aliases])
        else:
            groups.append([term])
    return groups
