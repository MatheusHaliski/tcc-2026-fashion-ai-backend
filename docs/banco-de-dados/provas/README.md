# Provas fotográficas: Tipo Look automático e exercícios 09 a 20

Capturas de 27/11/2026, tiradas no navegador (Chromium/Playwright) com o front da `main` rodando em `next dev`
(`DEV_GATE_ENABLED=false`). A API foi **simulada** por `page.route`, com respostas no formato dos controllers e Views
do backend. Não houve backend, banco ou conta real. O estado simulado fica na memória do script. Por isso, nas fotos
"recarregado", a tela relê pelo GET o que acabou de ser gravado, como faria com o servidor de verdade.

O campo pedido em cada foto aparece **contornado em vermelho**. O contorno é CSS injetado pelo teste e não faz
parte do app.

- Scripts: [`scripts/validation/provas-exercicios/`](../../../scripts/validation/provas-exercicios/). Para rodar
  tudo, use `rodar-todas.sh`, que gera as capturas em PNG e um JSON por prova com os pedidos enviados.
- Nesta pasta há uma seleção em webp comprimido. As capturas completas, em PNG, são geradas pelos scripts.

## Problemas encontrados na `main` e corrigidos neste PR

| O que estava quebrado | Efeito na tela | Correção |
|---|---|---|
| As 22 chaves `institutionalReference.*` dos exercícios 09 e 10 sumiram dos três idiomas num merge posterior ao `02b702c5d` | Em Editar perfil, o campo da categoria da marca e o da área artística mostravam as chaves cruas (`institutionalReference.categoriaMarca.label`…) e o `institutional-reference-field.test.tsx` falhava (5 testes) | Restauradas com os textos originais. O teste voltou a passar |
| As 9 chaves `sealAvailability.*` do exercício 11 também sumiram | Na aba Selos aparecia `sealAvailability.state.SCHEDULED sealAvailability.window` no lugar de "Agendado · de … até …", e o assistente não traduzia o aviso de fim antes do início | Restauradas com os textos originais. O `seal-availability.test.tsx` passa |
| O seletor do Tipo Look automático mostrava o nome do cadastro | A lista oferecia "Unisex", enquanto o resto do app mostra "Unissex" | Passa a usar `lookTypeName`. Há um teste novo em `look-type-preference.test.tsx` |

Fora do escopo e só registrado: pela mesma perda, faltam também as chaves `faiStore.*` da Loja FAI Points,
`accessibility.chooseProduct`/`productLabel`, `brands.slug.atendimento`, `common.name` e `common.open`.

## Tipo Look automático (Editar perfil)

| Foto | O que prova |
|---|---|
| [look-automatico-1-perfil-desligado](look-automatico-1-perfil-desligado.webp) | Botão "Tipo Look automático" desligado (estado vazio) |
| [look-automatico-2-criador-de-peca-pergunta-o-sexo](look-automatico-2-criador-de-peca-pergunta-o-sexo.webp) | Desligado: o criador de peça (etapa 2) pede o campo "Sexo" |
| [look-automatico-3b-opcoes-do-tipo](look-automatico-3b-opcoes-do-tipo.webp) | Ligado: a lista "Tipo aplicado" vem de `GET /api/tipos-look` (Feminino, Masculino, Unissex) |
| [look-automatico-4-perfil-recarregado](look-automatico-4-perfil-recarregado.webp) | Depois de recarregar, continua ligado em "Feminino" (`GET /api/me/preferences/tipo-look`) |
| [look-automatico-5-criador-de-peca-sem-o-campo](look-automatico-5-criador-de-peca-sem-o-campo.webp) | Ligado: o criador de peça não pede mais "Sexo" (Material e Tamanho ficam lado a lado) |
| [look-automatico-7-card-do-look-com-o-tipo](look-automatico-7-card-do-look-com-o-tipo.webp) | O look criado sem o campo aparece em Meus looks com "Tipo de look: Feminino", aplicado pelo servidor (`CreationLookDefaults`) |

## Exercícios

| Nº | Foto | O que prova |
|---|---|---|
| 09 | [ex09-1-vazio](ex09-1-vazio.webp) | Editar perfil da marca: "Categoria principal da marca" sem escolha. O texto antigo aparece só para leitura |
| 09 | [ex09-3-preenchido](ex09-3-preenchido.webp) · [ex09-4-recarregado](ex09-4-recarregado.webp) | "Casual" gravado (`PATCH /api/me/brand-profile {categoriaMarcaId}`) e mantido depois de recarregar |
| 09 | [ex09-5-card-em-marcas](ex09-5-card-em-marcas.webp) · [ex09-6-cabecalho-do-perfil](ex09-6-cabecalho-do-perfil.webp) | A categoria escolhida no card de Marcas e no cabeçalho do perfil |
| 10 | [ex10-1-vazio](ex10-1-vazio.webp) · [ex10-4-recarregado](ex10-4-recarregado.webp) | "Área artística principal" vazia, depois "Música" gravada e mantida depois de recarregar |
| 10 | [ex10-6-cabecalho-do-perfil](ex10-6-cabecalho-do-perfil.webp) | Cabeçalho: "Música · Também: Cinema, Teatro" |
| 11 | [ex11-1-prazo-vazio](ex11-1-prazo-vazio.webp) · [ex11-2-fim-antes-do-inicio-recusado](ex11-2-fim-antes-do-inicio-recusado.webp) · [ex11-3-prazo-preenchido](ex11-3-prazo-preenchido.webp) | Assistente do selo: início e fim vazios, aviso de fim antes do início, e depois o período válido |
| 11 | [ex11-5-recarregado](ex11-5-recarregado.webp) | Aba Selos recarregada: estado "Agendado" e o período, calculados pelo servidor (`availabilityState`) |
| 12 | [ex12-1-regra-padrao-3-azuis](ex12-1-regra-padrao-3-azuis.webp) · [ex12-2-regra-minimo-2-azuis](ex12-2-regra-minimo-2-azuis.webp) | Regra estruturada: de "no mínimo 3" para "no mínimo 2 peças na cor azul" |
| 12 | [ex12-3-selo-recarregado-com-a-regra](ex12-3-selo-recarregado-com-a-regra.webp) · [ex12-4-previa-pecas-contadas](ex12-4-previa-pecas-contadas.webp) | O selo relido com a regra, e a prévia do criador de look com "2 peças contaram para a regra" |
| 13 | [ex13-1-card-marca-em-texto-nao-verificada](ex13-1-card-marca-em-texto-nao-verificada.webp) | Regra antiga: "Marca em texto, não verificada: Zara" |
| 13 | [ex13-4-marca-escolhida](ex13-4-marca-escolhida.webp) · [ex13-5-card-recarregado-marca-por-id](ex13-5-card-recarregado-marca-por-id.webp) | "Zara Home" escolhida na lista (grava `brandReference {kind: CATALOG, id}`) e lida depois de recarregar |
| 14 | [ex14-1-promocao-canal-vazio](ex14-1-promocao-canal-vazio.webp) · [ex14-3-promocao-canal-escolhido](ex14-3-promocao-canal-escolhido.webp) | Promoção de selo: "Onde o cupom pode ser usado" vazio, depois "Loja física" |
| 14 | [ex14-4-flair-oferta-sem-canal](ex14-4-flair-oferta-sem-canal.webp) · [ex14-6-flair-oferta-recarregada](ex14-6-flair-oferta-recarregada.webp) | Combinação FLAIR "não informado", depois "e-commerce", relida depois de recarregar |
| 14 | [ex14-7-carteira-canal-do-cupom](ex14-7-carteira-canal-do-cupom.webp) | Carteira: canal gravado em cada cupom emitido (loja física, e-commerce e "não informado" no antigo) |
| 15 | [ex15-1-oferta-antiga-sem-moeda](ex15-1-oferta-antiga-sem-moeda.webp) · [ex15-2-tres-casas-recusado](ex15-2-tres-casas-recusado.webp) · [ex15-3-minimo-e-moeda-preenchidos](ex15-3-minimo-e-moeda-preenchidos.webp) | Compra mínima: oferta antiga sem moeda, 50.005 recusado com o rascunho mantido, depois 50,00 USD |
| 15 | [ex15-4-oferta-recarregada](ex15-4-oferta-recarregada.webp) · [ex15-5-carteira-minimo-da-emissao](ex15-5-carteira-minimo-da-emissao.webp) | "compra mínima US$ 50" relida depois de recarregar. Na carteira: US$ 50,00, R$ 0,00 e "condição da emissão não registrada" |
| 16 | [ex16-1-sem-preferencia-cenario-oficial](ex16-1-sem-preferencia-cenario-oficial.webp) · [ex16-2-cenarios-permitidos](ex16-2-cenarios-permitidos.webp) | Desafio sem preferência (cenário oficial) e só os cenários permitidos na lista |
| 16 | [ex16-4-desafio-recarregado](ex16-4-desafio-recarregado.webp) · [ex16-5-central-com-a-preferencia](ex16-5-central-com-a-preferencia.webp) | "Livre" mantido depois de recarregar, e na central "Seu cenário: Livre". O outro desafio continua no oficial |
| 17 | [ex17-1-dinamica-padrao-ao-abrir](ex17-1-dinamica-padrao-ao-abrir.webp) · [ex17-3-dinamica-escolhida](ex17-3-dinamica-escolhida.webp) | "Tipo de trend" obrigatório: abre em "PASSA O LOOK" (padrão da tela, não há estado vazio), depois "Cor em comum" |
| 17 | [ex17-4-lista-recarregada](ex17-4-lista-recarregada.webp) · [ex17-5-filtro-por-dinamica](ex17-5-filtro-por-dinamica.webp) | Trend publicada, lista recarregada e filtro por dinâmica (`?kind=COR_EM_COMUM`) |
| 18 | [ex18-1-perfil-sem-peca-assinatura](ex18-1-perfil-sem-peca-assinatura.webp) · [ex18-2-escolha-peca-privada-com-aviso](ex18-2-escolha-peca-privada-com-aviso.webp) | Perfil sem Peça Assinatura, e o aviso de quem vai ver ao escolher uma peça privada |
| 18 | [ex18-4-visitante-ve-a-peca-publica](ex18-4-visitante-ve-a-peca-publica.webp) · [ex18-5-perfil-recarregado](ex18-5-perfil-recarregado.webp) · [ex18-6-historico](ex18-6-historico.webp) | A visitante vê a peça pública, sem botões. Depois da troca e de recarregar, a dona vê a peça nova e o histórico com as duas escolhas |
| 19 | [ex19-1-detalhe-imagem-unica](ex19-1-detalhe-imagem-unica.webp) · [ex19-3-mosaico-escolhido](ex19-3-mosaico-escolhido.webp) | AURA comum: formato "Imagem única", depois "Imagem variada" (`MOSAICO`) |
| 19 | [ex19-4-recusa-do-servidor-rascunho-fica](ex19-4-recusa-do-servidor-rascunho-fica.webp) · [ex19-5-detalhe-recarregado-mosaico](ex19-5-detalhe-recarregado-mosaico.webp) | Recusa do servidor com o rascunho mantido. O detalhe recarregado em mosaico, e Minhas peças com a mesma arte |
| 20 | [ex20-1-sku-e-cor-vazios](ex20-1-sku-e-cor-vazios.webp) · [ex20-2-sku-a-volta-a-variante-azul](ex20-2-sku-a-volta-a-variante-azul.webp) | Código SKU e cor vazios. SKU-A devolve o produto na variante azul |
| 20 | [ex20-3-sku-a-com-vermelho-sem-resultado](ex20-3-sku-a-com-vermelho-sem-resultado.webp) · [ex20-5-peca-relida-com-sku-e-cor](ex20-5-peca-relida-com-sku-e-cor.webp) | SKU-A com vermelho não devolve nada, porque a cor é de outra variante. A peça criada (`productId` + `variantId`) relida mostra "Do catálogo: SKU SKU-A · Azul" |

## Limites destas provas

- A API é simulada. As fotos provam a tela, o pedido enviado e a leitura depois de recarregar. As regras do banco
  (FK, CHECK, UNIQUE) estão provadas nos testes Java e no laboratório MySQL descrito em
  [`MIGRACOES_DOS_EXERCICIOS.md`](../MIGRACOES_DOS_EXERCICIOS.md).
- Exercício 12: a prévia mostra quantas peças contaram, mas não o motivo de um look não atender selo a selo. Isso já
  estava registrado como não entregue em [`solucoes/12-quantidade-cor.md`](../solucoes/12-quantidade-cor.md).
- Exercício 17: não há tela de rascunhos nem edição (PUT) de trend, como já registrado em
  [`solucoes/17-dinamica-trend.md`](../solucoes/17-dinamica-trend.md).
