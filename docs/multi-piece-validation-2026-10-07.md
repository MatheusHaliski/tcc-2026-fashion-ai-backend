# Validação: múltiplas peças e correções do provador

Uma foto com várias peças passa para **Mais detalhes**, na própria página. Os slots preservam os dados ao alternar peças e fotos; cada peça é salva com seu próprio recorte. Há inclusão e ajuste manual de regiões quando a detecção não consegue separá-las.

A análise remota tem orçamento total de 12 segundos, sem repetição automática nesse fluxo; o upload tem cancelamento em 25 segundos. A primeira foto pronta libera a edição enquanto as seguintes são analisadas. A separação local é conservadora: regiões desconectadas sobre fundo uniforme/transparente, sem inventar categoria ou material.

## Evidências

- `multi-piece-evidence/api.json`: chamada à API Java real, com MySQL local e conta descartável de teste. Cinco peças numa imagem sintética, resultado local em 0,739 segundo. IA externa desativada; não representa seu tempo de resposta.
- `multi-piece-evidence/browser.json`, `desktop.png`, `mobile.png`: Chromium, resposta de visão simulada, cinco slots, edição preservada, zero modais de revisão e sem transbordamento horizontal a 390 px.
- `cloth-coverage-evidence`: Chromium com WebGL por software e avatar/peças sintéticos. Frente, perfil e costas; erros de página e de console registrados. Não são fotos nem o avatar do usuário.

## Provador

A barra das peças superiores abaixo do quadril usa um envelope contínuo preso ao quadril, em vez de retalhos copiados das coxas. A distância entre camadas considera todas as peças inferiores; blazers têm menor folga e uma camiseta padrão neutra por baixo. O brilho branco excessivo das peças externas foi reduzido.

Texturas periódicas detectadas no tecido são repetidas nas mangas e costas; o alinhamento da foto usa o tronco, sem incluir braços. A lavagem/cor por altura da calça continua ao redor das pernas, com transição suave entre foto e tecido. Fotos muito estreitas de corpo inteiro usadas como parte superior passam pelo filtro local de pessoa. Se a peça não puder ser isolada com confiança em até cinco segundos, a prévia usa sua cor cadastrada.

Óculos impressos em texturas antigas são removidos de uma cópia para renderização; o arquivo original é preservado. A armação 3D considera inclinação e espessura para manter distância do rosto. A correção anterior da pose natural e da ancoragem do cabelo está incluída nesta mesma branch.

## Limites

O provador continua sendo uma prévia paramétrica. Uma foto não revela construção, tecido ou detalhes reais das costas: não há garantia de caimento físico ou qualidade AAA. Estampas não periódicas nas costas não são reconstruídas. A mistura suave da textura é um shader do provador; exportações glTF usam o atlas e UVs sem essa mistura. Fotos complexas podem exigir recorte manual ou uma imagem isolada da peça.

## Estado ao interromper para publicação do PR

Publicado a pedido do usuário antes de concluir a validação final. Maven verify: 1183 testes, zero falhas/erros, dois ignorados. Frontend: execução completa com 973 testes passando; o teste adicional de amostragem do torso passou na execução dirigida (19 testes). Typecheck passou. O build de produção passou antes das últimas alterações de textura e geometria e não foi repetido neste estado final.

A captura do blazer ainda mostra alguns acabamentos da camiseta interna atravessando a peça externa, principalmente nos braços e na barra. A correção completa dessa oclusão entre camadas fica pendente; não foi implementada antes da interrupção. A captura do xadrez confirma repetição nas mangas e costas, com barra contínua. Ambas usam imagens sintéticas.
