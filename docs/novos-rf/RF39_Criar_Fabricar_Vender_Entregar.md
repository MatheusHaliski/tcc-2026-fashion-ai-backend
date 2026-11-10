# RF39 — Criar, fabricar, vender e entregar peças e mobiliário de marcas e celebridades

> Especificação de 2026-11-10. Substitui o RF39 anterior (componentes 3D para o Meu Quarto, extinto junto com o antigo
> RF27) e o plano logístico de marketplace da mesma data. Nada aqui está implementado. No TCC, fabricação, pagamento
> e frete são **simulados ou em sandbox**: nenhum pagamento real, fábrica real, conta de transportadora ou dado real
> de cliente.

## 1. Visão geral

A marca ou celebridade **desenha** a peça; o FashionAI **fabrica, vende e entrega**.

```
1. Criar            2. Pedido de         3. Fabricação        4. Venda na          5. Entrega no
   no editor 3D  ─►    produção ao    ─►    (piloto e lote) ─►   loja do app    ─►    endereço do
   (marca/celeb.)      FashionAI            por fábrica          (FashionAI)          comprador
                                            parceira
```

| Etapa | Responsável | Saída |
|---|---|---|
| 1. Criar | marca ou celebridade verificada | projeto 3D versionado + ficha técnica |
| 2. Pedido de produção | marca/celebridade envia; FashionAI analisa | orçamento aprovado e contrato do lote |
| 3. Fabricação | fábrica parceira, coordenada pelo FashionAI | peça-piloto aprovada e lote produzido com qualidade |
| 4. Venda | FashionAI publica na loja do app | anúncio com preço, estoque e prazos |
| 5. Entrega | FashionAI (estoque e expedição) e transportadora | pedido entregue, com rastreio e pós-venda |

**Dois tipos de produto**, com as mesmas cinco etapas:

- **Peças de roupa e acessórios**: camisetas, jaquetas, vestidos, bolsas, bonés etc.
- **Mobiliário de closet** (os "componentes de quarto"): guarda-roupas, araras, sapateiras, penteadeiras, espelhos,
  cabideiros e nichos.

## 2. Etapa 1 — Criar no editor 3D

- **Onde:** o editor de peças 3D do FAI Atelier (RF51, `/atelier/projects/{id}/editor`), com uma biblioteca de
  **bases fabricáveis**: para roupa, moldes-base por tipo e tamanho; para mobiliário, módulos com medidas padrão
  (corpo, portas, gavetas, prateleiras, cabideiro, pés).
- **O que o criador define:** base, medidas, material, cor, acabamento, estampa e logo, aplicações (bordado,
  silk, gravação), embalagem e etiqueta com a identidade (selo RF25).
- **Validação de fabricabilidade:** o editor só deixa enviar se o projeto usa materiais do catálogo de fornecedores,
  medidas dentro dos limites da base e cores com código de referência (Pantone ou similar). Fora disso, mostra o
  motivo.
- **Ficha técnica gerada automaticamente:** por versão, com vistas, medidas, grade de tamanhos (roupa) ou cotas
  (móvel), lista de materiais e aplicações. O 3D é a referência visual; o que vale para a fábrica é a ficha.
- **Copilot (RF24):** sugere materiais e acabamentos possíveis, mas nunca envia o pedido sozinho.

## 3. Etapa 2 — Pedido de produção ao FashionAI

1. A marca ou celebridade envia a versão final do projeto com: quantidade desejada do lote, grade de tamanhos ou
   variações, preço de venda sugerido e data desejada de lançamento.
2. O FashionAI faz a **análise técnica** (fabricável? fornecedor disponível?) e a **análise de direitos**: a marca
   precisa ter direito sobre logos e artes; a celebridade, sobre nome e imagem (RF1 validou a identidade).
3. O FashionAI devolve um **orçamento** com custo unitário por quantidade, prazo de piloto e de lote, preço de
   venda recomendado e divisão da receita.
4. A marca ou celebridade **aprova ou pede ajuste**. A aprovação gera o contrato do lote.

**Modelos de financiamento do lote** (decisão comercial):

| Modelo | Quem paga a produção | Risco do estoque |
|---|---|---|
| **Pré-venda** *(recomendado para começar)* | os compradores, durante a campanha; só fabrica se atingir o mínimo | quase nenhum |
| Lote pago pelo emissor | marca/celebridade | do emissor |
| Lote pago pelo FashionAI | FashionAI, com divisão de receita maior | do FashionAI |

**Estados do pedido de produção:** `RASCUNHO → ENVIADO → EM_ANALISE → ORCADO → APROVADO → EM_PILOTO →
PILOTO_APROVADO → EM_PRODUCAO → INSPECAO → EM_ESTOQUE` (ou `RECUSADO`, `CANCELADO`).

## 4. Etapa 3 — Fabricação

- **Fábricas parceiras** homologadas por tipo: confecção e estamparia para roupa; marcenaria e metalurgia para
  mobiliário. O FashionAI escolhe a fábrica por custo, capacidade e prazo.
- **Peça-piloto:** antes do lote, a fábrica produz uma unidade. A marca/celebridade aprova com fotos e medidas (ou
  recebe a peça física). Reprovação gera ajuste no projeto e nova versão.
- **Produção do lote:** acompanhamento por etapas, com prazo previsto e atualizado.
- **Controle de qualidade:** inspeção por amostragem (medidas, cor, costura/acabamento, logo). Lote reprovado volta à
  fábrica, sem ir à venda.
- **Cadastro do produto físico:** cada variação ganha SKU, código de barras, peso, medidas da embalagem e volumes.

**Prazos de referência [proposta]:** roupa — piloto 10 dias úteis, lote 20–30 dias; mobiliário — piloto 15 dias
úteis, lote 30–45 dias.

## 5. Etapa 4 — Venda na loja do app

- O FashionAI publica o anúncio na loja do app e no perfil da marca/celebridade (RF14/RF22), com fotos reais da
  peça-piloto ou do lote, modelo 3D ilustrativo, medidas, materiais, preço, estoque e prazo de envio.
- **Pré-venda:** mostra a meta mínima, o tempo restante e o prazo estimado de entrega; se a meta não for atingida, todos
  os compradores são reembolsados.
- **Pronta entrega:** só com estoque inspecionado.
- **Edições numeradas** (celebridades): numeração por unidade, sem duplicidade mesmo com compras simultâneas.
- **Experimentar antes:** peças de roupa podem ser provadas no Provador (RF18) e no Meu Avatar 3D (RF40) pelo modelo
  3D; a prova é visual e não garante caimento — a tabela de medidas vale mais.
- **Pagamento:** Pix ou cartão via gateway (sandbox no TCC). FAI Points podem dar desconto só se a regra fiscal for
  aprovada [decidir].
- **Divisão da receita:** registrada por venda (custo de produção, frete, comissão do FashionAI e parte do emissor) e
  exibida no painel do emissor.

## 6. Etapa 5 — Entrega no endereço

- **Estoque e expedição:** o lote fica no centro de distribuição do FashionAI ou de um operador logístico; o FashionAI
  separa, embala e emite a NF-e da venda.
- **Frete:** cotado no carrinho pelo CEP e pelo peso cubado de cada volume (`A × L × P / 6000`).
  - Roupa e acessórios: transportadora de encomendas ou Correios.
  - Mobiliário: transportadora de carga fracionada, com entrega agendada e montagem opcional por parceiro.
- **Cobertura por fases:** Fase 1 nas capitais do Sul e Sudeste; Fase 2 nas demais capitais; Fase 3 no interior.
  Fora da área atendida, o produto mostra "não entrega no seu CEP".
- **Rastreio:** `PAGO → SEPARANDO → ENVIADO → EM_TRANSITO → SAIU_PARA_ENTREGA → ENTREGUE`, com notificação a cada
  mudança (RF3).

## 7. Pós-venda (CDC)

- **Arrependimento:** 7 dias após o recebimento (art. 49), com coleta reversa sem custo para o comprador.
- **Garantia legal:** 90 dias para produto durável (art. 26); defeito de fabricação é resolvido pelo FashionAI, que
  aciona a fábrica parceira.
- **Avaria no transporte:** registro com fotos em até 48 h; troca ou reembolso. Transporte com seguro sobre o valor
  da NF.
- **Atendimento:** canal único do FashionAI; a marca/celebridade não precisa atender o consumidor.

## 8. Responsabilidades

| Tema | Marca / celebridade | FashionAI | Fábrica parceira |
|---|---|---|---|
| Design e identidade | ✅ | revisa fabricabilidade e direitos | — |
| Direitos de logo, nome e imagem | ✅ garante | verifica | — |
| Orçamento e contrato | aprova | ✅ elabora | informa custo e prazo |
| Piloto | ✅ aprova | coordena | ✅ produz |
| Produção e qualidade | — | ✅ coordena e inspeciona | ✅ produz |
| Venda, NF-e e atendimento | divulga | ✅ | — |
| Estoque e entrega | — | ✅ | — |
| Garantia | — | ✅ perante o consumidor | ✅ perante o FashionAI |

## 9. Dados e privacidade (LGPD, RNF6)

- Endereço, telefone e CPF só no checkout; compartilhados com a transportadora apenas para aquele pedido.
- Os dados do cartão não passam pelo FashionAI (tokenização no gateway).
- O emissor vê vendas agregadas e por pedido, nunca o endereço do comprador.
- Projetos 3D e fichas técnicas são confidenciais até o lançamento; a fábrica recebe só a ficha técnica do lote.

## 10. Entidades [proposta]

`ProductionProject` (projeto 3D + ficha técnica versionada) · `ProductionOrder` (lote, quantidade, grade, estado) ·
`ProductionQuote` · `Factory` · `PilotSample` · `QualityInspection` · `PhysicalProduct` / `ProductVariant` (SKU,
peso, volumes) · `InventoryLot` · `StoreListing` (pré-venda ou pronta entrega) · `SalesOrder` / `SalesOrderItem` ·
`Shipment` (estados de entrega) · `ReturnRequest` · `RevenueSplit`.

## 11. Fases no TCC

| Fase | Entrega | Ambiente |
|---|---|---|
| P0 | Bases fabricáveis no editor 3D, validação e ficha técnica gerada | real (app) |
| P1 | Pedido de produção com estados, orçamento e aprovação (fábrica simulada pelo admin) | simulado |
| P2 | Loja com pré-venda e pronta entrega, edições numeradas e checkout em sandbox | sandbox |
| P3 | Frete por tabela de CEP e peso cubado, rastreio com estados manuais e pós-venda | simulado |
| P4 | Fábricas, gateway e transportadoras reais | fora do TCC |

## 12. Decisões pendentes

1. Modelo de financiamento do lote na estreia (pré-venda é a recomendação).
2. Comissão do FashionAI e divisão de receita padrão.
3. Quantidade mínima de lote por tipo de produto.
4. Região da Fase 1 de entrega.
5. Se FAI Points podem dar desconto em produto físico.
6. Montagem de mobiliário: parceiro nacional único ou regional.
