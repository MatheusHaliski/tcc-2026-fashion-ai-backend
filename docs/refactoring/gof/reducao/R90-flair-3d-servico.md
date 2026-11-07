# Lote R90-flair-3d-servico — mapeamento de cartas extraído de `FlairChallengeService` + serviço dos jogos

Base: `claude/adoring-davinci-mufbri`. Pacotes: `fai-application/.../application/flair/` e `.../application/service/`,
`fai-web/.../controller/`, `fai-domain/.../model` e `.../repository`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `service/FlairChallengeService.java` (`java-service`, 250; congelado) | 1035 | 1005 | `flair/CbcCardMapper.java` (89) | nenhum |

Arquivos novos do FLAIR 3D MAKE UP (sem extração, todos dentro do limite):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `flair/CbcCardMapper` | 89 | `FlairCardInstance` → `CbcRules.Card` (tags do retrato ou da peça via função `tagsOf`, Hype numérico, datas da peça viva); `pieces()` carrega as peças uma vez |
| `service/Flair3dAccess` | 150 | `WardrobeLevel` (faixas do Inventory Score), `Me` (nível FAI + faixa, UMA leitura de cada), `check` (só informa) e `require` (403 `FAI_LEVEL_REQUIRED` / `WARDROBE_LEVEL_REQUIRED`); `Level.valueOf` estrito no catálogo |
| `service/Flair3dRewards` | 167 | recompensas extras idempotentes por (pessoa, jogo, código) via `flair_game_rewards`: Item do quarto (origem `FLAIR_3D`, `PENDING` sem sku) e carta Especial (R1, `originId` = linha da recompensa) |
| `service/FlairGameService` | 212 | bean `@Service`: `summary`, `list` (filtros), `detail`, `check`, `submit` (`@Transactional`); bloqueio como PRIMEIRA instrução de check/submit; delega ao `FlairChallengeService` e anexa `glass`, `FLAIR_3D_PERFECT` e `rewards` |
| `service/FlairGameViews` | 166 | montagem dos JSONs (§1.4): campos FLAIR 3D MAKE UP do resumo, ficha/cena/vagas com `optional`+`effects` no detalhe, contadores, reconstrução de `SlotResult`, abertura da história pela ficha, linha de perfeição |
| `service/FlairGame3dScore` | 130 | o bloco `glass` de uma partida, puro: faixa de Hype, bônus de jogada, efeito por vaga, faixa de partida, totais, `scoreMax`, `perfect` (R2) |
| `controller/FlairGameController` | 66 | 5 rotas `/api/flair/games[/summary|/{slug}[/check|/submit]]` (`summary` declarado antes de `{slug}`) |
| `model/FlairGameReward` + `repository/FlairGameRewardRepository` | 67 + 17 | entidade `flair_game_rewards` e consultas por (pessoa, jogo[, código]) |

## Como foi dividido

- `FlairChallengeService.models(Collection<FlairCardInstance>)` (33 linhas, só I/O de peças + mapeamento) virou uma
  delegação de 3 linhas para `CbcCardMapper.models(list, pieces, FlairCollectionService::tagsOf)`. O construtor do
  serviço NÃO mudou (R13: o helper é estático e recebe o repositório e a função de tags por parâmetro); os imports
  `ZoneOffset` e `WardrobeItem` que só o corpo movido usava saíram. `FlairCollectionService.tagsOf` continua
  package-private (fora dos arquivos deste lote): o mapper recebe a função em vez de depender dela.
- Duas trocas de linha (sem crescer): `pointsLines` usa a ação `FLAIR_3D` quando `c.getSeries() != null` (R9), e o
  laço de `list()` pula `series != null` para os 100 jogos não poluírem `/flair/desafios`.
- O serviço dos jogos chama membros package-private do `FlairChallengeService` (`summary`, `window`, `now`, `mineBy`)
  por estar no mesmo pacote — o contrato do CBC (API, DTOs, URLs, `@Transactional`, autorização) não mudou.

## Por que "nenhum"

`CbcCardMapper` é uma função utilitária pura extraída (um método estático com I/O mínimo); não há família de
algoritmos escolhida em tempo de execução (Strategy), nem interface de fachada nova (o `FlairChallengeService` já era
o ponto de entrada e continua sendo). `FlairGameService` sobre `FlairChallengeService` + `Flair3dAccess` + `Flair3dRewards`
é composição comum de serviço: cada rota chama uma sequência fixa; não esconde um subsistema de vários colaboradores
com interface própria a ponto de justificar Facade.

## Testes e equivalência

| Etapa | Resultado |
|---|---:|
| Caracterização antes: `FlairChallengeServiceTest` + `FlairChallengeServiceAdminTest` no original | 19 testes, 0 falhas |
| Depois da extração: os mesmos 19 + `CbcCardMapperTest` (4) | 23 testes, 0 falhas |
| Novos: `Flair3dAccessTest` (9), `Flair3dRewardsTest` (5), `FlairGameServiceTest` (9), `FlairGameControllerTest` (4, fai-web, dublê manual — R3) | 27 testes, 0 falhas |
| Catraca | `FlairChallengeService.java` 1035 → 1005 (`--update`); 0 violações |

Sem banco, migração escrita à mão (V86 é gerada pelo build dos jogos), deploy, IA ou dados reais.
