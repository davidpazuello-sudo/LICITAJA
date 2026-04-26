# Banco de Dados do LicitaAI

## Visao geral

O banco do MVP usa SQLite local e e inicializado automaticamente na subida do backend. O arquivo gerado fica em [`backend/licitai.db`](/C:/Users/david/Desktop/Projetos/LicitaJa/backend/licitai.db).

## Diagrama de entidades

```text
+-------------------+
| configuracoes     |
+-------------------+
| id                |
| chave             |
| valor             |
+-------------------+

+-------------------+       1:N       +-------------------+
| licitacoes        |---------------->| editais           |
+-------------------+                 +-------------------+
| id                |                 | id                |
| numero_controle   |                 | licitacao_id (FK) |
| numero_processo   |                 | arquivo_nome      |
| orgao             |                 | arquivo_path      |
| uasg              |                 | status_extracao   |
| objeto            |                 | erro_mensagem     |
| modalidade        |                 | created_at        |
| valor_estimado    |                 +-------------------+
| data_abertura     |
| estado            |       1:N       +-------------------+
| cidade            |---------------->| itens             |
| link_edital       |                 +-------------------+
| link_site         |                 | id                |
| observacoes       |                 | licitacao_id (FK) |
| status            |                 | edital_id (FK)    |
| fonte             |                 | numero_item       |
| dados_brutos      |                 | descricao         |
| created_at        |                 | quantidade        |
| updated_at        |                 | unidade           |
+-------------------+                 | especificacoes    |
                                      | status_pesquisa   |
                                      | preco_medio       |
                                      | created_at        |
                                      | updated_at        |
                                      +-------------------+
                                                 |
                                                 | 1:N
                                                 v
                                      +-------------------+
                                      | cotacoes          |
                                      +-------------------+
                                      | id                |
                                      | item_id (FK)      |
                                      | fornecedor_nome   |
                                      | preco_unitario    |
                                      | fonte_url         |
                                      | fonte_nome        |
                                      | data_cotacao      |
                                      | created_at        |
                                      +-------------------+
```

## Tabelas e funcoes

### `licitacoes`

Tabela principal do sistema. Guarda cada oportunidade salva pelo usuario em "Minhas Licitacoes", junto com os dados trazidos do PNCP e o estado atual da analise.

Colunas importantes:
- `numero_controle`: identificador unico da licitacao no sistema local.
- `objeto`: descricao resumida do que esta sendo contratado.
- `status`: etapa atual da licitacao dentro do fluxo do LicitaAI.
- `dados_brutos`: JSON serializado com a resposta original da fonte externa.
- `observacoes`: anotacoes livres do usuario.

### `editais`

Armazena os PDFs vinculados a uma licitacao.

Colunas importantes:
- `licitacao_id`: referencia a qual licitacao o edital pertence.
- `arquivo_path`: caminho local do PDF salvo em disco.
- `status_extracao`: acompanha o processamento do edital pela IA.
- `erro_mensagem`: registra falhas de leitura ou extracao.

### `itens`

Guarda os itens extraidos do edital e o estado da pesquisa de fornecedores.

Colunas importantes:
- `numero_item`: numero do item dentro do edital.
- `descricao`: descricao textual do item.
- `especificacoes`: JSON serializado com as exigencias tecnicas minimas.
- `status_pesquisa`: indica se o item ja foi pesquisado ou ainda esta pendente.
- `preco_medio`: media calculada a partir das cotacoes encontradas.

### `cotacoes`

Armazena as cotacoes encontradas para cada item.

Colunas importantes:
- `item_id`: referencia ao item pesquisado.
- `fornecedor_nome`: nome do fornecedor identificado.
- `preco_unitario`: preco unitario encontrado.
- `fonte_url`: link da origem da informacao.
- `fonte_nome`: nome amigavel da fonte pesquisada.

### `configuracoes`

Tabela chave-valor para preferencias locais do sistema.

Valores padrao inseridos na inicializacao:
- `openai_api_key`
- `anthropic_api_key`
- `gemini_api_key`
- `margem_minima`
- `regime_tributario`
- `estado_padrao`
- `ia_active_provider`
- `ia_provider_openai`
- `ia_provider_anthropic`
- `ia_provider_gemini`

Chaves importantes para IA:
- `ia_active_provider`: guarda qual provedor esta ativo no momento da extracao.
- `ia_provider_openai`: JSON com modelo, chave e prompt do card da OpenAI.
- `ia_provider_anthropic`: JSON com modelo, chave e prompt do card da Anthropic.
- `ia_provider_gemini`: JSON com modelo, chave e prompt do card do Gemini.

## Relacionamentos

- `licitacoes.id -> editais.licitacao_id`: uma licitacao pode ter varios editais.
- `licitacoes.id -> itens.licitacao_id`: uma licitacao pode ter varios itens.
- `editais.id -> itens.edital_id`: um item pode ser associado ao edital que o originou.
- `itens.id -> cotacoes.item_id`: um item pode ter varias cotacoes.

Regras de exclusao:
- excluir uma `licitacao` remove seus `editais` e `itens`
- excluir um `item` remove suas `cotacoes`

## Campos de status e significados

### `licitacoes.status`

- `nova`: licitacao salva, ainda sem analise.
- `em_analise`: edital enviado ou itens em avaliacao.
- `itens_extraidos`: itens ja extraidos do edital.
- `fornecedores_encontrados`: cotacoes encontradas para os itens.
- `concluida`: analise encerrada pelo usuario.

### `editais.status_extracao`

- `pendente`: edital registrado, aguardando processamento.
- `processando`: leitura ou extracao em andamento.
- `extraido`: extracao concluida com sucesso.
- `erro`: houve falha no processamento.

### `itens.status_pesquisa`

- `aguardando`: item ainda nao pesquisado.
- `pesquisando`: coleta de fornecedores em andamento.
- `encontrado`: preco medio calculado com cotacoes validas.
- `sem_preco`: busca concluida sem preco confiavel.
- `erro`: falha durante a pesquisa.

## Colunas de JSON serializado

- `licitacoes.dados_brutos`: resposta original do PNCP ou de outra fonte publica.
- `itens.especificacoes`: lista JSON de especificacoes minimas, por exemplo `["Gramatura 75g/m2", "Cor branca"]`.
- `configuracoes.ia_provider_*`: configuracao serializada de cada IA, incluindo treinamento da LLM por provedor.

No MVP esses campos ficam armazenados como `TEXT` no SQLite para manter simplicidade e portabilidade local.

## Inicializacao automatica

Na subida do FastAPI:
- o backend executa `create_all` do SQLAlchemy
- se o arquivo do banco nao existir, ele e criado automaticamente
- as configuracoes padrao sao inseridas apenas se ainda nao existirem

## Estrutura validada no Sprint 1

Tabelas encontradas no banco:
- `licitacoes`
- `editais`
- `itens`
- `cotacoes`
- `configuracoes`

Colunas validadas:
- `licitacoes`: `id, numero_controle, numero_processo, orgao, uasg, objeto, modalidade, valor_estimado, data_abertura, estado, cidade, link_edital, link_site, observacoes, status, fonte, dados_brutos, created_at, updated_at`
- `editais`: `id, licitacao_id, arquivo_nome, arquivo_path, status_extracao, erro_mensagem, created_at`
- `itens`: `id, licitacao_id, edital_id, numero_item, descricao, quantidade, unidade, especificacoes, status_pesquisa, preco_medio, created_at, updated_at`
- `cotacoes`: `id, item_id, fornecedor_nome, preco_unitario, fonte_url, fonte_nome, data_cotacao, created_at`
- `configuracoes`: `id, chave, valor`
