# Auditoria arquitetural — FashionAI

Data: 30/10/2026. Base: `a4c9e5d129cf6eb45e5c6ff23e0ba5ff2632b4b1` (main consultada no início). Branch local: `refactor/architecture-first-batch`, checkout `/workspace/fashionai-refactoring`.

## Escopo e preservação

A tarefa atual é refatoração progressiva, não implementação do editor GLB ou mudança de regras. Foi criado um worktree separado. Os checkouts existentes, incluindo suas alterações não commitadas, não foram editados. Não houve deploy, migration, conexão a banco, download de modelo ou execução de GPU nesta tarefa. A publicação desta refatoração em PR foi autorizada explicitamente pelo usuário após a entrega local.

O checkout completo encontrou falta de espaço ao copiar vídeos. O checkout utilizado é esparso: `media`, `assets`, `public` e `docs` históricos não foram materializados. O inventário lê fontes históricas ausentes diretamente do Git; binários não entram na contagem. Durante a verificação visual, `public` foi ligado temporariamente, somente para leitura, aos assets já disponíveis em outro checkout. O link foi removido ao terminar. Os scripts de cópia de assets do prebuild não foram executados.

## Estrutura confirmada pelo código

| Área | Evidência | Fronteira atual |
|---|---|---|
| Frontend | `package.json`, `app/`, `components/`, `lib/`, `next.config.ts` | Next.js App Router, React/TSX, hooks/contextos, UI e Three.js/R3F. |
| Domínio | `fai-domain` | Entidades, enums, contratos de repositórios. |
| Aplicação | `fai-application` | Casos de uso, políticas, views/DTOs, taxonomia, catálogo, imagem e portas. |
| HTTP | `fai-web` | Controllers, segurança, configuração web, tratamento de erros. |
| Adapters | `fai-infrastructure/{ai-providers,cache-redis,persistence-cassandra,persistence-mysql,platform,search-opensearch,storage-s3}` | Integrações e persistência. A presença do código não prova disponibilidade desses serviços. |
| Boot/cobertura | `fai-bootstrap`, `fai-coverage`, `pom.xml` | Composição Spring e agregação de cobertura. |
| Pipelines | `scripts/catalog/`, `scripts/cloud/`, `services/anatomical_vton/` | Python de catálogo/fotografia, deploy e worker Vertex. |

Os candidatos `process_local_sd.py`, `process_photo_sets.py`, `canonical_full_frame.py`, `catalog_image_inventory.py`, `photo_sets_vertex.py` e `deploy_fashn_vertex.py` existem nesta base. A auditoria anterior de outra revisão não foi usada para declarar caminhos ausentes.

## Inventário e limitações das métricas

- [Top 30 e método](FILE_COMPLEXITY_INVENTORY.md), [CSV completo](file-complexity.csv), [dados estruturados](inventory.json).
- [Baseline da revisão Git](baseline/FILE_COMPLEXITY_INVENTORY.md). Diferencia a versão original do estado de trabalho refatorado.
- Peso solicitado: tamanho 20%, complexidade 25%, responsabilidades 20%, acoplamento 15%, duplicação 10%, dificuldade de teste 10%.
- Ramos/imports e sinais textuais são proxies para triagem; não são complexidade ciclomática certificada, fan-out de runtime ou prova de violação SOLID. Python usa AST para definições e pontos de ramificação. Java/JS/TS têm contagens lexicais estimadas.
- As associações de testes são candidatas textuais. Cobertura efetiva: N/D; não foi executada a suíte agregada de cobertura.
- Duplicações são blocos candidatos normalizados. DTOs, fixtures e dados declarativos podem se parecer sem justificar abstração compartilhada.

## Cinco pontos de maior risco — revisão humana

| Arquivo | Risco concreto | Estratégia |
|---|---|---|
| `WardrobeService.java` | Autorização, dados da peça, fotografia, IA e escrita transacional no mesmo serviço. | Extrair primeiro montagem pura de resposta; preservar mutações e transações. |
| `SealService.java` | Elegibilidade, consentimento, revisão, validade e emissão de vínculos. | Caracterização de autorização e estados antes de separar casos de uso. |
| `ChallengeService.java` | Votos, encerramento, concorrência e recompensas. | Provar idempotência/locks; não reorganizar somente pela extensão. |
| `SecurityConfig.java` | Matchers públicos/privados e fronteiras HTTP. | Manter intacto neste lote; testes de acesso antes de qualquer reorganização. |
| `lib/avatar3d/human/garments.ts` | Geometria, UV, articulação e interação com lowerwear/upperwear em ciclo estático existente. | Fixtures e múltiplas vistas/poses antes de extrações. |

Esse julgamento não é o mesmo que o score automático. Copilot/Scheme e o editor 3D também exigem atenção, mas não serão refatorados indiscriminadamente em uma única alteração.

## Decisões arquiteturais do primeiro lote

1. Agrupar por funcionalidade dentro da estrutura existente, sem mover todos os módulos para uma arquitetura nova.
2. Manter `components/expanded-card.tsx` como facade de compatibilidade; separar peça, look, DNA, sucesso e galeria.
3. Manter o estado de cada card junto à respectiva composição. Não criar um hook gigante para apenas esconder a lógica anterior.
4. Preservar `PieceCardPanels` integralmente e fixar seu comportamento de seleção/teclado com testes dedicados.
5. Isolar a montagem estendida da taxonomia em `application.taxonomy.TaxonomyView`; o serviço original continua como entrypoint compatível.
6. Isolar leitura/validação de artefatos locais e upload verificado em `photo_set_artifacts.py`; o worker mantém a CLI, a assinatura de upload e os contratos do lote.

## Dependências e ciclos

O scanner encontrou 10 componentes fortemente conectados no grafo de imports estáticos tanto na baseline quanto depois. O grupo dos cards agora inclui os módulos extraídos; ao normalizar esses caminhos para o módulo de origem não aparecem grupos cíclicos novos. Isso não resolve os ciclos antigos nem comprova ausência de ciclos dinâmicos. Os grupos completos estão em `inventory.json`.

Princípios aplicados: SRP por responsabilidade; DIP já existente preservado nos adapters/portas; contratos de substituição e APIs mantidos. Nenhuma interface Java foi criada somente para cumprir um padrão.
