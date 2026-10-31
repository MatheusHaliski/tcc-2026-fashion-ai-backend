# Plano progressivo de refatoração

Base de trabalho e limitações: [auditoria](ARCHITECTURE_AUDIT.md). O plano distingue código implementado de etapas futuras; não equivale a promessa de concluir todo o repositório nesta execução.

## Lote 1 — implementado, com validação parcial de ambiente

| Fronteira | Alteração | Evidência |
|---|---|---|
| Cards expandidos | Facade pública + implementações por peça/look/DNA/sucesso + galeria. | 48 testes React; corpos de seis funções preservados; screenshots desktop/mobile disponíveis. |
| Taxonomia | Extrair montagem pura do DTO estendido de WardrobeService. | 43 testes Java antes/depois, incluindo contrato de taxonomia existente e conservação. |
| Artefatos de fotos | Extrair validação dos PNGs e upload com conferência de hash. | 4 novos testes passam; CLI compatível; dois testes antigos de política falham igualmente antes/depois. |
| Auditoria | Inventário, ranking e grafo estático reproduzíveis. | Testes locais do analisador e CSV/JSON completos. |

O lote não altera CSS, endpoints, DTOs, entidades, migrations, versões de modelos, resolução das imagens, política de qualidade ou regras de consentimento. A galeria mantém o markup e os handlers anteriores.

## Portas que faltam para certificação completa

1. Build Next.js completo em ambiente com espaço suficiente e dependências correspondentes ao lockfile. A compilação local prosseguiu até geração de páginas, mas terminou com ENOSPC.
2. Concluir a comparação visual posterior dos estados loading/erro/vazio, interrompida pelo Chromium; os testes de componentes desses fluxos existentes passaram.
3. Investigar as duas fixtures de lote incompatíveis com o quality gate atual numa mudança funcional separada. Não relaxar o gate para conseguir um teste verde.
4. Rodar a suíte global e cobertura quando houver recursos; ainda não há certificação de todos os módulos do projeto.

## Próximos lotes recomendados

### Lote 2 — aprofundar frontend com baseline estável

- `components/catalog/catalog-search.tsx`: separar estado/consulta de resultados e painel de detalhes, preservando paginação, filtros e importação pública de CatalogResultCard.
- `components/multi-piece-review.tsx`: delimitar revisão de lote, edição individual e navegação, com testes de preservação de rascunho.
- `components/expanded-card/expanded-piece.tsx`: avaliar um hook focado somente no ciclo editar/validar/salvar e um módulo de fontes de imagens. Extrair apenas se reduzir acoplamento real; manter ownership de modais e notificações consistente.
- `components/atelier3d/editor.tsx`: observar estabilidade do editor recém-introduzido antes de separar viewport, documento e colaboração. Não combinar refatoração com novas ferramentas.

### Lote 3 — serviços de aplicação

- Wardrobe: continuar por funções puras e resolução de dados; só depois separar processamento de fotografia, com teste de transação/eventos.
- Copilot/Scheme: mapear casos de uso e contratos, evitando interfaces abrangentes que escondam dependências.
- Challenge/Seal: testes de concorrência, autorização e idempotência antes de reorganizar encerramento/emissão. Mover fronteiras transacionais apenas com prova de equivalência.

### Lote 4 — Python

- `process_local_sd.py`: separar parsing/configuração, provedores e escrita de resultados, preservando execução por módulo e script.
- `process_photo_sets.py`: reavaliar orchestration/commit CAS depois de caracterizar as fixtures de qualidade. O lote atual não moveu commit_set nem alterou critérios de READY.
- Deploy/Vertex: somente parsing/funções puras e testes locais; nenhuma aplicação de infraestrutura ou inferência paga.

### Lote 5 — duplicações e consolidação

Revisar candidatos do CSV por duplicação literal, regra, integração, apresentação ou coincidência. Extrair somente abstrações estáveis. Priorizar os ciclos entre geometria e cards após cobertura suficiente. Fazer nova baseline, contratos e screenshots em cada lote, com métricas líquidas incluindo arquivos extraídos.

## Política de publicação

O usuário autorizou explicitamente abrir a PR após revisar o resultado local. A branch de publicação é `refactor/architecture-first-batch`; o conteúdo permanece isolado de outras tarefas. A PR documenta as limitações de build, navegador e baseline Python. Não há deploy, merge automático ou alteração de banco nesta publicação.


## Checkpoint adicional — 30/10/2026

Nova auditoria por AST e primeiro lote de histórico do Atelier documentados em [gof/INDEX.md](gof/INDEX.md). Este adendo preserva o relato anterior e distingue a base5166f88c das novas alterações ainda não commitadas. Inventário abrangente não equivale a revisão semântica concluída.
