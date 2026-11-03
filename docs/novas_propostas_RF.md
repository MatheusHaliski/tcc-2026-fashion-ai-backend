# Novos fluxos funcionais candidatos — FashionAI

Propostas de pesquisa, não escopo aprovado nem funcionalidades implementadas. IDs RF-PESQ-* são locais e não renumeram os requisitos oficiais. P1=próximos candidatos a descoberta/MVP, não urgência de produção; P2=segunda onda após dependências/pilotos. Esforço é julgamento qualitativo, sem estimativa de prazo ou orçamento. Os critérios de aceite são sugestões para especificação/testes futuros, não testes executados.

A maior prioridade técnica é fechar as lacunas de fluxos existentes descritas em relatorio.md. Não se recomenda iniciar as dez propostas em paralelo. Entre as novidades, priorizar variante de compra, lavanderia e BOM/cotação; pós-venda deve ser considerado antes de escalar a loja física.

|ID|Proposta|Prioridade|Esforço|
|---|---|---|---|
|RF-PESQ-01|Resgate por SKU, cor e tamanho com estoque específico|P1|Média/alta|
|RF-PESQ-02|Troca/devolução rastreável e estorno de FAI Points|P1|Alta|
|RF-PESQ-03|Ciclo de lavanderia e disponibilidade para vestir|P1|Média|
|RF-PESQ-04|Lista de materiais e cotação de produção vinculada à revisão|P1|Média/alta|
|RF-PESQ-05|Ordem de reparo com evidência emitida pela oficina|P1|Média/alta|
|RF-PESQ-06|Aprovação de amostra e lote de produção no Atelier|P2|Alta|
|RF-PESQ-07|Agendar prova física com seleção de tamanhos e reserva temporária|P2|Alta|
|RF-PESQ-08|Busca de roupas por acessibilidade de uso e conforto verificável|P1|Média|
|RF-PESQ-09|Lista de compras por lacunas e orçamento do guarda-roupa|P2|Média|
|RF-PESQ-10|Painel de demanda de varejo agregado e consentido|P2|Alta|

## RF-PESQ-01 — Resgate por SKU, cor e tamanho com estoque específico

**Classificação:** extensão de fluxo existente. **Prioridade:** P1; esforço:Média/alta.

**Ator:** Comprador e marca/celebridade vendedora.

**Gatilho:** Selecionar um produto físico de vestuário para resgatar

**Comportamento proposto:** Exigir escolha explícita de variante de cor e tamanho disponível; vincular essa variante ao pedido e debitar o estoque correspondente.

**Por que faz sentido:** Fecha a distância entre provar um tamanho no avatar e receber fisicamente a variante correta; evita tratar estoque do produto como estoque de cada tamanho. Benefício esperado é hipótese a validar, não resultado observado.

**Dependências:** Catálogo de variantes confiável; vínculo entre estoque e SKU; transação/ledger.

**Critérios de aceite propostos:**

1. O checkout mostra apenas variantes pertencentes ao produto e distingue indisponível de informação ausente.
2. O servidor rejeita variante de outro produto, tamanho inexistente e estoque esgotado antes de debitar pontos.
3. Duas compras concorrentes do último SKU geram no máximo um débito/pedido concluído; repetir a chave devolve o mesmo pedido.
4. Pedido, histórico e preparação de envio exibem o SKU escolhido; variante não pode ser trocada silenciosamente.

Base existente/lacuna:

- [fai-application/src/main/java/br/com/fashionai/application/service/PhysicalStoreService.java:45](<../../../fai-application/src/main/java/br/com/fashionai/application/service/PhysicalStoreService.java#L45>) — ListingForm identifica produto, não SKU; OrderForm da linha48 contém somente endereço.
- [fai-application/src/main/java/br/com/fashionai/application/service/PhysicalStoreService.java:196](<../../../fai-application/src/main/java/br/com/fashionai/application/service/PhysicalStoreService.java#L196>) — Estoque é bloqueado por listing no contrato atual.

## RF-PESQ-02 — Troca/devolução rastreável e estorno de FAI Points

**Classificação:** extensão de pós-venda existente. **Prioridade:** P1; esforço:Alta.

**Ator:** Comprador, vendedor e operador de atendimento.

**Gatilho:** Solicitar troca/devolução de um pedido elegível

**Comportamento proposto:** Registrar motivo por peça/variante, aplicar política vigente de prazo e condição, acompanhar coleta/recebimento/inspeção e executar estorno ou troca de forma idempotente.

**Por que faz sentido:** Vestibilidade, cor e qualidade material afetam troca de roupas; uma loja com entrega necessita também um pós-venda explícito e auditável. Benefício esperado é hipótese a validar, não resultado observado.

**Dependências:** Pedido por variante; política de devolução; estados de recebimento e ledger.

**Critérios de aceite propostos:**

1. Elegibilidade usa a política vinculada ao pedido, com prazos e exceções visíveis antes da confirmação; alterações futuras de política não alteram o pedido antigo.
2. Somente comprador e equipe autorizada acessam o caso; imagens/comprovantes seguem acesso restrito.
3. Estorno é lançado uma única vez no ledger após evento de recebimento/aprovação e não por repetição do clique.
4. Peça devolvida não retorna ao estoque vendável sem inspeção; divergência de condição possui motivo e trilha.
5. Motivos de caimento podem alimentar feedback de tamanho somente com base legal/consentimento apropriado e sem exposição pública.

Base existente/lacuna:

- [fai-application/src/main/java/br/com/fashionai/application/service/PhysicalStoreService.java:254](<../../../fai-application/src/main/java/br/com/fashionai/application/service/PhysicalStoreService.java#L254>) — Rastreamento atual atualiza envio/entrega; o serviço consultado não define fluxo de retorno/estorno.
- [fai-application/src/main/java/br/com/fashionai/application/service/FaiPointsService.java:108](<../../../fai-application/src/main/java/br/com/fashionai/application/service/FaiPointsService.java#L108>) — Ledger e idempotência existentes são base reutilizável, mas não implementam sozinhos o novo processo.

## RF-PESQ-03 — Ciclo de lavanderia e disponibilidade para vestir

**Classificação:** novo fluxo sobre conservação/cuidados/disponibilidade existentes. **Prioridade:** P1; esforço:Média.

**Ator:** Proprietário da peça.

**Gatilho:** Marcar peça usada, enviada à lavanderia ou devolvida limpa

**Comportamento proposto:** Organizar lotes de lavagem com instruções declaradas, indisponibilizar temporariamente as peças e avisar quando looks planejados usam peça ainda indisponível.

**Por que faz sentido:** Resolve uma restrição diária real entre guarda-roupa digital e roupa utilizável. Benefício esperado é hipótese a validar, não resultado observado.

**Dependências:** Cuidados estruturados e declarados; disponibilidade da peça; agenda.

**Critérios de aceite propostos:**

1. Modelar transições limpa→usada→lavagem→limpa sem confundir com condição física ou arquivo.
2. Sugerir agrupamento apenas com composição/instrução conhecida; exigir confirmação e sinalizar dado ausente.
3. Impedir operações em peças de outro usuário e registrar mudança com data.
4. Retirar temporariamente da recomendação de looks prontos e restaurar após confirmação de disponibilidade.

Base existente/lacuna:

- [components/piece-detail-facts.tsx:19](<../../../components/piece-detail-facts.tsx#L19>) — Conservação e lavagem já são mostradas, não se propõe recriar campos.
- [fai-domain/src/main/java/br/com/fashionai/domain/model/enums/AvailabilityStatus.java:4](<../../../fai-domain/src/main/java/br/com/fashionai/domain/model/enums/AvailabilityStatus.java#L4>) — Disponibilidade atual tem três estados genéricos.

## RF-PESQ-04 — Lista de materiais e cotação de produção vinculada à revisão

**Classificação:** novo fluxo de varejo/fabricação a partir do Atelier existente. **Prioridade:** P1; esforço:Média/alta.

**Ator:** Designer, marca e fornecedor convidado.

**Gatilho:** Revisão técnica liberada para solicitar cotação.

**Comportamento proposto:** Compor BOM com materiais/aviamentos/consumo e receber cotações por quantidade, prazo e tamanho, sem transformar voto em compra automática.

**Por que faz sentido:** Transforma especificação criativa em conversa comercial verificável; diferencia orçamento de execução física e evita ampliar requisitos financeiros cedo demais. Benefício esperado é hipótese a validar, não resultado observado.

**Dependências:** Revisões técnicas e permissões do Atelier; cadastro de materiais/fornecedores.

**Critérios de aceite propostos:**

1. Cotação aponta revisão imutável, quantidades por tamanho, moeda, preço unitário, custo de amostra, validade e prazo.
2. Fornecedor só vê o projeto/itens concedidos; preço e dados comerciais têm visibilidade controlada.
3. Revisão modificada sinaliza cotação desatualizada; aceite registra autor e versão.
4. Pré-venda/pagamento ficam fora do MVP; interesse da comunidade não gera dívida ou promessa de entrega.

Base existente/lacuna:

- [components/atelier-projects/contracts.ts:4](<../../../components/atelier-projects/contracts.ts#L4>) — Especificação atual tem tecido/acabamentos textuais, sem BOM/custos.
- [fai-application/src/main/java/br/com/fashionai/application/atelierproject/AtelierProjectService.java:159](<../../../fai-application/src/main/java/br/com/fashionai/application/atelierproject/AtelierProjectService.java#L159>) — Escopo atual exclui pedido e promessa de produção.

## RF-PESQ-05 — Ordem de reparo com evidência emitida pela oficina

**Classificação:** extensão do passaporte existente. **Prioridade:** P1; esforço:Média/alta.

**Ator:** Proprietário e prestador de ajuste/reparo.

**Gatilho:** Usuário solicita conserto ou ajuste de uma peça com passaporte.

**Comportamento proposto:** Registrar diagnóstico, orçamento consentido, autorização, serviço realizado e declaração do prestador, mantendo autodeclaração separada de atestação.

**Por que faz sentido:** Dá utilidade operacional e rastreabilidade à segunda vida, em vez de duplicar apenas o formulário de histórico já existente. Benefício esperado é hipótese a validar, não resultado observado.

**Dependências:** Passaporte/eventos; identidade do prestador; anexos com acesso controlado.

**Critérios de aceite propostos:**

1. Ordem passa por SOLICITADA, ORÇADA, AUTORIZADA, EM_SERVIÇO, ENTREGUE/CANCELADA; orçamento não pode ser aceito por terceiro.
2. Comprovante registra prestador, data, serviço, revisão e escopo autorizado de compartilhamento; recibo privado não aparece no QR público.
3. Uma correção mantém histórico anterior e autoria; revogação de acesso impede nova consulta do prestador.
4. Atestação significa serviço declarado pelo prestador, não certificação de autenticidade ou alegação ambiental.

Base existente/lacuna:

- [fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java:35](<../../../fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java#L35>) — REPAIR já é tipo de evento declarado pelo dono.
- [fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java:193](<../../../fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java#L193>) — Evidência apresentada é UNVERIFIED.

## RF-PESQ-06 — Aprovação de amostra e lote de produção no Atelier

**Classificação:** Extensão do Atelier colaborativo existente. **Prioridade:** P2; esforço:Alta.

**Ator:** Designer, marca e produtor.

**Gatilho:** Revisão da ficha técnica pronta para amostra

**Comportamento proposto:** Congelar revisão comBOM, tolerâncias e anexos, receber amostra, registrar desvios e aprovar explicitamente a revisão/lote para produção.

**Por que faz sentido:** Hipótese de conectar criação digital à fabricação real; medir retrabalho, ambiguidades e lead time em piloto com produtores. Benefício esperado é hipótese a validar, não resultado observado.

**Dependências:** BOM/cotação; revisão congelada; evidência da amostra e papel de aprovador.

**Critérios de aceite propostos:**

1. Pedido referencia revisão imutável da ficha técnica.
2. Troca de tecido ou modelagem invalida aprovação anterior.
3. Desvios podem ser aceitos com justificativa ou devolvidos.
4. Voto social não autoriza produção, cobrança nem representa aprovação técnica.

Base existente/lacuna:

- [fai-application/src/main/java/br/com/fashionai/application/atelierproject/AtelierProjectService.java:159](<../../../fai-application/src/main/java/br/com/fashionai/application/atelierproject/AtelierProjectService.java#L159>) — Projeto colaborativo é base existente; aprovação de lote produtivo é expansão a validar.

Referências de método/contexto: https://www.iso.org/standard/78176.html, https://www.nngroup.com/articles/ten-usability-heuristics/

## RF-PESQ-07 — Agendar prova física com seleção de tamanhos e reserva temporária

**Classificação:** novo fluxo de varejo candidato; verificar duplicações na consolidação. **Prioridade:** P2; esforço:Alta.

**Ator:** Comprador, loja e vendedor autorizado.

**Gatilho:** Pessoa escolhe peças no provador e solicita experimentar em loja

**Comportamento proposto:** Gerar lista de prova física por SKU/tamanho, consultar disponibilidade e solicitar agenda/reserva com prazo, sem presumir estoque pela existência do item no catálogo.

**Por que faz sentido:** Transforma descoberta/prova virtual em visita assistida; é diferente de apenas sincronizar quatro slots entre aparelhos. Benefício esperado é hipótese a validar, não resultado observado.

**Dependências:** Parceria com lojas; agenda e estoque com confirmação, expiração e cancelamento.

**Critérios de aceite propostos:**

1. Confirmação de agenda depende de aceite/integração real da loja e informa prazo/estado.
2. Reserva expira de forma idempotente, cancela sem duplicação e não revela medidas/fotos ao vendedor por padrão.
3. Item sem estoque ou sem integração é apresentado como solicitação pendente, nunca como reserva confirmada.
4. Concilia resultado da prova e libera reserva sem publicar automaticamente dados sociais.

Base existente/lacuna:
- components/try-on/fitting-room.tsx:65
- fai-application/src/main/java/br/com/fashionai/application/multiplatform/TryOnSessionService.java:28

## RF-PESQ-08 — Busca de roupas por acessibilidade de uso e conforto verificável

**Classificação:** novo RF de catálogo/descoberta; não confundir com efeitos sensoriais do quarto. **Prioridade:** P1; esforço:Média.

**Ator:** Usuário com preferência de vestibilidade e marca fornecedora de dados.

**Gatilho:** Ativar filtros de facilidade de vestir, fechamento e sensibilidade ao tecido

**Comportamento proposto:** Consultar atributos declarados/verificados de fechamento, abertura, costura/etiqueta e contato com o tecido, distinguindo informação desconhecida de atributo confirmado.

**Por que faz sentido:** Conecta design funcional à compra e descoberta, ampliando utilidade para além de estética e medidas; requer dados do produto, não suposições de IA. Benefício esperado é hipótese a validar, não resultado observado.

**Dependências:** Taxonomia funcional e evidência editorial; preferência voluntária, sem inferir diagnóstico.

**Critérios de aceite propostos:**

1. A marca informa atributos estruturados e a origem da declaração; o app não infere acessibilidade somente pela fotografia ou pelo nome do tecido.
2. O usuário pode filtrar sem fornecer diagnóstico ou condição de saúde; preferências não são publicadas no perfil.
3. Resultados distinguem declarado, revisado e sem informação, sem classificar ausência de dado como inadequação.
4. A ficha do produto descreve o atributo em linguagem concreta, por exemplo abertura frontal e fechamento magnético, sem prometer resultado clínico.
5. Critérios de aceitação são avaliados em tarefas com usuários do público-alvo antes de alegar adequação ou acessibilidade validada.

Base existente/lacuna:

- [fai-application/src/main/java/br/com/fashionai/application/service/SearchService.java:98](<../../../fai-application/src/main/java/br/com/fashionai/application/service/SearchService.java#L98>) — Filters atuais atendem estilo, ocasião, cor, marca, categoria e Hype; não estabelecem critérios de facilidade de vestir.
- [lib/sensory.ts:1](<../../../lib/sensory.ts#L1>) — Sensory existente sintetiza som/háptico no quarto; não é cadastro de acessibilidade da roupa.

## RF-PESQ-09 — Lista de compras por lacunas e orçamento do guarda-roupa

**Classificação:** extensão de cápsula/catálogo; não é nova recomendação de tamanho. **Prioridade:** P2; esforço:Média.

**Ator:** Proprietário do guarda-roupa.

**Gatilho:** Informar ocasiões recorrentes, restrições e orçamento e solicitar plano de compras

**Comportamento proposto:** Identificar lacunas que impedem looks para as ocasiões e priorizar compras compatíveis com peças existentes, explicando a necessidade e respeitando o orçamento.

**Por que faz sentido:** Acrescenta uma decisão econômica e explicável à cápsula já existente, em vez de recriar catálogo ou recomendação de tamanho. Benefício esperado é hipótese a validar, não resultado observado.

**Dependências:** Cápsula e Copilot existentes; preço/orçamento declarados e cobertura do guarda-roupa.

**Critérios de aceite propostos:**

1. Informar quais peças existentes cada candidato complementa e quais ocasiões cobre.
2. Exibir preço/fonte/moeda e data da consulta; itens sem preço confirmado ficam fora do somatório garantido.
3. Permitir marcar já possuo/não preciso e recalcular sem sugerir automaticamente a mesma compra.
4. Não executar compra; excluir peças privadas de terceiros das evidências.

Base existente/lacuna:

- [components/lookbook-tabs.tsx:318](<../../../components/lookbook-tabs.tsx#L318>) — Cápsula existente serve como ponto de partida.
- [components/catalog/catalog-search.tsx:134](<../../../components/catalog/catalog-search.tsx#L134>) — Busca existente permite localizar complementos.

## RF-PESQ-10 — Painel de demanda de varejo agregado e consentido

**Classificação:** novo RF B2B apoiado em catálogo/loja existentes. **Prioridade:** P2; esforço:Alta.

**Ator:** Marca/celebridade aprovada e usuário que autoriza contribuição analítica.

**Gatilho:** Consultar interesse agregado por produto, cor, tamanho e disponibilidade

**Comportamento proposto:** Agregar apenas eventos consentidos de interesse/indisponibilidade, com minimização e limiares de publicação, para orientar reposição e sortimento sem expor usuários.

**Por que faz sentido:** Ajuda a priorizar tamanhos/cores em falta e decisões de sortimento; o benefício deve ser medido por reposição útil e vendas, preservando confiança do usuário. Benefício esperado é hipótese a validar, não resultado observado.

**Dependências:** Eventos consentidos, agregação com limiar mínimo e controle de finalidade/retirada.

**Critérios de aceite propostos:**

1. A contribuição é opcional, tem finalidade explícita e pode ser revogada sem impedir funcionalidades essenciais do guarda-roupa.
2. O painel não mostra identificadores, fotos, medidas corporais ou histórico individual; recortes raros são suprimidos conforme limiar configurado e revisado pela equipe de privacidade.
3. Combinações de filtros não permitem reconstruir um grupo pequeno; aplicar testes de reidentificação/ataque por diferença antes de liberar novos recortes.
4. Marca vê somente seu próprio catálogo; eventuais dados de comparação externos precisam de política e autorização próprias.
5. Métrica informa período, tamanho de amostra, atrasos e diferença entre interesse, intenção e venda realizada; não prometer previsão de demanda validada.

Base existente/lacuna:

- [fai-application/src/main/java/br/com/fashionai/application/service/PhysicalStoreService.java:96](<../../../fai-application/src/main/java/br/com/fashionai/application/service/PhysicalStoreService.java#L96>) — Operação comercial e catálogo por vendedor já existem como base de escopo.
- [fai-application/src/main/java/br/com/fashionai/application/service/AccountService.java:385](<../../../fai-application/src/main/java/br/com/fashionai/application/service/AccountService.java#L385>) — Finalidades e revogação de consentimento existentes são ponto de integração, não autorização implícita para analytics novo.

## Fora de promessa

Voto/interesse não equivale a pré-venda; orçamento não equivale a ordem de produção; etiqueta ou geometria não prova conforto; disponibilidade observada não é reserva confirmada sem retorno da loja. Reparos declarados não viram verificação de oficina automaticamente. Preferências funcionais não são diagnóstico de saúde. Nenhum passaporte é declarado conforme a legislação europeia sem análise específica. Dados de demanda devem excluir conteúdo/pessoas identificáveis e respeitar finalidade e consentimento aplicáveis.

## Rastreabilidade de ideias

O conjunto completo de candidatos dos cinco agentes está em pesquisa.json/candidate_pool. Propostas sobre graduação por tamanho, procedência da imagem e validação de feedback foram preservadas como candidatos de evolução/hardening, sem inflar o catálogo de novidades. Cápsula de viagem é extensão de cápsula existente e foi deixada para descoberta posterior.
