# Fluxo do Usuario

## Visao geral

O LicitaAI e uma aplicacao local para uso individual. O usuario percorre um fluxo direto: buscar oportunidades, salvar o que interessa, abrir o perfil, enviar o edital, escolher a IA ativa, extrair os itens e depois seguir para a pesquisa de fornecedores.

## Fluxo principal

1. Buscar licitacoes
   O usuario acessa a tela "Buscar Licitacoes", informa uma palavra-chave e pode complementar com filtros como orgao, estado e modalidade.
2. Salvar uma oportunidade
   Ao encontrar uma licitacao relevante, o usuario clica em salvar. Essa oportunidade passa a aparecer em "Minhas Licitacoes".
3. Acompanhar a lista salva
   Na tela "Minhas Licitacoes", o usuario consulta o conjunto salvo, filtra por status e localiza rapidamente uma oportunidade por texto.
4. Abrir o perfil
   Ao entrar em uma licitacao, o usuario visualiza os dados gerais, links externos e o campo de observacoes com salvamento automatico.
5. Escolher a IA ativa
   Na tela "Configuracoes", o usuario pode configurar varias IAs suportadas, mas apenas uma fica ativa por vez. O treinamento da LLM e editado dentro do card de cada IA.
6. Enviar o edital
   Na aba "Itens", o usuario envia um PDF do edital. O arquivo e salvo localmente e registrado na tabela `editais`.
7. Extrair os itens com IA
   Com o PDF enviado, o backend le o texto com `pdfplumber`, usa a IA ativa e persiste os itens extraidos.
8. Revisar os itens
   Depois da extracao, a interface mostra um resumo da licitacao e cards expansivos para revisar descricao, quantidade, unidade e especificacoes minimas de cada item.
9. Pesquisar fornecedores e precos
   Com os itens extraidos, o usuario clica em "Pesquisar fornecedores e precos" por item ou em "Pesquisar todos os itens" para buscar em lote.

## Estados das paginas

### Buscar Licitacoes

- vazio: nenhum resultado antes da primeira busca ou quando nada foi encontrado
- carregando: spinner durante a consulta ao PNCP
- com dados: cards com informacoes resumidas e acao de salvar
- erro: mensagem amigavel quando o PNCP estiver indisponivel ou a integracao falhar

### Minhas Licitacoes

- vazio: nenhuma licitacao salva no banco local
- carregando: consulta inicial das licitacoes
- com dados: cards com status, prazo e acesso ao perfil
- erro: falha de comunicacao com a API local

### Configuracoes de IA

- carregando: busca inicial do catalogo de IAs
- com dados: cards por provedor, com ativacao exclusiva e treinamento proprio
- salvando: feedback por card quando modelo, chave ou prompt sao persistidos
- erro: falha de comunicacao com a API local

### Perfil da Licitacao - Itens

- vazio inicial: nenhum edital enviado e nenhum item extraido
- pronto para extrair: edital enviado, botao de extracao habilitado
- carregando extracao: feedback visual enquanto a IA ativa processa o edital
- com dados: resumo dos itens e cards colapsados por padrao
- erro: mensagem amigavel em caso de PDF ilegivel, PDF sem texto, falta de chave da IA ativa ou falha da IA

## Regras de negocio

- A licitacao entra no sistema com status `nova`.
- Quando a extracao e iniciada, a licitacao muda para `em_analise`.
- Quando a extracao termina com sucesso, a licitacao muda para `itens_extraidos`.
- Apenas uma IA pode estar ativa por vez.
- O prompt de treinamento pertence a cada IA e nao a pagina de configuracoes como um todo.
- O backend sempre usa a IA ativa no momento da extracao.
- Se a IA ativa nao tiver chave configurada, a extracao falha com mensagem clara.

## Comportamento esperado da IA

- Ler o texto bruto extraido do PDF.
- Identificar todos os itens descritos no edital.
- Retornar, para cada item:
  - `numero_item`
  - `descricao`
  - `quantidade`
  - `unidade`
  - `especificacoes`
- Responder em JSON estruturado sem texto extra fora do formato esperado.
- Respeitar o treinamento configurado dentro do card da IA ativa.
- Falhar de forma conservadora quando o PDF nao tiver texto suficiente, em vez de inventar itens.
