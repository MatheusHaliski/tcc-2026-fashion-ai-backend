# Fashion AI - Entidades, RF e Bancos

Status: esqueleto inicial implementado no backend Java.

Fontes usadas: `01-bootstrap-repo-java.md`, documentos de anatomia dos cards RF5/RF6/RF13, especificacao social antiga apenas como referencia de modelo, `db/schema.sql` antigo apenas como referencia, Trello JSON exportado, pacote `fashionai-diagramas-completo (10)-TOPrompt.zip`, RF24 xlsx/markdown, RF4/RF18 pipelines, taxonomias oficiais e PDF de subcategorias.

Fonte explicitamente descartada: `ENTIDADES_RF4_RF5_DIAGRAMA_CLASSES.md`. Ela nao deve ser usada como fonte de verdade de entidades.

## Regras aplicadas no codigo

| Regra | Implementacao inicial |
|---|---|
| MySQL como fonte da verdade | Entidades JPA e Flyway `V1__baseline.sql` em `persistence-mysql`. |
| Cassandra para timeline e notificacoes | Porta de projecao criada; Cassandra fica como leitura/entrega, nao como verdade transacional. |
| Redis para contadores e rate limit | Porta e adaptador Redis criados para contadores/limites. |
| OpenSearch para busca | Porta e adaptador criados para indexar documentos pesquisaveis. |
| S3/MinIO para midia | Porta e adaptador criados; metadados ficam no MySQL. |
| Sem relacionamento EAGER | Entidades usam `FetchType.LAZY` onde ha associacao. |
| Colecoes paginadas | Nao foram criadas colecoes `@OneToMany` nas entidades; consultas devem sair por repositorio/pagina. |
| Concorrencia | Entidades mutaveis principais herdam `@Version`. |
| RNF3 | Campos pessoais sensiveis usam converter AES-GCM. |
| RNF5 | `AuditService` explicito grava em `audit_log` com transacao `REQUIRES_NEW`. |

## Tabela principal

| Entidade / agregado | RF principal | Banco fonte da verdade | Bancos/projecoes conectados na sequencia | Observacoes de modelagem |
|---|---|---|---|---|
| `User` | RF1, RF2, RF3, RF6, RF17, RF23 | MySQL `users` | Redis para tentativas/rate limit; OpenSearch para busca de perfis; S3 para avatar e background selecionado | Perfil `PESSOAL`, `MARCA` ou `CELEBRIDADE`; email, nome e bio cifrados; `interfaceBackgroundPresetId` suporta RF23; `lookDoDiaPanelVersion` guarda a preferencia visual do RF6. |
| `RefreshToken` | RF2 | MySQL `refresh_tokens` | Redis opcional para blacklist/limite por sessao | Refresh token rotativo persistido; token armazenado por hash. |
| `BrandProfile` | RF14, RF20 | MySQL `brand_profiles` | OpenSearch para descoberta; S3 para logo/midia | Perfil de marca separado de `User`; status de aprovacao e origem. |
| `CelebrityProfile` | RF21, RF22 | MySQL `celebrity_profiles` | OpenSearch para descoberta; S3 para avatar/midia | Perfil de celebridade separado; consentimento/selo tratado em eventos e vinculos. |
| `WardrobeItem` | RF4, RF5, RF8, RF9, RF10, RF13, RF18 | MySQL `wardrobe_items` | OpenSearch para busca por categoria/tag; Redis para favoritos/contadores; S3 para imagem | Item do guarda-roupa; categoria, subcategoria, tags, moderacao e metadados minimos de pipeline flat lay RF4. |
| `Scheme` | RF5, RF6, RF8, RF10, RF11, RF13, RF15, RF18, RF19, RF20, RF21, RF23 | MySQL `schemes` | Cassandra timeline; Redis contadores; OpenSearch busca; S3 capa/background/export/render | `ClothesScheme` conforme anatomia: composicao, titulo, selos, preco total, descricao, ocasiao/estilo e itens; inclui cache de hype e metadados RF11/RF18. |
| `SchemeItem` | RF5, RF15 | MySQL `scheme_items` | Sem projecao propria; lido junto do esquema por pagina/consulta | Liga um `WardrobeItem` a um slot do `Scheme`. |
| `DailyLook` | RF6 | MySQL `daily_looks` | Redis para cache de aba; Cassandra timeline se publicado | Registro datado do Look do Dia; fonte de verdade para historico, continuidade na virada do dia e comparacao com ontem. |
| `HypeScoreMetric` | RF6, RF13, RF19, RF24 | MySQL `hype_score_metrics` | Redis cache; OpenSearch/analytics futuro | Detalha `E_raw`, `E_norm`, `Trend_raw`, `T_norm`, `HypeScore`, `TopPercentSemanal`, selos e sugestao IA. `Scheme.hypeScore` e `hypeScoreGlobal` ficam como cache de leitura. |
| `SchemeBrandLink` | RF20, RF21 | MySQL `scheme_brand_links` | Cassandra notificacoes; auditoria RNF5 | Estado `PENDENTE`, `APROVADO`, `RECUSADO` ou `CADUCADO`; mudanca de estado gera auditoria obrigatoria. |
| `Follow` | RF17, RF19 | MySQL `follows` | Cassandra timeline; Redis contadores de seguidores/seguindo | Vínculo social entre usuarios, com status. |
| `Comment` | RF19, RF3 | MySQL `comments` | Cassandra notificacoes; Redis contador; OpenSearch se moderado/publico | Conteudo cifrado; nao deve vazar em auditoria. |
| `Reaction` | RF19 | MySQL `reactions` | Redis contador por alvo; Cassandra timeline/notificacao | Reacao polimorfica para esquema/comentario/foto. |
| `Notification` | RF19, RF20, RF21, RF24 | MySQL `notifications` | Cassandra inbox/timeline de entrega | Entidade JPA criada porque foi solicitada; leitura em escala deve usar Cassandra. |
| `StyleDna` | RF13, RF24 | MySQL `style_dna` | OpenSearch/embedding na etapa de recomendacao; S3 para arte visual se gerada | Frase identitaria cifrada; paleta, palavras-chave e assinatura de estilo. |
| `Photo` | RF4, RF12, RF18, RF24 | MySQL `photos` | S3/MinIO para binario; OpenSearch se indexavel | Guarda metadados, origem, hash, dimensoes e status de moderacao. |
| `PipelineJob` | RF4, RF11, RF16, RF18, RF24 | MySQL `pipeline_jobs` | Redis rate limit/cache; auditoria de chamada IA; S3 artefatos de entrada/saida | Orquestra chamadas externas e etapas assincronas como `FLAT_LAY_STANDARDIZATION`, `OUTFIT_RENDER`, `TRY_ON_2D` e `THREE_D_GENERATION`. |
| `AuditLog` | RNF5, RF2, RF3, RF20, RF24 | MySQL `audit_log` | Exportacao/observabilidade futura | Registro explicito de login, 403, dado sensivel, consentimento, conta, vinculo e IA. |
| Timeline projection | RF6, RF17, RF19 | Cassandra | Redis contadores; MySQL por lookup canonical | Nao e entidade JPA; infraestrutura inicial tem porta/adaptador. |
| Search document | RF8, RF14, RF17, RF20, RF22 | OpenSearch | MySQL canonical; S3 URLs publicas | Nao e entidade JPA; deve receber eventos de dominio/aplicacao para indexacao. |
| Media object | RF4, RF11, RF12, RF18, RF23 | S3/MinIO | MySQL metadados; CDN/public URL futuro | Binarios nao entram no Git; backend so emite chaves/URLs e metadados. |

## Sequencia recomendada de conexao

| Ordem | Banco/servico | Motivo |
|---|---|---|
| 1 | MySQL + Flyway | Base transacional dos RF1/RF2/RF3/RF4/RF5 e auditoria RNF5. |
| 2 | Redis | Login/rate limit/contadores sao criterios transversais e baratos de testar. |
| 3 | S3/MinIO | RF4/RF11/RF12/RF18/RF23 dependem de midia real. |
| 4 | Cassandra | Timeline/notificacoes entram depois que eventos sociais existem. |
| 5 | OpenSearch | Busca ganha valor quando usuarios, pecas, esquemas e perfis ja existem. |
| 6 | Provedores IA | Ativar por RF, sempre atras de `AiProviderPort`, sem chave no frontend. |
