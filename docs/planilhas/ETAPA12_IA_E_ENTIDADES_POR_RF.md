# Etapa 12 — IA e entidades/bancos por RF e RNF

Gerado de `AiCatalog`/`AiCapability` (código), do grafo de injeção controller → serviço, das entidades JPA e do teste ponta a ponta (`general_log` do MySQL). Numeração dos RF: **Trello**. Planilhas: `IA_por_RF_RNF.xlsx` e `Entidades_BD_por_RF_RNF.xlsx`.

## Capacidades de IA

| Nº | Capacidade | RF hospedeiro | Primário | Fallback local | Consentimento | Acionada no E2E |
|---|---|---|---|---|---|---|
| 1 | Piece Analyzer | RF4 | Google Gemini Flash · gemini-2.5-flash | Análise local (k-means de cor + proporção da silhueta) | Envio de fotos a IA externa | RF4 |
| 2 | Content Moderator | RF4 | Google Gemini Flash · gemini-2.5-flash | Heurística local (resolução, cobertura do objeto, proporção de tons de pele) | Envio de fotos a IA externa | RF4 |
| 3 | Scheme Composer | RF5 | Claude (Anthropic API) · claude-opus-5 | Composição por regras (ocasião, estilo, harmonia de cor, estação) | Recomendações por IA | RF5, RF28 |
| 4 | DNA Synthesizer | RF13 | Claude (Anthropic API) · claude-opus-5 | Arquétipo por mapeamento estilo→Kibbe + paleta k-means local | Recomendações por IA | RF13 |
| 5 | Background Generator | RF11 | Adobe Firefly Services · firefly-image-4 | Galeria pré-gerada: presets AURA, materiais, mosaicos e gradientes do /public | não exige (sem dado pessoal) | RF11 |
| 6 | SealBond Matcher | RF20/RF21 | Similaridade de embeddings local (marca da peça + assinatura de estilo) · local | Regra de marca exata | não exige (sem dado pessoal) | RF21 |
| 7 | Style Advisor | RF6 | Claude (Anthropic API) · claude-opus-5 | Dica por regra da métrica mais fraca | Recomendações por IA | RF28 |
| 8 | Insight Generator | RF26 | Claude (Anthropic API) · claude-opus-5 | Texto por template a partir dos rankings | não exige (sem dado pessoal) | — |
| 9 | Brand Resolver | RF4/RF5/RF13 | Fuzzy match (Jaro-Winkler) contra a tabela brands · local | Normalização + match exato | não exige (sem dado pessoal) | — |
| 10 | Copilot | RF10 | Claude (Anthropic API) · claude-opus-5 | Recomendação por regras + clima | Recomendações por IA | RF10, RF27, RF28 |
| 11 | StyleInsight / PatternAnalysis | RF12 | Estatística local sobre o histórico de fotos/peças · local | Estatística local | Histórico para recomendação | — |
| 12 | Edit Assistant | RF9 | Claude (Anthropic API) · claude-opus-5 | Parser de intenções por palavras-chave | Recomendações por IA | RF9 |
| 13 | Acervo Grouping AI | RF6 | Embeddings de atributos + k-means local · local | Sem agrupamento | não exige (sem dado pessoal) | RF6 |
| 14 | Affinity AI | RF8 | Cosseno entre centróide do usuário e do perfil · local | Ordena por mais recentes | Histórico para recomendação | — |
| 15 | 3D Generator (Meshy / Stable Fast 3D / relevo local) | RF16 | Meshy image-to-3D · meshy-5 | Relevo inflado local: silhueta do recorte → malha frente/verso + foto como textura (glTF binário) | Envio de fotos a IA externa | — |
| 16 | Try-on AI (FASHN.ai) | RF18 | FASHN.ai · tryon-v1.6 | Sobreposição aproximada por camadas e âncoras do manequim | Envio de fotos a IA externa | RF18 |
| 17 | Try-on Polish AI | RF18 | Cleanup.pictures API · cleanup-hd | Suavização de borda (feather) + casamento de luminância local | Envio de fotos a IA externa | — |
| 18 | Category Fallback Compositor | RF18 | Tabela de landmarks pé/perna e mão/rosto do manequim (equivalente MediaPipe) · local | Slot sem overlay | não exige (sem dado pessoal) | — |
| 19 | Photo Curator AI | RF12 | Heurística local + embeddings do acervo · local | Grade cronológica | Histórico para recomendação | RF12 |
| 20 | Flat Lay Standardizer (pipeline RF4) | RF4 | rembg (auto-hospedado, ONNX u2net) via HTTP · u2net | Java2D: flood fill de borda + PCA de orientação + gray-world + composição 1024px | Envio de fotos a IA externa | RF4 |
| 21 | Brand Logo Finder (busca na web) | RF4/RF14/RF26 | Claude (Anthropic API) · claude-opus-5 | Monograma SVG com as iniciais e uma cor estável por marca | não exige (sem dado pessoal) | RF4 |
| 22 | Studio Enhancer (foto de estúdio da peça) | RF4 | Photoroom Image Editing API (fundo + AI lighting + AI shadow) · photoroom-v2-edit | Java2D: bicúbica progressiva + clarity + nitidez + vibração, luz por campo de altura, gradiente radial, sombra projetada/contato | Envio de fotos a IA externa | RF4 |

> No teste deste ambiente não há chave de IA configurada: toda chamada caiu no motor local e ficou registrada em `ai_inference_log` (provedor `local`, `fallback=true`).

## IA por RF (Trello)

| RF | Requisito | Capacidades de IA |
|---|---|---|
| RF1 | Cadastrar conta na plataforma (perfil Pessoal, Marca ou Celebridade) | SealBond Matcher, Style Advisor |
| RF2 | Autenticar usuário na plataforma com credenciais de acesso | — |
| RF3 | Gerenciar a conta: dados pessoais, sessão, segurança, privacidade (LGPD) e notificações | — |
| RF4 | Adicionar uma nova peça de roupa ao guarda-roupa por fotografia e formulário | Piece Analyzer, Content Moderator, SealBond Matcher, Style Advisor, 3D Generator (Meshy / Stable Fast 3D / relevo local), Flat Lay Standardizer (pipeline RF4), Brand Logo Finder (busca na web), Studio Enhancer (foto de estúdio da peça) |
| RF5 | Criar um esquema de vestimenta na aba "Criar Look" | Piece Analyzer, Content Moderator, Scheme Composer, Background Generator, SealBond Matcher, Edit Assistant, Flat Lay Standardizer (pipeline RF4), Studio Enhancer (foto de estúdio da peça) |
| RF6 | Acessar e gerenciar o Perfil Lookbook (Closet Digital + Looks Salvos) | Piece Analyzer, Content Moderator, Background Generator, SealBond Matcher, Style Advisor, Edit Assistant, Acervo Grouping AI, Flat Lay Standardizer (pipeline RF4), Studio Enhancer (foto de estúdio da peça) |
| RF7 | Acessar o detalhe de uma peça a partir da lista de peças de um esquema salvo | Piece Analyzer, Content Moderator, Edit Assistant, 3D Generator (Meshy / Stable Fast 3D / relevo local), Flat Lay Standardizer (pipeline RF4), Brand Logo Finder (busca na web), Studio Enhancer (foto de estúdio da peça) |
| RF8 | Visualizar esquemas de vestimenta & peças de roupa criados por outros usuários na rede social do Fashion AI, através da aba "Buscar" | Insight Generator, Edit Assistant |
| RF9 | Editar os dados de um esquema de vestimenta e das peças que o compõem | Piece Analyzer, Content Moderator, Background Generator, SealBond Matcher, Edit Assistant, Flat Lay Standardizer (pipeline RF4), Studio Enhancer (foto de estúdio da peça) |
| RF10 | Possibilitar que o usuário gere recomendações de esquemas de vestimenta & de peças de roupa através da aba "Copilot" | Piece Analyzer, Content Moderator, Scheme Composer, Style Advisor, Copilot, Edit Assistant, Acervo Grouping AI, Flat Lay Standardizer (pipeline RF4), Studio Enhancer (foto de estúdio da peça) |
| RF11 | Compor a arte de fundo (Background Studio) do card de um esquema ou de uma peça | Piece Analyzer, Content Moderator, Background Generator, SealBond Matcher, Edit Assistant, Flat Lay Standardizer (pipeline RF4), Studio Enhancer (foto de estúdio da peça) |
| RF12 | Visualizar e editar a página "Minhas Fotos" | Piece Analyzer, Content Moderator, Photo Curator AI, Flat Lay Standardizer (pipeline RF4), Studio Enhancer (foto de estúdio da peça) |
| RF13 | Criar um esquema de identidade pessoal de moda na página "DNA de Estilo" | DNA Synthesizer, Edit Assistant |
| RF14 | Visualizar a aba "Marcas" — Feed de Perfil de Marcas de roupa cadastradas dentro do sistema do FashionAI | SealBond Matcher, Edit Assistant, Affinity AI |
| RF15 | Editar uma fotografia de uma peça de roupa proveniente da adição de uma peça de roupa ou criação de novo esquema de vestimenta, através de um Editor Canvas Interativo 2D | Piece Analyzer, Content Moderator, Insight Generator, Edit Assistant, 3D Generator (Meshy / Stable Fast 3D / relevo local), Photo Curator AI, Flat Lay Standardizer (pipeline RF4), Brand Logo Finder (busca na web), Studio Enhancer (foto de estúdio da peça) |
| RF16 | Implementar geração de imagem 3D das peças do guarda-roupa utilizando serviços de API externas | Piece Analyzer, Content Moderator, 3D Generator (Meshy / Stable Fast 3D / relevo local), Flat Lay Standardizer (pipeline RF4), Brand Logo Finder (busca na web), Studio Enhancer (foto de estúdio da peça) |
| RF17 | Permitir que o Usuário visualize a página de perfil de outros Usuários cadastrados dentro da rede social do FashionAI | SealBond Matcher, Edit Assistant, Affinity AI |
| RF18 | Usar o Provador 2D virtual com manequim masculino ou feminino | Piece Analyzer, Content Moderator, Edit Assistant, Try-on AI (FASHN.ai), Flat Lay Standardizer (pipeline RF4), Studio Enhancer (foto de estúdio da peça) |
| RF19 | Interagir socialmente com esquemas e peças: reagir, comentar, salvar, compartilhar, remixar e retornar | Piece Analyzer, Content Moderator, Background Generator, SealBond Matcher, Edit Assistant, Flat Lay Standardizer (pipeline RF4), Studio Enhancer (foto de estúdio da peça) |
| RF20 | Permitir que o usuário crie & publique um esquema de vestimenta como vinculado a uma marca de roupa, devidamente cadastrada dentro do Fashion AI | SealBond Matcher |
| RF21 | Permitir que o usuário crie & publique um esquema de vestimenta como vinculado a uma celebridade, devidamente cadastrada dentro do Fashion AI | SealBond Matcher |
| RF22 | Visualizar a aba "Celebridades" — Feed de Perfil de Celebridades cadastradas dentro do sistema do FashionAI | SealBond Matcher, Edit Assistant, Affinity AI |
| RF23 | Gerenciar preferências de interface e dados não sensíveis do perfil | Background Generator |
| RF24 | Usar a IA do sistema (motor transversal de inteligência artificial do Fashion AI) | SealBond Matcher, Style Advisor, Brand Logo Finder (busca na web) |
| RF25 | Criar & editar selo de marca ou celebridade através de formulário e arte de background | SealBond Matcher |
| RF26 | Realizar busca global de esquemas de vestimenta & peças de roupa por estação, região, clima e gênero, através da aba "Explorador Global" | Insight Generator, Edit Assistant |
| RF27 | Visualizar e organizar o guarda-roupa em um quarto 3D interativo, através da sub-aba "Meu Quarto" | Copilot |
| RF28 | Montar looks no Smart Mirror e pedir sugestões ao "Vista-me" usando apenas as peças do próprio guarda-roupa | Piece Analyzer, Content Moderator, Scheme Composer, Style Advisor, Copilot, Edit Assistant, Flat Lay Standardizer (pipeline RF4), Studio Enhancer (foto de estúdio da peça) |
| RF29 | Visualizar o FAI Inventory Score, destaques, evolução, conquistas e rankings do guarda-roupa, através da sub-aba "Destaques" | Copilot |
| RF30 | Ganhar e usar FAI Points e evoluir o nível do "Meu Quarto" | Copilot |
| RF31 | Filtrar e marcar o estado dos itens do acervo: favoritar, disponível, indisponível e todos | Piece Analyzer, Content Moderator, 3D Generator (Meshy / Stable Fast 3D / relevo local), Flat Lay Standardizer (pipeline RF4), Brand Logo Finder (busca na web), Studio Enhancer (foto de estúdio da peça) |
| RF32 | Participar de desafios de moda solo, em equipe, em duelo ou da comunidade, através da sub-aba "Desafios" | SealBond Matcher, Style Advisor, Copilot |
| RF33 | Visualizar a "Passarela 3D" na aba Explorar: o Look do Dia de cada usuário desfilando num manequim construído a partir da foto de perfil | Edit Assistant, Affinity AI, 3D Generator (Meshy / Stable Fast 3D / relevo local) |
| RF34 | Explorar as "Eras" de uma celebridade no perfil (RF22): busca por era, sub-aba "Insights de Eras" com mini palcos 2D e sub-aba "My Stage 3D" | — |
| RF34/RF35 |  | Edit Assistant, Affinity AI, 3D Generator (Meshy / Stable Fast 3D / relevo local) |
| RF35 | Explorar as "Coleções" de uma marca no perfil (RF14): busca por coleção e sub-aba "Collections Insights" com mini lojas 3D | — |
| RF36 | Gerar a "Foto com meu manequim" de uma peça (RF4) ou de um esquema inteiro (RF5), com o rosto 3D feito a partir da foto de perfil | Edit Assistant, Affinity AI, 3D Generator (Meshy / Stable Fast 3D / relevo local) |
| RF37 | Jogar o FLAIR: jogo de cartas de moda feito das peças e looks do guarda-roupa, com 15 modos de jogo e combinações de lojas que rendem cupons | Edit Assistant, Affinity AI |
| RF38 | Acessar & administrar a aba "Meus cupons promocionais" (marca/celebridade) e resgatar cupons Fashion AI na aba "Meus cupons resgatados" do lookbook | SealBond Matcher |
| RF39 | Criar componentes ou um guarda-roupa 3D inteiro com a identidade de uma marca/celebridade na aba "Criar guarda-roupa 3D" e vendê-los na loja do quarto | — |
| RNF5 |  | SealBond Matcher, Style Advisor |
| Dashboard gerencial |  | SealBond Matcher |
| RNF (admin) |  | SealBond Matcher, Style Advisor |

## Bancos por RF (o que o teste gravou)

| RF | Tabelas gravadas | Mídia | Projeções em produção |
|---|---|---|---|
| RF1 | audit_log, brand_profiles, notifications, refresh_tokens, seals, user_preferences, users, verification_codes | 2 | Cassandra notifications_by_user (caixa de entrada); S3 (avatar, capa); S3 (logo); S3 (ícone/arte do selo) |
| RF2 | audit_log, notifications, refresh_tokens, users, verification_codes | 0 | Cassandra notifications_by_user (caixa de entrada); S3 (avatar, capa) |
| RF3 | audit_log, data_export_requests, notifications, photos, refresh_tokens, user_consents, users, verification_codes | 3 | Cassandra notifications_by_user (caixa de entrada); S3 (arquivo original e versões); S3 (avatar, capa); S3 (pacote .zip) |
| RF4 | ai_inference_log, audit_log, brand_logos, fai_points_ledger, item_embeddings, moderation_queue, notifications, photos, pipeline_jobs, processing_jobs_log, quality_scores, room_layouts, room_storage_map, wardrobe_availability_log, wardrobe_items | 25 | Cassandra notifications_by_user (caixa de entrada); OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); Redis rate limit (cota diária de IA); S3 (arquivo original e versões); S3 (logo filtrado) |
| RF5 | ai_inference_log, audit_log, fai_points_ledger, item_embeddings, notifications, photos, piece_usage_diary, scheme_items, schemes, wardrobe_items | 1 | Cassandra notifications_by_user (caixa de entrada); OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card); Redis rate limit (cota diária de IA); S3 (arquivo original e versões) |
| RF6 | acervo_groups, ai_inference_log, audit_log, daily_looks, hype_groups, hype_score_metrics, metric_snapshots, saved_items, scheme_groupings, schemes, users, wardrobe_items | 0 | Cassandra timeline_by_user quando publicado; OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card); Redis rate limit (cota diária de IA); S3 (avatar, capa) |
| RF7 | audit_log, item_embeddings, room_storage_map, scheme_items, schemes, wardrobe_items | 0 | OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card) |
| RF8 | — | 0 | — |
| RF9 | ai_inference_log, audit_log, item_embeddings, schemes | 0 | OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card); Redis rate limit (cota diária de IA) |
| RF10 | ai_inference_log, audit_log, daily_looks, fai_points_ledger, item_embeddings, notifications, piece_usage_diary, scheme_items, schemes, wardrobe_items, week_plan_days, week_plans | 0 | Cassandra notifications_by_user (caixa de entrada); Cassandra timeline_by_user quando publicado; OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card); Redis rate limit (cota diária de IA) |
| RF11 | ai_inference_log, audit_log, photos, schemes, wardrobe_items | 1 | OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card); Redis rate limit (cota diária de IA); S3 (arquivo original e versões) |
| RF12 | ai_inference_log, audit_log, photos, wardrobe_items | 2 | OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); Redis rate limit (cota diária de IA); S3 (arquivo original e versões) |
| RF13 | ai_inference_log, audit_log, dna_scheme_items, dna_schemes, style_dna, style_dna_versions | 1 | Redis rate limit (cota diária de IA) |
| RF14 | audit_log | 0 | — |
| RF15 | item_embeddings, wardrobe_items | 0 | OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D) |
| RF16 | pipeline_jobs, wardrobe_items | 1 | OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D) |
| RF17 | audit_log, follows, notifications, users | 0 | Cassandra notifications_by_user (caixa de entrada); Redis contadores de seguidores; S3 (avatar, capa) |
| RF18 | ai_inference_log, audit_log, fai_points_ledger, item_embeddings, notifications, photos, scheme_items, schemes, user_preferences, wardrobe_items | 1 | Cassandra notifications_by_user (caixa de entrada); OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card); Redis rate limit (cota diária de IA); S3 (arquivo original e versões) |
| RF19 | comments, fai_points_ledger, notifications, reactions, saved_items, schemes, shares | 0 | Cassandra notifications_by_user (caixa de entrada); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card); Redis contadores por alvo |
| RF20 | ai_inference_log, audit_log, item_embeddings, notifications, piece_usage_diary, room_storage_map, scheme_items, schemes, seal_bonds, seals, wardrobe_availability_log, wardrobe_items | 0 | Cassandra notifications_by_user (caixa de entrada); OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card); Redis rate limit (cota diária de IA); S3 (ícone/arte do selo) |
| RF21 | ai_inference_log, audit_log, notifications, schemes, seal_bonds, seals | 0 | Cassandra notifications_by_user (caixa de entrada); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card); Redis rate limit (cota diária de IA); S3 (ícone/arte do selo) |
| RF22 | — | 0 | — |
| RF23 | audit_log, user_preferences | 0 | — |
| RF24 | brand_logos | 1 | S3 (logo filtrado) |
| RF25 | audit_log, promotions, seals | 1 | S3 (ícone/arte do selo) |
| RF26 | audit_log | 0 | — |
| RF27 | ai_inference_log, audit_log, fai_points_ledger, inventory_score_snapshots, room_layouts, room_storage_map | 0 | Redis rate limit (cota diária de IA) |
| RF28 | ai_inference_log, audit_log, daily_looks, fai_points_ledger, item_embeddings, mirror_states, notifications, piece_usage_diary, room_layouts, scheme_items, schemes, user_achievements, wardrobe_items | 0 | Cassandra notifications_by_user (caixa de entrada); Cassandra timeline_by_user quando publicado; OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card); Redis rate limit (cota diária de IA) |
| RF29 | inventory_score_snapshots, ranking_opt_ins | 0 | — |
| RF30 | room_catalog, room_inventory, room_layouts | 0 | S3 (logo e arte do guarda-roupa) |
| RF31 | wardrobe_availability_log, wardrobe_items | 0 | OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D) |
| RF32 | audit_log, challenge_events, challenge_instances, challenge_notes, challenge_participants, challenge_templates, challenge_votes, notifications, photos | 1 | Cassandra notifications_by_user (caixa de entrada); S3 (arquivo original e versões) |
| RF33 | — | 0 | — |
| RF34 | audit_log, scheme_groupings | 1 | — |
| RF35 | scheme_groupings | 1 | — |
| RF36 | audit_log, schemes, user_preferences, wardrobe_items | 2 | OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card) |
| RF37 | flair_coin_entries, flair_combinations, flair_match_entries, flair_matches, flair_mode_states, flair_profiles, flair_redemptions, flair_team_members, flair_teams, flair_territories | 0 | — |
| RF38 | coupon_rights, flair_coin_entries, flair_combinations, flair_profiles, flair_redemptions, notifications | 0 | Cassandra notifications_by_user (caixa de entrada) |
| RF39 | audit_log, room_catalog, room_inventory, room_layouts | 2 | S3 (logo e arte do guarda-roupa) |
| RNF10 | notifications, user_preferences | 0 | Cassandra notifications_by_user (caixa de entrada) |
| ADM | audit_log, backup_records, hype_groups, metric_snapshots, schemes, wardrobe_items | 1 | OpenSearch índice fai-pieces (busca); S3 (fotos, estúdio, 3D); OpenSearch índice fai-schemes (busca); Cassandra timeline_by_user (feed); Redis contadores (views/likes); S3 (capa, card); S3 (dump do MySQL) |
| DASH | sp_admin_kpis, sp_ai_cost_by_country, sp_timeseries, user_preferences | 0 | — |

## Bancos

| Banco | Guarda | Neste ambiente |
|---|---|---|
| MySQL 8 | Fonte da verdade de todas as entidades (Flyway V1–V21) | sempre ligado |
| Redis | Contadores (views, likes), rate limit e cota de IA | REDIS_ENABLED (desligado aqui → memória local) |
| Cassandra | timeline_by_user (feed) e notifications_by_user | CASSANDRA_ENABLED (desligado aqui → consulta no MySQL) |
| OpenSearch | Índices fai-pieces e fai-schemes (busca) | OPENSEARCH_ENABLED (desligado aqui → busca no MySQL) |
| S3 / MinIO | Mídia: fotos, cards, logos, modelos 3D, exportações, backups | STORAGE_TYPE=s3 (aqui: disco local) |
