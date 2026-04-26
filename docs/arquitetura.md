# Arquitetura do LicitaAI

## Visao geral

O LicitaAI e uma aplicacao web local e privada para uso individual. O sistema ajuda a decidir se uma licitacao vale a pena, reunindo busca, salvamento, extracao de itens com IA e pesquisa de referencias de preco.

## Diagrama de alto nivel

```text
+-------------------+       HTTP        +-------------------+
| Frontend React    | <---------------> | Backend FastAPI   |
| Vite + Tailwind   |                   | API REST          |
+-------------------+                   +-------------------+
                                                   |
                                                   v
                                        +-------------------+
                                        | SQLite            |
                                        | Dados locais MVP  |
                                        +-------------------+
                                                   |
                                                   v
                              +-------------------------------------------+
                              | Servicos externos                         |
                              | PNCP API | IA ativa | fontes publicas     |
                              +-------------------------------------------+
```

## Stack e justificativas

- React 18 + TypeScript: interface rica com tipagem para reduzir regressao.
- Vite: desenvolvimento local rapido e simples.
- Tailwind CSS: velocidade de iteracao visual com padrao consistente.
- FastAPI: API tipada, async e facil de manter.
- SQLite: banco local simples para o MVP individual.
- SQLAlchemy: ORM para evolucao do schema sem SQL manual a cada ajuste.
- httpx: cliente HTTP async para integrar PNCP, Anthropic e Gemini.
- pdfplumber: extracao de texto de editais em PDF.
- OpenAI / Anthropic / Gemini: provedores suportados para extracao estruturada, com uma IA ativa por vez.

## Como rodar localmente

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm.cmd run dev
```

## Variaveis de ambiente

| Variavel | Descricao | Exemplo |
|---|---|---|
| `APP_NAME` | Nome exibido pela API | `LicitaAI` |
| `ENVIRONMENT` | Ambiente local | `development` |
| `API_PREFIX` | Prefixo das rotas | `/api` |
| `FRONTEND_ORIGIN` | Origem liberada no CORS | `http://localhost:5173` |
| `DATABASE_URL` | URL do SQLite | `sqlite:///./licitai.db` |
| `OPENAI_API_KEY` | Chave fallback da OpenAI | `sk-...` |
| `ANTHROPIC_API_KEY` | Chave fallback da Anthropic | `sk-ant-...` |
| `GEMINI_API_KEY` | Chave fallback do Gemini | `AIza...` |
| `PNCP_BASE_URL` | URL base da API PNCP | `https://pncp.gov.br/api/consulta/v1` |
| `UPLOADS_DIR` | Diretorio de uploads | `uploads` |

## Observacoes de arquitetura

- A tela de configuracoes mantem um catalogo de IAs suportadas.
- Apenas uma IA fica ativa por vez para a extracao de itens.
- Cada IA guarda seu proprio modelo, sua propria chave e seu proprio prompt de treinamento.
- O backend usa a IA ativa no momento da extracao e falha com mensagem clara quando a chave daquela IA nao estiver configurada.
