# TDE — conteúdo revisável a partir da seção 4

> **Escopo e data-base:** análise local realizada em 28/09/2026 e conferência do Trello realizada em 29/09/2026. As três variáveis `TRELLO_*` estavam presentes, sem exposição de valores, e `python scripts/rubricas/verificar_trello.py` confirmou acesso de leitura ao board **TCC 2026 (Fashion AI) - Bryan,Matheus**. Foram consultadas 21 listas, 312 cards, descrições, membros, labels, checklists e os comentários disponíveis. A equipe autorizou o lote documentado em `docs/rubricas/TRELLO_RF25_RF39_DIFF_PROPOSTO.md`, mas quatro tentativas falharam na primeira escrita com HTTP 403 (`Method forbidden`). Testes sem credenciais confirmaram que o proxy permite GET e bloqueia POST/PUT/DELETE; portanto, nenhuma mutação ocorreu e o lote permanece pendente de liberação no proxy.

> **Fonte complementar:** `docs/rubricas/ANALISE_RF_RNF_E_BRAYAN.md` foi incorporado como avaliação de maturidade das evidências. Suas notas não representam conclusão do backlog nem aprovação da banca. A seleção dos cards usa as lacunas funcionais apontadas no documento, sem converter scores em status ou marcar CAs automaticamente.

## 4. Relação de atores e governança do trabalho

| Ator | Responsabilidade no escopo RF25–RF39 |
|---|---|
| Usuário pessoal | Organizar o acervo, compor looks, participar de desafios e jogos, administrar pontos e cupons. |
| Marca | Criar selo, promoção, coleção e componentes ou guarda-roupas 3D, respeitando autorização e estoque. |
| Celebridade | Criar selo, promoção, eras e itens 3D autorizados. |
| Administrador | Moderar conteúdo, auditar operações e atuar apenas nos fluxos explicitamente autorizados. |
| Bryan | Implementar, testar e demonstrar tarefas próprias vinculadas a RF e CA; não reatribuir autoria preexistente. |
| Revisor da equipe | Revisar o PR de Bryan e conferir CA, testes, evidência, segurança e regressão. |

As HUs devem conter apenas resultados observáveis pelo ator. Regras transversais — autorização, privacidade, desempenho, auditoria e resiliência — devem ser ligadas aos RNFs e testadas, sem copiar o mesmo texto para todas as HUs. Um CA deve expressar uma regra verificável em **Given/When/Then**, sem misturar implementação, estimativa, subtarefa ou definição de pronto.

## 5. Método de análise e rastreabilidade

A análise confrontou: especificações em `docs/meu_guarda_roupa/` e `docs/novos-rf/`; mapa de numeração oficial em `docs/novos-rf/README.md`; controllers e serviços Java; rotas Next.js; testes JUnit/Vitest; e inventário E2E em `scripts/e2e/suite_2.py`, `suite_3.py` e `TABELA_ENDPOINTS_POR_RF.md`. Endpoints foram tratados apenas como indício: a avaliação também considerou persistência, autorização, erros, interface e teste.

Há colisão de numeração histórica: no código, Meu Quarto, Espelho, Destaques, Pontos e Desafios aparecem como RF32–RF36, enquanto no Trello são RF27–RF32. Toda nova HU, teste e PR deve usar primeiro o número oficial do Trello e registrar o alias legado somente para rastreabilidade.

### 5.1 Regra de estimativa

- **Pequena (P):** 1–3 pontos; alteração localizada, sem migração nem contrato externo.
- **Média (M):** 5–8 pontos; cruza duas camadas ou exige integração e regressão.
- **Grande (G):** 13 pontos ou mais; envolve concorrência, migração, 3D/IA ou múltiplos perfis. Deve ser fatiada antes de entrar na sprint.

Os pontos são uma estimativa relativa por complexidade, risco e incerteza, não horas nem promessa de data. O planejamento deve respeitar a capacidade histórica confirmada pela equipe. Em Kanban, recomenda-se limitar trabalho em progresso e só mover um card para concluído após código, revisão, teste e evidência.

## 6. Auditoria dos RF25–RF39

Os estados e CAs foram confrontados com o board em modo somente leitura em 29/09/2026. Todos os cards RF25–RF39 estão abertos na lista **Requisitos Funcionais**, sem membro atribuído. HU-RF25–RF32 estão abertas no **Product Backlog**; HU-RF33–RF39 não foram localizadas. O detalhamento por card e as alterações propostas constam no diff de Trello versionado.

### RF25 — Selos de marca/celebridade e promoções

1. **Trello:** card aberto em Requisitos Funcionais, label Sprint 03, sem responsável, checklist ou comentário; 9 CAs estão na descrição, enquanto HU-RF25 está vazia no Product Backlog.
2. **CAs essenciais:** perfil institucional autorizado cria/edita selo; janela invertida é recusada; selo público só aparece quando aprovado e vigente; promoção respeita período e limite por usuário.
3. **Implementação:** `SealController`, `SealService`, `SealDesignService`, persistência de selo/promoção e telas de selos/promoções.
4. **Testes:** `SealDesignsTest`, `SealDesignServiceTest` e 13 passos E2E no RF25.
5. **Lacuna verificável:** não foi localizado teste automatizado dedicado à corrida de resgate/limite da promoção; autorização negativa deve ser consolidada por perfil.
6. **Dependências:** RF20/RF21, RF38, RNF1, RNF5 e relógio transacional.
7. **Bryan:** cobrir matriz de autorização e promoção no limite/expirada.
8. **Estimativa:** M (5 pontos).
9. **Pronto:** regras persistidas, erros 400/403/409 estáveis, testes unitários/integrados e E2E aprovados.
10. **Demonstração:** marca cria promoção válida; usuário elegível resgata; perfil indevido e janela inválida são bloqueados.

### RF26 — Explorador Global

1. **Trello:** card aberto em Requisitos Funcionais, label Sprint 04 e sem responsável/checklist/comentário; HU-RF26 está aberta no Product Backlog com quatro CAs em rascunho na descrição.
2. **CAs essenciais:** painel agrega por país; filtros de país retornam somente entidades elegíveis; estados vazio/erro são compreensíveis; números coincidem com a fonte persistida.
3. **Implementação:** `ExplorerService`, endpoints `/api/explorer/*` e `app/(site)/(app)/explorer/page.tsx`.
4. **Testes:** 3 passos E2E; não foi localizado teste unitário específico de agregação.
5. **Lacuna verificável:** ausência de prova automatizada que reconcilie totais e combinações de filtros com consulta de referência.
6. **Dependências:** dados de perfis institucionais, país/região, RNF7 e paginação.
7. **Bryan:** criar fixture determinística e teste de reconciliação das agregações.
8. **Estimativa:** M (5 pontos).
9. **Pronto:** totais reconciliados, filtros e estados vazios testados, consulta dentro do orçamento acordado pela equipe.
10. **Demonstração:** alternar país/filtro e comparar contagem da UI, API e consulta de referência.

### RF27 — Meu Quarto 3D

1. **Trello:** card RF e HU abertos, label Sprint 04 e sem responsável/comentário; a HU contém 12 CAs e 7 tarefas incompletas, e o RF duplica o CA12.
2. **CAs essenciais:** posições são persistidas; mover/renomear reflete nas visões; excedentes não bloqueiam cadastro; sem WebGL há modo 2.5D equivalente; “Mostrar no quarto” focaliza a peça.
3. **Implementação:** `RoomController`, `RoomService` e página `/room`, que já detecta WebGL e informa o fallback.
4. **Testes:** `RoomAddressTest`, `WardrobeCatalogTest` e 16 passos E2E.
5. **Lacuna verificável:** a especificação pede equivalência de ações no fallback, mas não foi localizado teste de componente/E2E que force WebGL indisponível; também não há alternância Avatar 3D/manequim visível na página.
6. **Dependências:** RF28, RF31, RF39, assets 3D e RNF7.
7. **Bryan:** implementar alternância manequim/avatar quando o contrato do RF40 estiver disponível, ou primeiro tornar o fallback 2.5D verificável por teste.
8. **Estimativa:** M (8 pontos); integração completa com avatar deve ser fatiada.
9. **Pronto:** ação equivalente nos dois modos, preferência preservada, testes de componente/E2E e acessibilidade.
10. **Demonstração:** abrir com e sem WebGL, localizar/mover a mesma peça e alternar representação sem perder estado.

### RF28 — Smart Mirror e Vista-me

1. **Trello:** card RF e HU abertos, label Sprint 04 e sem responsável/comentário; a HU contém 16 CAs e 8 tarefas incompletas, e o RF duplica o CA16.
2. **CAs essenciais:** vestir/substituir por slot; sugerir apenas peças elegíveis; rejeitar IDs não elegíveis; fallback local quando IA falha; salvar/levar composição ao RF5 e registrar Look do Dia sem duplicação.
3. **Implementação:** `MirrorController`, `MirrorService` e página `/mirror`; o serviço valida disponibilidade e oferece fallback local.
4. **Testes:** 14 passos E2E; não foi localizado teste de componente para o atalho contextual “Usar em…”.
5. **Lacuna verificável:** UI não expõe alternância Avatar 3D/manequim nem um atalho genérico “Usar em…”; a cobertura localizada é orientada a chamadas, não à jornada visual completa.
6. **Dependências:** RF5, RF10, RF24, RF27, RF31 e RF40.
7. **Bryan:** implementar o atalho contextual com retorno seguro ao fluxo de origem e teste E2E.
8. **Estimativa:** M (8 pontos).
9. **Pronto:** atalho disponível por teclado/toque, IDs validados no servidor, estado restaurável e teste ponta a ponta.
10. **Demonstração:** selecionar peça no acervo, enviá-la ao espelho/quarto, trocar slot e concluir um look.

### RF29 — Inventory Score, destaques e rankings

1. **Trello:** card RF e HU abertos, label Sprint 04 e sem responsável/comentário; a HU contém 11 CAs e 6 tarefas incompletas.
2. **CAs essenciais:** menos de 10 peças não gera nota; sete dimensões explicáveis; pesos renormalizados sem DNA; score limitado a 0–1000; ranking exige opt-in e cidade exige k-anonimato.
3. **Implementação:** `InventoryScoreService`, `HighlightsController` e página `/highlights`, com snapshots, explicações e rankings.
4. **Testes:** `ScoreBandsTest`, `WardrobeAnalysisTest` e 9 passos E2E; não foi encontrado teste unitário abrangente da fórmula completa.
5. **Lacuna verificável:** faltam vetores de cálculo manual para limiares, ausência de DNA, indisponibilidade e regressão “30 peças úteis > 500 vazias”.
6. **Dependências:** RF13, RF27, RF31, diário de uso, snapshots e RNF6.
7. **Bryan:** tarefa priorizada B1, descrita na seção 8.
8. **Estimativa:** M (8 pontos).
9. **Pronto:** fixtures calculadas à mão, explicação da API/UI coincidente e regressão automatizada.
10. **Demonstração:** alterar um dado controlado, recalcular e explicar exatamente a dimensão e o delta resultante.

### RF30 — FAI Points, níveis e loja

1. **Trello:** card RF e HU abertos, label Sprint 04 e sem responsável/comentário; a HU contém 8 CAs e 5 tarefas incompletas.
2. **CAs essenciais:** evento idempotente; teto diário não bloqueia ação; compra debita saldo sem reduzir pontos vitalícios; nível libera função; compra concorrente não produz saldo/estoque negativo.
3. **Implementação:** `FaiPointsService`, ledger, travas de comprador/item, `HighlightsController` e página `/points`.
4. **Testes:** `FaiPointsGamesTest`, `FaiPointsShopTest` e 8 passos E2E cobrem idempotência, tetos e serialização em unidade.
5. **Lacuna verificável:** falta teste de integração com banco real para restrição única/idempotência e rotina explícita de reconciliação saldo × ledger.
6. **Dependências:** RF29, RF32, RF37, RF39, transações e índices do banco.
7. **Bryan:** tarefa priorizada B2.
8. **Estimativa:** M (8 pontos).
9. **Pronto:** reconciliação detecta divergência sem alterar silenciosamente, corrida é testada no banco e UI explica teto.
10. **Demonstração:** repetir o mesmo evento, executar compras concorrentes e exibir extrato/saldo consistente.

### RF31 — Estados do acervo

1. **Trello:** card RF e HU abertos, label Sprint 04 e sem responsável/comentário; a HU contém 7 CAs e 5 tarefas incompletas, incluindo um CA de apresentação visual que deve ser tarefa FE.
2. **CAs essenciais:** favorita, disponível, indisponível e à venda persistem; fluxos automáticos excluem indisponíveis; tentativa manual informa restrição; todas as telas exibem o mesmo estado.
3. **Implementação:** `WardrobeService`, filtros em `MirrorService`, cards/modal do frontend e log de disponibilidade.
4. **Testes:** `WardrobeStateFilterTest` e 5 passos E2E.
5. **Lacuna verificável:** não há matriz automatizada tela × estado; a própria especificação local pede confirmação sobre “Para vender”.
6. **Dependências:** RF5, RF10, RF27–RF29 e RF32.
7. **Bryan:** criar contrato compartilhado de elegibilidade e regressão nas entradas de composição.
8. **Estimativa:** M (5 pontos).
9. **Pronto:** uma transição aparece igual em grade, detalhe, quarto e espelho; indisponível nunca entra em composição automática.
10. **Demonstração:** mudar estado numa tela e provar persistência, reflexo cruzado e exclusão do Vista-me.

### RF32 — Desafios

1. **Trello:** card RF e HU abertos, label Sprint 04 e sem responsável/comentário; a HU contém 17 CAs e 7 tarefas incompletas.
2. **CAs essenciais:** elegibilidade/convite; limite de ativos; entrada válida; um voto por eleitor; consentimento de foto; encerramento determinístico; recompensa única.
3. **Implementação:** `ChallengeController`, `ChallengeService`, persistência de instâncias/participantes/eventos/votos e telas `/challenges`.
4. **Testes:** `ChallengeSecurityTest` e 23 passos E2E cobrem privacidade e voto duplicado convertido em conflito.
5. **Lacuna verificável:** não foi localizado teste integrado de duas finalizações concorrentes, regra explícita de desempate e recompensa exatamente uma vez.
6. **Dependências:** RF30, RF31, RF36, RNF1, RNF5 e relógio.
7. **Bryan:** tarefa priorizada B3.
8. **Estimativa:** M (8 pontos).
9. **Pronto:** fechamento atômico, desempate documentado, ledger idempotente e teste concorrente reproduzível.
10. **Demonstração:** duas requisições encerram o mesmo desafio; só um resultado e uma recompensa são persistidos.

### RF33 — Passarela 3D

1. **Trello:** card aberto em Requisitos Funcionais, label Sprint 04 e sem responsável/checklist/comentário; 12 CAs estão na descrição e HU-RF33 não existe.
2. **CAs essenciais:** mostrar apenas Looks do Dia elegíveis; Top 100 global/regional/país; filtros combináveis; paginação/lote; fallback acessível sem WebGL.
3. **Implementação:** `ShowcaseController`/`ShowcaseService`; API de runway. Não foi localizada rota de frontend dedicada pelo nome “runway/showcase”.
4. **Testes:** 8 passos E2E, todos no mesmo endpoint; não foi localizado teste visual/funcional de fallback.
5. **Lacuna verificável:** cobertura E2E baixa para filtros/Top 100 e ausência de evidência automatizada de interface/fallback.
6. **Dependências:** Look do Dia, geografia, assets 3D, RF31 e RNF7.
7. **Bryan:** tarefa priorizada B4.
8. **Estimativa:** M (8 pontos).
9. **Pronto:** rota navegável, filtros conferidos contra API, fallback sem WebGL e teste E2E com fixture determinística.
10. **Demonstração:** alternar Global/Regional/País, filtrar e repetir o fluxo com WebGL bloqueado.

### RF34 — Eras da celebridade

1. **Trello:** card aberto em Requisitos Funcionais, label Sprint 04 e sem responsável/checklist/comentário; 8 CAs estão na descrição e HU-RF34 não existe.
2. **CAs essenciais:** celebridade autorizada cria/ordena/publica era; visitante busca e vê itens publicados; conteúdo não publicado não vaza; My Stage degrada sem WebGL.
3. **Implementação:** `ShowcaseService`/controller institucional e especificação `RF33-RF35.md`.
4. **Testes:** 9 passos E2E; não foi localizado teste unitário dedicado à governança editorial.
5. **Lacuna verificável:** faltam evidência visual de ciclo completo e testes negativos de perfil/rascunho.
6. **Dependências:** RF21/RF22, moderação, mídia 3D e RNF1.
7. **Bryan:** teste integrado de publicação e não vazamento de rascunho.
8. **Estimativa:** M (5 pontos).
9. **Pronto:** autorização e estados editoriais testados, ordem persistida e visita pública demonstrável.
10. **Demonstração:** celebridade publica uma era; visitante encontra; rascunho e perfil indevido permanecem bloqueados.

### RF35 — Coleções da marca

1. **Trello:** card aberto em Requisitos Funcionais, label Sprint 04 e sem responsável/checklist/comentário; 7 CAs estão na descrição e HU-RF35 não existe.
2. **CAs essenciais:** marca autorizada cria/ordena/publica coleção; visitante filtra itens disponíveis; estoque e retirada são refletidos; mini loja tem fallback.
3. **Implementação:** `ShowcaseService`/controller e especificação `RF33-RF35.md`.
4. **Testes:** 6 passos E2E; não foi localizado teste unitário dedicado a estoque/ordenação editorial.
5. **Lacuna verificável:** falta ciclo automatizado marca → publicação → visitante, com estoque esgotado e autorização negativa.
6. **Dependências:** RF14/RF20, catálogo, estoque, moderação e RNF1.
7. **Bryan:** implementar regressão ponta a ponta da coleção com estoque.
8. **Estimativa:** M (5 pontos).
9. **Pronto:** rascunho não público, ordem estável, esgotado não comprável e testes por perfil.
10. **Demonstração:** marca publica coleção, visitante navega e item esgotado recebe resposta/estado coerente.

### RF36 — Foto com manequim

1. **Trello:** card aberto em Requisitos Funcionais, label Sprint 04 e sem responsável/checklist/comentário; 8 CAs estão na descrição e HU-RF36 não existe.
2. **CAs essenciais:** consentimento explícito; peça/look válido; job expõe processamento/sucesso/falha; resultado e original seguem autorização; retry não duplica cobrança/artefato.
3. **Implementação:** endpoints de showcase/mannequim, pipeline de imagem e componentes de foto/manequim.
4. **Testes:** testes de imagem/try-on e 8 passos E2E; não foi localizado teste dedicado ao ciclo de falha do job deste RF.
5. **Lacuna verificável:** falhas, retry e revogação de consentimento carecem de prova funcional específica.
6. **Dependências:** RF4/RF5, RF16/RF18, perfil/foto, mídia restrita, RNF6 e RNF8.
7. **Bryan:** cobrir máquina de estados do job, consentimento e retry idempotente.
8. **Estimativa:** M (8 pontos).
9. **Pronto:** erros recuperáveis, consentimento auditável, mídia protegida e testes sem dados pessoais reais.
10. **Demonstração:** consentir, gerar, simular falha/retry e revogar acesso conforme regra aprovada.

### RF37 — FLAIR

1. **Trello:** card aberto em Requisitos Funcionais, label Sprint 04 e sem responsável/checklist/comentário; 12 CAs estão na descrição e HU-RF37 não existe.
2. **CAs essenciais:** regras determinísticas por modo; entrada válida; resultado persistido; recompensa idempotente e limitada; autorização de time; combinação/resgate não duplica.
3. **Implementação:** `FlairController`, `FlairModesController`, `FlairService`, `FlairModesService` e página `/flair`.
4. **Testes:** `FlairEngineTest`, `FlairLooksTest`, `FaiPointsGamesTest` e 67 passos E2E em 55 endpoints.
5. **Lacuna verificável:** grande superfície de 15 modos sem matriz de regressão modo × regra × recompensa; concorrência do resultado não está comprovada em banco real.
6. **Dependências:** RF30, RF31, RF38, times, catálogo e antifraude.
7. **Bryan:** matriz de contrato dos modos e teste integrado de recompensa única.
8. **Estimativa:** G (13); fatiar por família de modos.
9. **Pronto:** cada modo selecionado possui exemplo, invariantes, teste determinístico e recompensa reconciliada.
10. **Demonstração:** repetir finalização da mesma partida e provar placar/ledger únicos.

### RF38 — Cupons Fashion AI

1. **Trello:** card aberto em Requisitos Funcionais, label Sprint 04 e sem responsável/checklist/comentário; 10 CAs estão na descrição e HU-RF38 não existe.
2. **CAs essenciais:** direito nasce de fonte elegível; emissão respeita vigência/limite; resgate é único; expirado/usado é recusado; listas separam disponíveis e resgatados.
3. **Implementação:** `CouponController`, `CouponService`, direitos, promoções/resgates e página `/coupons`; serviço usa transações e eventos após commit.
4. **Testes:** 9 passos E2E em 6 endpoints; não foi localizado teste JUnit específico de `CouponService`.
5. **Lacuna verificável:** ausência de teste concorrente com restrição do banco para uso duplo, expiração no limite e rollback entre direito e emissão.
6. **Dependências:** RF25, RF37, relógio, índices únicos, transações e RNF5.
7. **Bryan:** tarefa priorizada B5.
8. **Estimativa:** M (8 pontos).
9. **Pronto:** uma emissão/resgate por direito, corrida retorna conflito de domínio, expiração determinística e auditoria sem segredo/código completo.
10. **Demonstração:** duas requisições usam o mesmo direito; uma vence, outra recebe 409, e o histórico permanece consistente.

### RF39 — Criador e loja de guarda-roupa 3D

1. **Trello:** card aberto em Requisitos Funcionais, label Sprint 04 e sem responsável/checklist/comentário; 12 CAs estão na descrição e HU-RF39 não existe.
2. **CAs essenciais:** apenas marca/celebridade elegível cria; componente/guarda-roupa persiste; edição respeita autoria; item com vendas é retirado da loja sem sumir de compradores; compra respeita nível/estoque/limite.
3. **Implementação:** `RoomCreatorController`, `WardrobeCreatorService`, catálogo/estoque e evidências em `docs/novos-rf/telas-rf39/`.
4. **Testes:** `WardrobeCatalogTest`, `FaiPointsShopTest` e 14 passos E2E.
5. **Lacuna verificável:** falta matriz integrada de perfis e teste mensurável em dispositivo modesto/fallback do editor 3D.
6. **Dependências:** RF25, RF27, RF30, assets/upload, RNF1 e RNF7.
7. **Bryan:** consolidar autorização por perfil e modo leve do editor em tarefa separada.
8. **Estimativa:** M (8 pontos) para RBAC; G para desempenho + editor.
9. **Pronto:** 401/403/409 previsíveis, criação persistida, compra preservada após retirada e orçamento de desempenho definido pela equipe.
10. **Demonstração:** marca cria/publica; usuário compra; criador retira; comprador continua vendo; usuário comum não cria.

## 7. Revisão proposta dos critérios de aceite

Antes de editar o backlog, aplicar este diff conceitual a cada HU:

1. **Manter:** comportamento do usuário, resultado persistido, autorização, erro funcional e condição de borda indispensáveis para validar a HU.
2. **Mesclar:** CAs que repetem a mesma regra em frases diferentes; manter uma única forma Given/When/Then.
3. **Mover para subtarefa/DoD:** nomes de arquivo, framework, “criar endpoint”, “tirar print”, “fazer commits”, revisão e publicação de evidência.
4. **Mover para RNF:** metas transversais de segurança, privacidade, acessibilidade e desempenho; na HU manter somente a ligação e a medição aplicável.
5. **Remover:** promessa não verificável (“interface intuitiva”, “rápido”, “funcionar corretamente”), solução prematura e métrica sem fonte.
6. **Não duplicar:** um CA compartilhado deve ter uma fonte canônica e ser referenciado; cada HU mantém apenas o que decide sua aceitação.

Checklist de qualidade: ator e pré-condição explícitos; uma ação por cenário; saída observável; erro/código quando relevante; persistência verificável; papel permitido/proibido; dado de teste; vínculo RF/HU/CA/teste; ausência de datas, responsáveis e métricas inventadas.

## 8. Cards autorizados para Bryan (publicação bloqueada por HTTP 403)

Os cinco cards abaixo coincidem com os avanços recomendados na análise complementar para RF29, RF30, RF32, RF33 e RF38. RF27/RF28 também têm integração FE relevante (“Usar em…” e Avatar/manequim), mas permanecem como candidatos de reserva porque o lote autorizado está limitado a cinco cards; qualquer substituição requer novo diff e confirmação.

### B1 — `[RF29][BE/QA] validar fórmula e explicação do Inventory Score`

- **Contexto/problema:** há implementação extensa e alguns testes auxiliares, porém não uma bateria que derive manualmente a nota completa e cubra bordas documentadas.
- **Valor:** o usuário entende por que a nota mudou e a banca consegue reproduzir o cálculo.
- **Inclui:** fixtures determinísticas; dimensões, pesos/renormalização, mínimo de peças, limites 0–1000 e regressão “inventário útil”. **Fora:** redesenhar fórmula ou ranking.
- **CAs:** Given 9 peças, When calcular, Then não há score e aparece progresso; Given ausência de DNA, When calcular, Then Identidade é omitida e pesos restantes somam 1; Given fixture manual, When consultar API/UI, Then total, dimensão e explicação coincidem; Given extremos, Then score fica em 0–1000.
- **Subtarefas:** BE extrair/estabilizar fixture e explicação; QA implementar testes parametrizados e cenário E2E; FE somente corrigir divergência encontrada.
- **Prováveis arquivos:** `InventoryScoreService.java`, `HighlightsController.java`, `/highlights/page.tsx`, novo `InventoryScoreServiceTest.java`.
- **Testes/evidências:** JUnit da fórmula, E2E da explicação, tabela entrada → conta manual → API; captura somente como evidência complementar.
- **Riscos/dependências:** relógio, dados de uso e DNA; congelar data e IDs.
- **Pronto/estimativa:** revisão por outro integrante, testes verdes e CA rastreado; **8 pontos (M)**.
- **Commits sugeridos:** `test(rf29): cobrir vetores da formula do inventory score`; `fix(rf29): alinhar explicacao ao calculo` (somente se houver defeito).

### B2 — `[RF30][BE/DB/QA] reconciliar ledger e provar idempotência em concorrência`

- **Contexto/problema:** unidade cobre idempotência/tetos e compra serializada, mas falta prova integrada com restrições reais e reconciliação operacional.
- **Valor:** evita saldo, nível ou recompensa divergentes quando eventos são repetidos ou concorrentes.
- **Inclui:** consulta/serviço de reconciliação sem correção silenciosa; teste de índice único e corrida; limite diário. **Fora:** mudar economia/pontuação.
- **CAs:** Given mesma chave em duas transações, When processadas em paralelo, Then existe um crédito; Given teto atingido, When nova ação ocorre, Then ação conclui sem pontos e informa limite; Given saldo derivado diferente do resumo, When reconciliar, Then divergência auditável é retornada sem apagar lançamentos.
- **Subtarefas:** DB conferir constraint/lock; BE implementar leitura de reconciliação protegida; QA teste de integração concorrente; FE exibir estado de limite já fornecido pela API.
- **Prováveis arquivos:** `FaiPointsService.java`, repositórios/entidades de ledger, migration Flyway e testes de integração.
- **Testes/evidências:** teste com banco real, log sem dados sensíveis, extrato antes/depois.
- **Riscos/dependências:** ordem de locks e fuso; usar `FaiPointsService.ZONE` e não relógio local arbitrário.
- **Pronto/estimativa:** corrida reproduzível, índice conferido, sem saldo negativo e revisão; **8 pontos (M)**.
- **Commits sugeridos:** `test(rf30): provar idempotencia concorrente do ledger`; `feat(rf30): adicionar reconciliacao somente leitura`.

### B3 — `[RF32][BE/DB/QA] tornar encerramento de desafio atômico e idempotente`

- **Contexto/problema:** voto duplicado possui proteção, mas o encerramento concorrente, desempate e recompensa única não têm prova localizada.
- **Valor:** participantes recebem resultado estável e nunca duplicam pontos.
- **Inclui:** transição única para encerrado, regra de desempate aprovada, chave idempotente de recompensa e teste concorrente. **Fora:** novos modos de desafio.
- **CAs:** Given desafio elegível, When duas finalizações concorrem, Then uma transição vence e ambas observam o mesmo resultado; Given empate, Then regra aprovada produz resultado determinístico; Given reprocessamento, Then ledger contém uma recompensa por participante/referência.
- **Subtarefas:** DB lock/versão/constraint; BE finalização e código de conflito; QA concorrência e reprocessamento; FE mostrar resultado retornado sem duplicar ação.
- **Prováveis arquivos:** `ChallengeService.java`, repositórios/entidades de desafio, `FaiPointsService.java`, migration e testes.
- **Testes/evidências:** integração concorrente, consulta às linhas finais e extrato dos vencedores.
- **Riscos/dependências:** equipe precisa confirmar regra de empate no card; sem confirmação, implementar apenas atomicidade/idempotência.
- **Pronto/estimativa:** regra aceita, teste não flaky, auditoria e revisão; **8 pontos (M)**.
- **Commits sugeridos:** `test(rf32): reproduzir encerramento concorrente`; `fix(rf32): impedir recompensa duplicada no fechamento`.

### B4 — `[RF33][FE/QA] entregar Passarela com filtros e fallback sem WebGL`

- **Contexto/problema:** API concentra ranking/filtros, mas não foi localizada rota dedicada nem teste visual/funcional; os 8 passos E2E exercitam um único endpoint.
- **Valor:** a Passarela permanece demonstrável em hardware sem 3D e os rankings podem ser validados pela interface.
- **Inclui:** rota navegável; Global/Regional/País; filtros essenciais; detecção de WebGL; lista/2.5D equivalente; estados vazio/erro. **Fora:** novo motor 3D.
- **CAs:** Given WebGL, When abrir, Then lote desfila e filtros atualizam API/UI; Given WebGL bloqueado, Then os mesmos looks e ações aparecem no fallback; Given fixture, Then Top 100 nunca excede 100 e respeita escopo; Given erro, Then retry acessível é exibido.
- **Subtarefas:** FE criar/ligar rota e fallback; BE corrigir contrato apenas se teste mostrar divergência; QA fixtures e E2E nos dois modos.
- **Prováveis arquivos:** nova página/rota da passarela, `ShowcaseController.java`, `ShowcaseService.java`, suíte Playwright/E2E.
- **Testes/evidências:** E2E com `getContext` bloqueado, assertions de filtros e screenshot nos dois modos.
- **Riscos/dependências:** assets e dados geográficos; não confundir fallback com ocultar funcionalidade.
- **Pronto/estimativa:** navegável por teclado, testes estáveis, lote/filtros reconciliados; **8 pontos (M)**.
- **Commits sugeridos:** `feat(rf33): adicionar passarela e fallback sem webgl`; `test(rf33): validar top 100 e filtros`.

### B5 — `[RF38][BE/DB/QA] impedir resgate duplo e cobrir expiração de cupom`

- **Contexto/problema:** serviço é transacional, mas não há teste JUnit específico que prove corrida, fronteira de expiração e rollback.
- **Valor:** o usuário não perde um direito nem obtém dois cupons em reenvio/concorrência.
- **Inclui:** constraint/idempotency key, lock ou insert atômico, relógio injetável e erros 409/410 coerentes. **Fora:** criar novas promoções ou redesenhar a tela.
- **CAs:** Given direito válido, When duas emissões/resgates concorrem, Then uma persiste e a outra retorna conflito de domínio; Given instante igual/após expiração, Then não emite/não usa; Given falha após reservar direito, Then transação reverte sem estado órfão; Given repetição da mesma chave, Then retorna resultado idempotente conforme contrato aprovado.
- **Subtarefas:** DB conferir índices; BE tornar operação atômica e relógio testável; QA integração concorrente/rollback; FE mapear erros para mensagem acionável.
- **Prováveis arquivos:** `CouponService.java`, `CouponController.java`, entidades/repositórios de cupom, Flyway, `/coupons/page.tsx` e novo teste.
- **Testes/evidências:** JUnit/integrado, E2E de expirado/usado, consulta final do direito e resgate.
- **Riscos/dependências:** emitir cria o código, validar apenas consulta e usar consome definitivamente; preservar códigos de cupom em segredo.
- **Pronto/estimativa:** transação/constraint comprovadas, testes e revisão; **8 pontos (M)**.
- **Commits sugeridos:** `test(rf38): reproduzir resgate concorrente`; `fix(rf38): tornar resgate de cupom transacional`.

## 9. Requisitos não funcionais aplicáveis

- **RNF1 — autorização:** testes positivos e negativos por perfil nos RF25, RF34, RF35 e RF39.
- **RNF5 — auditoria:** eventos de promoção, pontos, desafio e cupom com correlation ID, sem token/código sensível.
- **RNF6 — privacidade:** opt-in de ranking e consentimento/mídia restrita no RF36.
- **RNF7 — desempenho, acessibilidade e usabilidade:** fallback equivalente nos RF27, RF33 e RF39; metas numéricas dependem de aprovação da equipe.
- **RNF8 — resiliência:** fallback local no Vista-me e estados recuperáveis para renderização/serviços externos.

## 10. Autoria, fluxo de PR e definição de pronto comum

Bryan deve usar conta e identidade Git próprias. Não se deve alterar autoria histórica nem fabricar commits. Cada commit deve conter trabalho coeso e revisável; cada PR deve citar card, RF, CA, testes e evidência e ser revisado por outro integrante. Evidência documental ou screenshot acompanha a função, mas não substitui código e teste.

Definição de pronto comum: CA aprovado; código e migração revisados; autorização e erros cobertos; teste unitário/integrado e E2E pertinente; persistência conferida; interface demonstrável; acessibilidade/fallback quando aplicável; documentação de rastreabilidade atualizada; nenhuma credencial ou dado pessoal versionado.

## 11. Pendências para a equipe e plano de atualização do Trello

1. Preservar como registro de decisão o lote autorizado em `docs/rubricas/TRELLO_RF25_RF39_DIFF_PROPOSTO.md`, especialmente a criação das HU-RF33–RF39 e dos cinco cards de Bryan.
2. Confirmar com a equipe a regra objetiva de desempate do RF32 (o marcador `[regra]` não é implementável), o estado “à venda” do RF31 e as métricas do RNF7. A semântica do RF38 e Sprint 04 para HU-RF33–RF39 já foram confirmadas.
3. Liberar no caminho de rede/API os métodos de escrita para `api.trello.com` e repetir o lote já autorizado com `python scripts/rubricas/aplicar_trello_rf25_rf39.py --apply`.
4. Depois da escrita, reler os cards alterados, comparar o estado efetivo com o diff e registrar IDs e resultados sem credenciais.

### 11.1 Registro das consultas de leitura

| Consulta | Resultado | Escrita |
|---|---|---|
| `GET /1/boards/{boardId}?fields=name,url,closed` por `verificar_trello.py` | board aberto e leitura confirmada | não |
| `GET /1/boards/{boardId}/lists` | 21 listas lidas | não |
| `GET /1/boards/{boardId}/cards` com membros e checklists | 312 cards lidos | não |
| `GET /1/boards/{boardId}/actions?filter=commentCard` | comentários disponíveis consultados | não |
| `GET /1/boards/{boardId}/members` | membros do board consultados; Bryan localizado | não |

As URLs completas não são registradas porque contêm chave e token como parâmetros. A leitura não autoriza automaticamente escrita; o board só será declarado sincronizado após aprovação, aplicação e releitura do diff.

## 12. Fontes internas

- `docs/novos-rf/README.md` — mapa Trello ↔ aliases do código.
- `docs/meu_guarda_roupa/01-especificacao-meu-quarto.md`, `02-inventory-score-calculo.md` e `03-desafios-e-games.md` — regras e CAs locais.
- `docs/novos-rf/RF33-RF35.md`, `RF36-RF39.md` e `RF39_Criar_Guarda_Roupa_3D.md` — requisitos novos.
- `docs/testes/TABELA_ENDPOINTS_POR_RF.md` e `scripts/e2e/suite_2.py`/`suite_3.py` — inventário de testes de API.
- Controllers, serviços, repositórios, migrations e páginas citados em cada análise.
- `docs/rubricas/TRELLO_RF25_RF39_DIFF_PROPOSTO.md` — auditoria efetiva do board e lote de escrita aguardando aprovação.
