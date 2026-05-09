# LicitaAI

Aplicacao web local para analisar oportunidades em licitacoes publicas brasileiras.

Busque editais no PNCP, salve os que interessam, extraia itens com a IA ativa e pesquise precos de fornecedores - tudo rodando localmente, sem dados saindo da sua maquina, exceto chamadas ao PNCP e ao provedor de IA configurado.

## Stack

- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Backend: FastAPI (Python 3.11+)
- Banco de dados: SQLite local ou Postgres para web/producao
- IA: OpenAI, Anthropic ou Gemini, com uma ativa por vez

## Pre-requisitos

- Node.js 20+
- Python 3.11+
- Chave de API de pelo menos uma IA suportada

## Setup - Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env   # macOS / Linux
```

Edite `backend/.env` e preencha as chaves que quiser manter como fallback:

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```

Inicie o servidor:

```bash
python -m uvicorn app.main:app --reload
```

API disponivel em: `http://127.0.0.1:8000`
Health check: `http://127.0.0.1:8000/api/health`

## Setup - Frontend

```bash
cd frontend
npm install
npm.cmd run dev
```

Interface disponivel em: `http://127.0.0.1:5173`

## Variaveis de ambiente

Todas as variaveis ficam em `backend/.env`. As principais:

| Variavel | Descricao | Padrao |
|---|---|---|
| `OPENAI_API_KEY` | Chave fallback da OpenAI | vazio |
| `ANTHROPIC_API_KEY` | Chave fallback da Anthropic | vazio |
| `GEMINI_API_KEY` | Chave fallback do Gemini | vazio |
| `DATABASE_URL` | Caminho do banco SQLite | `sqlite:///./licitai.db` |
| `PNCP_BASE_URL` | URL base da API do PNCP | valor oficial |
| `FRONTEND_ORIGIN` | Origem permitida pelo CORS | `http://localhost:5173` |

## Banco e migracoes

O projeto agora suporta dois modos de banco:

- desenvolvimento local rapido com SQLite
- producao com Postgres

Exemplo local:

```env
DATABASE_URL=sqlite:///./licitai.db
```

Exemplo producao:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/licitai
```

As migracoes ficam em [`backend/alembic`](backend/alembic) e usam `alembic`.

Comandos uteis:

```bash
cd backend

# aplicar migracoes
python -m alembic upgrade head

# criar nova migracao
python -m alembic revision -m "descricao_da_mudanca"
```

Observacoes:

- o projeto ainda inicializa tabelas automaticamente no startup como protecao para ambiente vazio
- para web/producao, o fluxo recomendado e aplicar `alembic upgrade head` antes de subir a API

## Preparacao para Web

O backend ja foi preparado para a primeira etapa da migracao para web:

- suporte a `Postgres`
- base de migracoes com `Alembic`
- configuracoes de `CORS` por lista de origens
- configuracoes iniciais para `storage` externo
- camada de storage compativel com disco local ou bucket `S3/R2`

Variaveis novas para storage:

```env
STORAGE_BACKEND=local
STORAGE_BUCKET=
STORAGE_REGION=
STORAGE_ENDPOINT_URL=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_BASE_URL=
STORAGE_PREFIX=licitai
```

Nesta fase, o sistema ja salva e le editais pela camada de storage:

- `STORAGE_BACKEND=local` continua usando disco local
- `STORAGE_BACKEND=s3` permite usar bucket compativel com `S3/R2`

O campo `arquivo_path` dos editais agora deve ser tratado como referencia de storage, nao necessariamente como caminho fisico local.

### Migrar editais antigos para o storage novo

Depois de configurar `STORAGE_BACKEND=s3` e as credenciais do bucket, voce pode migrar os editais que hoje ainda estao no disco local:

```bash
cd backend

# simular sem alterar nada
python scripts/migrate_editais_to_storage.py --dry-run

# migrar de fato
python scripts/migrate_editais_to_storage.py
```

Durante a migracao:

- editais que ja estiverem em `storage://...` sao ignorados
- editais sem arquivo local valido sao reportados como falha
- o banco passa a guardar a nova referencia remota em `arquivo_path`

## Funcionalidades do MVP

1. **Buscar licitacoes** - consulta o PNCP por palavra-chave, orgao, estado e modalidade
2. **Minhas licitacoes** - lista salva localmente com filtros por status e busca textual
3. **Perfil da licitacao** - dados gerais, observacoes com auto-save e aba de itens
4. **Configuracoes de IA** - varias IAs disponiveis, mas apenas uma ativa por vez, com treinamento proprio por card
5. **Extracao de itens** - upload do edital em PDF e extracao automatica usando a IA ativa
6. **Pesquisa de fornecedores** - busca precos em bases publicas e calcula preco medio por item

## Documentacao tecnica

- [Arquitetura](docs/arquitetura.md)
- [Banco de dados](docs/banco-de-dados.md)
- [API](docs/api.md)
- [Fluxo do usuario](docs/fluxo-usuario.md)
