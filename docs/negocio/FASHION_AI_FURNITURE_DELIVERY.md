# Fashion AI Furniture Delivery — logística do negócio

> Especificação de 2026-11-10 para a operação de entrega de **mobiliário de closet** (guarda-roupas, araras,
> sapateiras, penteadeiras, espelhos, cabideiros, nichos) criado por marcas e celebridades e fabricado pelo FashionAI.
> O processo completo (criar → pedido de produção → fabricar → vender → entregar) está em
> [`../novos-rf/RF39_Criar_Fabricar_Vender_Entregar.md`](../novos-rf/RF39_Criar_Fabricar_Vender_Entregar.md); este
> documento detalha **só a logística**. Números marcados **[estimativa]** são hipóteses de planejamento, a validar com
> cotações reais. No TCC, tudo roda simulado: nenhuma transportadora, armazém ou dado real de cliente.

## 1. Proposta de valor logística

"O móvel da sua marca favorita, fabricado sob encomenda, entregue e montado na sua casa, com data marcada."

Três compromissos com o cliente:

1. **Prazo honesto:** a data mostrada no checkout já soma fabricação, expedição e transporte.
2. **Entrega agendada:** o cliente escolhe a janela (manhã ou tarde) quando o produto fica pronto.
3. **Montagem opcional:** contratada no checkout e feita por montador parceiro, no mesmo dia ou em até 3 dias úteis.

## 2. Características da carga

| Característica | Impacto |
|---|---|
| Volumoso e pesado (20–150 kg; até 2,2 m) [estimativa] | não cabe em encomenda comum; exige carga fracionada e 2 entregadores |
| Frágil em quinas, espelhos e vidro | embalagem reforçada, seguro e conferência na entrega |
| Desmontado em vários volumes | todos os volumes do pedido viajam juntos e são conferidos por código |
| Alto valor percebido e edições numeradas | rastreio por volume e prova de entrega com foto e assinatura |
| Fabricado sob encomenda | prazo de produção entra na promessa; estoque pequeno ou zero |

## 3. Rede logística

```
Fábricas parceiras ─► Centro de Distribuição (CD) FashionAI ─► Transportadora de carga fracionada ─► Hub regional
 (marcenaria,          recebe, inspeciona, consolida            (linha-tronco)                       (cross-docking)
  metalurgia)          volumes, embala e expede                                                          │
                                                                                                         ▼
                                                                  Última milha: entrega agendada + montagem opcional
```

- **Fase 1 — um CD no Sudeste** (região de Campinas/SP [estimativa]), operado por um operador logístico (3PL) com
  contrato por posição-palete e por pedido, sem galpão próprio.
- **Coleta nas fábricas:** programada pelo CD (milk run semanal) quando há várias fábricas na mesma região; senão,
  coleta direta pela transportadora.
- **Envio direto da fábrica (drop ship):** permitido para peças grandes demais para consolidar, com a mesma
  embalagem, etiqueta e inspeção por foto.
- **Fase 2 — hubs regionais** no Sul e no Nordeste para reduzir prazo da última milha.

## 4. Embalagem e identificação

- **Padrão FashionAI:** papelão de parede dupla, cantoneiras, filme stretch e manta para superfícies acabadas; espelho e
  vidro em caixa de madeira (engradado).
- **Etiqueta por volume:** número do pedido, "volume N de M", peso, código de barras e QR para conferência.
- **Manual de montagem e kit de ferragens** no volume 1, com lista conferida na expedição.
- **Identidade da marca/celebridade:** fita, cartão e certificado da edição numerada, sem expor o endereço do
  comprador para o emissor.

## 5. Frete e prazos

**Cálculo do frete:** peso cobrado = maior entre peso real e peso cubado (`A × L × P / 6000` por volume), somado por
pedido, mais seguro ad valorem sobre o valor da NF e taxa de agendamento.

| Faixa de destino | Transporte [estimativa] | Prazo de transporte [estimativa] |
|---|---|---|
| Capital e região metropolitana de SP | entrega direta do CD | 2–4 dias úteis |
| Capitais do Sul e Sudeste | linha-tronco + hub | 4–7 dias úteis |
| Demais capitais | linha-tronco + parceiro regional | 7–12 dias úteis |
| Interior | parceiro regional | 8–15 dias úteis |

**Promessa no checkout:** `prazo de fabricação (pré-venda ou lote) + 2 dias de expedição + prazo de transporte do CEP`.

**Cobertura:** Fase 1 só capitais e regiões metropolitanas do Sul e Sudeste; CEP fora da tabela mostra "não entrega
no seu CEP" e oferece "avise-me quando chegar".

## 6. Última milha e montagem

1. Quando o pedido chega ao hub, o cliente recebe o convite para **agendar** a janela (manhã ou tarde) nos próximos
   5 dias úteis.
2. Na véspera, confirmação por notificação; no dia, aviso "a caminho" com previsão.
3. **Entrega:** 2 entregadores, até o cômodo [decidir: limite de andares sem elevador]; conferência dos volumes com o
   cliente; prova de entrega com foto e assinatura no aplicativo do parceiro.
4. **Montagem:** montador parceiro com agenda própria; checklist de montagem e foto final; fixação na parede só com
   autorização do cliente.
5. **Ausência:** até 2 tentativas; depois, o pedido volta ao hub e o reagendamento pode ter custo.

## 7. Logística reversa

| Situação | Prazo | Quem paga | Fluxo |
|---|---|---|---|
| Arrependimento (CDC art. 49) | 7 dias após o recebimento | FashionAI (custo de devolução no preço) | coleta agendada, produto embalado pelo cliente ou pelo montador |
| Avaria no transporte | registro com fotos em até 48 h | transportadora (seguro) | troca de peça avariada ou do produto inteiro |
| Defeito de fabricação (garantia de 90 dias, art. 26) | dentro da garantia | fábrica parceira | assistência técnica no local ou troca |
| Volume faltante | registro na entrega | responsável identificado na conferência | envio do volume faltante em até 5 dias úteis |

Produtos devolvidos voltam ao CD, passam por inspeção e seguem para: estoque (perfeito), outlet com desconto
(pequena marca) ou descarte responsável/reciclagem.

## 8. Parceiros e contratos

| Parceiro | Papel | O que o contrato precisa ter |
|---|---|---|
| Operador logístico (3PL) | CD, recebimento, armazenagem, expedição | custo por palete e por pedido, acuracidade de estoque, seguro do armazém |
| Transportadora de carga fracionada | linha-tronco e entrega agendada | tabela por faixa de CEP, prazo, índice de avaria, API de rastreio |
| Parceiros regionais de última milha | entrega em capitais fora do Sudeste | prova de entrega, 2 entregadores, janela agendada |
| Rede de montadores | montagem e assistência | preço por produto, prazo, garantia da montagem |
| Seguradora | carga em trânsito | cobertura ad valorem, franquia, prazo de indenização |

## 9. Sistemas e integrações

- **Pedidos:** os estados do pedido e da entrega no FashionAI (`PAGO → SEPARANDO → ENVIADO → EM_TRANSITO →
  SAIU_PARA_ENTREGA → ENTREGUE`), alimentados pelo 3PL e pela transportadora.
- **Integrações [proposta]:** API de cotação e rastreio da transportadora (webhook de eventos), arquivo ou API de
  estoque do 3PL, agenda dos montadores, NF-e e etiqueta.
- **Rastreio por volume:** cada volume tem código próprio; o pedido só fica `ENTREGUE` com todos conferidos.
- **No TCC:** cotação por tabela interna de CEP e peso; eventos de rastreio lançados manualmente pelo admin.

## 10. Custos unitários [estimativa]

Exemplo para um guarda-roupa de 2 portas (3 volumes, 85 kg reais, 0,9 m³) entregue numa capital do Sudeste:

| Item | Faixa |
|---|---|
| Armazenagem e expedição no 3PL | R$ 25–40 |
| Embalagem padrão FashionAI | R$ 40–70 |
| Frete de carga fracionada (peso cubado ~150 kg) | R$ 180–320 |
| Seguro (0,3–0,5% do valor da NF de R$ 2.500) | R$ 8–13 |
| Taxa de agendamento e 2 entregadores | R$ 30–60 |
| **Custo logístico total** | **R$ 283–503 (11–20% do preço)** |
| Montagem opcional (cobrada à parte) | R$ 120–220 |

Política de frete: o cliente paga o frete calculado; frete grátis só subsidiado pela marca/celebridade em campanha.

## 11. Indicadores (KPIs)

| Indicador | Meta inicial [estimativa] |
|---|---|
| Entrega no prazo prometido (OTD) | ≥ 92% |
| Entrega na primeira tentativa | ≥ 90% |
| Índice de avaria | ≤ 2% dos pedidos |
| Pedidos com volume faltante | ≤ 0,5% |
| Montagem concluída na primeira visita | ≥ 95% |
| Devolução por arrependimento | ≤ 5% |
| Custo logístico sobre a receita | ≤ 18% |
| Avaliação da entrega (1–5) | ≥ 4,5 |

## 12. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Avaria em espelho, vidro ou quinas | engradado de madeira, cantoneiras, seguro, teste de queda da embalagem |
| Atraso da fábrica empurrando a promessa | promessa calculada com folga; aviso proativo e opção de cancelamento sem custo |
| Custo de frete inviabilizando o produto | mostrar frete na página do produto; priorizar móveis modulares que embalam menor |
| Endereço sem acesso (escada estreita, sem elevador) | perguntas no checkout (andar, elevador, medidas da porta) e alerta se o volume não passa |
| Baixa cobertura fora do Sudeste | expansão por fases e "avise-me" para medir demanda |
| Dependência de um único parceiro | ao menos duas transportadoras homologadas a partir da Fase 2 |

## 13. Fases de implantação

| Fase | Escopo | Gatilho para avançar |
|---|---|---|
| F0 (TCC) | fluxo completo simulado: tabela de frete, agendamento e rastreio manuais | demonstração aprovada |
| F1 | 1 CD no Sudeste (3PL), 1 transportadora, montadores em SP, RJ, BH, Curitiba e Porto Alegre | 300 pedidos/mês e OTD ≥ 90% |
| F2 | hubs no Sul e Nordeste, 2ª transportadora, demais capitais | 1.000 pedidos/mês |
| F3 | interior por parceiros regionais, outlet de devolvidos | custo logístico ≤ 15% |

## 14. Decisões pendentes

1. Localização do primeiro CD e escolha do 3PL.
2. Limite de andares sem elevador e regra de içamento.
3. Se a montagem entra no preço de alguns produtos (ex.: penteadeira com espelho) ou é sempre opcional.
4. Quem absorve o frete da devolução por arrependimento.
5. Política para produto devolvido: outlet, doação ou reciclagem.
