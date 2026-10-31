# Módulo 14 — AURA, Background Studio, cartas e animações: lote STUDIO-ARTWORK-RULES-001

Base: `bcaee73` (main após PR #416). Branch: `gof/14-aura`. `git status --short` limpo antes do lote.
Lote Java puro (sem mudança em TS/React, sem mudança visual).

## Mapeamento real do fluxo

Editor do card (Background Studio / editor AURA da peça, `components/background-studio.tsx`,
`components/piece-art-editor.tsx`) → `BackgroundController` (`fai-web`)
→ `BackgroundStudioService.saveScheme` / `savePiece` (`@Transactional`)
→ `requireAuraAccess` (`AuraPermissionsService`, `MetamorphoseInventoryService`) → `applyToScheme` (esquema:
cor/gradiente/AURA/material/anatomia/container → `Scheme.studioConfigJson`) e `savePieceInternal` → **`withRevision`**
(peça: `WardrobeItem.backgroundConfigJson` com `rev`/`baseRev`).

As regras estáticas `validateArtwork`, `validHypeMode`, `validateMotionWrite` e `withRevision` também são chamadas fora do
serviço: `WardrobeService` (criar/atualizar peça com fundo), `AuraCommerceService` (compra de composição),
`MetamorphoseInventoryService` (inventário da Metamorfose) e `AuraMotionServiceTest` (motion só do servidor).

## Problema concreto e decisão

`BackgroundStudioService` (812 linhas, congelado no baseline) misturava ~85 linhas de **validação pura do payload de
arte** (composição AURA curada com 9 condições num único `||`, 78 modos Hype — 6 fixos + 32 acabamento×layout + 40 técnica×paleta — em duas regex inline, Metamorfose +
presets de marca, enquadramento, borda, motion server-only e revisão otimista) com catálogo, IA, upload, persistência
e renderização. Essas regras não dependem de Spring, repositório, storage ou relógio e são compartilhadas por 3 outros
serviços — é uma responsabilidade coesa e testável isoladamente.

Extraída para **`StudioArtworkRules`** (package-private, `final`, sem estado, mesmo pacote). O serviço mantém
delegações de 1 linha com as mesmas assinaturas package-private, então nenhum consumidor (`WardrobeService` —
domínio 04 —, `AuraCommerceService`, `MetamorphoseInventoryService`, testes) foi alterado. `PHOTO_FRAMINGS` passou a
viver na unidade nova; `BackgroundStudioService.PHOTO_FRAMINGS` continua público e aponta para o mesmo `Set`.

Dentro da unidade, o `if` de 9 cláusulas virou `validComposition` (forma positiva equivalente por De Morgan, coberta
caso a caso pela caracterização), e Metamorfose/borda viraram métodos privados. Listas e regex viraram constantes
nomeadas. A **ordem das checagens** (composição → Hype → Metamorfose → preset de marca → enquadramento → borda) e a
ordem em `withRevision` (motion → arte → revisão) são contrato e foram preservadas.

### Padrões avaliados e não aplicados neste lote

- **Chain of Responsibility (validadores de arte):** a validação é fail-fast com 5 grupos fixos; diferente do cadastro
  (lote 02) não há acumulação de erros nem aplicabilidade por tipo. Uma cadeia só adicionaria indireção; funções privadas bastam.
- **Strategy (modos Hype/Metamorfose):** os modos são dados validados por lista/regex; o comportamento visual vive no
  front-end. Não há algoritmo variando no servidor.
- **Flyweight (presets/anatomias/direções imutáveis):** `DIRECTIONS`, `SEAL_PLACEMENT`, `ANATOMIES` já são constantes
  estáticas compartilhadas; não há criação repetida a otimizar. Mover o catálogo fica como próximo lote possível, por
  coesão, não por padrão.
- **Memento + Command (desfazer/refazer do editor):** pertence ao front-end (`piece-art-editor.tsx`); fora deste lote Java.
- **Builder (studioConfigJson):** `applyToScheme` mistura validação com acesso ao `AssetCatalogService` e mutação da
  entidade; extrair exige caracterização mais ampla de `resolved` — pendência abaixo.
- **Singleton:** nenhum manual; a unidade nova é estática e sem estado.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** da extração (`BackgroundStudioArtworkContractTest`, 8 testes novos: cada cláusula da composição AURA, limites 80/160, 5 famílias, Hype/Metamorfose/presets de marca, enquadramento, borda, ordem do primeiro erro, motion server-only, ordem das chaves e precedência de erros em `withRevision`) + testes existentes | `mvn -B -q -pl fai-application -Dtest=BackgroundStudioArtworkContractTest,BackgroundStudioServiceTest,BackgroundStudioAnimationTest,PieceArtRevisionTest,AuraMotionServiceTest -Dsurefire.failIfNoSpecifiedTests=false test` | 48 testes, 0 falhas |
| Depois da extração + `StudioArtworkRulesTest` (6 testes: delegação idêntica, 32 combinações acabamento×layout, paleta com `null`/id vazio, borda, revisão com `baseRev` decimal, motion mantido) + consumidores | mesmo comando + `StudioArtworkRulesTest,AuraCommerceServiceTest,AuraPermissionsServiceTest,MetamorphoseInventoryServiceTest,WardrobeServiceEstudioTest` | 80 testes, 0 falhas |
| Catraca de linhas | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | `BackgroundStudioService` APERTAR 812 → 736; 0 violações nos arquivos tocados (12 violações em arquivos de outros lotes, por a worktree partir de `bcaee73`) |

Logs: `evidence/14-aura-artwork-baseline.log`, `evidence/14-aura-artwork-after.log`.
Suíte completa não executada (máquina compartilhada com outros agentes); `fai-web` não referencia os métodos tocados.
Sem banco, servidor, rede, GPU/IA paga ou mídia real.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `BackgroundStudioService.java` | 812 | 736 (−76; −9,4 %) |
| `StudioArtworkRules.java` (novo) | — | 127 |
| Runtime combinado | 812 | 863 (+51: javadoc da classe, constantes nomeadas, assinaturas dos métodos privados, 4 delegações) |
| `BackgroundStudioArtworkContractTest.java` (novo) | — | 174 |
| `StudioArtworkRulesTest.java` (novo) | — | 90 |

## Contratos preservados

Assinaturas estáticas (`validateArtwork`, `validHypeMode`, `validateMotionWrite`, `withRevision`), `PHOTO_FRAMINGS`
público, códigos `AURA_COMPOSITION_INVALID`/`AURA_HYPE_INVALID`/`AURA_METAMORPHOSE_INVALID`/`PHOTO_FRAMING_INVALID`/
`CARD_BORDER_INVALID`/`AURA_MOTION_SERVER_ONLY` (400) e `ARTE_ALTERADA` (409), mensagens e chaves i18n, ordem das
checagens, formato de `backgroundConfigJson` (ordem das chaves, `baseRev` removido, `rev` incrementado) e
`studioConfigJson`, `@Transactional`, autorização AURA. Sem mudança de DTO, URL, schema, migration, front-end,
`reduceMotion` ou estética.

## Riscos e pendências do domínio 14

- `BackgroundStudioService` continua PARTIAL (736 linhas): `applyToScheme` (~165 linhas) mistura validação de presets
  com catálogo, mutação da entidade e montagem de `resolved`; `generateArt`/`generateSkinThumbnail` duplicam o
  `RemoteStep` anônimo; o catálogo estático (anatomias, selos, direções) pode ir para unidade própria.
- `AuraMotionService` (155) e componentes `components/hype`, `background-studio.tsx`, `piece-art-editor.tsx` não foram
  tocados; histórico desfazer/refazer do editor e listeners/rAF ficam para lote TS com vitest.
- Baseline: o orquestrador deve rodar `line_ratchet --update` para baixar o teto de `BackgroundStudioService` para 736.
