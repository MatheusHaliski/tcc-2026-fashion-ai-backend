# Build e camadas do provador — 7 de outubro de 2026

O deploy da `main` no commit `3a7a33c4` falhava porque `garments.ts` importava `fabricRows` e `fabricTile`, mas essas funções não existiam na versão de `garment-photo.ts` que chegou ao merge. Após restaurá-las, a checagem TypeScript também revelou o import ausente de `prepareFaceTexture`. Os três símbolos e os textos dos controles de múltiplas peças foram restaurados.

## Camadas

O provador prepara e valida os moldes externos antes de ocultar as áreas cobertas da roupa interna. A visibilidade do tecido inclui o envelope contínuo sobre o quadril; punhos, gola e barra separados obedecem à mesma ordem de camadas. Partes da roupa interna continuam visíveis quando o casaco é mais curto, tem mangas menores ou um decote mais profundo. Se o molde externo falhar, a roupa interna permanece visível.

A máscara de visibilidade é aplicada separadamente dos dados usados para alinhar a fotografia. Ocultar o cós por baixo de uma jaqueta mantém a posição da textura da calça. A filtragem local de fotos de catálogo com modelos de corpo inteiro também foi recuperada, com retorno para a cor cadastrada quando não houver um recorte confiável em cinco segundos.

## Validação

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 npm run build`: compilação Turbopack, TypeScript, verificação de traduções e geração das páginas passaram.
- `npx vitest run`: 105 arquivos, 980 testes passando.
- Seis regressões de camadas verificam corpos masculino/feminino, punhos e barra cobertos, decotes e mangas expostos, casacos longos, roupa de proteção preservada e alinhamento da foto da calça.
- `docs/cloth-layer-evidence`: Chromium com WebGL por software na aplicação de produção (`npm run start`), com avatar e imagens sintéticos e API simulada. Frente, perfil e costas; sem erros de página/console e sem acabamentos da camiseta padrão desenhados por cima do blazer.

A captura é reproduzível com `scripts/validation/try-on-layers.cjs`, a aplicação iniciada em `http://127.0.0.1:3000` com `DEV_GATE_ENABLED=false` somente no teste local, a URL pública da API definida durante o build, Chromium instalado e `playwright-core` disponível. É possível informar `PLAYWRIGHT_MODULE_PATH` e `CHROMIUM_PATH` para instalações fora do projeto. Os dados e imagens usados são definidos no próprio script, sem contas reais.

## Limites

Esta validação verifica cobertura e sobreposição no molde paramétrico. Não comprova a fidelidade de cada foto real do catálogo nem simulação física do tecido. Peças abertas, detalhes nas costas e estampas não periódicas continuam dependendo de informação adicional ou de um modelo 3D próprio. A combinação suave da textura é específica do shader do provador e não é exportada para glTF.
