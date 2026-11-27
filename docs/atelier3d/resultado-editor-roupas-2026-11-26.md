# Resultado — editor de roupas 3D do Atelier (26/11/2026)

Decisão de arquitetura: [decisao-editor-roupas-2026-11-26.md](decisao-editor-roupas-2026-11-26.md).
Evidência: `scripts/atelier3d/verify-garment-tools.cjs` (Chromium + SwiftShader, API em memória, camiseta
`fai-tee-prototype.glb` versionada). Resultado da execução: [browser-results.json](editor-roupas-2026-11-26/browser-results.json).

## Ferramentas entregues (painel "Ateliê da peça")

| Aba | O que faz | Evidência |
|---|---|---|
| Material | 9 presets PBR (algodão, jeans, couro, seda/cetim, lã/tricô, linho, veludo, sintético esportivo, metálico/lantejoula) em `MeshPhysicalMaterial`; brilho de fibra (sheen) e cor, espalhamento, verniz (clearcoat), transparência (transmission), 8 tramas com normal map procedural, repetições e relevo; parte selecionada ou peça inteira; manter cor | [jeans](editor-roupas-2026-11-26/01-material-jeans.png), [veludo](editor-roupas-2026-11-26/02-material-veludo.png), [lantejoula](editor-roupas-2026-11-26/03-material-lantejoula.png) |
| Pintura | pincel e borracha em UV via raycast (cor, tamanho, opacidade, dureza), preencher parte, camadas (nova, ativa, visível, opacidade, excluir), limpar; cada traço = 1 passo de desfazer | [traços](editor-roupas-2026-11-26/05-pintura-tracos.png), [desfeito](editor-roupas-2026-11-26/06-pintura-desfeita.png), [borracha](editor-roupas-2026-11-26/07-pintura-borracha.png), [camada](editor-roupas-2026-11-26/07b-pintura-camada-preenchida.png) |
| Estampa | listras, xadrez, poá e camuflagem geradas por código (3 cores, repetições, rotação, opacidade); upload PNG/JPG/SVG; imagem como padrão repetido; decalque projetado (aplicar, recolocar, tamanho, rotação, opacidade, remover) | [listras](editor-roupas-2026-11-26/09-estampa-listras.png), [xadrez](editor-roupas-2026-11-26/10-estampa-xadrez.png), [camuflagem](editor-roupas-2026-11-26/11-estampa-camuflagem.png), [decalque](editor-roupas-2026-11-26/12-decalque-aplicado.png), [recolocado](editor-roupas-2026-11-26/13-decalque-recolocado-girado.png), [imagem repetida](editor-roupas-2026-11-26/14-padrao-imagem-manga.png) |
| Modelagem | pincel puxar/empurrar/inflar/encolher/suavizar com raio, força, queda e simetria X; barra, comprimento, folga, manga e decote por região (toda, cima, baixo, esquerda, direita, centro, frente, costas); espelhar lados; suavizar; restaurar; gizmo mover/girar/escalar já existente | [barra](editor-roupas-2026-11-26/17-forma-barra-alongada.png), [decote e folga](editor-roupas-2026-11-26/18-forma-decote-folga.png), [pincel](editor-roupas-2026-11-26/19-forma-esculpida-simetria.png) |
| Acabamentos | pesponto tracejado nas bordas abertas (cor, distância, ponto), botões e rebites por clique, luz de prévia (neutra/estúdio/quente, ambiente gerado localmente), manequim de costura só na prévia, miniatura PNG | [pespontos e aviamentos](editor-roupas-2026-11-26/22b-pespontos-botoes-rebites.png), [luz quente + manequim](editor-roupas-2026-11-26/23b-luz-quente-manequim.png) |

## GLB exportado e reaberto

Depois de todas as etapas a versão foi salva, exportada e reimportada pelo mesmo editor:
[camiseta-editada.glb](editor-roupas-2026-11-26/camiseta-editada.glb) (≈270 kB, 8 imagens embutidas,
`KHR_materials_sheen`, nós `FAI pesponto`/`FAI botão`/`FAI rebite`). Reaberta: [frente](editor-roupas-2026-11-26/26-glb-exportado-reaberto.png),
[perspectiva](editor-roupas-2026-11-26/27-glb-reaberto-perspectiva.png) — pintura, decalque, tecido, forma e aviamentos preservados.

## Testes (vitest, só arquivos tocados)

`lib/atelier3d/garment/{fabrics,paint,prints,sculpt,finishing}.test.ts`, `components/atelier3d/garment/garment-studio.test.tsx`,
caracterização da barra/histórico em `components/atelier3d/editor.test.tsx`. Java: `Atelier3dServiceTest.garmentEditsAreAcceptedOnlyWithKnownSections`.

## Limitações

- A peça base é low-poly (lathe de 48 segmentos): o pincel de escultura move faixas inteiras; não há subdivisão
  (o contrato `vertices` não cria vértices novos).
- Decalque e pintura dependem do UV do arquivo; UV sobreposto repete a arte. Textura composta de 1024 px por parte.
- O manequim é um busto procedural de prévia: o avatar do repositório é um pipeline de foto, não um corpo reutilizável.
- O editor de peça (`components/piece3d`) não recebeu o painel: o contrato da personalização não guarda `garment`.
- A suíte Maven completa não compila em `main` por um erro em `flair3d/nucleos/BatalhaLooksRodadas.java` (fora do escopo);
  o teste Java novo foi compilado e executado isoladamente com `javac`.
