# Lote R92 — provador com os `.glb` da Meshy

Data: 19/11/2026. Branch: `wip/provador-meshy`. Ver `docs/provador/MESHY_GLB.md`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Padrão GoF |
|---|---|---|---|
| `components/three/human-outfit.tsx` | 249 | 210 | NENHUM — a foto da peça saiu para `outfit-photo.ts`; o arquivo ganha os acessórios e a sola do `.glb` |

Arquivos novos:

| Arquivo novo | Responsabilidade | Padrão |
|---|---|---|
| `components/three/outfit-photo.ts` | parte do corpo da peça, URLs e foto isolada em cache (extraída, mesmo contrato; `photoPart`/`photoUrls` reexportados) | NENHUM (extração) |
| `components/three/outfit-meshy.ts` | calçado e acessório de `.glb` no avatar; altura da sola | NENHUM |
| `lib/avatar3d/meshy/glb-read.ts` | leitura mínima de `.glb` sem DOM (posições e triângulos) | NENHUM |
| `lib/avatar3d/meshy/slots.ts` | regra por subcategoria (slot, osso, modo de prender, estado) | NENHUM (tabela de dados) |
| `lib/avatar3d/meshy/analyze.ts` | normalização: frente, par, abertura, braços abertos, manifesto | NENHUM |
| `lib/avatar3d/meshy/manifest.ts` | formato e validação do `.fit.json` | NENHUM |
| `lib/avatar3d/meshy/body-anchors.ts` | medidas do corpo nos pontos de âncora | NENHUM |
| `lib/avatar3d/meshy/place.ts` | peça → ponto do corpo, por slot | NENHUM |
| `lib/avatar3d/meshy/rigid.ts` | geometria presa ao osso (rígida ou flexível) e pele sob o calçado | NENHUM |
| `lib/avatar3d/meshy/size.ts` | tamanho por região (roupa e calçado) | NENHUM |
| `lib/avatar3d/meshy/tuck.ts` | calça de `.glb` debaixo da peça de cima | NENHUM |
| `lib/avatar3d/meshy/texture-budget.ts` | texturas ≤ 1024 px | NENHUM |

Não foi aplicado Strategy aos slots (`place.ts`): são cinco ramos de uma função pura escolhidos por um campo do
manifesto, sem estado nem variação em tempo de execução; uma hierarquia de classes só acrescentaria indireção.

## Contrato preservado

- `outfitOf`, `photoPart`, `photoUrls` e `HumanOutfit` mantêm os mesmos nomes e efeitos (os testes de seleção e de
  cenas importam de `human-outfit`).
- Roupa de `.glb` sem manifesto se comporta como antes, exceto pelas correções documentadas em MESHY_GLB.md (punho,
  faixa do tronco, espinho com a cabeça, folga só da camada da mesma região). Calçado com `.glb` deixa de cair no
  molde: passa a ser preso aos ossos dos pés (teste de caracterização atualizado em `outfit-glb.test.ts`).
