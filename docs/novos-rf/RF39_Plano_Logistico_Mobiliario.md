# RF39 — Plano logístico: guarda-roupas e mobiliário reais de marcas e celebridades

> Proposta de 2026-11-10. Substitui o RF39 anterior (componentes 3D para o Meu Quarto, extinto junto com o antigo RF27).
> Nada aqui está implementado. No TCC, pagamento e frete rodam só em **sandbox**: nenhum pagamento real, conta real
> de transportadora ou dado real de cliente.

## 1. O que muda

Marcas e celebridades verificadas (RF1) vendem **guarda-roupas, araras, sapateiras, penteadeiras, espelhos e outros
móveis de closet reais**, com a identidade delas, e o FashionAI entrega no endereço do comprador. A peça de mobiliário
aparece no app com fotos reais e, quando houver, modelo 3D para visualização (RF16/RF51); o 3D é ilustrativo e não
substitui as medidas.

## 2. Modelo de operação

| Modelo | Quem guarda e envia | Prós | Contras |
|---|---|---|---|
| **A. Marketplace com envio pelo vendedor** *(recomendado para começar)* | o emissor (marca/celebridade ou fabricante parceiro) | sem estoque nem galpão do FashionAI; escala com o catálogo | qualidade de entrega depende do vendedor; exige SLA e penalidades |
| B. Fulfillment do FashionAI | FashionAI, em galpão próprio ou de operador logístico | controle de prazo e embalagem | custo fixo alto; móveis ocupam muito espaço |
| C. Sob encomenda (fabricação após o pedido) | marcenaria parceira do emissor | sem estoque parado; peças exclusivas | prazo longo (30–60 dias); cancelamento mais caro |

**Recomendação:** A para itens a pronta entrega e C para edições exclusivas, com o FashionAI como intermediador de
pagamento, atendimento e acompanhamento. B só se o volume justificar.

## 3. Fluxo do pedido

1. **Catálogo:** o emissor cadastra o produto com medidas (A × L × P), peso, volumes (caixas), material, cor, prazo de
   produção, CEP de origem, estoque e preço. Produtos de celebridade podem ser edição numerada.
2. **Cotação no carrinho:** o comprador informa o CEP; o sistema cota o frete pelo peso cubado de cada volume
   (`A × L × P / 6000`, padrão das transportadoras) e mostra prazo = produção + transporte. Fora da área atendida, o
   produto aparece como "não entrega no seu CEP".
3. **Pagamento:** Pix ou cartão por gateway com **split** (vendedor, frete, comissão do FashionAI). O valor fica retido
   até a confirmação de entrega.
4. **Separação e nota:** o vendedor emite a NF-e (CNPJ validado no cadastro de Marca, RF1) e gera a etiqueta.
5. **Coleta e transporte:** volumes pequenos por transportadora de encomendas ou Correios; móveis grandes por
   transportadora de carga fracionada, com agendamento de entrega.
6. **Rastreio:** estados `PAGO → EM_PRODUCAO → PRONTO → COLETADO → EM_TRANSITO → SAIU_PARA_ENTREGA → ENTREGUE`
   (ou `AVARIA`, `DEVOLVIDO`, `CANCELADO`), com notificação a cada mudança (RF3).
7. **Entrega e montagem:** o comprador agenda a janela; a montagem é opcional, cobrada à parte e feita por montador
   parceiro.
8. **Repasse:** o valor do vendedor é liberado depois de 7 dias da entrega, sem reclamação aberta.

## 4. Frete e cobertura

- **Fase 1:** capitais do Sul e Sudeste, onde há oferta de carga fracionada com agendamento.
- **Fase 2:** demais capitais. **Fase 3:** interior, com prazo e frete calculados por faixa de CEP.
- Itens acima de 30 kg ou 1 m em qualquer lado entram sempre como carga, nunca como encomenda.
- Frete grátis só se o emissor subsidiar; o FashionAI não absorve frete de móvel.

## 5. Avarias, devolução e garantia

- **Arrependimento:** 7 dias a partir do recebimento para compra online (CDC, art. 49), com coleta reversa paga pelo
  vendedor. Peças sob encomenda e personalizadas seguem a mesma regra; o cancelamento antes da produção é sem custo.
- **Garantia legal:** 90 dias para produto durável (CDC, art. 26), mais a garantia contratual do fabricante.
- **Avaria no transporte:** o comprador registra com fotos em até 48 h; o vendedor acionado pela transportadora troca
  ou reembolsa. Transporte com seguro sobre o valor da NF.
- **Atendimento:** o FashionAI media as reclamações e pode reter o repasse até a solução.

## 6. Requisitos para o vendedor

- Marca ou celebridade verificada (RF1) e CNPJ ativo de quem emite a nota (a celebridade vende por empresa ou
  por fabricante parceiro).
- Aceite do contrato de marketplace: SLA de postagem (até 2 dias úteis após "pronto"), taxa de comissão, política
  de devolução e penalidades por atraso.
- Dados completos de medidas, peso e volumes; produto sem esses dados não é publicado.

## 7. Dados e privacidade (LGPD, RNF6)

- Endereço, telefone e CPF só são pedidos no checkout e compartilhados com o vendedor e a transportadora apenas para
  aquele pedido.
- Dados de entrega ficam guardados pelo prazo fiscal e depois são anonimizados.
- Os dados do cartão não passam pelo FashionAI (tokenização no gateway).

## 8. Fases no TCC

| Fase | Entrega | Ambiente |
|---|---|---|
| L0 | Catálogo de mobiliário com medidas, volumes e identidade do emissor | real (app) |
| L1 | Carrinho, cotação de frete simulada por tabela de CEP e peso cubado | simulado |
| L2 | Checkout com gateway em sandbox e split simulado | sandbox |
| L3 | Painel do vendedor e rastreio com estados manuais | simulado |
| L4 | Integração real com transportadora e gateway | fora do TCC |

## 9. Decisões pendentes

1. Modelo A, C ou ambos na estreia.
2. Comissão do FashionAI e quem paga a taxa do gateway.
3. Região da Fase 1.
4. Se FAI Points podem dar desconto em produto físico (exige regra fiscal: desconto concedido pelo vendedor).
5. Montagem: parceiro único nacional ou indicado por cada vendedor.
