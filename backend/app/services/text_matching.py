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
