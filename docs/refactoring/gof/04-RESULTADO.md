# Módulo 04 — guarda-roupa, peça, captura e fotos: lote FLOW-CLOSET-QUERY-006

Base: `bcaee73` (main após PR #416, que já extraiu `StudioVersionMetadata` — ver `WARDROBE_STUDIO.md`).
Branch: `gof/04-guarda-roupa`. `git status --short` limpo antes do lote.

## Mapeamento real do fluxo do closet (RF6)

`app/(site)/(app)/closet` (lista de peças com filtros/ordenação/página) → `api` → `WardrobeController`
(`GET /api/me/closet` e `GET /api/users/{ownerId}/closet`, ambos montando `ClosetFilter`) → `WardrobeService.closet(viewer, ownerId, ClosetFilter)`
(`@Transactional(readOnly = true)`) → `WardrobeItemRepository.findByUserIdOrderByCreatedAtDesc` +
`HypeScoreCurrentRepository` (privacidade do Hype) + `SealService.approvedPieceBonds` (selo de marca) + `Guard.canView`
→ `WardrobeItem` → `Views.piece` / `Views.Page<PieceView>`.

## Problema concreto e decisão

`closet()` tinha ~75 linhas misturando, no mesmo método transacional, autorização (arquivada, `Guard.canView`, moderação),
I/O (repositório de peças, Hype, vínculos de selo) e regras puras: 7 filtros de atributo, normalização da ordenação
com apelidos em português, decisão de quando consultar o Hype, faixa mínima com arredondamento, predicado do selo,
um `switch` de 10 ordenações e a janela de paginação (tamanho 1..60, padrão 30). As regras puras eram testáveis só
montando o serviço inteiro com `Kit`/`World`.

Extraído **`ClosetQuery`** (package-private, mesmo pacote, 146 linhas, sem Spring/repositório/`Guard`/usuário):
`matches`, `stateMatches`, `sealFilter`, `sortKey`, `needsHype`, `belowMinimum`, `keepForSeal`, `order`, `window`
(+ `record Window`). A escolha da ordenação é **Strategy usando `java.util.Comparator` como interface de estratégia**
(uma estratégia por chave, padrão = recentes); não foi criada hierarquia nova.

Permanecem em `WardrobeService.closet`, inalterados: dono × terceiro, exclusão de arquivadas, `guard.canView`,
moderação APROVADA para terceiros, `hypeOf` (dono vê tudo; terceiros só `publicEligible`), `hypeMinimum` (limiares do
`HypeScoreConfig`), `SealService.approvedPieceBonds` com `canViewScheme`, relógio `HypeSignalRecorder.ZONE`, transação e
`Views`. `WardrobeService.sealFilter` e `stateMatches` mantêm assinatura (usados por testes) e delegam.

### Padrões avaliados e NÃO aplicados neste lote

- **Builder (PieceForm)**: `PieceForm` é record com 5 construtores de compatibilidade usados por controller/lote/catálogo;
  trocar por builder mexe no contrato de entrada — fica para lote com caracterização de `create/update`.
- **Chain of Responsibility (`validate(PieceForm)`)**: já acumula todos os erros num `LinkedHashMap` em ~20 linhas, com
  regras vindas de `Taxonomy`; uma cadeia agora seria indireção sem ganho.
- **Factory Method (CATALOG/USER_PHOTO/DEFAULT)**: `createInternal` decide origem no meio de I/O de storage/fila; exige
  lote próprio com testes de `REFERENCE_ONLY` e mídia. Não tocado.
- **State (processamento de fotos)** / **Command (reprocessamento)**: `reprocessPending` e estúdio já têm lote anterior;
  sem ganho claro neste recorte.
- **Facade**: `WardrobeService` já é a fachada do controller.
- **Singleton**: nenhum introduzido.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Baseline dos testes existentes do closet | `mvn -B -q -pl fai-application -Dtest='WardrobeServiceClosetTest,ClosetSealFilterTest,LookbookClosetHypePrivacyTest,WardrobeStateFilterTest,WardrobeServiceParsersTest' test` | 56 testes, 0 falhas |
| Caracterização **antes** da extração (`WardrobeClosetCaracterizacaoTest`, 8 novos: ordem desconhecida/nula = recentes, apelido sensível a maiúsculas, desempate de `least_worn`, preço nulo = 0 e sort estável, `growth` com desempate por tendência e sem Hype por último, faixa desconhecida exige score com limite −0,5, tamanho padrão/página além do fim/`hasMore`, cor/família, busca) | mesmo comando + `WardrobeClosetCaracterizacaoTest` | 64 testes, 0 falhas (`evidence/04-closet-baseline.log`) |
| Depois da extração + `ClosetQueryTest` (6 unitários puros) | idem + `ClosetQueryTest` | 70 testes, 0 falhas (`evidence/04-closet-after.log`) |
| Regressão do domínio (cadastro, estúdio, parsers, análise, criador, listeners, conservação, filtros de look) | `mvn -B -pl fai-application -Dtest=ClosetQueryTest,ClosetSealFilterTest,PieceConservationServiceTest,StudioVersionMetadataTest,StudioVersionsTest,WardrobeAnalysisTest,WardrobeAnalyzeFlowTest,WardrobeClosetCaracterizacaoTest,WardrobeCreatorServiceTest,WardrobeEventListenersTest,WardrobePrefillTest,WardrobeServiceCadastroTest,WardrobeServiceClosetTest,WardrobeServiceEstudioTest,WardrobeServiceParsersTest,WardrobeStateFilterTest,LookbookClosetHypePrivacyTest,SchemeFiltersTest test` | 161 testes, 0 falhas, 3 skipped preexistentes (`WardrobeAnalyzeFlowTest`) — BUILD SUCCESS (`evidence/04-closet-regression.log`) |
| Regra de tamanho | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | `WardrobeService` APERTAR 2792→2730; 2 violações **fora do lote** (`IdentityService` 1079 > 1007, `SchemeService` 1311 > 1271): arquivos não tocados aqui; a worktree parte de `bcaee73`, anterior às extrações dos domínios 02/03 que baixaram esses tetos na branch principal. Somem na integração (`evidence/04-line-ratchet.log`). |

Sem banco, servidor, navegador, rede, GPU/Vertex, bucket ou imagens reais. Testes com mocks e fixtures em memória.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `WardrobeService.java` | 2792 | 2730 (−62; −2,2 %) |
| `closet()` | ~75 linhas | ~30 |
| `ClosetQuery.java` (novo, produção ≤ 250) | — | 146 |
| Runtime combinado | 2792 | 2876 (+84: javadoc, assinaturas, 2 helpers privados `blank`/`contains`) |
| Testes novos | — | `WardrobeClosetCaracterizacaoTest` 173, `ClosetQueryTest` 119 (≤ 400) |

O ganho é coesão/testabilidade da política de consulta do closet, não redução global de complexidade.

## Contratos preservados

URL, parâmetros de `ClosetFilter` (record e 3 construtores), `Views.Page`/`PieceView`, ordem de chegada estável, apelidos
de ordenação (sensíveis a maiúsculas), limites de página, faixa de Hype com arredondamento, privacidade do Hype para
terceiros, regras de selo RF53, visibilidade/moderação, transação read-only. Sem mudança de DTO, schema, migration,
i18n ou configuração. Nenhuma foto, slot, tag, marca, origem de foto ou contador foi tocado.

## Riscos e pendências do domínio 04

- `WardrobeService` continua CRITICAL/PARTIAL (2730 linhas): análise de foto, cadastro (`createInternal` ~150 linhas com
  origem CATALOG/USER_PHOTO/DEFAULT), marca por busca, estúdio e 3D no mesmo bean. Próximo candidato: aplicação do
  formulário (`apply`/`applyTaxonomy`) com caracterização de proveniência de variação.
- `ClosetQuery.blank/contains` duplicam dois one-liners de `WardrobeService` para manter a unidade independente do bean.
- `PhotoService`, `MultiPieceService`, `WardrobeCreatorService` e formulários `/pieces` não alterados.
