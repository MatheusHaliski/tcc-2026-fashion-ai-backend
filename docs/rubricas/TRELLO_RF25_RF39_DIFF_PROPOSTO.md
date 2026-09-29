# Trello — auditoria RF25–RF39 e diff de escrita proposto

> Leitura realizada em 29/09/2026. Nenhuma escrita foi executada. Chave, token e URLs autenticadas não foram registrados.

## Consultas e fotografia do board

- Board aberto: **TCC 2026 (Fashion AI) - Bryan,Matheus**.
- Consultados por `GET`: board, 21 listas, 312 cards, descrições, membros, labels, checklists, comentários e membros do board.
- Bryan está no board (`bryanstrey1`), mas nenhum card RF25–RF39 ou HU-RF25–RF32 possui membro atribuído.
- RF25–RF39 estão abertos em **Requisitos Funcionais**.
- HU-RF25–RF32 estão abertas em **Product Backlog**; HU-RF33–RF39 não foram localizadas.
- Os cards RF25–RF39 não têm checklists. HU-RF27–RF32 possuem checklists de CA e tarefas, todos ainda incompletos. HU-RF25 está vazia e HU-RF26 mantém CAs como rascunho na descrição.
- RF25–RF39 não possuem comentários. A leitura do board retornou apenas dois comentários no total, ambos fora deste recorte.

## Diagnóstico por RF

| RF | Card RF | HU/CA no board | Inconsistência ou lacuna | Ação proposta |
|---|---|---|---|---|
| RF25 | Aberto, Sprint 03, 9 CAs na descrição | HU-RF25 vazia | CA estão no card RF e a HU não é verificável; título da HU tem erro gramatical | Mover os 9 CAs para checklist da HU, corrigir título e deixar no RF apenas objetivo/dependências |
| RF26 | Aberto, Sprint 04, sem CA | HU-RF26 com 4 CAs “rascunho” na descrição | Entidades usam `&amp;`; CA04 é decisão de arquitetura, não aceite do usuário | Criar checklist com CA01–CA03; mover CA04 para tarefa DB/BE; normalizar `&` |
| RF27 | Aberto, Sprint 04 | HU com 12 CAs + 7 tarefas, 0 concluídas | RF repete CA12 apesar de dizer que CA só ficam na HU | Remover o parágrafo duplicado CA12 do RF; manter checklist da HU |
| RF28 | Aberto, Sprint 04 | HU com 16 CAs + 8 tarefas, 0 concluídas | RF repete CA16; CA05 permite peça indisponível no slot, enquanto RF31 exclui indisponível dos fluxos | Remover duplicata do RF e decidir CA05: entrada manual com aviso ou bloqueio uniforme |
| RF29 | Aberto, Sprint 04 | HU com 11 CAs + 6 tarefas, 0 concluídas | Board não reflete testes já existentes; CA03/04/11 permanecem bons critérios de regressão | Preservar CAs e atualizar apenas tarefas/evidências após execução, sem marcar pronto automaticamente |
| RF30 | Aberto, Sprint 04 | HU com 8 CAs + 5 tarefas, 0 concluídas | Board não reflete implementação/testes de idempotência, teto e compra serializada | Preservar CAs; adicionar card funcional de reconciliação para Bryan |
| RF31 | Aberto, Sprint 04 | HU com 7 CAs + 5 tarefas, 0 concluídas | CA07 prescreve detalhe visual (“padrão Spotify”, tamanho do rótulo), adequado a tarefa/design, não aceite funcional | Mover CA07 para tarefa FE; manter CA01–CA06 e reforçar exclusão de indisponíveis |
| RF32 | Aberto, Sprint 04 | HU com 17 CAs + 7 tarefas, 0 concluídas | CA12 exige idempotência, mas não define concorrência/desempate | Manter CA01–CA17; criar card de fechamento concorrente para Bryan; confirmar desempate |
| RF33 | Aberto, label Sprint 04 mas descrição diz “a definir”, 12 CAs | HU ausente | CA misturam RF1/RF23, UI 3D e ranking; não existe HU canônica | Criar HU-RF33 e mover somente CAs da jornada Passarela; referenciar foto/perfil em vez de duplicar RF1/RF23 |
| RF34 | Aberto, label Sprint 04 mas descrição diz “a definir”, 8 CAs | HU ausente | Critérios estão no card RF; sem separação entre edição da celebridade e visita pública | Criar HU-RF34 com cenários por papel e rascunho/publicação |
| RF35 | Aberto, label Sprint 04 mas descrição diz “a definir”, 7 CAs | HU ausente | Critérios estão no card RF; CA05 mistura ranking, visual e efeitos cosméticos | Criar HU-RF35; separar comportamento funcional de tarefa visual |
| RF36 | Aberto, label Sprint 04 mas descrição diz “a definir”, 8 CAs | HU ausente | Consentimento e falha/retry não estão explícitos; CA08 só desabilita sem fallback | Criar HU-RF36; adicionar consentimento, erro recuperável e retry idempotente |
| RF37 | Aberto, label Sprint 04 mas descrição diz “a definir”, 12 CAs | HU ausente | CA05 reúne 15 modos num único critério não diagnosticável | Criar HU-RF37; desdobrar CA05 em checklist/matriz por família de modos, sem duplicar regras comuns |
| RF38 | Aberto, label Sprint 04 mas descrição diz “a definir”, 10 CAs | HU ausente | Falta CA explícito para expiração, corrida, duplo uso e rollback | Criar HU-RF38; adicionar atomicidade/idempotência e separar emissão de validação/uso |
| RF39 | Aberto, label Sprint 04 mas descrição diz “a definir”, 12 CAs | HU ausente | Falta fallback/desempenho e matriz negativa de perfis | Criar HU-RF39; adicionar RBAC negativo, persistência e modo leve/fallback |

## Operações propostas no Trello

Este é o lote de escrita aguardando confirmação. Não será aplicado parcialmente sem nova conferência.

### 1. Normalizações sem perda de conteúdo

1. Corrigir `&amp;` para `&` nos títulos e descrições de RF26/HU-RF26.
2. Corrigir o título da HU-RF25 para: `HU-RF25 — COMO marca ou celebridade autenticada, POSSO criar e gerenciar os selos do meu perfil, PARA vinculá-los a peças e looks elegíveis e oferecer promoções verificáveis`.
3. Criar checklist **Critérios de Aceite** na HU-RF25 com os nove CAs hoje presentes no RF25; substituir a lista duplicada do RF25 por um ponteiro para a HU.
4. Criar checklists **Critérios de Aceite** e **Tarefas por área** na HU-RF26; CA01–CA03 permanecem CAs e a decisão “não criar região em peça/esquema” vira tarefa `[DB/BE]`.
5. Remover apenas as cópias de CA12 e CA16 das descrições de RF27/RF28; os textos canônicos continuam nas HUs.
6. Mover RF31.CA07 para a checklist **Tarefas por área** como `[FE]`, preservando RF31.CA01–CA06.

### 2. HUs ausentes

Criar HU-RF33–HU-RF39 no **Product Backlog**, cada uma com:

- título COMO/POSSO/PARA;
- descrição curta, dependências e fonte;
- checklist **Critérios de Aceite** em Given/When/Then;
- checklist **Tarefas por área**;
- label existente **Sprint 04** apenas se a equipe confirmar que essa label significa agrupamento e não compromisso de entrega;
- nenhum membro atribuído por padrão.

Os CAs atuais não serão apagados até que a nova HU seja criada e relida. Depois, o card RF manterá objetivo, atores, dependências e link para a HU, evitando duas fontes de verdade.

### 3. Cards funcionais para Bryan

Criar no **Product Backlog**, atribuir a Bryan somente após sua concordância e vincular aos CAs indicados:

1. `[RF29][BE/QA] validar fórmula e explicação do Inventory Score` — RF29.CA02–CA05 e CA11; 8 pontos.
2. `[RF30][BE/DB/QA] reconciliar ledger e provar idempotência em concorrência` — RF30.CA01–CA03; 8 pontos.
3. `[RF32][BE/DB/QA] tornar encerramento de desafio atômico e idempotente` — RF32.CA12; 8 pontos; bloqueado apenas quanto à regra de desempate.
4. `[RF33][FE/QA] entregar Passarela com filtros e fallback sem WebGL` — RF33.CA07 e CA10–CA12; 8 pontos.
5. `[RF38][BE/DB/QA] impedir resgate duplo e cobrir expiração de cupom` — novos CAs de concorrência/expiração; 8 pontos.

O corpo completo dos cinco cards — contexto, valor, escopo, Given/When/Then, subtarefas, arquivos, testes, evidências, riscos, DoD e commits — permanece na seção 8 de `TDE_SECAO_4_RF25_RF39.md` e será copiado sem incluir credenciais ou alegar resultados ainda não obtidos.

## Salvaguardas da aplicação

- Antes da escrita: reler os cards-alvo e confirmar que `dateLastActivity`/conteúdo não mudou desde esta auditoria.
- Não excluir checklist/card; primeiro criar/mover e reler, depois remover somente duplicata confirmada.
- Não marcar CA/tarefa como concluído com base apenas na presença de código ou endpoint.
- Não atribuir Bryan sem concordância explícita da equipe/Bryan.
- Registrar IDs dos cards/checklists criados e respostas HTTP, nunca URLs autenticadas.
- Após a aplicação: executar novamente todas as consultas GET e gerar comparação esperado × efetivo.

## Confirmações necessárias antes da escrita

1. Autorizar o lote inteiro ou indicar quais operações numeradas podem ser aplicadas.
2. Confirmar se HU-RF33–RF39 devem receber a label **Sprint 04** ou ficar sem sprint.
3. Confirmar se os cinco cards podem ser atribuídos imediatamente a Bryan.
4. Decidir se RF28.CA05 permite vestir manualmente peça indisponível com aviso ou se RF31 deve bloquear também essa entrada.
5. Definir o desempate do RF32 e a fronteira exata entre “emitir”, “resgatar/validar” e “usar” no RF38.
