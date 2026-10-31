# Lote R03-imaging — `fai-application/.../application/imaging/`

Base: `claude/serene-thompson-yetcg5` (`a0e10d7`). Branch: `gof/r03-imaging`. Objetivo: os 7 arquivos do lote dentro de
250 linhas (`docs/refactoring/LINE_RULES.md`), por extração de responsabilidades, sem mudar nenhum pixel, byte ou número.
`ImageOps.java` não foi tocado (outro lote).

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `BrandRegions.java` | 252 | 226 | `BrandTiles.java` (48) — grade de nova tentativa + caixas do logo/quadrantes (só geometria 0–1) | NENHUM |
| `PhotoAcceptance.java` | 293 | 204 | `PhotoMeasures.java` (103) — `bestSymmetry`, `clippedShare`, `components` (medidas de pixel) | NENHUM |
| `StudioFraming.java` | 270 | 193 | `StraightCuts.java` (96) — detecção de cortes retos (`cuts` + votação de inclinação `line`) | NENHUM |
| `SvgPathRenderer.java` | 269 | 212 | `SvgArc.java` (69) — arco elíptico SVG → Béziers cúbicas (SVG 1.1 F.6) | NENHUM |
| `WornPieceRegions.java` | 324 | 212 | `WornPersonBlob.java` (78) — bloco conexo da pessoa; `WornRows.java` (61) — `first`/`last`/`colourCut` do perfil por linha | NENHUM |
| `FlatLayPipeline.java` | 319 | 240 | `FlatLayMasks.java` (110) — portão de privacidade (`mayShowPerson` + limiares), `truncatedSides`, `hiResCutout` | NENHUM (ver abaixo) |
| `ReliefModelGenerator.java` | 310 | 231 | `GlbWriter.java` (98) — serialização glTF 2.0 binária + `isGlb` | NENHUM |

Todas as classes novas são `final`, package-private, estáticas e puras (sem Spring, sem I/O, sem provedor). Assinaturas
existentes com consumidores foram mantidas como delegações de 1 linha: `BrandRegions.tiles` (assinatura pública
intacta; o parâmetro `piece` já não era usado), `StudioFraming.cuts`/`straightCuts`, `WornPieceRegions.colourCut`,
`FlatLayPipeline.mayShowPerson`/`truncatedSides` (pública)/`hiResCutout`, `ReliefModelGenerator.isGlb` (pública).
Constantes públicas/consultadas (`PhotoAcceptance.COMPONENT_MIN_SHARE`, `WornPieceRegions.MIN_*`/`SPLIT_DIST`,
`FlatLayPipeline.STUDIO_SOURCE_MAX`) ficaram no dono original e são lidas pelos colaboradores.
`FlatLayPipeline.PERSON_SKIN_GATE`/`PERSON_SAMPLES` (sem consumidores fora da classe) foram com o portão de privacidade.

### Por que NENHUM padrão GoF

- **BrandRegions**: `zones` é um `switch` de 4 tabelas de caixas fixas; um Strategy por categoria só espalharia tabelas
  de 1 linha. A grade de nova tentativa é uma função pura.
- **PhotoAcceptance**: os critérios são validações ordenadas com motivo (candidato a Chain of Responsibility), mas
  compartilham medidas intermediárias (componentes, eixo, simetria) e têm saídas antecipadas que dependem umas das outras
  (sem fundo confiável, a forma não é medida). Um elo por critério exigiria um contexto mutável e não há variação de
  regras por tipo; a lista ordenada no método é mais legível. Só as medidas de pixel foram extraídas.
- **StudioFraming / SvgPathRenderer / WornPieceRegions / ReliefModelGenerator**: extrações de algoritmos puros (corte
  reto, arco, blob, varredura de linhas, serialização GLB); não há família de variações nem estado. O `switch` de
  comandos SVG poderia virar Interpreter/Command, mas compartilha o cursor de tokens e o ponto corrente — fragmentaria
  sem ganho.
- **FlatLayPipeline**: o bean já é a fachada do pipeline e as listas de portas externas com queda para o motor local
  já funcionam como Chain of Responsibility (primeira porta disponível que responde vence). Nada novo foi criado; só
  as leituras de máscara saíram. `@Component`, portas e registro de etapas continuam no bean.

## Equivalência (caracterização)

`ImagingSplitCharacterizationTest` (novo, 339 linhas) gera imagens sintéticas pequenas em memória (camiseta com mangas e
logo, cena vestida num `ClassMap` 48×80, foto 160×200 para o Flat Lay, SVG com todos os comandos M/H/V/L/C/S/Q/T/A/Z e
flags de arco colados) e compara 52 resultados — caixas de zonas/grades, `zoneOf`, `detectLogo`, relatórios de aceite
completos (`toMap`) em 8 cenários, `shapeCheck`/`aiPhotoChecks`, `Frame` de 3 enquadramentos, `cuts`, pixels de
`compose` (com e sem sombra) e `downscale`, segmentos do `Path2D` e pixels do render SVG, `Worn` detectados e
`colourCut`, PNG/JPEG/miniatura/fonte do estúdio/metadados/etapas do Flat Lay, `truncatedSides`, `mayShowPerson`,
`hiResCutout`, e o GLB (JSON canônico + SHA do bloco binário + cabeçalho + contagens/medidas) — por SHA-256 do texto.
Os valores foram capturados **no código original** e confirmados idênticos em 3 JVMs antes da extração.

Dois cuidados de determinismo descobertos ao capturar: `Set.of` com 2+ itens muda a ordem de iteração por JVM (o teste
usa `TreeSet`), e o JSON do glTF é montado com `Map.of` (ordem de chaves varia por JVM — comportamento preexistente, não
alterado); por isso o GLB é comparado com JSON canônico + bloco binário.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (código original + caracterização) | `mvn -B -o -pl fai-application -Dtest='ImagingSplitCharacterizationTest,BrandReaderTest,SubtypeAndBrandZonesTest,StudioFramingGhostLogoTest,LogoFilterTest,StudioAndReliefTest,WornPieceRegionsTest,PhotoAcceptanceTest,FlatLayPrivacyTest,FlatLayThumbnailTest,PhotoServiceTest,MultiPieceServiceTest,WardrobeAnalyzeFlowTest,WardrobeServiceParsersTest,WardrobeAnalysisTest,WardrobeServiceEstudioTest,RoomAssetServiceTest' -Dsurefire.failIfNoSpecifiedTests=false test` | 141 testes, 0 falhas, 19 skipped (`assumeTrue` preexistente, assets fora do checkout: `PhotoAcceptanceTest` 11, `SubtypeAndBrandZonesTest` 5, `WardrobeAnalyzeFlowTest` 3) |
| Depois da extração | mesmo comando | 141 testes, 0 falhas, 19 skipped; os 52 digests idênticos |
| Catraca | `python3 scripts/refactoring/line_ratchet.py --update` e `python3 scripts/refactoring/line_ratchet.py` | 7 entradas removidas do baseline; 0 violações |

Os 19 skips são `assumeTrue` preexistentes (fotos de peças reais fora do checkout); como `PhotoAcceptanceTest` pula
inteiro nesta máquina, a caracterização nova é a cobertura efetiva de `PhotoAcceptance.evaluate` neste lote. Consumidores em `fai-infrastructure/ai-providers` (testes de sonda) usam só API
pública inalterada (`BrandRegions.zones/crop/Zone`, `FlatLayPipeline.Result`, `WornPieceRegions.detect/Worn/Kind`).

Sem banco, servidor, rede, IA paga, GPU ou bucket. Nenhum DTO, URL, schema, i18n, visual, autorização ou transação mudou.

## Pendências

Nenhuma: os 7 arquivos ficaram ≤ 250 linhas e saíram do `line_baseline.json`.
