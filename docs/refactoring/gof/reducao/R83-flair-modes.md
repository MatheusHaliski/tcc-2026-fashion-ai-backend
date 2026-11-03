# Lote R83-flair-modes — `FlairModesService` como Facade sobre um colaborador por modo

Base: `claude/relaxed-pasteur-5b5466` (merge feito antes do commit final; a base trouxe os lotes R81/R85, sem tocar em
arquivos do FLAIR). Pacote: `fai-application/src/main/java/br/com/fashionai/application/service/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `service/FlairModesService.java` (`java-service`, 250) | 1643 | 248 | 17 colaboradores, tabela abaixo (2183 no total) | **Facade** (estrutural) |

Colaboradores (todos package-private, sem Spring, criados uma vez no construtor do serviço; classes `final`, exceto
o record `FlairModeParts`):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `FlairModeParts` | 45 | record com os colaboradores e a montagem deles a partir das 16 dependências do bean (quem compartilha looks e registro, quais repositórios cada modo recebe) |
| `FlairModeCatalog` | 117 | catálogo estático: `MODES`, `CITIES`, `BOARD`/`board()`, `TERRITORIES`, `territory()` e o payload de `catalog()` |
| `FlairModeValues` | 38 | calendário (`today`, `seasonKey`, `weekKey`) e leitura tolerante do estado JSON (`num`, `ids`) |
| `FlairModeViews` | 54 | `lookView`, `clashView` e `overall` (vencedor de uma série de rodadas) |
| `FlairModeLooks` | 170 | looks e cartas: look de um look salvo ou de cartas soltas, looks próprios/públicos, a "Casa" sorteada por semente, oponente por @usuário, `seed`, `pickSquad`, `myLooks` |
| `FlairMatchRecorder` | 190 | `finish` (partida, lados, V/E/D, recompensa com teto diário, FAI Points, direitos), `discoverSynergies`, troféus, `trophiesOf`, estado por modo/temporada, `ownDraft` |
| `FlairLookDuels` | 155 | Battle of Looks, FLAIR Squad, Combo Battle e Tag Team |
| `FlairLeagueMode` | 215 | Fashion League: elenco, tabela, rodada, `stylePoints`, `table` |
| `FlairRunwayMode` | 124 | FLAIR Runway: tema rotativo, temporada, desfile em três fases |
| `FlairWorldTour` | 155 | Fashion World Tour: tabuleiro, dado (`DICE`), desafio pendente |
| `FlairTerritoryModes` | 171 | Fashion Monopoly e FLAIR Conquest: mapa e ataque/captura |
| `FlairDraftMode` | 187 | FLAIR Draft: início, escolha alternada com a IA, looks finais |
| `FlairDeckMode` | 172 | Deck Battle: `DECK_RULE`, deck sugerido/salvo, mão e jogada |
| `FlairBossMode` | 70 | Fashion Boss |
| `FlairWardrobeWars` | 99 | Wardrobe Wars (`wardrobe` + partida) |
| `FlairChessMode` | 84 | FLAIR Chess (sugestão e partida) |
| `FlairUltimateTeam` | 137 | FLAIR Ultimate Team (`autoUltimate`, elenco por função, partida) |

## Como foi dividido

- O código foi movido por faixas de linhas do original com um script de extração, sem alterar os corpos. Nos corpos,
  as únicas mudanças são a qualificação das chamadas que mudaram de dono (`look(x)` → `modeLooks.look(x)`,
  `this::look` → `modeLooks::look`, `finish(…)` → `recorder.finish(…)`, `state(…)` → `recorder.state(…)`,
  `house(x)` → `FlairModeLooks.house(x)`, `FlairModesService::lookView` → `FlairModeViews::lookView`). As funções
  estáticas que saíram (`today`, `seasonKey`, `num`, `ids`, `lookView`, `clashView`, `overall`, `territory`, `BOARD`…)
  entram por `import static`, e por isso as chamadas nos corpos ficaram iguais.
- O serviço continua o único bean: as **30 anotações `@Transactional`** (com os mesmos `readOnly = true`; `catalog` segue sem) ficaram nos
  mesmos métodos públicos, e cada um delega para um colaborador numa instrução. Construtor de 16 argumentos (também
  usado por `ServiceFakes.FakeFlairModesService`, que compila sem alteração), records públicos `Mode`, `Square`,
  `Territory` e constantes públicas `MODES`, `CITIES`, `BOARD`, `TERRITORIES` (agora apontando para as listas do
  catálogo, mesmas instâncias), `REWARDED_PER_MODE_DAY` e `COMPETITIVE` (usada por `FlairService`) não mudaram.
- **Autorização**: as chamadas a `guard.requireCanCreate`/`requireOwner` e a `schemeService.owned` foram junto com o
  corpo do caso de uso, na mesma ordem e dentro da transação do bean. Autochamadas do original (`saveRoster` →
  `league`, `saveDeck` → `deck`, `saveUltimate`/`playUltimate` → `ultimate`) continuam dentro do mesmo colaborador e sem
  passar pelo proxy, como antes. Os `@SuppressWarnings("unchecked")` de `roll`, `resolveTour` e `draftView` foram com os
  corpos.
- Membros package-private mantidos como delegação no serviço porque têm chamador fora da classe: `look(Scheme)`
  (`FlairModesServiceTest`) e `table(…)` (idem). Saíram sem delegação (sem chamador fora da classe): `board`,
  `territory`, `today`, `seasonKey`, `weekKey`, `cardsOf`, `lookOfCards`, `ownSchemes`, `ownScheme`, `publicLooksOf`,
  `houseLooks`, `houseCards`, `opponentUser`, `house`, `seed`, `lookView`, `clashView`, `outcome`, `overall`, `finish`,
  `discoverSynergies`, `trophy`, `state`, `ids`, `pickSquad`, `num`, `stylePoints`, `looksById`, `cardsById`,
  `RUNWAY_THEMES`, `runwayTheme`, `runwaySeason`, `tourView`, `draftView`, `ownDraft`, `DECK_RULE`, `suggestDeck`,
  `wardrobe`, `autoUltimate` (agora nos colaboradores, com o mesmo nome e assinatura). Nenhum foi apagado.
- No serviço, os banners de seção foram agrupados (Liga + Runway, World Tour + Monopoly/Conquest, Draft + Deck), da
  mesma forma que o original já agrupava "Monopoly e Conquest".

## Por que Facade (e não Strategy nem Template Method)

- **Facade**: `FlairModesController`, `FlairCardModesController` e `FlairService` continuam falando só com
  `FlairModesService`, que esconde 11 colaboradores por modo e 6 de apoio e coordena transação e dependências. A
  estrutura extraída é de fato uma fachada; nenhuma interface artificial foi criada.
- **Strategy / Template Method avaliados e descartados**: os modos não têm o mesmo ciclo. Duelos são uma chamada só
  (`battle`, `squad`, `combo`, `tagTeam`, `fightBoss`, `wardrobeWars`, `chess`); a Liga tem elenco + tabela + rodada; o
  World Tour tem dado + desafio pendente; Draft e Deck abrem uma partida e a fecham em passos diferentes (escolhas
  alternadas × jogada única); Ultimate guarda funções. As assinaturas públicas são todas diferentes, cada endpoint
  chama um modo fixo e nada escolhe o modo em tempo de execução por código. O único passo comum é o final
  (`FlairMatchRecorder.finish`), chamado por cada modo com dados próprios: é um colaborador compartilhado, não um
  esqueleto com ganchos. Uma interface `FlairMode` com `start/play/score` teria métodos vazios ou com parâmetros
  genéricos (`Map<String, Object>`) só para "ter padrão".
- `FlairModeParts` é só a montagem dos colaboradores (um record com fábrica estática). Não é Abstract Factory nem
  Builder: não há famílias de produtos nem montagem passo a passo, então não registramos padrão para ele.

## Testes e equivalência

Caracterização antes: novo `FlairModesFacadeCharacterizationTest` (165 linhas, 5 testes, testkit `Kit` + `World` +
`MemoryRepository`), escrito e verde **no código original** (commit `02f6823`). Ele congela com SHA-256 o catálogo estático
(`MODES`, `BOARD`, `TERRITORIES` e as partes de ordem estável de `catalog()`; `Map.of`/`Set.of` do motor iteram em ordem
aleatória por JVM, por isso as outras partes ficam fora do digest), os utilitários puros, os códigos `status:code` de 14
validações (oponente, elenco, liga sem elenco, tour sem desafio, ataque, deck, boss, xadrez, ultimate, draft, wardrobe,
tag team), o formato gravado do elenco da liga e da partida aberta do Draft, as chaves e a ordem dos payloads (battle +
`finish`, tour, runway, territórios, deck, ultimate, xadrez) e a regra de moedas 20/8/3. Depois da extração, só as
referências aos utilitários movidos (`FlairModesService.num` → `FlairModeValues.num`, `territory`, `house`,
`stylePoints`, `ids`, `seasonKey`, `weekKey`, `runwayTheme`, `runwaySeason`, `DECK_RULE`, `RUNWAY_THEMES`) foram
reapontadas para os novos donos; nenhuma asserção mudou. `FlairModesServiceTest` (21 testes, cobre todos os 31 públicos)
não foi alterado.

```
mvn -B -q -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false \
    -Dtest='FlairModesServiceTest,FlairModesFacadeCharacterizationTest' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -q -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,ContratoRotasPorTagTest' test
mvn -B -q -o -pl fai-application -Djacoco.skip=true test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original, `FlairModesServiceTest` | 21 testes, 0 falhas, 0 erros |
| Original + `FlairModesFacadeCharacterizationTest` | 26 testes, 0 falhas (digests estáveis em execuções repetidas) |
| Após o Facade | **26 testes, 0 falhas, 0 erros** |
| `fai-web` install (compila contra o novo serviço; `ServiceFakes` sem alteração) | OK |
| `ControllerDelegacaoTest` + `ContratoRotasPorTagTest` | 697 + 1 testes, 0 falhas |
| Suíte completa de `fai-application` (depois) | 2034 testes, 0 falhas, 0 erros, 27 skipped |
| Catraca | `FlairModesService.java` só como `APERTAR` (1643 → 248); 0 violações; nenhum arquivo novo acima do limite |

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n/JSON.

## Pendências

- Nenhuma para o limite: o serviço ficou com 248 linhas (limite 250). O que sobra é contrato: 31 métodos públicos (30 com
  `@Transactional`), construtor de 16 argumentos, 3 records públicos e as constantes públicas.
- Possível passo futuro (fora do escopo, muda testes): levar `FlairModesServiceTest` a chamar `FlairModeLooks.look` e
  `FlairLeagueMode.table` direto, o que tira as duas delegações package-private restantes.
- `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
