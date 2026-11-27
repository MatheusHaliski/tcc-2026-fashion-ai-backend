# Lote R87 — provador veste o `.glb` do produto

Extração feita antes de acrescentar o caminho do `.glb` ao `HumanOutfit`, para o arquivo congelado não crescer.
Caracterização antes e depois: `outfit-selection`, `scenes`, `skin-isolation` e `default-outfit` (22 testes) verdes
nos dois lados.

| Arquivo | Antes | Depois | Extraído para | Padrão GoF |
|---|---:|---:|---|---|
| `components/three/human-outfit.tsx` | 291 | 249 (sai do baseline) | `outfit-finishes.ts` (partes do calçado, barra, punho, botões, costura, gola) | NENHUM |

Arquivos novos, uma responsabilidade cada: `outfit-glb.ts` (vestir pelo `.glb`, cache do ajuste),
`use-garment-glbs.ts` (carregar o `.glb`), `lib/avatar3d/human/glb-garment/{frame,align,wrap,index}.ts`.

Motivo do NENHUM: blocos de construção de malha movidos para funções, sem hierarquia nova. O caminho `.glb` × molde
é um `if` antes do molde (`wearGlb` devolve se vestiu); não é Strategy porque só há dois caminhos e o molde continua
sendo o padrão.
