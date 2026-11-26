# Editor de roupas 3D — onde as ferramentas moram (26/11/2026)

## Decisão

As ferramentas de roupa (material, pintura, estampa, modelagem e acabamentos) ficam no **editor 3D do Atelier**
(`components/atelier3d/editor.tsx`), como o painel **Ateliê da peça** (`components/atelier3d/garment/*`), com a
lógica pura em `lib/atelier3d/garment/*`.

Motivos:

- É o editor que recebe os `.glb` de roupa (criação local, importação e as peças geradas por outra sessão), versiona,
  colabora com convidados e exporta o `.glb` final. O editor de peça (`components/piece3d`) personaliza uma peça do
  acervo **sem alterar o GLB** e o backend dele (`CustomizationDocument`) só aceita transformações/material/vértices;
  ele continua igual nesta entrega (o painel pode ser montado nele depois, com o mesmo `useGarmentStudio`, quando o
  contrato da personalização aceitar a seção `garment`).
- O modelo de documento já existente (`SceneDocument` + `SceneHistory` com snapshots imutáveis) é reaproveitado:
  todas as edições de roupa vão numa seção opcional **`garment`** do mesmo documento. Assim desfazer/refazer,
  salvamento automático, conflito de versão, restauração e exportação funcionam sem caminho novo.

## Como funciona

| Peça | Arquivo | Papel |
|---|---|---|
| Estado serializável | `lib/atelier3d/garment/state.ts` | tipos, limites, `withGarment` (sem edições, a seção some) |
| Aplicação na cena | `lib/atelier3d/garment/apply.ts` | chamado no fim de `applyDocument`: viewport e exportação veem o mesmo resultado |
| Tecido | `fabrics.ts`, `weave.ts`, `textures.ts` | presets PBR (`MeshPhysicalMaterial`), normal map procedural da trama |
| Superfície | `surface.ts`, `raster.ts`, `paint.ts`, `patterns.ts`, `decal.ts`, `images.ts` | textura de cor composta por parte: fundo → padrão → estampas → camadas de pintura |
| Modelagem | `sculpt.ts`, `fit.ts` | pincel de escultura e ajustes de roupa gravados em `vertices` (contrato já existente) |
| Acabamentos | `extras.ts`, `stitches.ts`, `accessories.ts` | pespontos e botões/rebites como malhas filhas da parte |

- A pintura é **vetorial no documento** (traços em UV com cor, tamanho, opacidade, dureza, borracha; preenchimento) e
  rasterizada no navegador; o documento salvo fica pequeno e o desfazer volta traço a traço.
- Estampas enviadas (PNG/JPG/SVG) são rasterizadas para PNG/JPEG de até 512 px e guardadas uma vez em `images`
  (no máximo 4, ~360 kB cada), cabendo no teto de 2 MB do documento salvo pelo servidor.
- Exportação: `GLTFExporter` embute a textura composta (PNG no bufferView), o normal map da trama e as extensões
  `KHR_materials_sheen/clearcoat/transmission/volume`, todas já aceitas por `inspectGlb` e pelo `GlbInspector` Java.
  Intensidade do sheen vai embutida em `sheenColor` porque o glTF não tem fator de intensidade.

## Backend

Mudança mínima, sem migração: `Atelier3dService.Document` ganhou o campo opcional `garment` (`Map<String,Object>`,
seções conhecidas apenas). O JSON continua na mesma coluna de texto da versão, limitado a 2 MB.

## Limites conhecidos

- A modelagem move vértices existentes (não cria faces): malhas muito simples deformam em degraus.
- O decalque é cozido no UV da parte; UV com sobreposição repete a estampa nas ilhas sobrepostas.
- Sem UV a parte não aceita pintura nem estampa (o painel avisa).
