# Fotos das peças — recuperação e seleção

A peça deve usar sua foto e o enquadramento do produto. Uma miniatura, imagem processada ou foto indisponível não deve impedir o uso de outra foto da mesma peça.

## Alterações verificadas

- [x] URLs `/media/` do catálogo são resolvidas no backend, inclusive em recortes semânticos.
- [x] O card tenta as variantes de estúdio, miniatura, foto principal e origem oficial disponível, sem repetir a mesma URL.
- [x] O detalhe também recupera a foto principal quando o estúdio está indisponível.
- [x] O `srcSet` da miniatura anterior é removido ao trocar de fonte.
- [x] A origem oficial acompanha os metadados de novas seleções do catálogo; não é usada depois de uma troca da foto pelo usuário.
- [x] Selecionar tenta até três fotos utilizáveis do mesmo produto e não usa fotos recusadas pela revisão.
- [x] Selecionar usa `ProductRuleFrame`, a mesma regra do worker, incluindo calçados. Não exige um recorte só de tecido.
- [x] Fotos recusadas pela revisão deixam de participar da escolha da imagem principal, mesmo se estiverem marcadas como principais ou canônicas.
- [x] Corrigidos erros de compilação presentes na base: importação duplicada de `AuraHype` e referências inexistentes a `auraHypeEnabled` no backend. A preferência persistida continua `auraHype`.

## Evidências e limites

23 testes de frontend passaram, cobrindo recuperação de imagens, seleção e cadastro. 27 testes de backend passaram, incluindo alternativa indisponível, bytes inválidos, revisão rejeitada e enquadramento de calçado. `npm run typecheck` e o empacotamento Maven dos 13 módulos passaram.

O teste Playwright executa páginas reais do app local com API simulada e foto oficial real da Columbia. Falhas 404 de estúdio/miniatura são intencionais. O card e o detalhe carregaram a foto de 3000×3150, sem erros JavaScript. Isso verifica a recuperação no navegador, não a persistência no banco publicado.

- [Resultado do navegador](browser-result.json)
- [Card recuperando a foto](card-recupera-foto.png)
- [Detalhe recuperando a foto](detalhe-recupera-foto.png)
- [Amostra HTTP das fontes oficiais](fontes-oficiais-amostra.json): dez fotos de dez marcas responderam HTTP 200 e foram decodificadas.
- [Diagnóstico do pipeline com três fotos reais](pipeline-amostra.json): o enquadramento do produto foi encontrado para Vans, Columbia e Arezzo. A análise completa ainda apontou `IMAGE_TOO_SMALL` ou necessidade de reprocessamento; **enquadramento encontrado não equivale a aprovação automática da foto**.

Os JSONLs publicados contêm 18.972 linhas, 480 sem imagem e 31.232 URLs distintas de imagens. São registros de coleta/cache, não uma contagem de produtos únicos persistidos no MySQL. O relatório publicado ainda é anterior à execução completa.

Não houve alteração do banco de produção nem deploy. Ainda é necessário validar o ambiente publicado após integração. Peças antigas sem a referência oficial nos metadados não ganham essa referência retroativamente nesta alteração. URLs expiradas, bloqueadas pela origem e registros sem qualquer foto continuam exigindo atualização da fonte; o app não substitui pela foto de outro produto.

## Reproduzir a falha de transporte

Inicie o app com API pública apontando para `http://localhost:8080`, gate local desativado e porta 3102. O teste intercepta a API e a renovação de sessão somente no navegador de teste.

```bash
FAI_TEST_PHOTO=/caminho/foto-columbia.jpg \
BASE=http://localhost:3102 \
node scripts/e2e/verify-piece-photo-fallback.mjs work/fotos-evidencias
```

Playwright e Chromium precisam estar instalados. `PLAYWRIGHT` pode indicar o módulo e `CHROMIUM_EXECUTABLE_PATH` o executável, quando necessário.
