# Lote R80-seal — `SealService` como Facade; `SealPolicies` e `SealDesigns` por família de regra

Base: `claude/relaxed-pasteur-5b5466` (merge feito antes do commit final, sem mudanças em Java vindas da base).
Branch: `worktree-agent-aad69abd3df8de595`. Pacote: `fai-application/src/main/java/br/com/fashionai/application/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `service/SealService.java` (`java-service`, 250) | 2097 | 474 | 15 colaboradores, tabela abaixo | **Facade** (estrutural) |
| `service/SealPolicies.java` (`java-outro`, 250) | 732 | 230 | `SealPolicyNormalizer` (228), `SealPolicyParser` (80), `SealPolicyEvaluator` (194), `SealPolicyText` (120), `SealPolicyValues` (42) | NENHUM |
| `seal/SealDesigns.java` (`java-outro`, 250) | 481 | 181 | `SealDesignNormalizer` (204), `SealDesignFields` (83), `SealDesignTemplates` (96) | NENHUM |

Colaboradores do `SealService` (todos `final`, package-private, sem Spring; criados uma vez no construtor do serviço):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `SealIssuers` | 49 | emissor apto (marca validada / celebridade verificada com consentimento), emissor do modo Hype, `requireIssuer` |
| `SealHypeLookups` | 174 | Hype atual das políticas (em lote), selos já conquistados, ordem das sugestões por Hype, exigência do modo Hype (`requireHypeMatch`) |
| `SealHypeAverages` | 180 | "Hype do selo" com cache e Hype dos looks vinculados nas métricas do emissor |
| `SealViews` | 189 | views de selo, vínculo, medalhão e resumo do look; disponibilidade do selo (RNF12); `sealsOf` |
| `SealFormWriter` | 185 | criar/editar selo (política, desenho, ícone, janela, teto, validade), política gerada pela IA, selos padrão |
| `SealPolicyDraftFlow` | 155 | Copilot `#createsealpolicy` (contexto, validação da resposta, digest) |
| `SealCandidates` | 214 | candidatos por política padronizada e pela heurística de marca/assinatura de estilo |
| `SealSuggestionFlows` | 225 | `suggest`, `previewScheme`, `preview`, `previewPiece` e o resultado da prévia |
| `SealProfileShowcase` | 100 | política PERFIL: looks e peças da vitrine do emissor |
| `SealPieceBadges` | 145 | medalhões dos looks e das peças, visibilidade de peça/look, `approvedPieceBonds` |
| `SealBondRouting` | 216 | unicidade, roteamento pendente → revisão/emissão, selo do nível, emissão (CA08), validade, auditoria do vínculo |
| `SealBondResponses` | 166 | pedido Hype, aceite, vínculo manual, recusa (uma/todas) |
| `SealBondReviews` | 165 | fila de revisão, aprovar/rejeitar/revalidar, revogações, aviso de revalidação |
| `SealPromotionReads` | 194 | "Meus Selos", promoções elegíveis e do perfil, views de promoção/resgate, métricas do emissor |
| `SealPromotionWriter` | 207 | criar (também pela administração), editar, pausar promoção e resgatar |

## Como foi dividido

- **SealService**: o código foi movido por faixas de linhas do original (script de extração), sem alterar os corpos; as
  únicas mudanças nos corpos são a qualificação das chamadas que passaram a outro colaborador (`issuer(x)` →
  `issuers.issuer(x)`, `bondView(b)` → `views.bondView(b)`, `hype()` → `hypeQuery.get()`…) e a leitura das dependências
  opcionais por `Supplier` (`sealBrands` → `brands.get()`, `hypeCache` → `cache.get()`, `sealInferenceLogs` →
  `inferenceLogs.get()`), para que os setters `setHypeQuery`, `setHypeCache` e `setSealPolicyContext` continuem valendo
  depois da construção.
- O serviço continua o único bean: **todas as 35 anotações `@Transactional`** (com `readOnly` e
  `noRollbackFor = SealUnavailable.class`) e o `@EventListener` de `onPieceDeleted` ficaram nos mesmos métodos públicos;
  o construtor de 16 argumentos, os setters, os records públicos (`SealForm`, `Candidate`, `PieceFields`,
  `PromotionForm`), `SealUnavailable` e as constantes públicas não mudaram. Cada método público delega para um
  colaborador numa instrução.
- **Autorização**: as chamadas de `guard` (`requireCanCreate`, `requireOwner`, `requireAdmin`,
  `requireApprovedInstitutional` via `SealIssuers.requireIssuer`) foram junto com o corpo do caso de uso, na mesma ordem
  e dentro da mesma transação do bean (o colaborador é chamado pelo método `@Transactional`), então a semântica é a mesma.
  Autochamadas do original (`draft` → `draft`, `preview` → `preview`, `sealsOf` → `sealsOf`, `createAdminPromotion` →
  `createPromotion`) continuam sem passar pelo proxy, como antes.
- Membros package-private mantidos como delegação porque têm chamador fora da classe: `freshHype`, `hypeIssuerAvailable`,
  `sealView`, `bondView`, `canViewPiece`, `canViewScheme` (`SealHypeOffersService`, `WardrobeService`),
  `hasProfilePolicies`, `profileSchemes`, `profilePieces` (`InstitutionalService` e testes), `grantExpiry`, `unavailable`
  (testes). Estáticos públicos (`available`, `unavailableReason`, `badge`, `approvedPieceBonds`, `storeUrl`,
  `httpsOnly`) também.
- Saíram sem delegação (nenhum chamador no repositório, inclusive testes e `fai-web`): `hypeLookup`, `candidateHype`,
  `byHype`, `sealViews`, `sealHype`, `bondedHype`, `publicHype`, `ISSUER_HYPE_TOP`, `promotionView`, `redemptionView`,
  `partnerConsented` (agora nos colaboradores); apagados por não terem uso nenhum: a constante privada `OPEN`, o
  utilitário `uuids` e as sobrecargas package-private `candidates(scheme, items, unregistered)` e
  `candidates(…, pieceOnly)` (o código só chamava a versão com Hype, que foi para `SealCandidates`).
- **SealPolicies** continua dono dos tipos (`Rule`, `HypeCriteria`, `Policy`, `HypeFact`, `HypeLookup`, `Verdict`),
  das constantes e de `dimensions`, e delega os públicos `normalize`, `parse`, `evaluate` (3 sobrecargas), `meets`,
  `describe`, `levelLabel` e o package-private `colorMatches` (usado por `SealReferenceModels`). Família por arquivo:
  validação da tela, leitura do gravado, avaliação, texto e leitura tolerante de valores. Os package-private sem chamador
  externo (`normalizeHype`, `parseHype`, `passes`, `describeHype`, `describe(Rule)`) foram com a família, sem delegação.
- **SealDesigns** continua dono do catálogo (geometria, elementos, padrões, materiais, paletas, limites), de
  `catalog`, `defaultDesign`, `fromPalette`, `labelFrom` e delega `normalize` e `nearestCircular`. Validação do desenho,
  leitura de campos e catálogo de modelos (`seals/templates.json`, carregado pelo mesmo class loader) ficaram em arquivos
  próprios.

## Por que Facade (SealService) e NENHUM (SealPolicies, SealDesigns)

- **Facade**: controllers (`SealController`, `SealPromotionController`) e serviços (`InstitutionalService`,
  `CouponService`, `SchemeService`, `WardrobeService`, `SealHypeOffersService`, `DashboardService`…) continuam falando só
  com `SealService`, que esconde 15 subsistemas coesos e coordena transação e dependências. A estrutura extraída é de
  fato uma fachada sobre colaboradores; nenhuma interface artificial foi criada.
- **Strategy (SealPolicies)**: os quantificadores (`AT_LEAST`/`ALL`/`NONE`) e os tiers (PEÇA/LOOK) são um `switch` de
  três linhas sobre o mesmo laço de peças, sem algoritmo intercambiável em tempo de execução; classes por quantificador
  espalhariam o laço. **Chain of Responsibility** (validação de regras) também não: os erros saem na ordem dos campos de
  uma mesma regra, sem handlers independentes.
- **Strategy (SealDesigns)**: os tipos `CIRCULAR`/`FOLHA`/`FASHIONAI` só ligam ou desligam blocos do mesmo JSON
  normalizado (textos da folha, núcleo); não há variação de algoritmo por tipo que justifique uma família de classes.

## Testes e equivalência

Caracterização antes: novo `SealServiceFacadeCharacterizationTest` (235 linhas, 6 testes, testkit `Kit` +
`MemoryRepository`) escrito e verde **no código original** (commit `aeaa4f9`), cobrindo os públicos sem teste direto:
`ensureDefaultSeals`, `createSeal`/`updateSeal` (política manual, limites, validade), `sealsOf` (dono/visitante),
`refuse`/`refuseAll`, `reviewQueue`/`review` (aprovação com emissão, código `BRD-`, validade, rejeição com motivo),
`mySeals` (grupos), `updatePromotion`/`setPromotionStatus`/`createAdminPromotion`.

Lista do lote (29 classes): CouponServiceTest, DashboardHypeV2Test, DashboardServiceCharacterizationTest,
InstitutionalDisplayPolicyTest, InstitutionalDisplayRankingTest, InstitutionalProfileFeedTest, IssuerReviewServiceTest,
SchemeFiltersTest, SealCreatorsCoverageTest, SealDesignsTest, SealDetectionCoverageTest, SealDraftsTest,
SealGrantValidityTest, SealHypeIssuerPiecesTest, SealHypeOffersServiceTest, SealHypeServiceTest, SealPoliciesHypeTest,
SealPoliciesTest, SealPolicyChatTest, SealPromotionCharacterizationTest, SealPromotionFlowTest,
SealPromotionLifecycleTest, SealReferenceModelsTest, ClosetSealFilterTest, PromotionRulesTest, SealDesignServiceTest,
InsightNewContextsTest, LensServiceTest, SealServiceFacadeCharacterizationTest.

```
mvn -B -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='<lista acima>' test
mvn -B -o -pl fai-web -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false \
    -Dtest='ControllerDelegacaoTest,SealControllerPieceSealsTest,SealFormPayloadTest,SealCopilotRoutesTest,ContratoRotasPorTagTest,JsonCompatConfigTest' test
mvn -B -o -pl fai-application -am -Djacoco.skip=true test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original, 28 classes existentes | 255 testes, 0 falhas, 0 erros |
| Original + `SealServiceFacadeCharacterizationTest` | 261 testes, 0 falhas |
| Após `SealPolicies` + `SealDesigns` | 261 testes, 0 falhas |
| Após o Facade do `SealService` | **261 testes, 0 falhas, 0 erros** |
| `fai-web` (compila contra o novo serviço; `ServiceFakes.FakeSealService` sobrescreve os mesmos públicos) | 708 testes, 0 falhas (não medido antes) |
| Suíte completa de `fai-application` (depois) | 2029 testes, 0 falhas, 0 erros, 27 skipped |
| Catraca | os 3 arquivos do lote só como `APERTAR` (2097 → 474, 732 → 230, 481 → 181); nenhum arquivo novo acima do limite; as violações restantes são de `components/heist`/`lib/heist`/`lib/avatar3d` (outros lotes) |

Observação de ambiente: o `~/.m2` não tinha `surefire-junit-platform:3.6.1`; foi baixado uma vez (`dependency:get`) e as
execuções seguintes rodaram com `-o`. Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n.

## Pendências

- `SealService.java` ficou com **474 linhas** (limite 250). O que sobra é contrato que o lote não podia mudar:
  44 métodos públicos (35 `@Transactional`, 1 `@EventListener`) com a assinatura e a javadoc curta (~230 linhas), os
  4 records públicos e `SealUnavailable` referenciados como `SealService.X` em `fai-web`, outros serviços e testes
  (~45 linhas), o construtor de 16 argumentos que monta os colaboradores, os setters opcionais e as delegações
  package-private com chamador externo. Próximo passo sugerido: levar os records para tipos de topo junto com a
  atualização de `fai-web`/testes e apontar `SealHypeOffersService`/`InstitutionalService` direto para os colaboradores
  (`SealViews`, `SealHypeLookups`, `SealProfileShowcase`), o que tira as delegações package-private.
- `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
