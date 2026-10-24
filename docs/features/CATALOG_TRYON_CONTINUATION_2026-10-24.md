# Catálogo e textura do provador — 24/10/2026

Esta continuação parte do PR #390, já integrado, e incorpora o `main` posterior sem substituir o trabalho de FLAIR, monitoramento do modelo 3D ou a trilha opcional de packshot local.

## Comportamento corrigido

- Produto, imagem, variante e cor efetiva permanecem vinculados do worker até a busca, preparação do card, transporte de textura e inclusão no guarda-roupa. Uma fotografia genérica principal só atende uma variante quando existe vínculo de cor base demonstrável; ambiguidade não autoriza outra cor.
- Alterações de fonte, categoria, subcategoria, variante, cor ou revisão invalidam os respectivos caches. Respostas de outro produto/variante/contexto ou com estado `REVIEW`, `RETRY` ou `INELIGIBLE` não são aplicadas nem persistidas como fotografias prontas.
- A escolha explícita de uma peça recebe prioridade na fila de preparação, compartilhando a requisição existente e respeitando dois workers. A seleção aguarda sua própria foto, sem guardar a resposta canônica de outra variante.
- A roupa é vestida imediatamente com seus dados disponíveis. A linha do provador informa o estado real da fotografia e oferece **Recarregar textura** para a peça selecionada. Um produto do catálogo não exibe uma barra de geração GLB nunca solicitada. O arquivo GLB salvo continua um recurso separado.
- URLs autenticadas e caches de textura incluem variante, imagem e revisão. Fetches têm cancelamento por tempo limite; o atlas mantém cache limitado. Estampas verificadas permanecem nos pixels da frente, e cores isoladas de emblemas não viram listras artificiais nas costas do jeans.
- Nomes que declaram manga curta são respeitados na geometria de camisas e jaquetas. Moletons com capuz recebem uma aproximação geométrica de capuz abaixado, com cor amostrada do tecido.

## Pipeline automático e evidência real

O provedor combina probabilidades reais do parser FASHN e máscara independente `u2net_cloth_seg`; a decisão registra concordância, confiança observada, extensão e contexto. O preflight de altura ocorre antes de limpar, ampliar, renderizar ou enviar arquivos. Só uma medição confiável estritamente abaixo de 25% pode tornar uma imagem inelegível. A exclusão lógica de um produto continua exigindo auditoria de todas as alternativas e revalidação CAS.

O Total frame aprovado é PNG RGBA transparente, centralizado, proporcional, com maior aresta normalizada em 50%. O recorte de tecido fica integralmente dentro da máscara, sem padding. O cache de quatro arquivos de modelos foi verificado por tamanho/SHA e carregado em CPU.

Foram processadas fotografias reais obtidas de fontes oficiais, sem conexão ao banco ou upload:

| Fonte | Resultado observado |
| --- | --- |
| Nike Boston Celtics hoodie | `READY`; lettering e detalhes fotografados preservados na imagem isolada. |
| Aramis microxadrez frontal | `READY`; botões e cor preservados. A fonte de 420 px não resolve o microxadrez com nitidez suficiente para prometer reprodução fina. |
| Duas vistas Hokkaido no modelo e Aramis lateral | `REVIEW` por extensão incerta; não foram aprovadas nem excluídas. |
| Hokkaido floral, foto oficial da posição 6 | `READY`; IoU de máscaras 0,985772, altura na fonte 50,8604%, cobertura de tecido 100%. A URL/proveniência foi adicionada ao registro do dataset; o banco não recebeu essa alternativa nesta sessão. |

O softmax não é uma probabilidade calibrada de acerto. Os modelos segmentam classes, sem distinguir necessariamente duas roupas encostadas da mesma classe. Fotografias pequenas podem conservar halos de antialiasing. Partes escondidas, costas, mangas e costuras não visíveis permanecem estimadas; isso não constitui digitalização industrial da roupa nem comprova fidelidade de todas as marcas.

## Transferência de passaporte

Na aceitação, a peça histórica do remetente fica privada e arquivada. A nova peça permanece privada e aciona os eventos normais do guarda-roupa; uma repetição idempotente não publica esses eventos novamente. Comprovantes pessoais e autoria histórica continuam separados da nova posse.

## Publicação e limites operacionais

O worker precisa ser implantado no ambiente conectado ao banco/storage. Não houve migração, importação do dataset, upload, limpeza ou exclusão no catálogo de produção. A conexão TCP ao banco não está liberada neste ambiente. O build Docker não pôde ser executado por indisponibilidade do socket; dependências, importações CPU e arquivos de modelos foram verificados fora do contêiner.

Os testes de navegador usam autenticação/API controladas. As imagens Nike, Aramis e Hokkaido são reais; o jeans de referência usado para verificar costuras, emblema e retry é FAI, sem certificação de fidelidade de um jeans Levi’s sem fotografia correspondente.

## Evidência visual

- [Nike: estampa frontal](validation-2026-10-24/real-nike-celtics-front-1440.png) e [capuz/costas](validation-2026-10-24/real-nike-celtics-rear-1440.png).
- [Aramis frontal](validation-2026-10-24/real-aramis-xadrez-front-1440.png).
- [Hokkaido floral no viewport mobile](validation-2026-10-24/real-hokkaido-front-390.png).
- [Relatório WebGL](validation-2026-10-24/real-garment-webgl-browser.json): quatro casos em 1440/390 px, sem erros de página/shader; requisições com imagem/variante/revisão corretas; fonte em revisão sem projeção.
- [Comparação de pixels](validation-2026-10-24/real-garment-front-pixel-proof.json): todos os pixels opacos de origem foram mantidos na metade frontal do atlas (Nike 206.317, Aramis 189.599, Hokkaido 111.398). Isso não comprova alinhamento geométrico ou detalhes invisíveis.

## Verificações de código

- 82 testes Java focados de catálogo/passaporte passaram, incluindo aceitação concorrente/idempotente da transferência e transporte de imagem/variante.
- O pacote Java 21 completo, com os 13 módulos e compilação dos testes, passou depois da integração do `main`.
- 280 testes Python passaram na árvore integrada, incluindo a trilha opcional SD já existente no `main`.
- O build Next.js de produção passou, com TypeScript, estilos, design e traduções PT/EN/ES.
- A validação do fluxo real de retry em `/try-on` usou fotografia FAI e APIs controladas: peça vestida durante falha, recarga apenas da textura selecionada e sucesso sem guardar a peça nem iniciar GLB. Foram verificados 1440/390 px, sem overflow ou erros de página.
