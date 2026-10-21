# Identidade visual das peças superiores e inferiores

A aparência vem da fotografia da **peça/variante selecionada**, não de uma paleta ou de um logo inferido pelo nome da marca. As regras de modelagem por subcategoria continuam independentes dessa aparência. Sem foto utilizável, o provador conserva a cor cadastrada e informa o estado da foto; não desenha um emblema da marca.

## Correções

- A amostragem de trama agora admite listras horizontais e verticais. Antes exigia repetição nos dois eixos, aceitando xadrez e descartando listras. Um eixo constante só é aceito quando há periodicidade no outro; tecido liso, logo isolado e faixa lateral única não viram estampas repetidas.
- Fotografias isoladas e o painel frontal conservam até 2048 pixels no maior eixo, sem ampliar a fonte. A textura final tem dois painéis, podendo chegar a 4096 pixels de largura. Isso preserva mais detalhe de letras e logos quando a imagem original tem resolução suficiente. A saída da segmentação de pessoa continua limitada à resolução fornecida pelo processamento, sem inventar detalhe adicional.
- Camisetas de manga longa, cropped e moletom com capuz passam pelo alinhamento por landmarks já empregado nas outras famílias superiores.
- Uma peça com apenas foto processada deixa de ser classificada como imagem padrão: seus detalhes fotográficos não recebem a carcela e os botões genéricos de fallback por causa da ausência da URL original.
- A projeção separada das pernas, a exclusão da foto externa no forro da saia-short e a proteção contra projeção de pessoa/fundo permanecem.

## Evidência

60 testes focados aprovados em sete arquivos, incluindo os testes existentes de seleção e isolamento da pele. As 19 famílias superiores e 14 inferiores foram verificadas nos dois corpos de referência quanto à presença de projeção frontal. Testes de raster verificam listras, xadrez, logos únicos, faixas isoladas e preservação dos pixels do recorte. Build de produção Next.js/TypeScript aprovado.

Chromium, laboratório local: três fotografias sintéticas distintas (camisa com listras horizontais e logo A, cargo com listras verticais e logo B, camiseta com listras verticais e logo C) substituem URLs exatas de referências locais. Cada atlas conservou 1200 × 1600 pixels por painel, mais de dez mil pixels da cor do seu logo no painel frontal e zero dessa cor no painel de tecido. Todas as peças tiveram vértices de projeção e nenhum erro JavaScript. As capturas foram inspecionadas visualmente; `browser.json` registra as contagens.

As referências usadas como roupa padrão podem compartilhar essas mesmas URLs substituídas no teste. As letras são identificadores fictícios das amostras, não marcas comerciais. Esta validação local não comprova fidelidade de todo o catálogo de marcas em produção.

## Limites de fidelidade

Uma foto frontal permite conservar os detalhes visíveis nessa foto. Mangas usam trama/cor estimadas e não uma reconstrução de logos laterais; costas, interior, bordados em relevo, recortes e costuras industriais exigem vistas adicionais, UVs e/ou assets do produto. O painel de trama é uma extrapolação conservadora: não demonstra que a estampa realmente continua nas costas. Logos não devem ser criados ou espalhados por regiões sem evidência.

Reflexos, luz do ambiente, perspectiva e resolução original afetam a aparência na tela. Os testes não certificam reprodução colorimétrica nem geometria perfeita de todos os SKUs. Não houve inferência GPU, alteração do catálogo de produção nem teste em aparelho móvel físico neste lote.
