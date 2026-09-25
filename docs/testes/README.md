# Teste ponta a ponta dos endpoints (API real + MySQL)

| Arquivo | O que tem |
|---------|-----------|
| [TABELA_ENDPOINTS_POR_RF.md](TABELA_ENDPOINTS_POR_RF.md) / `.xlsx` | Uma linha por passo: **RF (Trello), CA, endpoint, passo, usuário, status HTTP, salvou em qual banco, exibiu no frontend (GET buscou do banco)** |
| `tabela.json` | Os mesmos dados em JSON |
| [COBERTURA_E2E.md](COBERTURA_E2E.md) | Cobertura de código do backend medida pelo JaCoCo durante o teste |
| `exemplos/` | Alguns cartões de evidência (o pacote completo, com até 5 fotos por endpoint, é entregue à parte em zip) |

## Resultado

- **452 passos, 452 com o status esperado, 368 endpoints distintos** — todos os endpoints do inventário do backend.
- Usuários: uma conta nova criada pelo próprio teste (cadastro → verificação de e-mail → login) e as contas de
  demonstração (admin, marca Atelier Lume, celebridade Luna Vega e perfis pessoais).
- Passos de regra de negócio esperam 4xx e isso aparece na tabela (ex.: `409 LIMITE_DESAFIOS`, `403 ACESSO_NEGADO`,
  `400 MATERIAL_INVALIDO`). Nenhum passo terminou com um status diferente do esperado.

## Como cada coluna é obtida

1. **Status**: código HTTP devolvido pela API.
2. **Salvou em qual banco?**: o MySQL roda com `general_log` em tabela; para cada chamada, o teste lê os comandos
   `INSERT/UPDATE/DELETE` executados pelo usuário `fashionai` (a aplicação) entre o início e o fim da chamada.
   Arquivos novos no storage de mídia também são listados.
3. **Exibiu no frontend?**: para GET, as telas do Next.js que chamam o endpoint (varredura do código do frontend) e as
   tabelas que o GET leu; para escritas, o GET com tela que relê a tabela gravada (ex.: `POST /api/pieces` → relido por
   `GET /api/pieces/{id}` e `GET /api/me/closet`).
4. Neste ambiente Redis, Cassandra e OpenSearch estão desligados (`*_ENABLED=false`): contadores, timeline e busca caem
   no MySQL; a mídia fica no disco local (S3 em produção). Não há chave de IA: toda capacidade de IA usou o motor local
   e isso ficou registrado em `ai_inference_log`.

## Cartões de evidência (até 5 fotos por endpoint)

Cada cartão mostra, para um passo: **1** a requisição (corpo; senhas e tokens mascarados), **2** a resposta, **3** o SQL
de escrita que a API executou no MySQL (INSERT como pares coluna = valor, sem as colunas nulas; UPDATE com SET/WHERE),
**4** as imagens gravadas no storage e **5** a tela que exibe o dado. Nos endpoints de criação, telas reais do app
completam os cartões (peça no closet, look criado, desafio, compra na loja, cupons…).

## Bugs encontrados e corrigidos pelo teste

| Onde | Problema | Correção |
|------|----------|----------|
| `POST /api/schemes` | 500: sugestão de selo dentro da mesma transação marcava rollback | sugestão roda depois do commit |
| Look do dia | exceção de regra marcava rollback | `noRollbackFor = ApiException` |
| Copiloto / Modelo 3D | cálculo auxiliar derrubava a transação principal | transações isoladas (`REQUIRES_NEW`) |
| Background Studio | todo prompt era recusado (validação via prompt aumentado) | valida só o texto do usuário |
| Provador 2D | NPE com imagens padrão | lê o arquivo padrão; peça sem recorte vira aviso |
| Desafios (RF32) | 409 ao aceitar: `created_at` nulo por `merge` de entidade com id atribuído | entidades implementam `Persistable` |
| Minhas Fotos (RF12) | 409 ao excluir a foto que era a imagem da peça (`image_url` obrigatório) | a peça volta para a imagem padrão |

## Reproduzir

Scripts em `scripts/e2e/` (ver o README de lá).
