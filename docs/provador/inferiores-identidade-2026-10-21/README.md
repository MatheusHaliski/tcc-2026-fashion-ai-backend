# Identidade visual: complemento para partes inferiores

Uma peça pode ter uma perna estampada e outra lisa, ou lavagens de cores diferentes. A textura estimada anterior escolhia uma única trama/cor para toda a peça, transferindo o padrão de uma perna para a outra, mesmo quando a projeção frontal estava correta.

Agora, quando a máscara comprova duas pernas separadas, cada metade da fotografia fornece sua própria amostra de repetição ou de cor/lavagem. Uma perna lisa não herda as listras da outra. A amostragem por perna usa uma faixa mais larga para evitar que um logo localizado domine a mediana de cor e gere uma faixa na extrapolação. A foto frontal e sua projeção independente por perna continuam intactas.

Sem evidência de pernas separadas, mantém-se a leitura única; saias não são divididas artificialmente. O forro estimado da saia-short continua impedido de receber o logo da foto externa. As alterações anteriores de resolução, alinhamento e preservação da foto processada permanecem.

## Evidências

- 57 testes focados aprovados em cinco arquivos, incluindo geometria/projeção das 14 subcategorias inferiores e regressão das superiores. Novo teste combina perna listrada, perna lisa de outra cor e logo localizado; verifica que trama e cor são lidas somente da perna correspondente.
- Build de produção Next.js/TypeScript aprovado.
- Chromium com fotografia sintética assimétrica aplicada à referência cargo: painel da perna lisa conservou RGB `[25,120,60]`, 10.198 pixels da cor do logo permaneceram na frente e nenhum no painel de tecido. Captura e atlas foram inspecionados visualmente. A letra B é uma marca fictícia da amostra, não uma marca comercial.
- As 14 referências locais inferiores também apareceram vestidas e com fotografia projetada no Chromium, sem erros JavaScript; registro em `subcategorias-browser.json`. Canvas fixo e corpo feminino de referência, sem certificação de produtos reais de cada marca.

## Limites

A cor, as listras e os logos devem vir da fotografia da peça/variante selecionada. Não se cria um emblema baseado no nome da marca. Uma única fotografia frontal não comprova o desenho das costas ou do interior: as cores/tramas extrapoladas continuam estimadas e detalhes exclusivos dessas regiões precisam de vistas adicionais ou UVs próprios. Um logo muito grande ainda pode influenciar a estimativa da cor dominante; esta amostragem não é segmentação semântica de logos.

As referências e a API simulada do laboratório não certificam todos os SKUs ou marcas do catálogo de produção. Não houve alteração do banco de produção, inferência GPU nem teste em aparelho móvel físico neste lote.
