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
