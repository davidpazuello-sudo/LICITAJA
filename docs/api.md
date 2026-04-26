# API do LicitaAI

## Visao geral

- Base URL local: `http://127.0.0.1:8000`
- Prefixo das rotas: `/api`
- Formato principal: `application/json`
- Autenticacao: nao ha autenticacao no MVP local

## Rotas disponiveis

### `GET /api/health`

Verifica se o backend esta ativo.

### `GET /api/busca/licitacoes`

Consulta licitacoes no PNCP e devolve resultados adaptados para a interface do LicitaAI.

#### Query params principais

- `buscar_por`: busca global por objeto, descricao, familia, numero, empresa e outros campos textuais
- `numero_oportunidade`: busca parcial ou exata pelo numero da oportunidade
- `objeto_licitacao`: texto livre focado no objeto da licitacao
- `orgao`: nome do orgao responsavel
- `empresa`: refinamento textual por empresa ou entidade
- `sub_status`: filtro textual por status operacional
- `estado`: UF
- `modalidade`: modalidade da contratacao
- `tipo_fornecimento`: lista separada por virgula, ex. `bens,servicos`
- `familia_fornecimento`: lista separada por virgula com ids da arvore de familias
- `data_inicio` e `data_fim`: intervalo do periodo pesquisado

### `POST /api/licitacoes`

Salva uma licitacao em "Minhas Licitacoes". Se o `numero_controle` ja existir, a API reaproveita o registro salvo.

### `GET /api/licitacoes`

Lista as licitacoes salvas, com filtros por `status` e `q`.

### `GET /api/licitacoes/{id}`

Retorna o perfil completo da licitacao, incluindo itens e editais.

### `PATCH /api/licitacoes/{id}`

Atualiza campos editaveis da licitacao, como `observacoes` e `status`.

### `DELETE /api/licitacoes/{id}`

Remove a licitacao salva do banco local.

### `POST /api/licitacoes/{id}/editais`

Faz upload do edital em PDF, salva o arquivo em disco e registra esse envio na tabela `editais`.

### `GET /api/licitacoes/{id}/itens`

Lista os itens da licitacao salva.

### `POST /api/licitacoes/{id}/itens/extrair`

Executa a extracao de itens do ultimo edital enviado usando a IA ativa no momento.

### `GET /api/itens/{id}`

Retorna o detalhe completo de um item, incluindo as cotacoes registradas.

### `POST /api/itens/{id}/pesquisar`

Pesquisa fornecedores e precos para um item.

### `POST /api/licitacoes/{id}/itens/pesquisar-todos`

Executa a pesquisa de fornecedores e precos para todos os itens da licitacao.

### `GET /api/configuracoes/pncp`

Retorna a configuracao atual da integracao com o PNCP.

### `PATCH /api/configuracoes/pncp`

Atualiza a URL base usada na integracao com o PNCP.

### `POST /api/configuracoes/pncp/testar`

Executa uma chamada curta ao PNCP para validar conectividade.

### `GET /api/configuracoes/ia`

Retorna o catalogo de IAs suportadas, incluindo qual esta ativa, qual modelo cada uma usa, se a chave esta configurada e o prompt de treinamento do respectivo card.

#### Exemplo de response

```json
{
  "provider_ativo": "openai",
  "providers": [
    {
      "id": "openai",
      "vendor": "openai",
      "nome": "OpenAI",
      "descricao": "Boa opcao geral para extracao estruturada de itens com resposta em JSON.",
      "modelo": "gpt-4o",
      "api_key_masked": "sk-proj-...abcd",
      "prompt_extracao": "Voce e um especialista...",
      "ativo": true,
      "configurada": true
    }
  ]
}
```

### `PATCH /api/configuracoes/ia/{provider_id}`

Atualiza os dados da IA informada. Cada provedor tem sua propria chave, seu proprio modelo e seu proprio prompt de treinamento.

#### Exemplo de body

```json
{
  "modelo": "claude-3-5-sonnet-latest",
  "api_key": "sk-ant-...",
  "prompt_extracao": "Voce e um especialista em licitacoes..."
}
```

### `POST /api/configuracoes/ia/{provider_id}/ativar`

Ativa a IA informada e desativa logicamente as demais. Sempre existe apenas uma IA ativa por vez.

## Codigos de erro

- `400 Bad Request`: parametro invalido, falta de edital, PDF ilegivel ou falha controlada da consulta externa
- `404 Not Found`: licitacao, item ou IA nao encontrada
- `422 Unprocessable Entity`: payload ou query string invalida
- `500 Internal Server Error`: falha inesperada no backend local

## Observacoes de integracao

- A busca de licitacoes usa o PNCP como fonte oficial.
- A extracao de itens usa `pdfplumber` para leitura do PDF.
- A IA usada na extracao depende do provedor ativo em `Configuracoes`.
- OpenAI, Anthropic e Gemini sao os provedores suportados atualmente.
- Como as fontes externas podem oscilar, o backend retorna mensagens claras em vez de quebrar a interface.
