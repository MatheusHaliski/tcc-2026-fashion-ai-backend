# Avatar 3D — cobertura do cabelo, abertura dos olhos e cor dos lábios

## Problemas corrigidos

A textura da base do cabelo atribuía alfa entre 150 e 255 a todo o volume. Em MSAA, isso reduzia a cobertura inclusive no couro cabeludo. A base agora permanece opaca; o atlas de fibras conserva fundo vazio e bordas recortadas. O shader trata o interior de cada fibra sobrevivente como opaco e usa antialiasing apenas na sua borda. Ele consulta a amostragem do framebuffer no desenho: alvos sem MSAA usam recorte opaco, sem presumir que a configuração do canvas também vale para todos os render targets.

Limitar o globo ocular no shader não eliminava os triângulos de pele que atravessavam a abertura do olho. `openEyeSockets` subtrai o contorno medido da superfície anterior da órbita, conservando a parede posterior. Novos vértices recebem UV, normal e pesos interpolados; os identificadores de ossos são combinados pelos pesos, sem interpolar números de ossos. O recorte faz parte da geometria e acompanha a cabeça também na exportação GLB. A linha d'água acompanha o contorno inferior observado.

As correções de iluminação e de cor da pele também alteravam os lábios. Uma máscara no contorno externo dos lábios protege a cor presente na fotografia, incluindo batom e o interior escuro da boca. O sistema não gera batom para quem não o tem nem condiciona a preservação ao sexo cadastrado.

## Verificação

```sh
npx vitest run \
  lib/avatar3d/human/hair-coverage.test.ts \
  lib/avatar3d/human/hair-geometry.test.ts \
  lib/avatar3d/human/hair-strands.test.ts \
  lib/avatar3d/human/eyes.test.ts \
  lib/avatar3d/human/skin-bake.test.ts \
  lib/avatar3d/human/attach-hair.test.ts --maxWorkers 1
npm run typecheck
```

Os 52 testes dessa execução passaram. Os casos verificam cobertura com e sem MSAA, níveis de detalhe, ancoragem, conservação da pupila/esclera, abertura estreita e inclinada, raios atravessando a abertura sem pele na frente, pesos de ossos válidos e preservação das cores de lábios naturais ou com batom.

A inspeção visual em Chromium/WebGL 2.0, com MSAA de quatro amostras, completou nove cenários: frente, olhos estreitos, olhos estreitos e inclinados, lábios naturais, LODs 0/1/2/3, óculos e comparação sem o recorte anterior da órbita. Nenhum erro de página ou shader foi registrado. O laboratório gera um quadro explícito por captura para não saturar a GPU por software com animação contínua. Os arquivos estáticos do avatar vêm do repositório; chamadas externas da API são simuladas.

[Relatório dos cenários](evidence/avatar-refinements-2026-10-09/browser.json), [olhos antes](evidence/avatar-refinements-2026-10-09/eyes-before.png), [olhos depois](evidence/avatar-refinements-2026-10-09/eyes-after.png), [abertura inclinada](evidence/avatar-refinements-2026-10-09/eyes-narrow-tilted.png), [cabelo](evidence/avatar-refinements-2026-10-09/hair-lod1.png) e [lábios naturais](evidence/avatar-refinements-2026-10-09/natural-lips.png).

A inspeção visual usa o `AvatarViewer` real, com o corpo do repositório e um atlas sintético de olhos, sobrancelhas e lábios. As capturas não são reconstruções das fotografias enviadas pelo usuário. O laboratório temporário de inspeção é removido antes do commit.

## Limites

O cabelo continua sendo gerado por uma base e fitas de fibras; sua silhueta e penteado não equivalem a uma digitalização de fios reais. Preservar a cor de batom não recupera detalhe ausente ou borrado na foto. A qualidade depende da medição do rosto e do atlas; iluminação, maquiagem, cabelo cobrindo o rosto e enquadramento podem afetar esses dados. Os resultados de GPU por software usados na auditoria não devem ser usados como medida de FPS em aparelhos reais.
