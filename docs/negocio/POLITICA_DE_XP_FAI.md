# Política de FAI Points, FAI XP e preços

**Status:** proposta de padronização
**Escopo:** saldo e progressão, itens das lojas, jogos e ações verificáveis no Fashion AI, incluindo peças, looks,
conteúdo de marcas e criações de usuários.

Esta política define como ganhar e gastar FAI Points e como calcular FAI XP. Valores de concessão devem seguir a matriz
central de [RF41](../novos-rf/RF41_v2_Concessao_FAI_Points_Todos_RFs.md); nenhuma recompensa pode ser criada apenas na
tela ou variar segundo valor informado pelo navegador.

Documentos relacionados: [RF35 — FAI Points e progressão](../meu_guarda_roupa/01-especificacao-meu-quarto.md#5-rf35--fai-points-e-progressão-do-quarto),
[RF39 — loja do quarto](../novos-rf/RF39_Criar_Guarda_Roupa_3D.md),
[RF41 — concessão de FAI Points](../novos-rf/RF41_v2_Concessao_FAI_Points_Todos_RFs.md),
[RF48 — resgate e doações](../novos-rf/RF48_FAI_Points_Resgate_e_Doacoes.md),
[níveis e desbloqueios FLAIR](../design/FAI_XP_NIVEIS_FLAIR.md) e [Central FLAIR](../flair/CENTRAL_FLAIR.md).

## 1. Definições e relação entre as unidades

| Unidade | Função | Pode ser gasta? | Regra |
|---|---|---:|---|
| **FAI Points disponíveis** | Saldo ganho no uso do app; usado para resgatar itens em lojas que aceitam pontos. | Sim | Não é vendido por dinheiro. A sacabilidade depende da origem e segue RF48. |
| **FAI Points vitalícios** | Soma permanente dos pontos elegíveis ganhos; registra a progressão. | Não | Compras, doações enviadas/recebidas e vendas não reduzem nem aumentam este total. |
| **FAI XP** | Nome exibido para a progressão medida pelos FAI Points vitalícios. | Não | Cada FAI Point de uma concessão elegível acrescenta **1 FAI XP**. Não existe conversão ou carteira de XP separada. |

Uma concessão elegível aumenta o saldo disponível conforme sua regra e, na mesma operação, os pontos vitalícios e o FAI XP
na mesma quantidade. Regras com origem não sacável continuam não sacáveis; receber uma doação não cria XP. Gastar pontos
na loja reduz apenas o saldo disponível, nunca o XP, o total vitalício ou o nível. Estornos e correções de fraude devem
ser auditáveis e não podem apagar lançamentos do ledger.

XP não é meio de pagamento. Itens não têm “preço em XP”: um requisito de XP é um **nível mínimo de acesso**, não um
desconto nem um débito. Não há compra de FAI Points com dinheiro real, nem conversão de moeda premium, FLAIR Coins,
cupons ou compras em pontos.

## 2. Preços de itens e desbloqueios

Todo item publicado deve apresentar, antes da confirmação, um preço exato, a moeda aceita, a raridade, eventuais
requisitos de nível, disponibilidade e limites de compra. Não pode existir item com preço oculto ou definido pelo cliente.
O preço é congelado durante a oferta; alterações valem para novas ofertas, sem reescrever compras passadas.

Para itens resgatáveis com FAI Points, usar esta escada inicial de referência:

| Categoria do item | Preço de referência | Condição |
|---|---:|---|
| Gratuito / recompensa direta | **0 pts** | O item não pode exigir compra; critérios da recompensa ficam visíveis. |
| Básico | **1–150 pts** | Item comum de fábrica, sem escassez artificial. |
| Premium | **151–380 pts** | Acabamento, material ou função adicional claramente descritos. |
| Signature | **381–900 pts** | Item especial, com benefício cosmético ou de personalização explicitado. |
| Edição limitada | **901–1.200 pts** | Quantidade e período de disponibilidade visíveis; não conceder vantagem competitiva. |
| Criação de marca/celebridade ou conjunto 3D | **0–20.000 pts** | O preço sugerido é a soma dos preços-base dos componentes multiplicados pelos fatores de material; respeitar RF39, compatibilidade e teto da oferta. |

As faixas são referências de calibração, não permissão para cobrar mais por raridade sem justificativa. A loja do quarto
deve manter um catálogo rotativo e revisar trimestralmente emissão versus gasto, visando a proporção de **1,2–1,5**
descrita em RF41 §8.3. Itens comercializados em dinheiro seguem preço direto em moeda local e regras próprias de
monetização; não podem exigir, aceitar ou conceder FAI XP/Points como parte do pagamento.

| Uso do FAI XP | Regra |
|---|---|
| Nível **Básico** | 0 XP |
| **Studio** | 300 XP |
| **Loft** | 900 XP |
| **Closet** | 2.000 XP |
| **Atelier** | 4.000 XP |
| **Penthouse** | 7.500 XP |
| **Maison** | 12.000 XP |

Um SKU ou modo pode exigir um desses níveis (ou outro nível documentado e aprovado), mas não pode consumir XP. A exigência
deve aparecer na oferta e ser validada também pelo servidor.

## 3. Concessões por ações do sistema

RF41 é a fonte de verdade para cada ação, valor em FAI Points, sacabilidade, referência e limites. Para as concessões
elegíveis, o FAI XP é igual ao valor em pontos da regra. Exemplos da matriz vigente:

| Ação validada | FAI Points | FAI XP | Regra principal |
|---|---:|---:|---|
| Peça catalogada com correspondência confirmada | 15 | 15 | 10/dia; não sacável |
| Completar dados de peça | 10 | 10 | 10/dia; não sacável |
| Gerar modelo 3D de peça | 15 | 15 | 5/dia; não sacável |
| Primeira utilização real de peça | 15 | 15 | 1× por peça; sacabilidade conforme RF41 |
| Criar look com pelo menos 2 peças reais | 20 | 20 | 5/dia; não sacável |
| Look com qualidade validada (LQS) | 20 ou 30 | 20 ou 30 | LQS ≥ 70 ou ≥ 85; 5/dia |
| Look do dia vestido e aprovado | 20 | 20 | 1/dia; sacabilidade conforme RF41 |
| Partida FLAIR concluída / vitória | 5 / 10 | 5 / 10 | Limites separados por tipo; não sacáveis |
| Quest FLAIR concluída | 10 | 10 | Até 3/dia; não sacável |
| Voto em desafio comunitário | 2 | 2 | Até 5/dia; não sacável |
| Desafio concluído | 30–200 | 30–200 | Um pagamento por desafio; não sacável se houver aleatoriedade |
| Item de guarda-roupa 3D publicado | 20 | 20 | Até 1/semana; conta institucional, não sacável |

A tabela resume exemplos e não substitui as regras detalhadas. As demais ações — incluindo catalogação e curadoria,
edição e publicação de looks, uso do provador/espelho/Copilot, ações sociais, organização do quarto, conquistas, desafios,
Passarela, conteúdo institucional e eventos de catálogo — recebem apenas os valores e limites cadastrados na matriz
RF41. Uma ação nova só pode pontuar após ser incluída nessa matriz, com valor em pontos e XP, critério verificável,
limite, sacabilidade e chave de idempotência. Não se concede XP em separado para duplicar a mesma ação.

## 4. Jogos, desafios e recompensas

- Jogar, votar, vencer, concluir uma quest e concluir um desafio são eventos separados; cada um usa sua regra RF41 e
  seu próprio limite. A recompensa e o critério de conclusão devem ser mostrados antes de começar.
- Não há FAI Points ou XP por abrir telas, iniciar/abandonar uma partida, fazer chamadas repetidas ou repetir um resultado
  já pago. O servidor confirma a conclusão e registra a recompensa de forma idempotente.
- Pontos de FLAIR e de resultados aleatórios são **não sacáveis**. Não há entrada paga, aposta, pote ou caixa aleatória
  que conceda pontos sacáveis. Moedas próprias do jogo e cupons permanecem separados.
- Desafio publicado por marca/celebridade tem orçamento e valor definidos antes da publicação, dentro dos limites da
  plataforma; o criador não altera a recompensa de uma tentativa em andamento. Publicar o desafio e concluí-lo são
  ações independentes, sem duplicar o prêmio do participante.
- Pontos recebidos em doação, crédito de venda de item e resgate de cupom não geram XP. Comprar item também não gera XP.

## 5. Elegibilidade, limites e histórico

1. Premiar resultado útil e verificável, não navegação, consentimento, autointeração, gasto ou consumo.
2. Confirmar no servidor conclusão, referência (peça, look, jogo, desafio ou período) e requisitos de qualidade.
3. Conceder cada evento elegível uma única vez por pessoa e referência; aplicar limites por regra, grupo e teto global de
   RF41. Atingir um limite não bloqueia a ação do app, apenas a recompensa.
4. Não pontuar ações inválidas/removidas. Tratar duplicatas, contas vinculadas e automação com idempotência e prevenção
   a abuso, sem prejudicar uso legítimo.
5. Registrar no histórico o valor, a unidade, a ação, a referência, a regra/versionamento, a sacabilidade e o resultado
   de limite/inelegibilidade. Ledger append-only; toda correção deve manter trilha de auditoria.
6. Não alterar retroativamente preços de compras nem valores já concedidos. Recalibrar regras futuras com métricas de
   emissão, gasto, conclusão legítima, fraude e progresso, preservando a economia e o Fundo de Criadores (RF48).

## 6. Evolução e compatibilidade

Esta política unifica a apresentação e as regras gerais, sem substituir as especificações de RF35, RF39, RF41 ou RF48.
Em caso de divergência em concessão, limites ou sacabilidade, prevalece RF41; para preço e publicação de ofertas, RF39 e
as regras específicas da loja; para resgate e doações, RF48. Mudanças nesta política e nas matrizes de origem devem ser
feitas em conjunto para manter pontos, XP, preços e níveis consistentes.
