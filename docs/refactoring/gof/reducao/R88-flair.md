# Lote R88-flair — FLAIR: `FlairService` como Facade e os motores de regra por família

Base: `claude/relaxed-pasteur-5b5466` (fast-forward antes de começar; merge de novo antes do commit final). Pacotes:
`fai-application/src/main/java/br/com/fashionai/application/service/` e `.../application/flair/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `service/FlairService.java` (`java-service`, 250) | 1117 | 249 | 12 colaboradores, tabela abaixo (1632 no total) | **Facade** (estrutural) |
| `service/FlairCollectionService.java` (`java-service`, 250) | 309 | 187 | `FlairCardSnapshot` (117), `FlairCardViews` (76) | NENHUM |
| `flair/FlairLooks.java` (`java-outro`, 250) | 818 | 232 | 9 classes de regra, tabela abaixo (925 no total) | **Facade** (estrutural) |
| `flair/CbcRules.java` (`java-outro`, 250) | 615 | 236 | `CbcRequirements` (146), `CbcSintonia` (169), `CbcSlotAccepts` (76), `CbcValidation` (104), `CbcValues` (58) | **Facade** (estrutural) |
| `flair/FlairEngine.java` (`java-outro`, 250) | 365 | 184 | `FlairCardRules` (129), `FlairDeckRules` (74), `FlairDuelRules` (103) | **Facade** (estrutural) |

Colaboradores do `FlairService` (package-private, `final`, sem Spring, criados uma vez no construtor do bean por
`FlairServiceParts`):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `FlairServiceParts` | 53 | record com os colaboradores e a montagem deles a partir das 22 dependências do bean |
| `FlairDecks` | 206 | Hype v2 público (estados do job, `gameHype`, `publicLookHype`), `input`/`cardsOf`/`card`, `deck`, `cards` + `album`, `decks`, `deckOf`, `ownDeckScheme`, deck da Casa e melhor deck público |
| `FlairMatchLog` | 54 | `entry` (lado na partida, marcas das peças) e `entryView` (linha do histórico) |
| `FlairWallet` | 127 | `SKINS`, `profile`, `award` idempotente, `me`, `buySkin`, `rightsCheck` |
| `FlairQuests` | 111 | `Quest`/`QUESTS`, progresso e resgate |
| `FlairDuelGame` | 117 | `CASA`, `DUEL_REWARDS_PER_DAY` e o duelo 1×1 / treino contra a Casa |
| `FlairArena` | 109 | `ARENA_OCCASIONS`, `arenaTheme`, partida do dia, placar e inscrição |
| `FlairTeams` | 129 | equipes (criar, entrar, sair), `teamView` e a liga |
| `FlairTeamBattle` | 153 | os 3 melhores decks de cada equipe e o duelo 3×3 com recompensas |
| `FlairCombinationRules` | 159 | `CATEGORY_LABELS`, `sellerActive`, `available`, `check` (checklist), `combinationView`, `redemptionView` |
| `FlairCombinationAdmin` | 160 | `GAME_TYPES`, lado da loja: salvar/excluir combinação, aba do perfil, conferência do cupom |
| `FlairRedemptions` | 154 | lado do jogador: vitrine com melhor deck, conferência, resgate do cupom (`token`) e carteira |

Classes de regra do `FlairLooks` (package-private, `final`, estáticas e puras):

| Arquivo novo | Linhas | Família de regra |
|---|---:|---|
| `FlairLookCatalog` | 121 | rótulos dos atributos, os 18 temas (`w`, pesos e condições), bosses e funções do Ultimate (preenche os mapas públicos) |
| `FlairLookColors` | 40 | família de cor pelo hex, claro/escuro (luminância) |
| `FlairLookStats` | 145 | os 10 atributos do look, sinergias, completude, peso no tema (teto do HYPE), `clamp`, `count` e os conjuntos de subcategorias/estilos |
| `FlairLookScoring` | 136 | nota contextual, Battle of Looks, Combo Battle, Boss e Runway |
| `FlairSquadRules` | 137 | escalação (força bruta), Squad, divisão e partida da liga |
| `FlairTeamRules` | 97 | harmonia (Tag Team) e Ultimate Team (`roleValue`, `teamRating`) |
| `FlairChessRules` | 145 | tabuleiro 3×3, adjacência e `autoBoard` |
| `FlairDraftRules` | 57 | serpente do Draft e melhor look de uma mão |
| `FlairWardrobeRules` | 47 | Wardrobe Wars |

## Como foi dividido

- **Corpos movidos sem alteração.** Cada arquivo novo foi montado por faixas de linhas do original com um script de
  extração (Python, fora do repositório). Nos motores (`FlairEngine`, `FlairLooks`, `CbcRules`) as funções que mudaram
  de dono entram por `import static`, e os corpos ficaram byte a byte iguais. No `FlairService`, as únicas mudanças nos
  corpos são a qualificação das chamadas que mudaram de dono (`deck(s)` → `decks.deck(s)`, `award(…)` →
  `wallet.award(…)`, `entry(…)` → `matchLog.entry(…)`, `teamView(…)` → `teamsMode.teamView(…)`, `combinationView(…)` →
  `rules.combinationView(…)`, `this::redemptionView` → `rules::redemptionView`, etc.), aplicada por regex com contagem
  verificada, e a retirada das anotações `@Transactional`, que ficaram nos métodos do bean.
- **Contrato preservado.** Todas as classes e assinaturas públicas continuam onde estavam: `FlairEngine` (records
  `Ability`, `Hype`, `PieceInput`, `Card`, `Combo`, `Deck`, `Round`, `DuelResult`, `STATS`, `DUEL_ROUNDS`, `RARITIES`,
  `RARE_RARITY_MIN`, `LIMITED_RARITY_MIN`, `season`, `card`, `rarity`, `deck`, `duel`, `occasionScore`, `rank`),
  `FlairLooks` (os 8 records, `STATS`, `LABELS`, `THEMES`, `SQUAD_SITUATIONS`, `BOSSES`, `ROLES`, `BOARD`, `DIVISIONS`,
  `OUTERWEAR`, `NEUTRAL_HYPE` e os 27 métodos públicos), `CbcRules` (constantes, 7 records e 10 métodos públicos),
  `FlairService` (construtor de 22 argumentos, `CombinationForm` e os 27 métodos públicos, 23 com `@Transactional` com o
  mesmo `readOnly`) e `FlairCollectionService` (construtor, `Draft`, `TIERS`, `RARE`, 5 transações). `ServiceFakes`
  (fai-web) compila sem alteração.
- **Mapas públicos do `FlairLooks`.** `LABELS`, `THEMES`, `BOSSES` e `ROLES` continuam sendo as mesmas instâncias
  `LinkedHashMap` declaradas no `FlairLooks`; um único bloco `static` chama `FlairLookCatalog.labels/themes/bosses/roles`,
  que fazem os mesmos `put` na mesma ordem. `OUTERWEAR` é declarado antes do bloco (o tema RAINY_LONDON o usa), e o
  catálogo não tem estado estático próprio, então não há ciclo de inicialização entre as classes.
- **Autorização e transação.** `guard.requireCanCreate`, `requireApprovedInstitutional`, `deny`, `schemeService.owned` e
  `canView` foram com o corpo de cada caso de uso, na mesma ordem e dentro da transação do bean. As autochamadas do
  original (`buySkin`/`claimQuest`/`duel` → `me`, `claimQuest` → `quests`, `joinArena` → `arena`, `createTeam`/`joinTeam`/
  `leaveTeam` → `league`) continuam sem passar pelo proxy, como antes.
- **Membros package-private mantidos no serviço** (têm chamador fora da classe): `today`, `season` (`FlairModeValues`,
  `FlairChallengeService`, `FlairCollectionService`), `card` (`FlairChessMode`, `FlairDeckMode`), `profile`, `award`
  (`FlairMatchRecorder`), `available` (`CouponService`), `sellerActive` (`SealPromotionWriter/Reads`, `SealViews`,
  `PhysicalStoreService`, `WardrobeCreatorService` por method reference). Em `FlairCollectionService`: `tierOf`,
  `visible` (mockado em `FlairChallengeServiceTest`) e `tagsOf`.
- **Saíram sem delegação** (agora no novo dono, mesmo nome e assinatura; nenhum apagado): no serviço, `CASA`,
  `DUEL_REWARDS_PER_DAY`, `ARENA_OCCASIONS`, `SKINS`, `GAME_TYPES`, `Quest`, `QUESTS`, `CATEGORY_LABELS`, `hypeStates`,
  `gameHype`, `input`, `deck(Scheme)`, `album`, `houseDeck`, `bestPublicDeck`, `arenaTheme`, `arenaMatch`, `teamDecks`,
  `check`, `combinationView`, `redemptionView` e os privados; em `FlairCollectionService`, `collection`, `previewOf`,
  `hypeSnapshot`, `view`, `min`, `max`, `num`, `notBlank`; em `FlairEngine`, `ability`, `MULT`, `EDGE_BONUS`, `COLD`,
  `WARM`; em `CbcRules`, `requirement`, `listOrOne`, `positionOk`, `harmonious`, `WHEEL`, `COMPLEMENTS`, `colorMatch`,
  `colorsMatch`, `matchesInterpretation`, `themeFocus`, `tagMatch`, `tier`, `intOf`, `strings`, `intersects`; em
  `FlairLooks`, `BOLD`, `TRENDY`, `SNEAKERS`, `STREET_BOTTOMS`, `STREET_TOPS`, `LEATHER_SHOES`, `RARITY_INDEX`,
  `DEFAULT_WEIGHT`, `w`, `theme(Theme)`, `boss`, `dark`, `light`, `luminance`, `clamp`, `completeness`, `jaccard`, `fits`,
  `neighbors`, `adjacency`, `cat`. Mantidos (pequenos, usados por várias famílias): `theme(String)`, `drawTheme`, `winner`.
- **Consumidores reapontados** (só a referência): `FlairDeckMode` (`FlairService.CATEGORY_LABELS` →
  `FlairCombinationRules.CATEGORY_LABELS`), `FlairServiceTest` (`arenaTheme`/`ARENA_OCCASIONS` → `FlairArena`, `QUESTS` →
  `FlairQuests`), `CbcRulesTest` e `CbcRulesRequisitosTest` (os helpers package-private → `CbcRequirements`,
  `CbcSlotAccepts`, `CbcSintonia`, `CbcValues`). Nenhuma asserção mudou.
- **Modificadores**: `private` → package-private só onde outro colaborador chama (`ownDeckScheme`, `entry`, `entryView`,
  `teamView`, `brandNameOf`; em `FlairCollectionService`, `collection`, `previewOf`, `hypeSnapshot`, `min`, `max`, `num`,
  `notBlank`). Os dois `SecureRandom` (códigos de equipe e de cupom) agora são um por colaborador.
- No `FlairService` os banners de seção saíram (o agrupamento por colaborador `parts.xxx()` já mostra as seções); os
  banners originais foram com o código para os colaboradores e as classes de regra.

## Por que Facade (e por que não Strategy, Chain of Responsibility ou Interpreter)

- **`FlairService` — Facade**: `FlairController`, `CouponService`, `FlairModesService` (e seus modos), `FlairAdventureService`,
  `FlairCollectionService`, `FlairChallengeService` e os serviços de selo continuam falando só com o bean, que esconde 11
  colaboradores por caso de uso e coordena transação e dependências. Mesmo modelo de R80/R83.
- **`FlairEngine`, `FlairLooks`, `CbcRules` — Facade estática**: os motores puros mantêm a API (records, constantes e
  funções) e delegam a classes de regra por família. Os consumidores (serviços de modos, desafios, aventura, testes) não
  mudaram de import. Nenhuma interface nova foi criada.
- **Strategy / Chain / Interpreter avaliados e descartados**: o brief pede aplicá-los só se a estrutura já for essa. Os
  requisitos do desafio (`CbcRequirements.requirement`) são um `switch` sobre o tipo com contadores diferentes por caso,
  não objetos intercambiáveis; transformar cada `case` numa estratégia mudaria a estrutura (e o risco de equivalência)
  sem problema concreto. A validação (`CbcValidation.validate`) acumula todos os erros em ordem fixa, não interrompe no
  primeiro handler. `FlairLooks.score` aplica condições fixas do tema em sequência, não uma gramática. Os jogos do
  `FlairService` têm ciclos diferentes (duelo único, arena diária, equipes, combinações em três passos), então não há
  Template Method comum. `FlairServiceParts` é só a montagem (record com fábrica estática), não Abstract Factory/Builder.
- **`FlairCollectionService` — NENHUM**: continua com os casos de uso (converter, coleção, prévia) e só tirou o retrato
  da peça e as visões; não virou fachada pura.

## Testes e equivalência

Caracterização antes (commit `05e6eff`, verde **no código original**):

- `FlairEngineLooksCharacterizationTest` (2 testes) e `CbcRulesCharacterizationTest` (2 testes): retrato canônico
  (`Retrato`, test helper: records pelos componentes; `LinkedHashMap`/`LinkedHashSet`/ordenados na ordem própria;
  `Map.of`/`Set.of`/`HashMap` com chaves ordenadas, porque a ordem deles muda por JVM) com SHA-256 de todas as funções
  públicas e das package-private com regra: 10 peças fixas × 4 estações, 6 decks × 6 duelos, notas de ocasião, ranks;
  6 looks × 18 temas (pesos, nota, sinergias, combo, runway, battle, tag, bestLook), squad, liga, divisões, harmonia,
  funções, bosses, Ultimate, xadrez, draft, Wardrobe Wars; 4 tabuleiros × 4 contextos × 26 requisitos no CBC, `misses`,
  tema, dias sem uso, 16×16 cores, validação com erros, utilitários. Digests estáveis em duas JVMs (texto idêntico).
- `FlairServiceFacadeCharacterizationTest` (3 testes): digest das tabelas estáticas e do mapeamento peça → `PieceInput`
  (ids trocados por `<id>`), ordem das chaves de `cards`, `me`, histórico, `duel`, arena, liga, equipe, batalha, quests,
  combinação, checklist, cupom e aba da loja; 23 códigos `status:code`; regra de coins do duelo contra a Casa (20/15/5 e
  pontos 25/8/2) e da quest (150 coins, 10 pontos).
- `FlairCollectionFacadeCharacterizationTest` (1 teste): chaves da carta, da coleção e das prévias, JSON gravado do
  Hype público, das tags e do verso, ordem da coleção por nível e nota.

Depois da extração, só as referências aos membros movidos foram reapontadas (lista acima); nenhum digest nem asserção mudou.

```
mvn -B -q -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false \
    -Dtest='Flair*Test,Cbc*Test,CouponServiceTest,Afterparty*Test,Seal*Test,PhysicalStore*Test,WardrobeCreator*Test' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -q -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,ContratoRotasPorTagTest' test
mvn -B -q -o -pl fai-application -Djacoco.skip=true test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original, testes do lote (`Flair*Test,Cbc*Test,CouponServiceTest`) | 139 testes, 0 falhas, 0 erros |
| Original + 4 testes de caracterização novos (8 testes) | verdes; digests iguais em duas execuções |
| Após a extração, testes do lote ampliados (FLAIR, CBC, cupons, selos, loja física, criador) | **318 testes, 0 falhas, 0 erros** |
| `fai-web` install (compila contra os novos serviços; `ServiceFakes` sem alteração) | OK |
| `ControllerDelegacaoTest` + `ContratoRotasPorTagTest` | 697 + 1 testes, 0 falhas |
| Suíte completa de `fai-application` (depois) | 2044 testes, 0 falhas, 0 erros, 27 skipped |
| Catraca | os 5 arquivos só como `APERTAR` (1117 → 249, 309 → 187, 818 → 232, 615 → 236, 365 → 184); 0 violações; nenhum arquivo novo acima do limite |

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n/JSON.

## Pendências

- Nenhuma para o limite. `FlairService` ficou com 249 linhas (limite 250): o que sobra é contrato (27 públicos, 23
  transações, construtor de 22 argumentos, `CombinationForm`) e 7 delegações package-private com chamador fora da classe.
  Para ganhar folga num próximo passo (fora do escopo): fazer `FlairMatchRecorder`, `CouponService`, `FlairChessMode` e
  `FlairDeckMode` dependerem dos colaboradores em vez de `profile`/`award`/`available`/`card`, e os serviços de selo de
  `FlairCombinationRules::sellerActive`.
- `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
