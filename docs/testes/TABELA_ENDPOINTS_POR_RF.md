# Teste ponta a ponta dos endpoints — tabela por RF

Execução real contra a API (Spring Boot) e o MySQL local. **452 passos, 452 com o status esperado, 368 endpoints distintos** (de 368 no inventário do backend).

Como cada coluna foi obtida:

- **Status**: código HTTP devolvido. Alguns passos testam regras de negócio e esperam 4xx (ex.: 409 limite, 403 sem permissão); o status real aparece na tabela.
- **Salvou em qual banco?**: comandos `INSERT/UPDATE/DELETE` que a própria aplicação executou durante a chamada, lidos do `general_log` do MySQL (filtrado pelo usuário `fashionai`), mais arquivos novos no storage de mídia.
- **Exibiu no frontend?**: para GET, as telas do Next.js que chamam o endpoint (varredura do código) e as tabelas que o GET leu; para escritas, qual GET com tela relê a tabela gravada.
- Neste ambiente Redis, Cassandra e OpenSearch estão desligados (`*_ENABLED=false`): cache, timeline e busca caem no MySQL; o storage de mídia é o disco local (S3 em produção).

## RF1  (11 passos, 8 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `POST /api/auth/uploads` | foto de perfil antes do cadastro (upload público) | anônimo | 201 | storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — arquivo servido em /media; tela: componente photo-picker.tsx |
| CA03 | `GET /api/auth/username-suggestions` | sugestões de username | anônimo | 200 | — (não grava) | API sem tela própria · lê MySQL: users |
| CA01 | `POST /api/auth/register` | cadastro de conta pessoal | anônimo | 201 | MySQL: audit_log (INSERT), notifications (INSERT), refresh_tokens (INSERT), user_preferences (INSERT), users (INSERT), verification_codes (INSERT) | sim — relido por GET /api/auth/sessions, GET /api/usernames/{username}/availability; tela: register |
| CA05 | `POST /api/auth/email-verification` | verificar e-mail com o código enviado | __reg | 200 | MySQL: audit_log (INSERT), users (UPDATE), verification_codes (UPDATE) | sim — relido por GET /api/auth/sessions, GET /api/usernames/{username}/availability; tela: verify-email |
| CA05 | `POST /api/auth/email-verification/resend` | reenviar código de verificação | __reg | 202 | — (não gravou) | ação sem releitura; tela: verify-email |
| CA03 | `GET /api/usernames/{username}/availability` | disponibilidade de username | anônimo | 200 | — (não grava) | sim — register; componente edit-profile.tsx · lê MySQL: users |
| CA08 | `GET /api/admin/approvals` | aprovações pendentes (admin) | demo_matheus3 | 200 | — (não grava) | sim — admin/users · lê MySQL: brand_profiles, celebrity_profiles, refresh_tokens, users |
| CA02 | `POST /api/auth/uploads` | enviar logo da marca no cadastro | anônimo | 201 | storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — arquivo servido em /media; tela: componente photo-picker.tsx |
| CA02 | `POST /api/auth/register` | cadastro de conta de marca (fica pendente) | anônimo | 201 | MySQL: audit_log (INSERT), brand_profiles (INSERT), notifications (INSERT), refresh_tokens (INSERT), user_preferences (INSERT), users (INSERT), verification_codes (INSERT) | sim — relido por GET /api/auth/sessions, GET /api/usernames/{username}/availability; tela: register |
| CA08 | `GET /api/admin/approvals` | fila de aprovações (admin) | demo_matheus3 | 200 | — (não grava) | sim — admin/users · lê MySQL: brand_profiles, celebrity_profiles, refresh_tokens, users |
| CA08 | `POST /api/admin/approvals/{userId}` | admin aprova a marca | demo_matheus3 | 200 | MySQL: audit_log (INSERT), brand_profiles (UPDATE), notifications (INSERT), seals (INSERT), users (UPDATE) | sim — relido por GET /api/admin/approvals, GET /api/admin/users; tela: admin/users |

## RF2  (5 passos, 5 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `POST /api/auth/login` | login com e-mail e senha | anônimo | 200 | MySQL: audit_log (INSERT), refresh_tokens (INSERT), users (UPDATE) | sim — relido por GET /api/auth/sessions, GET /api/usernames/{username}/availability; tela: login |
| CA02 | `POST /api/auth/refresh` | renovar sessão (refresh token com rotação) | anônimo | 200 | MySQL: refresh_tokens (INSERT/UPDATE) | sim — relido por GET /api/auth/sessions, GET /api/studio/backdrops |
| CA04 | `POST /api/auth/password-reset/request` | pedir redefinição de senha | anônimo | 202 | MySQL: audit_log (INSERT), notifications (INSERT), verification_codes (INSERT) | sim — relido por GET /api/notifications, GET /api/notifications/unread-count; tela: forgot-password |
| CA04 | `POST /api/auth/password-reset/confirm` | confirmar redefinição com token inválido (deve recusar) | anônimo | 400 | — (nada gravado: requisição recusada) | não se aplica — recusado com 400 LINK_INVALIDO (regra de negócio testada) |
| CA06 | `POST /api/auth/logout` | sair (encerra a sessão atual) | e2e-logout | 204 | MySQL: audit_log (INSERT), refresh_tokens (UPDATE) | sim — relido por GET /api/auth/sessions, GET /api/studio/backdrops |

## RF3  (22 passos, 20 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/me` | dados da conta autenticada | e2e_09242221 | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens, user_consents, users |
| CA02 | `PATCH /api/me/profile` | editar perfil (nome, bio, pronomes, links) | e2e_09242221 | 200 | MySQL: audit_log (INSERT), users (UPDATE) | sim — relido por GET /api/me/inventory-score/dimensions/{code}, GET /api/me/consents; tela: settings; componente edit-profile.tsx |
| CA02 | `PUT /api/me/username` | trocar username | e2e_09242221 | 200 | MySQL: audit_log (INSERT), users (UPDATE) | sim — relido por GET /api/me/inventory-score/dimensions/{code}, GET /api/me/consents; tela: componente edit-profile.tsx |
| CA02 | `POST /api/me/avatar` | enviar foto de perfil | e2e_09242221 | 200 | MySQL: photos (INSERT), users (UPDATE); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/me/inventory-score/dimensions/{code}, GET /api/me/photos/timeline; tela: componente edit-profile.tsx |
| CA02 | `POST /api/me/cover` | enviar capa do perfil | e2e_09242221 | 200 | MySQL: photos (INSERT), users (UPDATE); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/me/inventory-score/dimensions/{code}, GET /api/me/photos/timeline; tela: settings |
| CA06 | `PUT /api/me/privacy` | privacidade da conta | e2e_09242221 | 200 | MySQL: audit_log (INSERT), users (UPDATE) | sim — relido por GET /api/me/inventory-score/dimensions/{code}, GET /api/me/consents; tela: settings |
| CA05 | `PUT /api/auth/password` | trocar senha | e2e_09242221 | 200 | MySQL: audit_log (INSERT), refresh_tokens (UPDATE), users (UPDATE) | sim — relido por GET /api/auth/sessions, GET /api/usernames/{username}/availability; tela: settings |
| CA07 | `PATCH /api/me/sensitive` | dados sensíveis (2FA desligado) | e2e_09242221 | 200 | MySQL: audit_log (INSERT) | ação sem releitura; tela: settings |
| CA08 | `GET /api/auth/sessions` | sessões ativas | e2e_09242221 | 200 | — (não grava) | sim — settings · lê MySQL: refresh_tokens, users |
| CA09 | `PUT /api/me/consents/{purpose}` | consentimento LGPD por finalidade | e2e_09242221 | 200 | MySQL: audit_log (INSERT), user_consents (INSERT) | sim — relido por GET /api/me/consents, GET /api/me/room/organization/preview; tela: settings |
| CA10 | `GET /api/me/consents` | consentimentos | e2e_09242221 | 200 | — (não grava) | sim — settings · lê MySQL: refresh_tokens, user_consents, users |
| CA12 | `POST /api/me/exports` | exportar meus dados (LGPD) | e2e_09242221 | 202 | MySQL: audit_log (INSERT), data_export_requests (INSERT/UPDATE), notifications (INSERT); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/me/exports, GET /api/notifications; tela: settings |
| CA14 | `GET /api/rf3/users/{userId}/privacy-probe` | prova de controle de acesso por dono | e2e_09242221 | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens |
| CA12 | `GET /api/me/exports` | minhas exportações | e2e_09242221x | 200 | — (não grava) | sim — settings · lê MySQL: data_export_requests, refresh_tokens, users |
| CA12 | `GET /api/me/exports/{exportId}/file` | baixar o pacote exportado (.zip) | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: data_export_requests, refresh_tokens, users |
| CA05 | `PATCH /api/me/sensitive` | pedir troca de e-mail (código vai ao novo endereço) | e2e_09242221x | 200 | MySQL: audit_log (INSERT), verification_codes (INSERT) | ação sem releitura; tela: settings |
| CA05 | `POST /api/me/email-change/confirm` | confirmar troca de e-mail com o código | e2e_09242221x | 200 | MySQL: audit_log (INSERT), users (UPDATE), verification_codes (UPDATE) | sim — relido por GET /api/me/inventory-score/dimensions/{code}, GET /api/me/consents; tela: settings |
| CA08 | `GET /api/auth/sessions` | dispositivos conectados | e2e_09242221x | 200 | — (não grava) | sim — settings · lê MySQL: refresh_tokens, users |
| CA08 | `DELETE /api/auth/sessions/{sessionId}` | encerrar uma sessão específica | e2e_09242221x | 204 | MySQL: audit_log (INSERT), refresh_tokens (UPDATE) | sim — relido por GET /api/auth/sessions, GET /api/studio/backdrops; tela: settings |
| CA08 | `DELETE /api/auth/sessions` | sair de todos os outros dispositivos | e2e_09242221x | 200 | MySQL: refresh_tokens (UPDATE) | sim — relido por GET /api/auth/sessions, GET /api/studio/backdrops; tela: settings |
| CA13 | `POST /api/me/deletion` | agendar exclusão da conta (30 dias) | e2e_09242221x | 200 | MySQL: audit_log (INSERT), users (UPDATE) | sim — relido por GET /api/me/inventory-score/dimensions/{code}, GET /api/me/consents; tela: settings |
| CA13 | `DELETE /api/me/deletion` | cancelar a exclusão agendada | e2e_09242221x | 200 | MySQL: audit_log (INSERT), users (UPDATE) | sim — relido por GET /api/me/inventory-score/dimensions/{code}, GET /api/me/consents; tela: settings |

## RF4  (24 passos, 14 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/taxonomy` | taxonomia (categorias, cores, ocasiões) | anônimo | 200 | — (não grava) | sim — lib/api/taxonomy.ts · lê MySQL: brands |
| CA02 | `POST /api/pieces/analysis` | analisar foto (remoção de fundo + pré-preenchimento por IA) | e2e_09242221 | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), pipeline_jobs (INSERT/UPDATE); storage de mídia (local; S3 em produção): 5 arquivo(s) | sim — arquivo servido em /media; tela: pieces/new |
| CA03 | `GET /api/brand-search` | buscar marca na internet (zar) | e2e_09242221 | 200 | — (não grava) | sim — componente brand-search-input.tsx · lê MySQL: refresh_tokens, users |
| CA03 | `GET /api/brand-search` | buscar marca na internet (h&m) | e2e_09242221 | 200 | — (não grava) | sim — componente brand-search-input.tsx · lê MySQL: refresh_tokens, users |
| CA03 | `GET /api/brand-search` | buscar marca na internet (nike) | e2e_09242221 | 200 | — (não grava) | sim — componente brand-search-input.tsx · lê MySQL: refresh_tokens, users |
| CA03 | `GET /api/brand-search` | buscar marca na internet (adidas) | e2e_09242221 | 200 | — (não grava) | sim — componente brand-search-input.tsx · lê MySQL: refresh_tokens, users |
| CA03 | `GET /api/brand-search` | marca sem logo na web (fica como texto livre) | e2e_09242221 | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT) | sim — componente brand-search-input.tsx · lê MySQL: ai_inference_log, refresh_tokens, users |
| CA05 | `POST /api/pieces` | cadastrar peça a partir do rascunho (marca Zara escolhida na busca web) | e2e_09242221 | 201 | MySQL: audit_log (INSERT), brand_logos (UPDATE), fai_points_ledger (INSERT), item_embeddings (INSERT), notifications (INSERT), photos (INSERT), pipeline_jobs (UPDATE), processing_jobs_log (INSERT), quality_scores (INSERT), room_layouts (INSERT), room_storage_map (INSERT), wardrobe_availability_log (INSERT), wardrobe_items (INSERT) | sim — relido por GET /api/pieces/{id}, GET /api/me/room; tela: pieces/new |
| CA05 | `POST /api/pieces` | cadastrar peça (Calça E2E) com imagem padrão e marca H&M | e2e_09242221 | 201 | MySQL: audit_log (INSERT), brand_logos (UPDATE), item_embeddings (INSERT), notifications (INSERT), room_storage_map (INSERT), wardrobe_availability_log (INSERT), wardrobe_items (INSERT/UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/new |
| CA05 | `POST /api/pieces` | cadastrar peça (Tênis E2E) com imagem padrão e marca Nike | e2e_09242221 | 201 | MySQL: audit_log (INSERT), item_embeddings (INSERT), notifications (INSERT), room_storage_map (INSERT), wardrobe_availability_log (INSERT), wardrobe_items (INSERT/UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/new |
| CA05 | `POST /api/pieces` | cadastrar peça (Boné E2E) com imagem padrão e marca Adidas | e2e_09242221 | 201 | MySQL: audit_log (INSERT), brand_logos (UPDATE), item_embeddings (INSERT), notifications (INSERT), room_storage_map (INSERT), wardrobe_availability_log (INSERT), wardrobe_items (INSERT/UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/new |
| CA05 | `POST /api/pieces` | cadastrar peça (Vestido E2E) com imagem padrão e marca Zara | e2e_09242221 | 201 | MySQL: audit_log (INSERT), brand_logos (UPDATE), item_embeddings (INSERT), notifications (INSERT), room_storage_map (INSERT), wardrobe_availability_log (INSERT), wardrobe_items (INSERT/UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/new |
| CA05 | `POST /api/pieces` | cadastrar peça (Mocassim E2E) com imagem padrão e marca Osklen | e2e_09242221 | 201 | MySQL: audit_log (INSERT), item_embeddings (INSERT), notifications (INSERT), room_storage_map (INSERT), wardrobe_availability_log (INSERT), wardrobe_items (INSERT/UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/new |
| CA11 | `POST /api/pieces/analysis/batch` | analisar várias fotos de uma vez | e2e_09242221 | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), pipeline_jobs (INSERT); storage de mídia (local; S3 em produção): 5 arquivo(s) | sim — arquivo servido em /media; tela: pieces/[id]; pieces/new |
| CA11 | `POST /api/pieces/batch` | cadastrar peças em lote | e2e_09242221 | 201 | MySQL: audit_log (INSERT), item_embeddings (INSERT), notifications (INSERT), room_storage_map (INSERT), wardrobe_availability_log (INSERT), wardrobe_items (INSERT/UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/new |
| CA02 | `POST /api/pieces/{id}/background-removal` | reprocessar remoção de fundo | e2e_09242221 | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), wardrobe_items (UPDATE); storage de mídia (local; S3 em produção): 5 arquivo(s) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/[id]; try-on |
| EST | `GET /api/studio/backdrops` | fundos do estúdio | e2e_09242221 | 200 | — (não grava) | sim — componente studio.tsx · lê MySQL: refresh_tokens |
| EST | `POST /api/pieces/{id}/studio` | foto de estúdio da peça | e2e_09242221 | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), wardrobe_items (UPDATE); storage de mídia (local; S3 em produção): 4 arquivo(s) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/[id] |
| EST | `POST /api/me/pieces/studio` | estúdio para peças sem foto de estúdio | e2e_09242221 | 200 | — (não gravou) | ação sem releitura; tela: closet |
| EST | `POST /api/pieces/analysis/{draftId}/studio` | estúdio do rascunho com outro fundo | e2e_09242221 | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), pipeline_jobs (UPDATE); storage de mídia (local; S3 em produção): 4 arquivo(s) | sim — arquivo servido em /media; tela: pieces/new |
| CA09 | `PUT /api/pieces/{id}/image` | substituir a foto da peça | e2e_09242221 | 200 | MySQL: audit_log (INSERT), photos (INSERT), wardrobe_items (UPDATE); storage de mídia (local; S3 em produção): 2 arquivo(s) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/[id]; componente photo-editor.tsx |
| CA10 | `GET /api/admin/moderation` | fila de moderação (admin) | demo_matheus3 | 200 | — (não grava) | sim — admin/moderation · lê MySQL: moderation_queue, refresh_tokens, users, wardrobe_items |
| CA10 | `GET /api/admin/moderation` | fila de moderação (admin) | demo_matheus3 | 200 | — (não grava) | sim — admin/moderation · lê MySQL: moderation_queue, refresh_tokens, users, wardrobe_items |
| CA10 | `POST /api/admin/moderation/{itemId}` | admin aprova item da fila de moderação | demo_matheus3 | 200 | MySQL: audit_log (INSERT), moderation_queue (UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: admin/moderation |

## RF5  (11 passos, 6 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/schemes/builder` | dados do construtor de esquema | e2e_09242221x | 200 | — (não grava) | sim — componente scheme-builder.tsx · lê MySQL: refresh_tokens, users, wardrobe_items |
| CA04 | `POST /api/schemes/compositions` | gerar combinações com IA (fallback local) | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT) | ação sem releitura; tela: componente scheme-builder.tsx |
| CA06 | `POST /api/schemes/preview` | pré-visualizar o card | e2e_09242221x | 200 | — (não gravou) | ação sem releitura; tela: componente scheme-builder.tsx |
| CA07 | `POST /api/schemes` | salvar e publicar esquema (Look E2E casual) | e2e_09242221x | 201 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), fai_points_ledger (INSERT), item_embeddings (INSERT), notifications (INSERT), piece_usage_diary (INSERT), scheme_items (INSERT/UPDATE), schemes (INSERT/UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/pieces/{id}; tela: componente scheme-builder.tsx |
| CA07 | `POST /api/schemes` | salvar e publicar esquema (Look E2E festa) | e2e_09242221x | 201 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), fai_points_ledger (INSERT), item_embeddings (INSERT), notifications (INSERT), piece_usage_diary (INSERT), scheme_items (INSERT/UPDATE), schemes (INSERT/UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/pieces/{id}; tela: componente scheme-builder.tsx |
| CA07 | `POST /api/schemes` | salvar e publicar esquema (Look E2E street) | e2e_09242221x | 201 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), fai_points_ledger (INSERT), item_embeddings (INSERT), notifications (INSERT), scheme_items (INSERT/UPDATE), schemes (INSERT/UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/pieces/{id}; tela: componente scheme-builder.tsx |
| CA03 | `POST /api/schemes` | peça indisponível não entra no esquema (deve recusar) | e2e_09242221x | 400 | — (nada gravado: requisição recusada) | não se aplica — recusado com 400 PECA_INDISPONIVEL (regra de negócio testada) |
| CA09 | `POST /api/schemes/photos` | foto do look (post) | e2e_09242221x | 201 | MySQL: photos (INSERT); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/me/photos/timeline, GET /api/me/photos; tela: componente scheme-builder.tsx |
| CA08 | `POST /api/schemes/{id}/publication` | publicar com visibilidade | e2e_09242221x | 200 | MySQL: audit_log (INSERT), item_embeddings (UPDATE), scheme_items (UPDATE) | sim — relido por GET /api/schemes/{id}/look3d, GET /api/schemes/{id}; tela: schemes/[id] |
| CA07 | `POST /api/schemes` | salvar look parecido 1 (para agrupar) | e2e_09242221x | 201 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), item_embeddings (INSERT), notifications (INSERT), scheme_items (INSERT/UPDATE), schemes (INSERT/UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/pieces/{id}; tela: componente scheme-builder.tsx |
| CA07 | `POST /api/schemes` | salvar look parecido 2 (para agrupar) | e2e_09242221x | 201 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), item_embeddings (INSERT), notifications (INSERT), scheme_items (INSERT/UPDATE), schemes (INSERT/UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/pieces/{id}; tela: componente scheme-builder.tsx |

## RF6  (26 passos, 24 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA02 | `GET /api/me/schemes` | meus esquemas | e2e_09242221x | 200 | — (não grava) | sim — challenges/[id]; componente edit-profile.tsx; componente lookbook-tabs.tsx · lê MySQL: reactions, refresh_tokens, saved_items, scheme_items, schemes, seal_bonds |
| CA04 | `PATCH /api/schemes/{id}/flags` | favoritar esquema | e2e_09242221x | 200 | MySQL: schemes (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/schemes/{id}/look3d |
| CA01 | `GET /api/users/{ownerId}/lookbook` | visão geral do lookbook | ny_ava | 200 | — (não grava) | sim — componente lookbook-tabs.tsx · lê MySQL: refresh_tokens, scheme_items, schemes, users, wardrobe_items |
| CA05 | `POST /api/me/daily-look` | marcar Look do Dia | e2e_09242221x | 200 | MySQL: daily_looks (INSERT), schemes (UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/schemes/{id}; tela: schemes/[id] |
| CA05 | `GET /api/me/daily-look-tab` | aba Look do Dia + painel de Hype | e2e_09242221x | 200 | MySQL: hype_score_metrics (INSERT), schemes (UPDATE) | sim — componente lookbook-tabs.tsx · lê MySQL: daily_looks, hype_score_metrics, metric_snapshots, reactions, refresh_tokens, saved_items |
| CA05 | `GET /api/me/daily-looks` | histórico de Looks do Dia | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: daily_looks, refresh_tokens, schemes, users |
| CA06 | `GET /api/hype/panel-versions` | versões do painel de Hype | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens |
| CA06 | `PUT /api/me/hype-panel-version` | escolher versão do painel | e2e_09242221x | 200 | MySQL: users (UPDATE) | sim — relido por GET /api/me/inventory-score/dimensions/{code}, GET /api/me/consents; tela: componente lookbook-tabs.tsx |
| CA07 | `GET /api/hype/method` | como o Hype Score é calculado | anônimo | 200 | — (não grava) | API sem tela própria · sem leitura no MySQL (cálculo/cache/arquivo) |
| CA07 | `GET /api/hype/groups` | HypeGroups globais | anônimo | 200 | — (não grava) | API sem tela própria · lê MySQL: hype_groups |
| CA07 | `POST /api/me/hype-groups/suggestions` | sugerir HypeGroups (acervo grande) | luna_vega | 422 | — (nada gravado: requisição recusada) | não se aplica — recusado com 422 ACERVO_PEQUENO (regra de negócio testada) |
| CA07 | `GET /api/me/hype-groups` | meus HypeGroups | e2e_09242221x | 200 | — (não grava) | sim — componente lookbook-tabs.tsx · lê MySQL: acervo_groups, refresh_tokens, users |
| CA08 | `GET /api/me/capsule` | cápsula por categoria | e2e_09242221x | 200 | — (não grava) | sim — componente lookbook-tabs.tsx · lê MySQL: refresh_tokens, scheme_items, schemes, users, wardrobe_items |
| CA09 | `POST /api/groupings` | criar agrupamento | e2e_09242221x | 201 | MySQL: scheme_groupings (INSERT) | sim — relido por GET /api/groupings/{id}/schemes, GET /api/users/{ownerId}/groupings; tela: componente lookbook-tabs.tsx; componente showcase/showcase-tabs.tsx |
| CA09 | `PUT /api/groupings/{id}` | editar agrupamento | e2e_09242221x | 200 | MySQL: scheme_groupings (UPDATE) | sim — relido por GET /api/groupings/{id}/schemes, GET /api/users/{ownerId}/groupings; tela: componente showcase/showcase-tabs.tsx |
| CA09 | `POST /api/groupings/{id}/items` | adicionar esquemas ao agrupamento | e2e_09242221x | 200 | MySQL: schemes (UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/schemes/{id}; tela: componente showcase/showcase-tabs.tsx |
| CA09 | `GET /api/users/{ownerId}/groupings` | agrupamentos do usuário | e2e_09242221x | 200 | — (não grava) | sim — componente lookbook-tabs.tsx · lê MySQL: refresh_tokens, scheme_groupings, schemes, users |
| CA09 | `GET /api/groupings/{id}/schemes` | esquemas do agrupamento | e2e_09242221x | 200 | — (não grava) | sim — componente lookbook-tabs.tsx · lê MySQL: reactions, refresh_tokens, saved_items, scheme_groupings, scheme_items, schemes |
| CA03 | `GET /api/me/saved-looks` | looks salvos | ny_ava | 200 | — (não grava) | sim — componente lookbook-tabs.tsx · lê MySQL: brands, reactions, refresh_tokens, saved_items, scheme_items, schemes |
| CA03 | `PUT /api/me/saved-looks/{schemeId}/favorite` | favoritar look salvo | ny_ava | 200 | — (não gravou) | ação sem releitura; tela: componente lookbook-tabs.tsx |
| CA03 | `GET /api/me/saved-pieces` | peças salvas | ny_ava | 200 | — (não grava) | sim — componente lookbook-tabs.tsx · lê MySQL: refresh_tokens, saved_items, users |
| CA03 | `DELETE /api/me/saved-looks/{schemeId}` | remover dos salvos | ny_ava | 200 | MySQL: saved_items (DELETE), schemes (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/me/saved-looks; tela: componente lookbook-tabs.tsx |
| CA10 | `POST /api/admin/hype/recalibration` | recalibrar Hype Score (admin) | demo_matheus3 | 200 | MySQL: audit_log (INSERT), hype_groups (DELETE/INSERT), metric_snapshots (INSERT), schemes (UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/schemes/{id} |
| CA07 | `POST /api/me/hype-groups/suggestions` | sugerir HypeGroups de looks | e2e_09242221x | 200 | MySQL: acervo_groups (INSERT), ai_inference_log (INSERT), audit_log (INSERT) | sim — relido por GET /api/me/hype-groups; tela: componente lookbook-tabs.tsx |
| CA07 | `GET /api/me/hype-groups` | HypeGroups de looks | e2e_09242221x | 200 | — (não grava) | sim — componente lookbook-tabs.tsx · lê MySQL: acervo_groups, refresh_tokens, users |
| CA07 | `DELETE /api/me/hype-groups/{groupId}` | descartar um HypeGroup | e2e_09242221x | 204 | MySQL: acervo_groups (DELETE) | sim — relido por GET /api/me/hype-groups; tela: componente lookbook-tabs.tsx |

## RF7  (9 passos, 9 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/me/closet` | meu closet com filtros | e2e_09242221 | 200 | — (não grava) | sim — closet; componente showcase/showcase-tabs.tsx · lê MySQL: reactions, refresh_tokens, saved_items, users, wardrobe_items |
| CA02 | `GET /api/pieces/{id}` | detalhe da peça | e2e_09242221 | 200 | MySQL: wardrobe_items (UPDATE) | sim — pieces/[id] · lê MySQL: reactions, refresh_tokens, saved_items, scheme_items, users, wardrobe_items |
| CA05 | `PUT /api/pieces/{id}` | editar a peça | e2e_09242221 | 200 | MySQL: audit_log (INSERT), item_embeddings (UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/[id] |
| CA06 | `POST /api/pieces/{id}/worn` | registrar uso da peça hoje | e2e_09242221 | 200 | MySQL: wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/[id] |
| CA07 | `GET /api/pieces/{id}/deletion-impact` | impacto antes de excluir | e2e_09242221 | 200 | — (não grava) | sim — pieces/[id] · lê MySQL: refresh_tokens, scheme_items, users, wardrobe_items |
| CA03 | `GET /api/schemes/{id}` | abrir esquema (detalhe) | ny_ava | 200 | MySQL: schemes (UPDATE) | sim — schemes/[id]/edit; schemes/[id]; try-on · lê MySQL: reactions, refresh_tokens, saved_items, scheme_items, schemes, seal_bonds |
| CA04 | `POST /api/pieces/{pieceId}/return-to-origin` | voltar ao esquema de origem | e2e_09242221x | 200 | — (não gravou) | ação sem releitura; tela: pieces/[id] |
| CA02 | `GET /api/users/{ownerId}/closet` | closet de outro usuário | ny_ava | 200 | — (não grava) | sim — componente lookbook-tabs.tsx · lê MySQL: reactions, refresh_tokens, saved_items, users, wardrobe_items |
| CA07 | `DELETE /api/pieces/{id}` | excluir peça | e2e_09242221x | 200 | MySQL: audit_log (INSERT), room_storage_map (DELETE), scheme_items (UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/[id] |

## RF8  (4 passos, 4 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/feed` | feed | ny_ava | 200 | — (não grava) | sim — search · lê MySQL: brands, follows, reactions, refresh_tokens, saved_items, scheme_items |
| CA02 | `GET /api/search` | busca | ny_ava | 200 | — (não grava) | sim — search · lê MySQL: brands, follows, reactions, refresh_tokens, saved_items, scheme_items |
| CA03 | `GET /api/runway` | passarela de quem sigo | ny_ava | 200 | — (não grava) | API sem tela própria · lê MySQL: brands, challenge_events, challenge_instances, challenge_templates, challenge_votes, follows |
| CA04 | `GET /api/interactions/{type}/{id}/counters` | contadores do esquema | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: comments, reactions, refresh_tokens, saved_items, shares |

## RF9  (4 passos, 4 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `PUT /api/schemes/{id}` | editar esquema | e2e_09242221x | 200 | MySQL: audit_log (INSERT), item_embeddings (UPDATE), schemes (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/schemes/{id}/look3d; tela: componente scheme-builder.tsx |
| CA05 | `POST /api/schemes/{id}/improvements` | pedir melhoria por instrução (Edit Assistant) | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT) | ação sem releitura; tela: schemes/[id] |
| CA05 | `POST /api/schemes/{id}/improvements/apply` | aplicar o diff aceito | e2e_09242221x | 200 | MySQL: audit_log (INSERT), schemes (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/schemes/{id}/look3d; tela: schemes/[id] |
| CA05 | `POST /api/schemes/{id}/archive` | arquivar esquema | e2e_09242221x | 200 | MySQL: audit_log (INSERT), schemes (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/schemes/{id}/look3d; tela: schemes/[id] |

## RF10  (13 passos, 13 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA07 | `GET /api/me/daily-looks/pending-feedback` | look do dia aguardando feedback | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: daily_looks, refresh_tokens, schemes, users |
| CA07 | `PUT /api/me/daily-looks/{date}/feedback` | feedback do look do dia | e2e_09242221x | 200 | MySQL: daily_looks (UPDATE) | sim — relido por GET /api/me/dna, GET /api/me/daily-look-tab; tela: componente lookbook-tabs.tsx |
| CA01 | `GET /api/copilot/suggestions` | sugestões do Copilot | e2e_09242221x | 200 | — (não grava) | sim — copilot · lê MySQL: reactions, refresh_tokens, saved_items, scheme_items, schemes, seal_bonds |
| CA02 | `GET /api/copilot/context` | contexto do Copilot | e2e_09242221x | 200 | — (não grava) | sim — copilot · lê MySQL: challenge_participants, daily_looks, refresh_tokens, schemes, users, wardrobe_items |
| CA03 | `POST /api/copilot/messages` | perguntar ao Copilot | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT) | ação sem releitura; tela: copilot; room |
| CA04 | `POST /api/copilot/looks` | aceitar look do Copilot | e2e_09242221x | 201 | MySQL: daily_looks (UPDATE), schemes (UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/schemes/{id}; tela: copilot |
| CA05 | `POST /api/autopilot/daily` | Autopilot diário | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT) | ação sem releitura; tela: autopilot |
| CA05 | `POST /api/autopilot/daily/confirmation` | confirmar look do Autopilot | e2e_09242221x | 201 | MySQL: daily_looks (UPDATE), schemes (UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/schemes/{id}; tela: autopilot |
| CA06 | `POST /api/autopilot/weeks` | planejar a semana | e2e_09242221x | 201 | MySQL: week_plan_days (INSERT), week_plans (INSERT/UPDATE) | sim — relido por GET /api/autopilot/weeks/current; tela: autopilot |
| CA06 | `GET /api/autopilot/weeks/current` | semana atual | e2e_09242221x | 200 | — (não grava) | sim — autopilot · lê MySQL: refresh_tokens, users, wardrobe_items, week_plan_days, week_plans |
| CA06 | `PUT /api/autopilot/days/{dayId}` | trocar as peças de um dia | e2e_09242221x | 200 | MySQL: week_plan_days (UPDATE) | sim — relido por GET /api/autopilot/weeks/current |
| CA06 | `POST /api/autopilot/days/{dayId}/use` | usar o look do dia planejado | e2e_09242221x | 200 | MySQL: audit_log (INSERT), daily_looks (INSERT/UPDATE), fai_points_ledger (INSERT), item_embeddings (INSERT), notifications (INSERT), piece_usage_diary (INSERT), scheme_items (INSERT), schemes (INSERT/UPDATE), wardrobe_items (UPDATE), week_plan_days (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/schemes/{id}; tela: autopilot |
| CA06 | `DELETE /api/autopilot/weeks/current` | descartar a semana | e2e_09242221x | 200 | MySQL: week_plan_days (DELETE), week_plans (UPDATE) | sim — relido por GET /api/autopilot/weeks/current; tela: autopilot |

## RF11  (12 passos, 12 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `PUT /api/pieces/{id}/background` | fundo do card da peça | e2e_09242221 | 200 | MySQL: wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet |
| CA05 | `GET /api/schemes/{id}/card.png` | card renderizado (PNG) | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens, scheme_items, schemes, users, wardrobe_items |
| CA01 | `GET /api/backgrounds/catalog` | catálogo de fundos | e2e_09242221x | 200 | — (não grava) | sim — componente background-studio.tsx · lê MySQL: refresh_tokens |
| CA02 | `GET /api/backgrounds/recommendations` | recomendações de fundo | e2e_09242221x | 200 | — (não grava) | sim — componente background-studio.tsx · lê MySQL: refresh_tokens |
| CA03 | `GET /api/backgrounds/combination` | combinação aura × material | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens |
| CA04 | `PUT /api/schemes/{id}/background` | aplicar fundo ao esquema | e2e_09242221x | 200 | MySQL: schemes (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/schemes/{id}/look3d |
| CA04 | `DELETE /api/schemes/{id}/background` | voltar ao fundo padrão | e2e_09242221x | 200 | MySQL: schemes (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/schemes/{id}/look3d |
| CA07 | `POST /api/backgrounds/art` | arte de fundo por IA (fallback local) | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT) | ação sem releitura; tela: componente background-studio.tsx |
| CA08 | `POST /api/backgrounds/uploads` | enviar imagem de fundo | e2e_09242221x | 200 | MySQL: photos (INSERT); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/me/photos/timeline, GET /api/me/photos; tela: componente background-studio.tsx |
| ASSETS | `GET /api/assets/skins` | catálogo de assets | anônimo | 200 | — (não grava) | API sem tela própria · sem leitura no MySQL (cálculo/cache/arquivo) |
| ASSETS | `GET /api/assets/mosaics` | catálogo de assets | anônimo | 200 | — (não grava) | API sem tela própria · sem leitura no MySQL (cálculo/cache/arquivo) |
| CA09 | `POST /api/admin/skins/{skinId}/thumbnail` | thumbnail de skin (admin) | demo_matheus3 | 200 | — (não gravou) | ação de API (sem tela) |

## RF12  (9 passos, 8 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/me/photos` | minhas fotos | e2e_09242221x | 200 | — (não grava) | sim — photos · lê MySQL: photos, refresh_tokens, users, wardrobe_items |
| CA02 | `GET /api/me/photos/timeline` | linha do tempo das fotos | e2e_09242221x | 200 | — (não grava) | sim — photos · lê MySQL: photos, refresh_tokens, users |
| CA03 | `PUT /api/photos/{id}/key-moment` | marcar momento-chave | e2e_09242221x | 200 | MySQL: photos (UPDATE) | sim — relido por GET /api/me/photos/timeline, GET /api/me/photos; tela: photos |
| CA04 | `POST /api/photos/{id}/edits` | editar foto (nova versão) | e2e_09242221x | 200 | MySQL: audit_log (INSERT), photos (INSERT/UPDATE), wardrobe_items (UPDATE); storage de mídia (local; S3 em produção): 2 arquivo(s) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: componente photo-editor.tsx |
| CA05 | `GET /api/photos/{id}/file` | baixar a foto original | e2e_09242221x | 200 | MySQL: photos (UPDATE) | API sem tela própria · lê MySQL: photos, refresh_tokens, users |
| CA06 | `POST /api/me/photos/curation` | curadoria "Para você" | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), photos (UPDATE) | sim — relido por GET /api/me/photos/timeline, GET /api/me/photos; tela: photos |
| CA01 | `GET /api/me/photos` | minhas fotos | e2e_09242221x | 200 | — (não grava) | sim — photos · lê MySQL: photos, refresh_tokens, users, wardrobe_items |
| CA03 | `DELETE /api/photos/{id}` | excluir foto (confirmada) | e2e_09242221x | 200 | MySQL: photos (UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: photos |
| CA03 | `POST /api/photos/bulk-deletion` | excluir várias fotos | e2e_09242221x | 200 | MySQL: photos (UPDATE) | sim — relido por GET /api/me/photos/timeline, GET /api/me/photos; tela: photos |

## RF13  (14 passos, 14 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/me/dna` | meu DNA de Estilo | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), style_dna (INSERT/UPDATE), style_dna_versions (INSERT) | sim — dna · lê MySQL: ai_inference_log, daily_looks, refresh_tokens, scheme_items, schemes, style_dna |
| CA02 | `POST /api/me/dna` | formulário de vida | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), style_dna (UPDATE), style_dna_versions (INSERT) | sim — relido por GET /api/me/dna, GET /api/me/mirror; tela: dna |
| CA02 | `PUT /api/me/dna/life` | editar formulário de vida | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), style_dna (UPDATE), style_dna_versions (INSERT) | sim — relido por GET /api/me/dna, GET /api/me/mirror; tela: dna |
| CA03 | `PUT /api/me/dna/private-fields` | campos privados | e2e_09242221x | 200 | — (não gravou) | ação sem releitura; tela: dna |
| CA04 | `PUT /api/me/dna/color-season` | cartela sazonal | e2e_09242221x | 200 | MySQL: style_dna (UPDATE) | sim — relido por GET /api/me/dna, GET /api/me/mirror; tela: dna |
| CA05 | `POST /api/me/dna/share-card` | card de compartilhamento do DNA | e2e_09242221x | 200 | MySQL: style_dna (UPDATE); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/me/dna, GET /api/me/mirror; tela: dna |
| CA06 | `GET /api/dna-schemes/builder` | construtor de esquema de DNA | e2e_09242221x | 200 | — (não grava) | sim — componente dna-builder.tsx · lê MySQL: reactions, refresh_tokens, saved_items, scheme_items, schemes, seal_bonds |
| CA06 | `POST /api/dna-schemes/preview` | pré-visualizar esquema de DNA | e2e_09242221x | 200 | — (não gravou) | ação sem releitura; tela: componente dna-builder.tsx |
| CA07 | `POST /api/dna-schemes/compositions` | compor DNA com IA (fallback local) | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT) | ação sem releitura; tela: componente dna-builder.tsx |
| CA08 | `POST /api/dna-schemes` | criar esquema de DNA | e2e_09242221x | 201 | MySQL: dna_scheme_items (INSERT), dna_schemes (INSERT/UPDATE), style_dna (UPDATE) | sim — relido por GET /api/me/dna-schemes, GET /api/dna-schemes/{id}; tela: componente dna-builder.tsx |
| CA08 | `PUT /api/dna-schemes/{id}` | editar esquema de DNA | e2e_09242221x | 200 | MySQL: dna_scheme_items (DELETE/INSERT), dna_schemes (UPDATE) | sim — relido por GET /api/me/dna-schemes, GET /api/dna-schemes/{id}; tela: componente dna-builder.tsx |
| CA08 | `GET /api/dna-schemes/{id}` | abrir esquema de DNA | e2e_09242221x | 200 | — (não grava) | sim — dna-schemes/[id]/edit; dna-schemes/[id]; componente dna-builder.tsx · lê MySQL: dna_scheme_items, dna_schemes, refresh_tokens, scheme_items, schemes, users |
| CA08 | `GET /api/me/dna-schemes` | meus esquemas de DNA | e2e_09242221x | 200 | — (não grava) | sim — dna · lê MySQL: dna_scheme_items, dna_schemes, refresh_tokens, scheme_items, schemes, users |
| CA08 | `DELETE /api/dna-schemes/{id}` | excluir esquema de DNA | e2e_09242221x | 204 | MySQL: dna_schemes (UPDATE) | sim — relido por GET /api/me/dna-schemes, GET /api/dna-schemes/{id}; tela: dna-schemes/[id]; dna |

## RF14  (4 passos, 4 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/brands` | feed de marcas | e2e_09242221x | 200 | MySQL: audit_log (INSERT) | sim — brands · lê MySQL: ai_inference_log, brand_profiles, follows, refresh_tokens, seal_bonds, style_dna |
| CA02 | `GET /api/institutional/{slugOrId}` | perfil institucional da marca | e2e_09242221x | 200 | — (não grava) | sim — brands/[slug] · lê MySQL: brand_profiles, follows, reactions, refresh_tokens, saved_items, scheme_groupings |
| CA03 | `GET /api/institutional/{slugOrId}/tabs/{tab}` | aba do perfil institucional | e2e_09242221x | 200 | — (não grava) | sim — brands/[slug] · lê MySQL: brand_profiles, refresh_tokens, scheme_items, users, wardrobe_items |
| CA04 | `PATCH /api/me/brand-profile` | marca edita dados institucionais | atelier_lume3 | 200 | — (não gravou) | ação de API (sem tela) |

## RF15  (3 passos, 3 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/public-pieces` | peças públicas | ny_ava | 200 | — (não grava) | sim — search · lê MySQL: follows, refresh_tokens, users, wardrobe_items |
| CA02 | `POST /api/pieces/{id}/copy` | copiar peça pública para o meu guarda-roupa | ny_ava | 201 | MySQL: item_embeddings (INSERT), wardrobe_items (INSERT) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/[id] |
| CA03 | `POST /api/photos/background-removal` | remover fundo de uma foto | e2e_09242221x | 200 | — (não gravou) | ação sem releitura; tela: componente photo-editor.tsx |

## RF16  (2 passos, 2 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `POST /api/pieces/{id}/model3d` | pedir modelo 3D da peça | e2e_09242221 | 202 | MySQL: pipeline_jobs (INSERT), wardrobe_items (UPDATE); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/[id]; componente generate-3d.tsx |
| CA02 | `GET /api/pieces/{id}/model3d` | status do modelo 3D | e2e_09242221 | 200 | — (não grava) | sim — componente model3d-panel.tsx · lê MySQL: refresh_tokens, users, wardrobe_items |

## RF17  (11 passos, 8 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/profiles/{idOrUsername}` | perfil de outro usuário | ny_ava | 200 | — (não grava) | sim — room; u/[username]; componente lookbook-tabs.tsx · lê MySQL: follows, reactions, refresh_tokens, saved_items, scheme_items, schemes |
| CA02 | `POST /api/users/{targetId}/followers` | seguir | ny_ava | 200 | MySQL: follows (INSERT), notifications (INSERT) | sim — relido por GET /api/users/{userId}/connections, GET /api/public-pieces; tela: brands/[slug]; u/[username] |
| CA02 | `GET /api/users/{userId}/connections` | seguidores e seguindo | ny_ava | 200 | — (não grava) | sim — u/[username] · lê MySQL: follows, refresh_tokens, users |
| CA03 | `GET /api/me/follow-requests` | pedidos para me seguir | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: follows, refresh_tokens, users |
| CA04 | `DELETE /api/users/{targetId}/followers/me` | deixar de seguir | ny_ava | 200 | MySQL: follows (DELETE) | sim — relido por GET /api/users/{userId}/connections, GET /api/public-pieces; tela: brands/[slug]; u/[username] |
| CA05 | `PUT /api/users/{targetId}/block` | bloquear e desbloquear | ny_ava | 200 | — (não gravou) | ação sem releitura; tela: u/[username] |
| CA02 | `PUT /api/me/privacy` | conta passa a ser privada | e2e_09242221x | 200 | MySQL: audit_log (INSERT), users (UPDATE) | sim — relido por GET /api/me/inventory-score/dimensions/{code}, GET /api/me/consents; tela: settings |
| CA02 | `POST /api/users/{targetId}/followers` | pedido para seguir conta privada | ny_ava | 200 | MySQL: follows (INSERT), notifications (INSERT) | sim — relido por GET /api/users/{userId}/connections, GET /api/public-pieces; tela: brands/[slug]; u/[username] |
| CA02 | `GET /api/me/follow-requests` | pedidos pendentes | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: follows, refresh_tokens, users |
| CA02 | `POST /api/follow-requests/{followId}` | aceitar o pedido | e2e_09242221x | 200 | MySQL: follows (UPDATE), notifications (INSERT) | sim — relido por GET /api/users/{userId}/connections, GET /api/public-pieces |
| CA02 | `PUT /api/me/privacy` | conta volta a ser pública | e2e_09242221x | 200 | MySQL: audit_log (INSERT), users (UPDATE) | sim — relido por GET /api/me/inventory-score/dimensions/{code}, GET /api/me/consents; tela: settings |

## RF18  (4 passos, 4 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/try-on` | provador 2D | e2e_09242221x | 200 | — (não grava) | sim — try-on · lê MySQL: refresh_tokens, user_preferences, users, wardrobe_items |
| CA02 | `PUT /api/try-on/preferences` | preferências do manequim | e2e_09242221x | 200 | MySQL: user_preferences (UPDATE) | sim — relido por GET /api/try-on, GET /api/notifications/preferences; tela: try-on |
| CA03 | `POST /api/try-on/renders` | renderizar prova | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), photos (INSERT); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/me/photos/timeline, GET /api/me/photos; tela: try-on |
| CA04 | `POST /api/try-on/schemes` | salvar a prova como esquema | e2e_09242221x | 201 | MySQL: audit_log (INSERT), fai_points_ledger (INSERT), item_embeddings (INSERT), notifications (INSERT), scheme_items (INSERT), schemes (INSERT/UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/schemes/{id}; tela: try-on |

## RF19  (9 passos, 9 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `POST /api/interactions/{type}/{id}/reactions` | reagir ao esquema | ny_ava | 200 | MySQL: fai_points_ledger (INSERT), notifications (INSERT), reactions (INSERT), schemes (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/interactions/{type}/{id}/comments; tela: componente interactions.tsx |
| CA02 | `POST /api/interactions/{type}/{id}/comments` | comentar no esquema | ny_ava | 201 | MySQL: comments (INSERT), fai_points_ledger (INSERT), notifications (INSERT), schemes (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/interactions/{type}/{id}/comments; tela: componente interactions.tsx |
| CA02 | `GET /api/interactions/{type}/{id}/comments` | listar comentários | e2e_09242221x | 200 | — (não grava) | sim — componente interactions.tsx · lê MySQL: comments, refresh_tokens, schemes, users |
| CA03 | `POST /api/interactions/{type}/{id}/saves` | salvar o esquema | ny_ava | 200 | MySQL: saved_items (INSERT), schemes (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/interactions/{type}/{id}/comments; tela: componente interactions.tsx; componente lookbook-tabs.tsx |
| CA03 | `PUT /api/interactions/{type}/{id}/saves/favorite` | favoritar o salvo | ny_ava | 200 | MySQL: saved_items (UPDATE) | sim — relido por GET /api/me/saved-pieces, GET /api/me/closet; tela: componente lookbook-tabs.tsx |
| CA04 | `POST /api/interactions/{type}/{id}/shares` | compartilhar no feed | ny_ava | 200 | MySQL: notifications (INSERT), schemes (UPDATE), shares (INSERT) | sim — relido por GET /api/schemes/{id}, GET /api/interactions/{type}/{id}/comments; tela: componente interactions.tsx |
| CA05 | `POST /api/interactions/{type}/{id}/remixes` | remixar (interação) | ny_ava | 201 | — (não gravou) | ação sem releitura; tela: componente interactions.tsx |
| CA05 | `POST /api/schemes/{id}/remix` | remixar para o meu guarda-roupa | ny_ava | 201 | — (não gravou) | ação sem releitura; tela: schemes/[id] |
| CA02 | `DELETE /api/comments/{commentId}` | excluir comentário | ny_ava | 204 | MySQL: comments (UPDATE), schemes (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/interactions/{type}/{id}/comments; tela: componente interactions.tsx |

## RF20  (6 passos, 5 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `POST /api/pieces` | peça da marca Atelier Lume (para o matcher sugerir o selo) | e2e_09242221x | 201 | MySQL: audit_log (INSERT), item_embeddings (INSERT), notifications (INSERT), room_storage_map (INSERT), wardrobe_availability_log (INSERT), wardrobe_items (INSERT/UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/new |
| CA01 | `POST /api/schemes` | esquema com peça da marca (s4) — resposta traz sugestões de selo | e2e_09242221x | 201 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), item_embeddings (INSERT), notifications (INSERT), piece_usage_diary (INSERT), scheme_items (INSERT/UPDATE), schemes (INSERT/UPDATE), seal_bonds (INSERT), wardrobe_items (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/pieces/{id}; tela: componente scheme-builder.tsx |
| CA01 | `POST /api/schemes` | esquema com peça da marca (s5) — resposta traz sugestões de selo | e2e_09242221x | 201 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), item_embeddings (INSERT), notifications (INSERT), scheme_items (INSERT/UPDATE), schemes (INSERT/UPDATE), seal_bonds (INSERT), wardrobe_items (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/pieces/{id}; tela: componente scheme-builder.tsx |
| CA02 | `POST /api/seal-bonds/{bondId}/accept` | aceitar a sugestão de vínculo | e2e_09242221x | 200 | MySQL: audit_log (INSERT), notifications (INSERT), schemes (UPDATE), seal_bonds (UPDATE), seals (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/seal-bonds/review-queue; tela: schemes/[id] |
| CA03 | `GET /api/seal-bonds/review-queue` | fila de revisão da marca | atelier_lume3 | 200 | — (não grava) | sim — brands/[slug] · lê MySQL: refresh_tokens, schemes, seal_bonds, users |
| CA05 | `POST /api/seal-bonds/{bondId}/revoke` | marca revoga o selo concedido | atelier_lume3 | 200 | MySQL: audit_log (INSERT), notifications (INSERT), seal_bonds (UPDATE) | sim — relido por GET /api/seal-bonds/review-queue, GET /api/users/{ownerId}/promotions |

## RF21  (6 passos, 6 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/schemes/{schemeId}/seal-suggestions` | sugestões de selo do look (SealBond Matcher) | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), seal_bonds (DELETE/INSERT) | sim — schemes/[id] · lê MySQL: ai_inference_log, brand_profiles, celebrity_profiles, refresh_tokens, scheme_items, schemes |
| CA02 | `GET /api/me/seals` | meus selos conquistados | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: brand_profiles, promotion_redemptions, promotions, refresh_tokens, schemes, seal_bonds |
| CA04 | `POST /api/seal-bonds/{bondId}/refuse` | recusar sugestão de vínculo | e2e_09242221x | 200 | MySQL: audit_log (INSERT), seal_bonds (UPDATE) | sim — relido por GET /api/seal-bonds/review-queue, GET /api/users/{ownerId}/promotions |
| CA05 | `POST /api/schemes/{schemeId}/seal-bonds/refuse-all` | recusar todas as sugestões do esquema | e2e_09242221x | 200 | — (não gravou) | ação de API (sem tela) |
| CA06 | `POST /api/schemes/{schemeId}/seal-bonds` | vínculo manual com celebridade (consentimento de imagem) | e2e_09242221x | 201 | MySQL: audit_log (INSERT), notifications (INSERT), seal_bonds (INSERT/UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/schemes/{schemeId}/seal-suggestions; tela: schemes/[id] |
| CA07 | `POST /api/seal-bonds/{bondId}/review` | celebridade revisa (aprova) o vínculo | luna_vega | 200 | MySQL: audit_log (INSERT), notifications (INSERT), schemes (UPDATE), seal_bonds (UPDATE), seals (UPDATE) | sim — relido por GET /api/schemes/{id}, GET /api/seal-bonds/review-queue; tela: brands/[slug] |

## RF22  (3 passos, 3 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/celebrities` | feed de celebridades | e2e_09242221x | 200 | — (não grava) | sim — brands · lê MySQL: celebrity_profiles, follows, refresh_tokens, seal_bonds, style_dna, users |
| CA02 | `GET /api/institutional/{slugOrId}/store` | loja/links oficiais | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: brand_profiles, refresh_tokens, users |
| CA03 | `PATCH /api/me/celebrity-profile` | celebridade edita dados institucionais | luna_vega | 200 | — (não gravou) | ação de API (sem tela) |

## RF23  (3 passos, 3 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `PUT /api/me/preferences` | preferências de interface (tema, idioma, cor do container) | e2e_09242221 | 200 | MySQL: audit_log (INSERT), user_preferences (UPDATE) | sim — relido por GET /api/me/preferences, GET /api/me/issuer-dashboard; tela: room; settings |
| ASSETS | `GET /api/assets/manifest` | catálogo de assets | anônimo | 200 | — (não grava) | API sem tela própria · sem leitura no MySQL (cálculo/cache/arquivo) |
| ASSETS | `GET /api/assets/chrome` | catálogo de assets | anônimo | 200 | — (não grava) | API sem tela própria · sem leitura no MySQL (cálculo/cache/arquivo) |

## RF24  (7 passos, 7 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/brand-logos` | logo de marca pelo nome | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: brand_logos, refresh_tokens |
| CA01 | `GET /api/brand-logos/batch` | logos em lote | e2e_09242221x | 200 | — (não grava) | sim — lib/brand-logos.ts · lê MySQL: brand_logos, refresh_tokens |
| CA02 | `GET /api/admin/brand-logos` | catálogo de logos (admin) | demo_matheus3 | 200 | — (não grava) | sim — admin/system · lê MySQL: brand_logos, refresh_tokens, users |
| CA02 | `POST /api/admin/brand-logos/refresh` | atualizar logo (admin) | demo_matheus3 | 200 | MySQL: brand_logos (UPDATE) | sim — relido por GET /api/admin/brand-logos, GET /api/brand-logos/batch; tela: admin/system |
| CA02 | `POST /api/admin/brand-logos/upload` | enviar logo (admin) | demo_matheus3 | 200 | MySQL: brand_logos (UPDATE); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/admin/brand-logos, GET /api/brand-logos/batch; tela: admin/system |
| CA02 | `POST /api/admin/brand-logos/refresh-pending` | atualizar logos pendentes (admin) | demo_matheus3 | 200 | — (não gravou) | ação sem releitura; tela: admin/system |
| CA03 | `GET /api/admin/ai` | painel de IA (admin) | demo_matheus3 | 200 | — (não grava) | sim — admin/system · lê MySQL: ai_inference_log, refresh_tokens, users |

## RF25  (13 passos, 11 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA03 | `GET /api/seals/design-catalog` | catálogo do criador de selo | atelier_lume3 | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens |
| CA03 | `POST /api/seals/uploads` | enviar arte do selo | atelier_lume3 | 200 | storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — arquivo servido em /media; tela: componente seal-creator.tsx |
| CA02 | `POST /api/seals` | criar selo (com janela de validade) | atelier_lume3 | 201 | MySQL: audit_log (INSERT), seals (INSERT) | sim — relido por GET /api/users/{ownerId}/seals, GET /api/room-creator/options; tela: brands/[slug] |
| CA04 | `PUT /api/seals/{sealId}` | editar selo (expira em) | atelier_lume3 | 200 | MySQL: audit_log (INSERT), seals (UPDATE) | sim — relido por GET /api/users/{ownerId}/seals, GET /api/room-creator/options; tela: brands/[slug] |
| CA04 | `PUT /api/seals/{sealId}` | janela invertida é recusada | atelier_lume3 | 400 | — (nada gravado: requisição recusada) | não se aplica — recusado com 400 PERIODO_INVALIDO (regra de negócio testada) |
| CA05 | `GET /api/users/{ownerId}/seals` | selos do perfil (lista pública) | e2e_09242221x | 200 | — (não grava) | sim — brands/[slug]; componente coupons/brand-coupons-tab.tsx · lê MySQL: refresh_tokens, seals, users |
| CA06 | `POST /api/promotions` | criar promoção do selo (link da loja) | atelier_lume3 | 201 | MySQL: promotions (INSERT) | sim — relido por GET /api/users/{ownerId}/promotions, GET /api/me/coupons/admin; tela: brands/[slug]; componente coupons/brand-coupons-tab.tsx |
| CA06 | `PUT /api/promotions/{id}` | editar promoção | atelier_lume3 | 200 | MySQL: promotions (UPDATE) | sim — relido por GET /api/users/{ownerId}/promotions, GET /api/me/coupons/admin; tela: brands/[slug]; componente coupons/brand-coupons-tab.tsx |
| CA06 | `PUT /api/promotions/{id}/status` | desativar e reativar promoção | atelier_lume3 | 200 | MySQL: promotions (UPDATE) | sim — relido por GET /api/users/{ownerId}/promotions, GET /api/me/coupons/admin; tela: brands/[slug]; componente coupons/brand-coupons-tab.tsx |
| CA06 | `PUT /api/promotions/{id}/status` | reativar promoção | atelier_lume3 | 200 | MySQL: promotions (UPDATE) | sim — relido por GET /api/users/{ownerId}/promotions, GET /api/me/coupons/admin; tela: brands/[slug]; componente coupons/brand-coupons-tab.tsx |
| CA06 | `GET /api/users/{ownerId}/promotions` | promoções do perfil | e2e_09242221x | 200 | — (não grava) | sim — brands/[slug] · lê MySQL: promotions, refresh_tokens, seal_bonds, users |
| CA07 | `POST /api/promotions/{id}/redemptions` | resgatar promoção sem selo aprovado (deve recusar) | paris_lea | 409 | — (nada gravado: requisição recusada) | não se aplica — recusado com 409 SELO_INVALIDO (regra de negócio testada) |
| CA08 | `GET /api/me/issuer-metrics` | métricas do emissor | atelier_lume3 | 200 | — (não grava) | sim — brands/[slug] · lê MySQL: promotion_redemptions, refresh_tokens, seal_bonds, users |

## RF26  (3 passos, 3 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/explorer/global` | painel global por país | e2e_09242221x | 200 | — (não grava) | sim — explorer · lê MySQL: refresh_tokens, scheme_items, users, wardrobe_items |
| CA02 | `GET /api/explorer/brands` | buscar marcas e lojas | e2e_09242221x | 200 | — (não grava) | sim — explorer · lê MySQL: brand_profiles, refresh_tokens, schemes, seal_bonds, users, vw_brand_usage |
| CA03 | `GET /api/explorer/insights` | insights globais | e2e_09242221x | 200 | MySQL: audit_log (INSERT) | sim — explorer · lê MySQL: ai_inference_log, refresh_tokens, scheme_items, users, vw_brand_usage, vw_country_insights |

## RF27  (16 passos, 16 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/me/room` | meu quarto (módulos, endereços, estados) | e2e_09242221x | 200 | MySQL: inventory_score_snapshots (INSERT) | sim — room · lê MySQL: challenge_participants, daily_looks, inventory_score_snapshots, piece_usage_diary, refresh_tokens, room_inventory |
| CA02 | `GET /api/me/room/modules/{moduleId}` | abrir porta/gaveta | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: challenge_participants, daily_looks, piece_usage_diary, refresh_tokens, room_inventory, room_layouts |
| CA03 | `GET /api/me/room/list` | visão em lista | e2e_09242221x | 200 | — (não grava) | sim — room · lê MySQL: challenge_participants, daily_looks, piece_usage_diary, refresh_tokens, room_inventory, room_layouts |
| CA04 | `PUT /api/pieces/{pieceId}/room-address` | endereço da peça no quarto | e2e_09242221x | 200 | MySQL: room_storage_map (UPDATE) | sim — relido por GET /api/pieces/{pieceId}/tag, GET /api/me/room/organization/preview; tela: room |
| CA04 | `GET /api/pieces/{pieceId}/room-location` | onde está a peça | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens, room_layouts, room_storage_map, users, wardrobe_items |
| CA05 | `PUT /api/me/room/drawers/{drawer}` | renomear gaveta | e2e_09242221x | 200 | MySQL: fai_points_ledger (INSERT), room_layouts (UPDATE) | sim — relido por GET /api/me/room, GET /api/me/room/organization/preview; tela: room |
| CA06 | `GET /api/pieces/{pieceId}/tag` | etiqueta costurada da peça | e2e_09242221x | 200 | — (não grava) | sim — room · lê MySQL: piece_usage_diary, refresh_tokens, room_layouts, room_storage_map, users, wardrobe_items |
| CA06 | `POST /api/pieces/{pieceId}/diary` | diário de uso da peça | e2e_09242221x | 200 | — (não gravou) | ação sem releitura; tela: pieces/[id] |
| CA07 | `POST /api/me/room/season-storage` | baú de estação exige nível Penthouse (nível Estreia é recusado) | e2e_09242221x | 409 | — (nada gravado: requisição recusada) | não se aplica — recusado com 409 NIVEL_INSUFICIENTE (regra de negócio testada) |
| CA08 | `GET /api/me/room/organization/preview` | prévia da organização automática (IA opt-in) | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT) | sim — room · lê MySQL: ai_inference_log, refresh_tokens, room_layouts, room_storage_map, user_consents, users |
| CA08 | `POST /api/me/room/organization` | aplicar organização | e2e_09242221x | 200 | MySQL: room_layouts (UPDATE) | sim — relido por GET /api/me/room, GET /api/me/room/organization/preview; tela: room |
| CA08 | `DELETE /api/me/room/organization` | desfazer organização | e2e_09242221x | 200 | MySQL: room_layouts (UPDATE) | sim — relido por GET /api/me/room, GET /api/me/room/organization/preview; tela: room |
| CA09 | `PUT /api/me/room/monogram` | monograma do quarto (Studio+) | demo_matheus3 | 200 | MySQL: room_layouts (UPDATE) | sim — relido por GET /api/me/room, GET /api/me/room/organization/preview |
| CA11 | `POST /api/me/room/island` | ilha central (Atelier+) — nível insuficiente recusa | e2e_09242221x | 409 | — (nada gravado: requisição recusada) | não se aplica — recusado com 409 NIVEL_INSUFICIENTE (regra de negócio testada) |
| CA12 | `POST /api/me/room/keys` | dar a chave do quarto a um seguidor | e2e_09242221x | 200 | MySQL: room_layouts (UPDATE) | sim — relido por GET /api/me/room, GET /api/me/room/organization/preview; tela: room |
| CA12 | `GET /api/users/{ownerId}/room-tour` | visitar o quarto de alguém (com chave) | ny_ava | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens, room_layouts, room_storage_map, schemes, style_dna, users |

## RF28  (14 passos, 13 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/me/mirror` | estado do espelho | e2e_09242221x | 200 | MySQL: mirror_states (INSERT) | sim — mirror; room · lê MySQL: challenge_participants, mirror_states, refresh_tokens, room_layouts, room_storage_map, style_dna |
| CA02 | `POST /api/me/mirror/pieces` | vestir uma peça | e2e_09242221x | 200 | MySQL: mirror_states (UPDATE) | sim — relido por GET /api/me/mirror, GET /api/me/mirror/grwm; tela: mirror; room |
| CA03 | `GET /api/me/mirror/suggestions` | sugestões para o slot | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT) | sim — mirror · lê MySQL: ai_inference_log, challenge_participants, mirror_states, refresh_tokens, room_layouts, room_storage_map |
| CA02 | `DELETE /api/me/mirror/pieces/{pieceId}` | tirar a peça | e2e_09242221x | 200 | MySQL: mirror_states (UPDATE) | sim — relido por GET /api/me/mirror, GET /api/me/mirror/grwm; tela: mirror |
| CA04 | `POST /api/me/mirror/vista-me` | Vista-me (pedido em linguagem natural) | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), mirror_states (UPDATE) | sim — relido por GET /api/me/mirror, GET /api/me/mirror/grwm; tela: mirror |
| CA08 | `POST /api/me/mirror/another` | outro look com o mesmo pedido | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), mirror_states (UPDATE) | sim — relido por GET /api/me/mirror, GET /api/me/mirror/grwm; tela: mirror |
| CA08 | `POST /api/me/mirror/slots/{slot}/swap` | trocar só o calçado | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT) | ação sem releitura; tela: mirror |
| CA09 | `POST /api/me/mirror/take-one-off` | tira uma coisa | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), fai_points_ledger (INSERT), mirror_states (UPDATE), notifications (INSERT), room_layouts (UPDATE), user_achievements (INSERT) | sim — relido por GET /api/me/room, GET /api/me/mirror; tela: mirror |
| CA12 | `GET /api/me/mirror/grwm` | storyboard GRWM | e2e_09242221x | 200 | — (não grava) | sim — mirror · lê MySQL: challenge_participants, mirror_states, refresh_tokens, room_layouts, room_storage_map, users |
| CA11 | `POST /api/me/mirror/save` | salvar o look do espelho como esquema | e2e_09242221x | 200 | — (não gravou) | ação sem releitura; tela: mirror |
| CA02 | `POST /api/me/mirror/vista-me` | vestir de novo para usar | e2e_09242221x | 200 | MySQL: ai_inference_log (INSERT), audit_log (INSERT), mirror_states (UPDATE) | sim — relido por GET /api/me/mirror, GET /api/me/mirror/grwm; tela: mirror |
| CA10 | `POST /api/me/mirror/use` | usar o look hoje (Look do Dia + diário) | e2e_09242221x | 200 | MySQL: audit_log (INSERT), daily_looks (UPDATE), fai_points_ledger (INSERT), item_embeddings (INSERT), notifications (INSERT), piece_usage_diary (INSERT), scheme_items (INSERT), schemes (INSERT/UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/schemes/{id}; tela: mirror; room |
| CA11 | `POST /api/me/mirror/draft` | levar ao editor de esquemas | e2e_09242221x | 200 | — (não gravou) | ação sem releitura; tela: mirror |
| CA01 | `DELETE /api/me/mirror` | limpar o espelho | e2e_09242221x | 200 | MySQL: mirror_states (UPDATE) | sim — relido por GET /api/me/mirror, GET /api/me/mirror/grwm; tela: mirror |

## RF29  (9 passos, 8 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/me/highlights` | destaques e Inventory Score | demo_matheus3 | 200 | MySQL: inventory_score_snapshots (UPDATE) | sim — highlights · lê MySQL: brands, challenge_templates, inventory_score_snapshots, piece_usage_diary, ranking_opt_ins, refresh_tokens |
| CA02 | `GET /api/me/highlights` | progresso sem nota parcial (menos de 10 peças) | e2e_09242221x | 200 | MySQL: inventory_score_snapshots (UPDATE) | sim — highlights · lê MySQL: inventory_score_snapshots, piece_usage_diary, refresh_tokens, room_layouts, room_storage_map, scheme_items |
| CA03 | `GET /api/me/inventory-score/dimensions/{code}` | explicar uma dimensão | demo_matheus3 | 200 | — (não grava) | sim — highlights · lê MySQL: refresh_tokens, users |
| CA04 | `GET /api/me/inventory-score/hints` | dicas para melhorar | demo_matheus3 | 200 | — (não grava) | API sem tela própria · lê MySQL: challenge_templates, refresh_tokens, users |
| CA05 | `GET /api/inventory-score/method` | como o score é calculado | anônimo | 200 | — (não grava) | API sem tela própria · sem leitura no MySQL (cálculo/cache/arquivo) |
| CA06 | `GET /api/me/album` | álbum de snapshots | demo_matheus3 | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens, users |
| CA07 | `GET /api/me/retrospective/{year}` | retrospectiva anual | demo_matheus3 | 200 | — (não grava) | API sem tela própria · lê MySQL: piece_usage_diary, refresh_tokens, schemes, users, wardrobe_items |
| CA08 | `PUT /api/me/rankings/opt-in` | entrar nos rankings (opt-in) | demo_matheus3 | 200 | MySQL: ranking_opt_ins (UPDATE) | sim — relido por GET /api/me/rankings, GET /api/me/highlights; tela: highlights |
| CA08 | `GET /api/me/rankings` | minha posição nos rankings | demo_matheus3 | 200 | — (não grava) | sim — highlights · lê MySQL: ranking_opt_ins, ranking_positions, refresh_tokens, users |

## RF30  (8 passos, 7 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA06 | `PUT /api/me/room/light` | luz guiada (Studio+) | demo_matheus3 | 200 | MySQL: room_layouts (UPDATE) | sim — relido por GET /api/me/room, GET /api/me/room/organization/preview; tela: room |
| CA01 | `GET /api/me/points` | saldo, nível e extrato | e2e_09242221x | 200 | — (não grava) | sim — points · lê MySQL: fai_points_ledger, fai_points_rules, refresh_tokens, users |
| CA02 | `GET /api/me/achievements` | conquistas | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens, user_achievements, users |
| CA03 | `GET /api/points/shop` | loja do quarto | e2e_09242221x | 200 | — (não grava) | sim — componente room3d/room-store.tsx · lê MySQL: brand_profiles, celebrity_profiles, fai_points_ledger, refresh_tokens, room_catalog, room_inventory |
| CA03 | `POST /api/points/shop/{sku}/try-on` | provar no quarto (prévia sem compra) | e2e_09242221x | 200 | — (não gravou) | ação sem releitura; tela: componente room3d/room-store.tsx |
| CA04 | `POST /api/points/shop/{sku}/purchase` | comprar com FAI Points | e2e_09242221x | 200 | MySQL: room_catalog (UPDATE), room_inventory (INSERT) | sim — relido por GET /api/points/shop, GET /api/room-creator/items; tela: componente room3d/room-store.tsx |
| CA05 | `POST /api/me/room-inventory/{inventoryId}/apply` | montar o item num módulo | e2e_09242221x | 200 | MySQL: room_inventory (UPDATE), room_layouts (UPDATE) | sim — relido por GET /api/me/room, GET /api/me/room/organization/preview; tela: room; componente room3d/room-store.tsx |
| CA05 | `POST /api/me/room-inventory/{inventoryId}/apply` | módulo incompatível é recusado | e2e_09242221x | 409 | — (nada gravado: requisição recusada) | não se aplica — recusado com 409 ENCAIXE_INCOMPATIVEL (regra de negócio testada) |

## RF31  (5 passos, 3 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `PATCH /api/pieces/{id}/flags` | favoritar peça | e2e_09242221 | 200 | MySQL: wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: closet; pieces/[id] |
| CA02 | `PATCH /api/pieces/{id}/flags` | marcar peça indisponível | e2e_09242221 | 200 | MySQL: wardrobe_availability_log (INSERT), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: closet; pieces/[id] |
| CA03 | `PATCH /api/pieces/{id}/flags` | marcar peça à venda | e2e_09242221 | 200 | MySQL: wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: closet; pieces/[id] |
| CA04 | `GET /api/me/closet` | filtrar indisponíveis | e2e_09242221 | 200 | — (não grava) | sim — closet; componente showcase/showcase-tabs.tsx · lê MySQL: reactions, refresh_tokens, saved_items, users, wardrobe_items |
| CA05 | `GET /api/me/room` | peça indisponível aparece no cesto do quarto | e2e_09242221x | 200 | — (não grava) | sim — room · lê MySQL: challenge_participants, daily_looks, piece_usage_diary, refresh_tokens, room_inventory, room_layouts |

## RF32  (23 passos, 20 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/challenges/catalog` | catálogo de desafios | e2e_09242221x | 200 | — (não grava) | sim — challenges · lê MySQL: challenge_instances, challenge_participants, challenge_templates, refresh_tokens, users |
| CA02 | `POST /api/challenges` | iniciar duelo (Runway Battle) | e2e_09242221x | 201 | MySQL: audit_log (INSERT), challenge_instances (INSERT/UPDATE), challenge_participants (INSERT), notifications (INSERT) | sim — relido por GET /api/challenges/{id}, GET /api/challenges/catalog; tela: challenges |
| CA03 | `POST /api/challenges/{id}/accept` | convidado aceita | ny_ava | 200 | MySQL: challenge_instances (UPDATE), challenge_participants (UPDATE) | sim — relido por GET /api/challenges/{id}, GET /api/challenges/catalog; tela: challenges/[id]; challenges |
| CA02 | `POST /api/challenges/{id}/start` | começar agora | e2e_09242221x | 409 | — (nada gravado: requisição recusada) | não se aplica — recusado com 409 MINIMO_NAO_ATINGIDO (regra de negócio testada) |
| CA04 | `GET /api/challenges/{id}` | detalhe do desafio | e2e_09242221x | 200 | — (não grava) | sim — challenges/[id]; challenges · lê MySQL: challenge_events, challenge_instances, challenge_notes, challenge_participants, challenge_templates, refresh_tokens |
| CA05 | `POST /api/challenges/{id}/entries` | enviar look como entrada | e2e_09242221x | 200 | MySQL: challenge_events (INSERT), challenge_participants (UPDATE) | sim — relido por GET /api/challenges/catalog, GET /api/challenges/{id}/result-card; tela: challenges/[id] |
| CA06 | `GET /api/challenges/votes` | feed de votação | paris_lea | 200 | — (não grava) | sim — challenges · lê MySQL: challenge_events, challenge_instances, challenge_templates, challenge_votes, refresh_tokens, scheme_items |
| CA06 | `POST /api/challenges/{id}/votes` | votar numa entrada | paris_lea | 200 | MySQL: challenge_votes (INSERT) | sim — relido por GET /api/challenges/votes; tela: challenges/[id]; challenges |
| CA07 | `POST /api/challenges/{id}/notes` | recado no mural | ny_ava | 200 | MySQL: challenge_notes (INSERT) | sim — relido por GET /api/challenges/{id}; tela: challenges/[id] |
| CA07 | `POST /api/challenges/{id}/reactions` | reagir com emoji | ny_ava | 200 | MySQL: challenge_notes (INSERT) | sim — relido por GET /api/challenges/{id}; tela: challenges/[id]; componente interactions.tsx |
| CA09 | `GET /api/challenges/{id}/result-card` | card de resultado | e2e_09242221x | 200 | — (não grava) | sim — challenges/[id] · lê MySQL: challenge_events, challenge_instances, challenge_participants, challenge_templates, refresh_tokens, users |
| CA08 | `POST /api/challenges` | desafio Espelho de Verdade em equipe | e2e_09242221x | 201 | MySQL: audit_log (INSERT), challenge_instances (INSERT/UPDATE), challenge_participants (INSERT), notifications (INSERT) | sim — relido por GET /api/challenges/{id}, GET /api/challenges/catalog; tela: challenges |
| CA03 | `POST /api/challenges/{id}/accept` | convidado aceita (equipe) | ny_ava | 200 | MySQL: challenge_instances (UPDATE), challenge_participants (UPDATE) | sim — relido por GET /api/challenges/{id}, GET /api/challenges/catalog; tela: challenges/[id]; challenges |
| CA08 | `POST /api/challenges/{id}/real-mirror` | foto no espelho real dentro da janela do dia | e2e_09242221x | 200 | MySQL: challenge_events (INSERT), challenge_participants (UPDATE), photos (INSERT); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/challenges/catalog, GET /api/challenges/{id}/result-card; tela: challenges/[id] |
| CA08 | `POST /api/challenges/{id}/real-mirror/confirmations` | outro participante confirma a evidência | ny_ava | 200 | MySQL: challenge_events (INSERT), challenge_participants (UPDATE) | sim — relido por GET /api/challenges/catalog, GET /api/challenges/{id}/result-card |
| CA02 | `POST /api/challenges` | rascunho de desafio (GRWM) | e2e_09242221x | 201 | MySQL: audit_log (INSERT), challenge_instances (INSERT), challenge_participants (INSERT) | sim — relido por GET /api/challenges/{id}, GET /api/challenges/catalog; tela: challenges |
| CA02 | `POST /api/challenges/{id}/launch` | lançar o rascunho | e2e_09242221x | 200 | MySQL: challenge_instances (UPDATE), challenge_participants (UPDATE) | sim — relido por GET /api/challenges/{id}, GET /api/challenges/catalog |
| CA02 | `POST /api/challenges/{id}/cancel` | cancelar (criador) | e2e_09242221x | 200 | MySQL: challenge_instances (UPDATE) | sim — relido por GET /api/challenges/{id}, GET /api/challenges/catalog; tela: challenges/[id] |
| CA03 | `POST /api/challenges/{id}/leave` | sair do desafio | ny_ava | 200 | MySQL: challenge_participants (UPDATE) | sim — relido por GET /api/challenges/catalog, GET /api/challenges/{id}/result-card; tela: challenges/[id] |
| CA03 | `POST /api/challenges/{id}/decline` | recusar convite | paris_lea | 404 | — (nada gravado: requisição recusada) | não se aplica — recusado com 404 NAO_ENCONTRADO (regra de negócio testada) |
| CA04 | `GET /api/me/challenges` | meus desafios | e2e_09242221x | 200 | — (não grava) | sim — challenges · lê MySQL: challenge_instances, challenge_participants, challenge_templates, refresh_tokens, users |
| CA10 | `POST /api/challenges/proposals` | propor um desafio à comunidade | e2e_09242221x | 201 | MySQL: audit_log (INSERT), challenge_templates (INSERT) | sim — relido por GET /api/challenges/catalog, GET /api/challenges/{id}/result-card; tela: challenges |
| CA10 | `POST /api/admin/challenges/{code}/promotion` | admin promove a proposta ao catálogo | demo_matheus3 | 200 | MySQL: challenge_templates (UPDATE) | sim — relido por GET /api/challenges/catalog, GET /api/me/challenges |

## RF33  (8 passos, 1 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA10–12 | `GET /api/explorer/runway` | passarela: ranking=TOP100_GLOBAL&limit=12 | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/runway-panel.tsx · lê MySQL: daily_looks, refresh_tokens, scheme_items, schemes, user_preferences, users |
| CA10–12 | `GET /api/explorer/runway` | passarela: ranking=TOP100_REGIONAL&region=EUROPA | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/runway-panel.tsx · lê MySQL: daily_looks, refresh_tokens, scheme_items, schemes, user_preferences, users |
| CA10–12 | `GET /api/explorer/runway` | passarela: ranking=TOP100_PAIS&country=BR | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/runway-panel.tsx · lê MySQL: daily_looks, refresh_tokens, scheme_items, schemes, user_preferences, users |
| CA10–12 | `GET /api/explorer/runway` | passarela: ranking=SEGUINDO | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/runway-panel.tsx · lê MySQL: daily_looks, follows, refresh_tokens, scheme_items, schemes, user_preferences |
| CA10–12 | `GET /api/explorer/runway` | passarela: ranking=EM_ALTA&colors=black | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/runway-panel.tsx · lê MySQL: daily_looks, refresh_tokens, scheme_items, schemes, users, wardrobe_items |
| CA10–12 | `GET /api/explorer/runway` | passarela: ranking=RECENTES&limit=5&offset=5 | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/runway-panel.tsx · lê MySQL: daily_looks, refresh_tokens, scheme_items, schemes, user_preferences, users |
| CA10–12 | `GET /api/explorer/runway` | passarela: ranking=TOP100_GLOBAL&occasions=casual&styles=streetwear&sex=FEMININO | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/runway-panel.tsx · lê MySQL: daily_looks, refresh_tokens, scheme_items, schemes, user_preferences, users |
| CA12 | `GET /api/explorer/runway` | ranking inválido é recusado | e2e_09242221x | 400 | — (nada gravado: requisição recusada) | não se aplica — recusado com 400 RANKING_INVALIDO (regra de negócio testada) |

## RF34  (9 passos, 8 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA02 | `GET /api/institutional/{slug}/showcase/{kind}` | eras da celebridade | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/showcase-tabs.tsx · lê MySQL: brand_profiles, celebrity_profiles, refresh_tokens, scheme_groupings, schemes, users |
| CA02 | `GET /api/institutional/{slug}/showcase/{kind}/items` | busca por era, texto e ano | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/showcase-tabs.tsx · lê MySQL: brand_profiles, celebrity_profiles, reactions, refresh_tokens, saved_items, scheme_groupings |
| CA04 | `GET /api/institutional/{slug}/showcase/{kind}/insights` | Insights de Eras | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/showcase-tabs.tsx · lê MySQL: brand_profiles, celebrity_profiles, refresh_tokens, scheme_groupings, schemes, users |
| CA06 | `GET /api/institutional/{slug}/stage` | My Stage 3D | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/showcase-tabs.tsx · lê MySQL: brand_profiles, celebrity_profiles, refresh_tokens, scheme_groupings, scheme_items, schemes |
| CA01 | `POST /api/groupings` | celebridade cria uma era | luna_vega | 201 | MySQL: scheme_groupings (INSERT) | sim — relido por GET /api/groupings/{id}/schemes, GET /api/users/{ownerId}/groupings; tela: componente lookbook-tabs.tsx; componente showcase/showcase-tabs.tsx |
| CA03 | `POST /api/groupings/{id}/cover` | foto da era | luna_vega | 200 | MySQL: scheme_groupings (UPDATE); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/groupings/{id}/schemes, GET /api/users/{ownerId}/groupings; tela: componente showcase/showcase-tabs.tsx |
| CA08 | `PUT /api/groupings/{id}` | visitante não edita a era | e2e_09242221x | 403 | MySQL: audit_log (INSERT) | não se aplica — recusado com 403 ACESSO_NEGADO (regra de negócio testada) |
| CA01 | `DELETE /api/groupings/{id}` | excluir a era de teste | luna_vega | 204 | MySQL: scheme_groupings (DELETE) | sim — relido por GET /api/groupings/{id}/schemes, GET /api/users/{ownerId}/groupings; tela: componente showcase/showcase-tabs.tsx |
| CA05 | `GET /api/institutional/{slug}/showcase/{kind}` | aba de era inválida é recusada | e2e_09242221x | 404 | — (nada gravado: requisição recusada) | não se aplica — recusado com 404 NAO_ENCONTRADO (regra de negócio testada) |

## RF35  (6 passos, 6 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA02 | `GET /api/institutional/{slug}/showcase/{kind}` | coleções da marca | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/showcase-tabs.tsx · lê MySQL: brand_profiles, refresh_tokens, scheme_groupings, schemes, users, wardrobe_items |
| CA02 | `GET /api/institutional/{slug}/showcase/{kind}/items` | busca por coleção | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/showcase-tabs.tsx · lê MySQL: brand_profiles, refresh_tokens, scheme_groupings, schemes, users, wardrobe_items |
| CA04 | `GET /api/institutional/{slug}/showcase/{kind}/insights` | Collections Insights (mini lojas 3D) | e2e_09242221x | 200 | — (não grava) | sim — componente showcase/showcase-tabs.tsx · lê MySQL: brand_profiles, refresh_tokens, scheme_groupings, schemes, users, wardrobe_items |
| CA01 | `POST /api/groupings` | marca cria uma coleção | atelier_lume3 | 201 | MySQL: scheme_groupings (INSERT) | sim — relido por GET /api/groupings/{id}/schemes, GET /api/users/{ownerId}/groupings; tela: componente lookbook-tabs.tsx; componente showcase/showcase-tabs.tsx |
| CA03 | `POST /api/groupings/{id}/cover` | arte da coleção | atelier_lume3 | 200 | MySQL: scheme_groupings (UPDATE); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/groupings/{id}/schemes, GET /api/users/{ownerId}/groupings; tela: componente showcase/showcase-tabs.tsx |
| CA01 | `DELETE /api/groupings/{id}` | excluir a coleção de teste | atelier_lume3 | 204 | MySQL: scheme_groupings (DELETE) | sim — relido por GET /api/groupings/{id}/schemes, GET /api/users/{ownerId}/groupings; tela: componente showcase/showcase-tabs.tsx |

## RF36  (8 passos, 7 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA02 | `GET /api/pieces/{id}/look3d` | peça no manequim (look 3D) | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens, user_preferences, users, wardrobe_items |
| CA02 | `GET /api/schemes/{id}/look3d` | look inteiro no manequim | e2e_09242221x | 200 | — (não grava) | sim — componente edit-profile.tsx · lê MySQL: refresh_tokens, scheme_items, schemes, user_preferences, users, wardrobe_items |
| CA05 | `POST /api/schemes/{id}/model3d` | pedir 3D das peças do esquema (RF16) | e2e_09242221x | 200 | — (não gravou) | ação sem releitura; tela: schemes/[id]; componente generate-3d.tsx |
| CA06 | `POST /api/pieces/{id}/mannequin-photo` | salvar foto com manequim da peça | e2e_09242221x | 200 | MySQL: wardrobe_items (UPDATE); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet; tela: pieces/[id] |
| CA06 | `POST /api/schemes/{id}/mannequin-photo` | salvar foto do look como capa | e2e_09242221x | 200 | MySQL: schemes (UPDATE); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/schemes/{id}, GET /api/schemes/{id}/look3d; tela: schemes/[id] |
| CA07 | `POST /api/schemes/{id}/mannequin-photo` | só o dono gera (outro usuário recusado) | ny_ava | 403 | MySQL: audit_log (INSERT) | não se aplica — recusado com 403 ACESSO_NEGADO (regra de negócio testada) |
| CA07 | `DELETE /api/{kind:pieces\|schemes}/{id}/mannequin-photo` | remover a foto com manequim | e2e_09242221x | 204 | MySQL: wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/me/closet |
| CA03 | `PATCH /api/me/profile` | ajuste do rosto do manequim | e2e_09242221x | 200 | MySQL: audit_log (INSERT), user_preferences (UPDATE) | sim — relido por GET /api/me/preferences, GET /api/me/issuer-dashboard; tela: settings; componente edit-profile.tsx |

## RF37  (67 passos, 55 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/flair/me` | meu perfil FLAIR | e2e_09242221x | 200 | MySQL: flair_profiles (INSERT) | sim — flair · lê MySQL: flair_coin_entries, flair_match_entries, flair_profiles, flair_team_members, refresh_tokens, users |
| CA01 | `GET /api/flair/cards` | cartas e álbum | e2e_09242221x | 200 | — (não grava) | sim — flair; componente flair/modes.tsx · lê MySQL: brand_profiles, refresh_tokens, users, wardrobe_items |
| CA01 | `GET /api/flair/decks` | decks | e2e_09242221x | 200 | — (não grava) | sim — flair · lê MySQL: brand_profiles, refresh_tokens, scheme_items, schemes, users, wardrobe_items |
| CA01 | `GET /api/flair/decks/{schemeId}` | deck de um esquema | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens, scheme_items, schemes, users, wardrobe_items |
| CA04 | `GET /api/flair/quests` | quests | e2e_09242221x | 200 | — (não grava) | sim — flair · lê MySQL: brand_profiles, flair_coin_entries, flair_match_entries, reactions, refresh_tokens, scheme_items |
| CA04 | `POST /api/flair/quests/{code}/claim` | resgatar quest | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_profiles (UPDATE) | sim — relido por GET /api/flair/quests, GET /api/flair/teams; tela: flair |
| CA02 | `POST /api/flair/duels` | duelo 1×1 contra a Casa | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: flair |
| CA02 | `GET /api/flair/arena` | Arena do dia | e2e_09242221x | 200 | — (não grava) | sim — flair · lê MySQL: flair_match_entries, flair_matches, refresh_tokens, schemes, users |
| CA02 | `POST /api/flair/arena` | inscrever deck na Arena | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: flair |
| CA03 | `GET /api/flair/teams` | liga de equipes | e2e_09242221x | 200 | — (não grava) | sim — flair · lê MySQL: flair_profiles, flair_team_members, flair_teams, refresh_tokens, users |
| CA03 | `POST /api/flair/teams` | criar equipe | e2e_09242221x | 200 | MySQL: flair_team_members (INSERT), flair_teams (INSERT) | sim — relido por GET /api/flair/teams, GET /api/flair/me; tela: flair |
| CA03 | `POST /api/flair/teams/join` | entrar na equipe pelo código | luna_vega | 200 | MySQL: flair_team_members (INSERT) | sim — relido por GET /api/flair/teams, GET /api/flair/me; tela: flair |
| CA03 | `POST /api/flair/teams/battles` | duelo de equipes (3×3) | e2e_09242221x | 404 | — (nada gravado: requisição recusada) | não se aplica — recusado com 404 NAO_ENCONTRADO (regra de negócio testada) |
| CA03 | `DELETE /api/flair/teams/me` | sair da equipe | luna_vega | 200 | MySQL: flair_team_members (DELETE) | sim — relido por GET /api/flair/teams, GET /api/flair/me; tela: flair |
| CA03 | `DELETE /api/flair/teams/me` | última pessoa sai e encerra a equipe | e2e_09242221x | 200 | MySQL: flair_team_members (DELETE), flair_teams (DELETE) | sim — relido por GET /api/flair/teams, GET /api/flair/me; tela: flair |
| CA04 | `POST /api/flair/skins/{skin}` | skin cosmética de carta | e2e_09242221x | 409 | — (nada gravado: requisição recusada) | não se aplica — recusado com 409 COINS_INSUFICIENTES (regra de negócio testada) |
| CA05 | `GET /api/flair/modes` | catálogo dos 15 modos e 18 temas | e2e_09242221x | 200 | — (não grava) | sim — componente flair/modes.tsx · lê MySQL: refresh_tokens |
| CA05 | `GET /api/flair/modes/looks` | looks com os 10 atributos | e2e_09242221x | 200 | — (não grava) | sim — componente flair/modes.tsx · lê MySQL: brand_profiles, refresh_tokens, scheme_items, schemes, users, wardrobe_items |
| Battle | `POST /api/flair/modes/battle` | Battle of Looks contra @usuário e tema | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: componente flair/modes.tsx |
| Squad | `POST /api/flair/modes/squad` | FLAIR Squad 5×5 | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: componente flair/modes.tsx |
| League | `PUT /api/flair/modes/league/roster` | escalação da liga | e2e_09242221x | 200 | MySQL: flair_mode_states (INSERT/UPDATE) | sim — relido por GET /api/flair/modes/league, GET /api/flair/modes/runway; tela: componente flair/modes.tsx |
| League | `POST /api/flair/modes/league/play` | rodada da liga | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_mode_states (UPDATE), flair_profiles (UPDATE) | sim — relido por GET /api/flair/modes/league, GET /api/flair/modes/runway; tela: componente flair/modes.tsx |
| League | `GET /api/flair/modes/league` | tabela da liga | e2e_09242221x | 200 | — (não grava) | sim — componente flair/modes.tsx · lê MySQL: flair_mode_states, refresh_tokens, users |
| Runway | `GET /api/flair/modes/runway` | FLAIR Runway (tema do dia) | e2e_09242221x | 200 | — (não grava) | sim — componente flair/modes.tsx · lê MySQL: flair_mode_states, refresh_tokens, users |
| Runway | `GET /api/flair/modes/looks` | looks da celebridade | luna_vega | 200 | — (não grava) | sim — componente flair/modes.tsx · lê MySQL: refresh_tokens, scheme_items, schemes, users, wardrobe_items |
| Runway | `POST /api/flair/modes/runway` | inscrever look na Runway (1 por dia) | luna_vega | 409 | — (nada gravado: requisição recusada) | não se aplica — recusado com 409 JA_NA_RUNWAY (regra de negócio testada) |
| Tour | `GET /api/flair/modes/tour` | World Tour | e2e_09242221x | 200 | MySQL: flair_mode_states (INSERT) | sim — componente flair/modes.tsx · lê MySQL: flair_mode_states, refresh_tokens, users |
| Tour | `POST /api/flair/modes/tour/roll` | rolar o dado | e2e_09242221x | 200 | MySQL: flair_mode_states (UPDATE) | sim — relido por GET /api/flair/modes/tour, GET /api/flair/modes/league; tela: componente flair/modes.tsx |
| Tour | `POST /api/flair/modes/tour/resolve` | resolver a casa | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_mode_states (UPDATE), flair_profiles (UPDATE) | sim — relido por GET /api/flair/modes/tour, GET /api/flair/modes/league; tela: componente flair/modes.tsx |
| Conquest | `GET /api/flair/modes/territories` | mapa de conquista | e2e_09242221x | 200 | — (não grava) | sim — componente flair/modes.tsx · lê MySQL: flair_territories, refresh_tokens, scheme_items, schemes, users, wardrobe_items |
| Conquest | `POST /api/flair/modes/territories/{map}/{code}/attack` | atacar região (vence 2 de 3) | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_profiles (UPDATE), flair_territories (UPDATE) | sim — relido por GET /api/flair/modes/territories, GET /api/flair/arena; tela: componente flair/modes.tsx |
| Monopoly | `POST /api/flair/modes/territories/{map}/{code}/attack` | Fashion Monopoly | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_profiles (UPDATE), flair_territories (UPDATE) | sim — relido por GET /api/flair/modes/territories, GET /api/flair/arena; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft` | iniciar draft (20 peças) | e2e_09242221x | 200 | MySQL: flair_matches (INSERT) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft/{id}/pick` | escolha em serpente #1 | e2e_09242221x | 200 | MySQL: flair_matches (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft/{id}/pick` | escolha em serpente #2 | e2e_09242221x | 200 | MySQL: flair_matches (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft/{id}/pick` | escolha em serpente #3 | e2e_09242221x | 200 | MySQL: flair_matches (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft/{id}/pick` | escolha em serpente #4 | e2e_09242221x | 200 | MySQL: flair_matches (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft/{id}/pick` | escolha em serpente #5 | e2e_09242221x | 200 | MySQL: flair_matches (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft/{id}/pick` | escolha em serpente #6 | e2e_09242221x | 200 | MySQL: flair_matches (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft/{id}/pick` | escolha em serpente #7 | e2e_09242221x | 200 | MySQL: flair_matches (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft/{id}/pick` | escolha em serpente #8 | e2e_09242221x | 200 | MySQL: flair_matches (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft/{id}/pick` | escolha em serpente #9 | e2e_09242221x | 200 | MySQL: flair_matches (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft/{id}/pick` | escolha em serpente #10 | e2e_09242221x | 200 | MySQL: flair_matches (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Draft | `POST /api/flair/modes/draft/{id}/looks` | montar 3 looks do draft | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT/UPDATE), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: componente flair/modes.tsx |
| Deck | `GET /api/flair/modes/deck` | deck de 12 cartas (sugestão) | demo_matheus3 | 200 | — (não grava) | sim — componente flair/modes.tsx · lê MySQL: flair_mode_states, refresh_tokens, users, wardrobe_items |
| Deck | `PUT /api/flair/modes/deck` | salvar deck | demo_matheus3 | 200 | MySQL: flair_mode_states (UPDATE) | sim — relido por GET /api/flair/modes/deck, GET /api/flair/modes/league; tela: componente flair/modes.tsx |
| Deck | `POST /api/flair/modes/deck/battle` | Deck Battle: desafio | demo_matheus3 | 200 | MySQL: flair_matches (INSERT) | sim — relido por GET /api/flair/arena, GET /api/flair/combinations; tela: componente flair/modes.tsx |
| Deck | `POST /api/flair/modes/deck/battle/{id}/play` | Deck Battle: jogar a mão | demo_matheus3 | 200 | MySQL: flair_match_entries (INSERT), flair_matches (INSERT/UPDATE), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: componente flair/modes.tsx |
| Combo | `POST /api/flair/modes/combo` | Combo Battle | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: componente flair/modes.tsx |
| Tag | `POST /api/flair/modes/tag-team` | Tag Team 2×2 | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: componente flair/modes.tsx |
| Boss | `POST /api/flair/modes/bosses/{code}` | Fashion Boss: The Minimalist | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: componente flair/modes.tsx |
| Wars | `POST /api/flair/modes/wardrobe-wars` | Wardrobe Wars (7 categorias) | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: componente flair/modes.tsx |
| Chess | `GET /api/flair/modes/chess` | FLAIR Chess: sugestão de tabuleiro | e2e_09242221x | 200 | — (não grava) | sim — componente flair/modes.tsx · lê MySQL: brand_profiles, refresh_tokens, users, wardrobe_items |
| Chess | `POST /api/flair/modes/chess` | FLAIR Chess: jogar | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: componente flair/modes.tsx |
| Ultimate | `GET /api/flair/modes/ultimate` | Ultimate Team: sugestão | e2e_09242221x | 200 | MySQL: flair_mode_states (INSERT) | sim — componente flair/modes.tsx · lê MySQL: brand_profiles, flair_mode_states, refresh_tokens, scheme_items, schemes, users |
| Ultimate | `PUT /api/flair/modes/ultimate` | Ultimate Team: salvar papéis | e2e_09242221x | 200 | MySQL: flair_mode_states (UPDATE) | sim — relido por GET /api/flair/modes/ultimate, GET /api/flair/modes/league; tela: componente flair/modes.tsx |
| Ultimate | `POST /api/flair/modes/ultimate/play` | Ultimate Team: jogar | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_match_entries (INSERT), flair_matches (INSERT), flair_profiles (UPDATE) | sim — relido por GET /api/flair/arena, GET /api/flair/teams; tela: componente flair/modes.tsx |
| CA07 | `GET /api/flair/modes/trophies` | troféus | e2e_09242221x | 200 | — (não grava) | sim — componente flair/modes.tsx · lê MySQL: flair_trophies, refresh_tokens, users |
| CA09 | `GET /api/institutional/{slug}/flair` | aba FLAIR da marca | e2e_09242221x | 200 | — (não grava) | sim — componente flair/brand-flair-tab.tsx · lê MySQL: brand_profiles, flair_combinations, flair_redemptions, refresh_tokens, users |
| CA09 | `POST /api/flair/brand/combinations` | marca cria combinação | atelier_lume3 | 201 | MySQL: flair_combinations (INSERT) | sim — relido por GET /api/flair/vouchers, GET /api/flair/combinations; tela: componente flair/brand-flair-tab.tsx |
| CA09 | `PUT /api/flair/brand/combinations/{id}` | marca edita combinação | atelier_lume3 | 200 | MySQL: flair_combinations (UPDATE) | sim — relido por GET /api/flair/vouchers, GET /api/flair/combinations; tela: componente flair/brand-flair-tab.tsx |
| CA10 | `GET /api/flair/combinations` | combinações ativas com melhor deck | e2e_09242221x | 200 | — (não grava) | sim — flair · lê MySQL: brand_profiles, flair_combinations, flair_match_entries, flair_matches, flair_redemptions, refresh_tokens |
| CA10 | `GET /api/flair/combinations/{id}/check` | conferir deck contra a combinação | e2e_09242221x | 200 | — (não grava) | API sem tela própria · lê MySQL: brand_profiles, flair_combinations, flair_redemptions, refresh_tokens, scheme_items, schemes |
| CA10 | `POST /api/flair/combinations/{id}/redeem` | trocar o deck pelo cupom | e2e_09242221x | 200 | MySQL: flair_coin_entries (INSERT), flair_combinations (UPDATE), flair_profiles (UPDATE), flair_redemptions (INSERT) | sim — relido por GET /api/flair/combinations, GET /api/flair/teams; tela: flair |
| CA10 | `GET /api/flair/vouchers` | carteira de cupons | e2e_09242221x | 200 | — (não grava) | sim — flair · lê MySQL: brand_profiles, flair_combinations, flair_redemptions, refresh_tokens, schemes, users |
| CA12 | `POST /api/flair/brand/redemptions/validate` | loja valida o cupom no caixa | atelier_lume3 | 200 | MySQL: flair_redemptions (UPDATE) | sim — relido por GET /api/flair/vouchers, GET /api/flair/combinations; tela: componente flair/brand-flair-tab.tsx |
| CA09 | `DELETE /api/flair/brand/combinations/{id}` | remover combinação (com cupom emitido só desativa) | atelier_lume3 | 204 | MySQL: flair_combinations (UPDATE) | sim — relido por GET /api/flair/vouchers, GET /api/flair/combinations; tela: componente flair/brand-flair-tab.tsx |

## RF38  (9 passos, 6 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA07 | `GET /api/me/coupons` | meus cupons (direitos e resgatados) | e2e_09242221x | 200 | — (não grava) | sim — componente coupons/my-coupons.tsx · lê MySQL: brand_profiles, coupon_rights, flair_combinations, flair_match_entries, flair_matches, flair_redemptions |
| CA05 | `GET /api/me/coupons` | direito a cupom criado por aprovação de selo | e2e_09242221x | 200 | — (não grava) | sim — componente coupons/my-coupons.tsx · lê MySQL: brand_profiles, coupon_rights, flair_combinations, flair_match_entries, flair_matches, flair_redemptions |
| CA01 | `GET /api/me/coupons/admin` | aba Meus cupons promocionais (marca) | atelier_lume3 | 200 | — (não grava) | sim — componente coupons/brand-coupons-tab.tsx · lê MySQL: brand_profiles, coupon_rights, flair_combinations, flair_redemptions, promotion_redemptions, promotions |
| CA10 | `POST /api/me/coupons/validate` | marca valida o código no caixa | atelier_lume3 | 404 | — (nada gravado: requisição recusada) | não se aplica — recusado com 404 NAO_ENCONTRADO (regra de negócio testada) |
| CA05 | `POST /api/flair/brand/combinations` | marca cria a combinação "Combo E2E Resgate" | atelier_lume3 | 201 | MySQL: flair_combinations (INSERT) | sim — relido por GET /api/flair/vouchers, GET /api/flair/combinations; tela: componente flair/brand-flair-tab.tsx |
| CA05 | `POST /api/flair/brand/combinations` | marca cria a combinação "Combo E2E Dispensa" | atelier_lume3 | 201 | MySQL: flair_combinations (INSERT) | sim — relido por GET /api/flair/vouchers, GET /api/flair/combinations; tela: componente flair/brand-flair-tab.tsx |
| CA05 | `GET /api/me/coupons` | cupons conquistados aparecem como pendentes | e2e_09242221x | 200 | MySQL: coupon_rights (INSERT), notifications (INSERT) | sim — componente coupons/my-coupons.tsx · lê MySQL: brand_profiles, coupon_rights, flair_combinations, flair_match_entries, flair_matches, flair_redemptions |
| CA06 | `POST /api/me/coupon-rights/{id}/redeem` | resgatar o cupom conquistado | e2e_09242221x | 200 | MySQL: coupon_rights (UPDATE), flair_coin_entries (INSERT), flair_combinations (UPDATE), flair_profiles (UPDATE), flair_redemptions (INSERT) | sim — relido por GET /api/me/coupons/admin, GET /api/me/coupons; tela: componente coupons/my-coupons.tsx |
| CA05 | `POST /api/me/coupon-rights/{id}/dismiss` | dispensar o outro cupom (Agora não) | e2e_09242221x | 200 | MySQL: coupon_rights (UPDATE) | sim — relido por GET /api/me/coupons/admin, GET /api/me/coupons; tela: componente coupons/my-coupons.tsx |

## RF39  (14 passos, 8 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/room-creator/options` | opções do criador (marca) | atelier_lume3 | 200 | — (não grava) | sim — componente room3d/wardrobe-creator.tsx · lê MySQL: brand_profiles, refresh_tokens, seals, users |
| CA01 | `GET /api/room-creator/options` | usuário comum não acessa o criador | e2e_09242221x | 403 | MySQL: audit_log (INSERT) | não se aplica — recusado com 403 ACESSO_NEGADO (regra de negócio testada) |
| CA05 | `POST /api/room-creator/uploads` | enviar logo | atelier_lume3 | 200 | storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — arquivo servido em /media; tela: componente room3d/wardrobe-creator.tsx |
| CA05 | `POST /api/room-creator/uploads` | enviar arte | atelier_lume3 | 200 | storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — arquivo servido em /media; tela: componente room3d/wardrobe-creator.tsx |
| CA02 | `POST /api/room-creator/items` | criar componente (tapete de lã, grátis) | atelier_lume3 | 201 | MySQL: room_catalog (INSERT) | sim — relido por GET /api/room-creator/items, GET /api/points/shop; tela: componente room3d/wardrobe-creator.tsx |
| CA02 | `POST /api/room-creator/items` | criar guarda-roupa inteiro | atelier_lume3 | 201 | MySQL: room_catalog (INSERT) | sim — relido por GET /api/room-creator/items, GET /api/points/shop; tela: componente room3d/wardrobe-creator.tsx |
| CA04 | `POST /api/room-creator/items` | material não aceito pelo bloco é recusado | atelier_lume3 | 400 | — (nada gravado: requisição recusada) | não se aplica — recusado com 400 MATERIAL_INVALIDO (regra de negócio testada) |
| CA06 | `PUT /api/room-creator/items/{sku}` | editar condições (expira em) | atelier_lume3 | 200 | MySQL: room_catalog (UPDATE) | sim — relido por GET /api/room-creator/items, GET /api/points/shop; tela: componente room3d/wardrobe-creator.tsx |
| CA08 | `GET /api/room-creator/items` | minhas criações com vendas | atelier_lume3 | 200 | — (não grava) | sim — componente room3d/wardrobe-creator.tsx · lê MySQL: brand_profiles, refresh_tokens, room_catalog, seals, users |
| CA10 | `POST /api/points/shop/{sku}/purchase` | comprar o componente da marca | e2e_09242221x | 200 | MySQL: room_catalog (UPDATE), room_inventory (INSERT) | sim — relido por GET /api/points/shop, GET /api/room-creator/items; tela: componente room3d/room-store.tsx |
| CA10 | `POST /api/points/shop/{sku}/purchase` | limite de 1 por pessoa | e2e_09242221x | 409 | — (nada gravado: requisição recusada) | não se aplica — recusado com 409 CONDICAO_DE_COMPRA (regra de negócio testada) |
| CA11 | `POST /api/me/room-inventory/{inventoryId}/apply` | montar o tapete no quarto | e2e_09242221x | 200 | MySQL: room_inventory (UPDATE), room_layouts (UPDATE) | sim — relido por GET /api/me/room, GET /api/me/room/organization/preview; tela: room; componente room3d/room-store.tsx |
| CA08 | `DELETE /api/room-creator/items/{sku}` | excluir item vendido só retira da loja | atelier_lume3 | 204 | MySQL: room_catalog (UPDATE) | sim — relido por GET /api/room-creator/items, GET /api/points/shop; tela: componente room3d/wardrobe-creator.tsx |
| CA08 | `DELETE /api/room-creator/items/{sku}` | excluir guarda-roupa sem vendas | atelier_lume3 | 204 | MySQL: room_catalog (DELETE) | sim — relido por GET /api/room-creator/items, GET /api/points/shop; tela: componente room3d/wardrobe-creator.tsx |

## RNF5  (1 passos, 1 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/admin/audit` | trilha de auditoria (admin) | demo_matheus3 | 200 | — (não grava) | sim — admin/users · lê MySQL: audit_log, refresh_tokens, users |

## RNF7  (2 passos, 2 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/preferences/options` | opções de preferências | e2e_09242221 | 200 | — (não grava) | API sem tela própria · lê MySQL: refresh_tokens |
| CA01 | `GET /api/me/preferences` | ler preferências de interface | e2e_09242221x | 200 | — (não grava) | sim — settings; componente app-shell.tsx · lê MySQL: refresh_tokens, user_preferences, users |

## RNF10  (6 passos, 6 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `PUT /api/notifications/preferences` | preferências de notificação | e2e_09242221 | 200 | MySQL: user_preferences (UPDATE) | sim — relido por GET /api/notifications/preferences, GET /api/me/preferences; tela: notifications |
| CA02 | `GET /api/notifications` | notificações | e2e_09242221x | 200 | — (não grava) | sim — notifications · lê MySQL: notifications, refresh_tokens, users |
| CA03 | `GET /api/notifications/unread-count` | contador de não lidas | e2e_09242221x | 200 | — (não grava) | sim — componente app-shell.tsx · lê MySQL: notifications, refresh_tokens, users |
| CA04 | `POST /api/notifications/read` | marcar como lida | e2e_09242221x | 200 | MySQL: notifications (UPDATE) | sim — relido por GET /api/notifications, GET /api/notifications/unread-count; tela: notifications |
| CA04 | `POST /api/notifications/read-all` | marcar todas como lidas | e2e_09242221x | 200 | MySQL: notifications (UPDATE) | sim — relido por GET /api/notifications, GET /api/notifications/unread-count; tela: notifications |
| CA01 | `GET /api/notifications/preferences` | preferências de notificação | e2e_09242221x | 200 | — (não grava) | sim — notifications · lê MySQL: refresh_tokens, user_preferences, users |

## ADM  (6 passos, 6 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/admin/users` | usuários (admin) | demo_matheus3 | 200 | — (não grava) | sim — admin/users · lê MySQL: refresh_tokens, users |
| CA02 | `PUT /api/admin/users/{userId}/role` | papel do usuário (admin) | demo_matheus3 | 200 | MySQL: audit_log (INSERT) | ação sem releitura; tela: admin/users |
| CA03 | `PUT /api/admin/users/{userId}/status` | suspender e reativar (admin) | demo_matheus3 | 200 | MySQL: audit_log (INSERT) | ação sem releitura; tela: admin/users |
| CA04 | `GET /api/admin/backups` | backups (admin) | demo_matheus3 | 200 | — (não grava) | sim — admin/system · lê MySQL: backup_records, refresh_tokens, users |
| CA04 | `POST /api/admin/backups` | gerar backup (admin) | demo_matheus3 | 202 | MySQL: audit_log (INSERT), backup_records (INSERT); storage de mídia (local; S3 em produção): 1 arquivo(s) | sim — relido por GET /api/admin/backups; tela: admin/system |
| CA05 | `POST /api/admin/jobs/{job}` | rodar job de Hype (admin) | demo_matheus3 | 200 | MySQL: audit_log (INSERT), hype_groups (DELETE/INSERT), metric_snapshots (INSERT), schemes (UPDATE), wardrobe_items (UPDATE) | sim — relido por GET /api/pieces/{id}, GET /api/schemes/{id}; tela: admin/system |

## DASH  (3 passos, 3 endpoints)

| CA | Endpoint | Passo | Usuário | Status | Salvou em qual banco? | Exibiu no frontend (GET buscou do banco)? |
|----|----------|-------|---------|--------|-----------------------|-------------------------------------------|
| CA01 | `GET /api/admin/dashboard` | dashboard gerencial com filtros | demo_matheus3 | 200 | MySQL: sp_admin_kpis (CALL), sp_ai_cost_by_country (CALL), sp_timeseries (CALL) | sim — admin/dashboard · lê MySQL: challenge_instances, challenge_participants, fai_points_ledger, inventory_score_snapshots, refresh_tokens, seal_bonds |
| CA02 | `GET /api/me/issuer-dashboard` | dashboard da marca | atelier_lume3 | 200 | — (não grava) | sim — dashboard · lê MySQL: promotion_redemptions, refresh_tokens, seal_bonds, user_preferences, users |
| CA03 | `PUT /api/me/dashboard-layout` | salvar layout do dashboard | demo_matheus3 | 200 | MySQL: user_preferences (UPDATE) | sim — relido por GET /api/me/preferences, GET /api/me/issuer-dashboard; tela: admin/dashboard |

