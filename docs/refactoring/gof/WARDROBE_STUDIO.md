# FLOW-WARDROBE-STUDIO-004 — política de versões de fotos de estúdio

Base:1ab356bb. WardrobeService tinha2.827 linhas e passou a2.792. StudioVersionMetadata tem64: runtime combinado2.827→2.856 (+29); redução do arquivo original35 linhas (1,24%). Não há alegação de redução global de complexidade. O serviço continua CRITICAL/PARTIAL.

## Responsabilidade isolada

Projeção dos derivados permitidos (url, thumb/feed/detail/enhanced, backdrop, stages/metrics/framing/feed/logo/provider); cópia do contêiner studio; coerção do provider para string; número de versão explícito ou fallback legado; aprovação implícita legada; referência curta da versão anterior; número da versão pendente.

O helper não conhece WardrobeItem, Spring, repositorios, storage ou usuário. A consulta da URL para fallback de versão é lazy, preservando a avaliação anterior. As quatro funções de compatibilidade package-level em WardrobeService continuam com as mesmas assinaturas. URLs nulas, metadata malformada, omissão de campos nulos, timestamp único para createdAt/approvedAt e cópia superficial existente foram preservados.

Autorizações, owned(), métodos transacionais, decisão offer/apply, aprovação/descarte, auditoria e remoção best-effort de mídia permanecem no serviço. Sem mudança de DTO, endpoint, schema ou configuração produtiva. É extração de política pura, sem nova hierarquia GoF ou bean transacional.

## Verificação

- Baseline:14 testes de estúdio passaram antes da alteração produtiva.
- Caracterização adicionada antes da extração:18 testes (14 existentes+4 novos) passaram.
- Regressão final:98 testes de estúdio, cadastro, closet, parsers, filtros e conservação passaram;0 falhas/erros. Java21, Maven offline; Mockito explícito como javaagent porque self-attach é restrito neste executor.

Comando: `JAVA_HOME=/workspace/.tooling/jdk21 /workspace/.tooling/maven/bin/mvn -o -Dmaven.repo.local=/workspace/.tooling/m2 -DargLine=-javaagent:/workspace/.tooling/m2/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar -pl fai-application -am '-Dtest=WardrobeService*Test,StudioVersionMetadataTest,WardrobeStateFilterTest,PieceConservationServiceTest' -Dsurefire.failIfNoSpecifiedTests=false test`.

Nenhum banco, servidor produtivo, GPU ou navegador foi usado neste lote Java. Os testes usam mocks e fixtures locais. Logs em evidence/wardrobe-studio-*.log.
