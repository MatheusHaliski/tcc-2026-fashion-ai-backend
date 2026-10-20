# Identidade das roupas e auditoria por marca — 20/10/2026

## O que mudou no renderizador

- Calças cargo conservam a projeção da fotografia. Antes, `construction=cargo` zerava `photoWeight`, apagando os detalhes do produto.
- A máscara de uma foto isolada pode fornecer dois painéis separados para as pernas. A projeção usa a largura de cada perna do avatar e da foto, em vez de projetar o vão entre as pernas sobre o tecido. A região do cós mantém a projeção conjunta, com transição gradual. Fotos sem evidência suficiente continuam no método anterior.
- Com fotografia válida, a camisa conserva seus botões, carcela, costuras e pontas de gola fotografados. O renderizador deixa de sobrepor a esses detalhes um conjunto genérico de sete botões e triângulos lisos de gola. As faixas estruturais de barra/punho e a borda do decote continuam sendo geometria do molde. Sem foto específica, o acabamento de referência continua disponível.
- O contrato técnico usa `specFor(piece)`, incluindo variação, atributos e material, em vez de informar a folga do molde genérico. A versão do molde passou para `fai-mould-skinwrap-v3`.

Isso preserva a identidade visível de cada produto, mas não reconstrói sua costura oculta nem converte botões fotografados em geometria 3D medida.

## Auditoria reproduzível por marca

```bash
FAI_BRAND_MESH_REPORT=work/brand-meshes.json npx vitest run scripts/tryon/audit-brand-meshes.test.ts
```

O comando lê somente `data/catalog/products` e `data/catalog/expansion/products`, em JSON/JSONL. Deduplica pela marca e pelo identificador disponível do produto (ID, URL oficial, SKU ou subcategoria/nome). A saída completa, incluindo cada produto, fica em `work/`; `resumo-marcas.csv` traz a agregação desta execução.

É uma auditoria de **parâmetros e disponibilidade de dados**, não um teste visual de todas as fotografias, nem uma medida de colisão de todos os corpos. `withoutMould` inclui acessórios que usam prévia 2D; não significa que todos esses registros estejam quebrados. `missingDimensions` indica ausência de medidas utilizáveis pelo contrato atual. Campos ausentes não são estimados como se fossem medidos.

A consulta de leitura ao catálogo de produção retornou HTTP 403 nesta sessão. Esta execução usa os arquivos locais, não o estado atual do banco em produção. Nenhum produto ou imagem de produção foi alterado.

## Validação e limites

Testes numéricos de UV exercitam os painéis separados e a preservação da foto cargo; testes de geometria exercitam os acabamentos e o contrato ajustado. Eles não certificam realismo visual ou precisão milimétrica de cada marca.

Não há malhas específicas aprovadas por produto no registro atual. O resultado continua `PARAMETRIC_MOULD`/aproximação, com projeção frontal e material estimado onde necessário. Faltam malhas/UV próprios, vistas laterais e traseiras e medidas por modelo para garantir posição exata de bolsos, costuras e encaixe em qualquer biotipo/pose.

## Regressão de CI identificada durante a revisão

O job frontend do PR #378 passou testes/build, mas falhou no CLS do Feed. O artefato do CI mostrou o diálogo do tutorial mudando de altura quando sua demonstração carregava: CLS 0,459 no mobile, 0,224 no tablet e 0,137 no desktop. O exemplo específico do Feed agora é carregado junto com o diálogo, mantendo os outros exemplos sob carregamento sob demanda e preservando Escape/instruções.

A auditoria de produção local com API sintética passou nas 27 combinações de rota/dispositivo: nenhum overflow, erro JavaScript ou violação WCAG detectada; CLS do Feed abaixo de 0,004. O limite de aprovação continuou em 0,1. Não foram relaxados os critérios do CI.

As fotografias locais imutáveis do acervo agora são reconhecidas pelo caminho exato **efetivamente carregado**. Elas não aguardam outra análise de pessoa/pose para serem aplicadas. URLs externas, uploads e fallbacks externos não herdam essa condição de um ID ou de uma imagem local que falhou. A captura 3D só é considerada pronta após `outfitReady`, com vértices realmente usando `photoWeight` da fotografia.

### Evidência final da referência 3D

`referencia-frontal.png` e `referencia-costas.png` são capturas do canvas do laboratório `/lab/scenes` em Chromium/SwiftShader: camisa, cargo e tênis do acervo FAI, não assets certificados de marcas comerciais. A cena ficou vestida e sem erros JavaScript; a calça tem 648 vértices e a camisa 920 com peso de fotografia maior que 0,5. Não há mais carcela/botões/gola-ponta genéricos sobre a foto da camisa. `captura-3d.json` registra os giros solicitados e as malhas efetivas; o giro da câmera usa interpolação, portanto o ângulo capturado não é uma calibração angular.

A referência foi carregada em viewport desktop e depois 390×844, mas o laboratório conserva canvas interno de largura fixa; isso não certifica a usabilidade mobile da rota `/try-on`. A inspeção ainda mostra serrilhado no recorte do decote/barra e limitações de encaixe/projeção nas costas. As imagens evidenciam a textura recuperada, não um resultado anatômico perfeito.

Validação desta rodada: suíte completa com 1.769 testes aprovados e 3 ignorados (um é o exportador de auditoria, executado separadamente com variável de saída); após a correção final de carregamento, mais 13 testes focados passaram. TypeScript e build de produção passaram. Nenhum teste numérico é tratado como prova de fotorrealismo.
