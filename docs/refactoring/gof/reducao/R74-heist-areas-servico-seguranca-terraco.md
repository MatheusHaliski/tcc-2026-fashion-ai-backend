# Lote R74-heist-areas-servico-seguranca-terraco — áreas de serviço, segurança, terraço e móveis dos bastidores

Base: `claude/relaxed-pasteur-5b5466` (`164c90e`). Branch: `worktree-agent-a0a0c4c9ee4815144`. Objetivo: os 6 arquivos de
`components/heist/scene/areas/` dentro do limite da categoria `lib-ts` (**250** linhas, `docs/refactoring/LINE_RULES.md`),
por extração de responsabilidades, sem mudar nenhum número, string, chave de cache nem a ordem das chamadas.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `servico-kit.ts` | 543 | 19 | `servico-kit-pbr.ts` (174) — ruído e superfícies PBR (com `FAKE`); `servico-kit-mats.ts` (68) — `once`, `pbrMat`, paleta `SM`; `servico-kit-frame.ts` (53) — referencial `Fr`, `rbox`, `lathe`, `tube`, `light`, `SPHg`, `xyz`; `servico-maze.ts` (95) — labirinto (`mazeInfo`, `zoneOf`, `COPA_ZONES`…); `servico-text.ts` (48) — `SRV_TEXT`, `localeOf`, `textOf`; `servico-signs.ts` (139) — atlas e placas (`signAtlas`, `signGeo`, `sign`, `signOn`…) | NENHUM |
| `servico.ts` | 338 | 209 | `servico-quads.ts` (35) — `H`, `flatQuad`, `wallQuad`, `faceZones`; `servico-equipe.ts` (132) — câmara fria, cortina, armários, quadro de avisos, o que a equipe deixou, quadro elétrico e miudezas de prédio | NENHUM |
| `servico-copa.ts` | 357 | 190 | `servico-copa-kit.ts` (40) — comida tingida, louça/vidraria torneada, cuba GN, pés e tampo de inox; `servico-copa-cozinha.ts` (152) — fogão com coifa, geladeira, bancada de preparo, estante | NENHUM |
| `seguranca.ts` | 329 | 214 | `seguranca-tex.ts` (52) — painel do palco/pista e planta do museu; `seguranca-moveis.ts` (86) — mesa de coordenação, racks, armário do café | NENHUM |
| `terraco.ts` | 469 | 209 | `terraco-kit.ts` (77) — paleta do jardim, `box`, chama, folhas, folhagem, lanterna de ferro, `ROOM`; `terraco-moveis.ts` (212) — móveis da planta (jardineiras, teca, mesa de fogo, drinks, banco, totem, bistrô, cinzeiro, canteiros, pilares do pergolado) | NENHUM |
| `bastidores-moveis.ts` | 349 | 176 | `bastidores-tinta.ts` (10) — sala, `COL`, `TINT`; `bastidores-mesas.ts` (97) — mesa da produção, folha de chamada, parede de monitores; `bastidores-proprios.ts` (102) — costura, carrinho de acessórios, cases, cadeiras de diretor | NENHUM |

Nenhum arquivo do lote estava no baseline (eram violações novas); depois do lote nenhum aparece em
`line_ratchet.py` (violações totais 54 → 48, as restantes são de outros lotes). Todos os arquivos novos ≤ 212.

## Como foi dividido

- **Movimento por faixas de linhas**: os trechos foram copiados do original por faixas de linhas (script), sem
  redigitar. A única mudança textual dentro deles é o prefixo `export` nas declarações que passaram a ser usadas por
  outro arquivo. Em `servico.ts`, três trechos do `dress` viraram funções (`staffFixtures`, `leftBehind`,
  `wallServices`) com o corpo idêntico, chamadas no mesmo lugar e recebendo a mesma paleta `S`, o mesmo sorteio `R`
  (`rand(401)`, consumido na mesma ordem) e o mesmo `info`.
- **Consumidores sem mudança**: `servico-kit.ts` reexporta tudo (`export *` dos 6 módulos), então `servico.ts`,
  `servico-copa.ts`, `servico-pecas.ts`, `seguranca.ts`, `bastidores.ts` e `bastidores-moveis.ts` continuam importando
  de `./servico-kit`; `servico-copa.ts` mantém `copaFixture` e o `export { plateGeo, … gnPan }`;
  `bastidores-moveis.ts` reexporta `callDesk`, `monitorWall`, `productionDesk` e `bastidoresFixture` (o import de
  `bastidores.ts` não mudou). Os `AREA` de servico/seguranca/terraco continuam nos arquivos originais.
- **Estado de módulo preservado**: caches (`pbrs`, `mats`, `atlasMats`, `mazeCache`) mudaram de arquivo junto com as
  funções que os usam (uma instância só); `pendingFlames`/`pendingTotem` do terraço moram em `terraco-moveis.ts` e são
  os mesmos arrays que `terraco()` esvazia.
- **Prova de movimentação** (script comparando `HEAD` com os arquivos atuais, sem imports, cabeçalhos e o prefixo
  `export`): 2195 linhas originais, 0 faltando exceto o separador `/* === textos e placas === */` (os dois arquivos
  novos têm cabeçalho próprio); extras só o andaime das 3 funções de `servico-equipe.ts` e as constantes `room` de
  `servico-equipe.ts`/`seguranca-moveis.ts`.

### Por que NENHUM padrão GoF

- `servico-kit.ts` virou um índice de reexportação para não mexer nos consumidores; não simplifica interface nem
  coordena colaboradores, então não é registrado como Facade.
- Os demais são módulos de construtores procedurais (funções que escrevem num lote): separar por grupo de móveis,
  texturas e materiais é organização por responsabilidade; não há família de variações (o despacho por `model` já é
  um `switch` simples), estado nem árvore a compor.

## Testes e equivalência

Caracterização nova, escrita e gravada **no código original** antes de qualquer extração:
`components/heist/scene/areas/areas-servico-seguranca-terraco.snapshot.test.ts` (194 linhas, jsdom) +
`areas-servico-seguranca-terraco.snapshot.json` (2447 linhas). Para cada móvel da planta das 4 salas (10 + 6 + 22 + 16)
e para cada `dress` (servico, seguranca, terraco em "low" e servico/terraco em "high"), num contexto próprio com lote e
instâncias que registram cada chamada: SHA-256 da sequência de chamadas (sala, material, geometria, matriz a 3 casas,
sombra), malhas mescladas (material, vértices, caixa), instâncias (chave, material, contagem, caixa), âncoras de luz,
chamas, giroflex, o que anima, objetos soltos no grupo e o estado depois de rodar os ticks (normal e alarme). Do kit:
ruído, pixels das 10 superfícies PBR em low/high (o contexto 2D do teste guarda o `putImageData`), paleta `SM`, `pbrMat`,
chamadas do `Fr`, `mazeInfo()` completo, zonas, `SRV_TEXT`, UV de cada placa e o atlas nos 3 idiomas × 2 qualidades.

| Etapa | Comando | Resultado |
|---|---|---|
| Original (gravação + confirmação) | `npx vitest run components/heist/scene/areas/areas-servico-seguranca-terraco.snapshot.test.ts` (2×) | 1º grava o JSON; 2º passa sem mudar (md5 `c767bd58…`) |
| Original | `npx vitest run components/heist components/lab` / `npx tsc --noEmit` | 5 arquivos, 27 testes OK / 0 erros |
| Depois de cada arquivo extraído | retrato + `npx tsc --noEmit` | idêntico a cada passo; 0 erros |
| Final | `npx vitest run components/heist components/lab` | 6 arquivos, 28 testes OK (27 + retrato) |
| Final | `npx tsc --noEmit` | 0 erros |
| Final | `python3 scripts/refactoring/line_ratchet.py` | nenhum arquivo do lote nem novo listado; 48 violações (todas de outros lotes) |

## Pendências

Nenhuma do lote. Os 6 arquivos e os 17 novos estão dentro de 250 linhas. O baseline não foi tocado (nenhum arquivo do
lote estava congelado).
