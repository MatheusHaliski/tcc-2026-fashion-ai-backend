# Taxonomia de entidades do FashionAI

> Gerado por `scripts/docs/taxonomia_entidades.py` a partir do código em 2026-10-05. As contagens são calculadas; o único conteúdo manual é o agrupamento por área. Para atualizar, rode o script de novo.

Numeração de RF = a do **Trello** (código RF32→RF27, RF33 do espelho→RF28, RF34→RF29, RF35→RF30, RF36→RF32, RF4 da captura V29→RF45; tabela em [`docs/novos-rf/README.md`](../novos-rf/README.md)). Visão complementar, por contexto delimitado, com migração de origem e enum de ciclo de vida de cada entidade: [`docs/entidades/TAXONOMIA_ENTIDADES.md`](../entidades/TAXONOMIA_ENTIDADES.md). Esta aqui traz contagens, campos, relações JPA, enums com valores e as entidades embutidas em JSON.

## Resumo

| Medida | Valor |
|---|---|
| Entidades persistidas (JPA, MySQL) | 107 |
| Áreas de negócio | 14 |
| Campos (somados) | 1315 |
| Relações JPA (ManyToOne/OneToOne/…) | 71 |
| Enums de domínio | 97 |
| Categorias de peça · subcategorias | 5 · 78 |
| Cores · famílias | 59 · 12 |
| Ocasiões · estilos | 20 · 25 |
| Entidades sem área (devem ser 0) | 0 |

Bases abstratas: `AuditableEntity` (id UUID, criado/atualizado em/por — RNF5) e `VersionedAuditableEntity` (+ `@Version`, concorrência otimista para agregados mutáveis). Mapa visual: `taxonomia-de-entidades.puml/.png`.

## Áreas e entidades

### Identidade, conta e privacidade  ·  RF1–RF3, RF23, RNF2/RNF6  ·  6 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **User** | `users` | versionada | 32 | — | Conta do usuário (RF1/RF2/RF3/RF23). Dados pessoais identificadores ficam cifrados em repouso (RNF3); e-mail tem hash determinístico para unicidade e login sem expor o valor. |
| **UserPreferences** | `user_preferences` | versionada | 25 | user → User | RF23 — preferências de interface e de uso. Não são dado pessoal (doc LGPD do RNF6): salvam direto, sem reautenticação, persistidas no servidor e replicadas entre dispositivos (CA16-CA18, last-write-wins por #clientUpdate… |
| **UserConsent** | `user_consents` | versionada | 7 | user → User | RF3.CA16-CA21 e RF24.CA15 — consentimento por finalidade. Estado atual por (usuário, finalidade); cada manifestação/revogação também vira evento em audit_log (CA18: data e hora da manifestação). |
| **VerificationCode** | `verification_codes` | versionada | 9 | user → User | Código/link transacional (confirmação de e-mail, troca de e-mail, 2FA, redefinição de senha). Só o hash do código é persistido; o destino novo (troca de e-mail) fica cifrado (RNF3). |
| **RefreshToken** | `refresh_tokens` | versionada | 12 | user → User | RNF2 — refresh token rotativo (armazenado só como hash). Cada família representa uma sessão ativa exibida em "Sessões ativas" (RF3.CA32); logout invalida no servidor (RF3.CA31). |
| **DataExportRequest** | `data_export_requests` | versionada | 5 | user → User | RF3.CA22-CA23 — exportação dos dados do titular em JSON (Art. 18, V — portabilidade). |

### Perfis emissores (marca e celebridade)  ·  RF1.CA06–CA10, RF14, RF20–RF22  ·  2 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **BrandProfile** | `brand_profiles` | versionada | 29 | owner → User | Perfil empresarial de marca (RF1.CA06-CA07, RF14, RF20). Aprovação depende de administrador; CNPJ e contato comercial ficam cifrados (RNF3). #requiresSealReview é o CA07 do RF20. |
| **CelebrityProfile** | `celebrity_profiles` | versionada | 28 | owner → User | Perfil de celebridade (RF1.CA09-CA10, RF21, RF22). Só celebridades verificadas entram no pool de sugestão de vínculo (RF21.CA18). A assinatura de estilo (CA17) guarda paleta/arquétipo/estilos — atmosfera, nunca retrato (… |

### Guarda-roupa e peças  ·  RF4, RF6, RF7, RF9, RF28, RF29, RF31, RF45  ·  12 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **WardrobeItem** | `wardrobe_items` | versionada | 75 | user → User, brandProfile → BrandProfile, brand → Brand | ClothesPiece (taxonomia §02) — peça do guarda-roupa (RF4, RF6, RF7, RF9, RF18). Campos de formulário, de sistema (pipeline Flat Lay, moderação, contadores sociais, hype score) e de lineage de remix. Listas curtas (occasi… |
| **PieceImage** | `piece_images` | versionada | 28 | — | RF4 · Asset de imagem da peça. ORIGINAL nunca é sobrescrito (chave única); os demais derivam dele. |
| **PieceUsageDiaryEntry** | `piece_usage_diary` | — | 9 | — | DET-C07 / DET-M04 — Diário da Peça: cada uso com data, ocasião e nota (1× por dia). |
| **WardrobeAvailabilityChange** | `wardrobe_availability_log` | — | 5 | — | RF34 §3.3 — histórico de transições disponível/indisponível (população de exposição da Utilização). |
| **CaptureSession** | `capture_sessions` | versionada | 15 | — | RF4 · Sessão progressiva de captura: uma foto obrigatória e complementares só quando aumentam a confiança. |
| **CaptureRequest** | `capture_requests` | versionada | 12 | — | RF4 · Pedido de foto complementar com propósito explícito; Pular nunca bloqueia o cadastro. |
| **QualityScore** | `quality_scores` | auditável | 9 | — | RFC RF4 — QualityScore: métricas por etapa do Flat Lay, aceite e recomendações de reenvio. |
| **AiReviewItem** | `ai_review_items` | versionada | 18 | — | RF4 · Revisão de IA: AI decision · user correction · admin decision · final value (alimenta o active learning). |
| **GarmentLandmark** | `garment_landmarks` | versionada | 7 | — | RF4 · Landmark da peça numa imagem (coordenadas normalizadas), com o modelo que o produziu. |
| **GarmentEmbedding** | `garment_embeddings` | versionada | 9 | — | RF4 · Embedding visual por imagem e versão de modelo; só com consentimento de treinamento. |
| **ItemEmbedding** | `item_embeddings` | versionada | 6 | — | Embedding vetorial por peça/esquema (Acervo Grouping #13, Affinity #14, Photo Curator #19). |
| **BrandPrediction** | `brand_predictions` | versionada | 8 | — | RF4 · Saída do ensemble por nível (marca, linha, modelo…), com evidências e alternativas. |

### Marcas e catálogo global  ·  RF4, RF47  ·  12 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **Brand** | `brands` | versionada | 11 | brandProfile → BrandProfile | Catálogo de marcas referenciado por ClothesPiece.brandId (taxonomia §brand). SEEDED = carga inicial; AUTO_DETECTED = criado pelo Brand Resolver (RF24) somente após regex + dedup + validação externa — nunca por omissão. |
| **BrandAlias** | `brand_aliases` | versionada | 3 | — | RF47 · Apelido de marca ("PRL" → Ralph Lauren): normalização sem marca duplicada. |
| **BrandLogo** | `brand_logos` | versionada | 11 | — | Logo de marca encontrado na internet (Wikidata, busca na web pela IA ou ícone do site oficial) e guardado no storage próprio. A chave é o nome normalizado, então serve tanto para marcas do catálogo quanto para o texto li… |
| **CatalogSource** | `catalog_sources` | versionada | 7 | — | RF47 · Fonte oficial/autorizada de uma marca (domínio) e se ela permite guardar cópia das imagens. |
| **CatalogProduct** | `catalog_products` | versionada | 29 | — | RF47 · Produto global conhecido pelo FashionAI (≠ WardrobeItem, a posse por uma pessoa). |
| **CatalogProductAlias** | `catalog_product_aliases` | versionada | 3 | — | RF47 · Apelido de produto ("AF1" → Air Force 1). |
| **CatalogVariant** | `catalog_variants` | versionada | 8 | — | RF47 · Variante de um produto (cor, código, SKU). |
| **CatalogImage** | `catalog_images` | versionada | 13 | — | RF47 · Foto oficial com proveniência; REFERENCE_ONLY guarda só a URL autorizada. |
| **CatalogIngestionRun** | `catalog_ingestion_runs` | versionada | 12 | — | RF47 · Execução do pipeline de ingestão do catálogo (auditoria). |
| **KbBrandSignature** | `kb_brand_signatures` | versionada | 9 | — | RF4 · Base de conhecimento: sinal visual/textual característico de uma marca. |
| **KbProductLine** | `kb_product_lines` | versionada | 4 | — | RF4 · Base de conhecimento: linha de produto de uma marca. |
| **KbProductModel** | `kb_product_models` | versionada | 8 | — | RF4 · Base de conhecimento: modelo de produto (tokens de OCR e padrão de código). |

### Esquemas (looks), DNA e planejamento  ·  RF5–RF7, RF11, RF13, RF28 (Vista-me), HU18–HU20  ·  14 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **Scheme** | `schemes` | versionada | 55 | user → User, originalScheme → Scheme | ClothesScheme (taxonomia §03) — esquema de vestimenta (RF5, RF6, RF7, RF9, RF11, RF18, RF19, RF20/21). occasion/style guardam até 3 valores (CSV), sealIds até 4 (JSON). A configuração completa do Background Studio (RF11:… |
| **SchemeItem** | `scheme_items` | auditável | 13 | scheme → Scheme, wardrobeItem → WardrobeItem | Peça posicionada no esquema (taxonomia §03 — SchemeItem): slot, transformação (zIndex, posição, escala, rotação, opacidade) e filtros de imagem do pipeline RF5 (blur, saturation, brightness, contrast, hue_shift) em filte… |
| **SchemeGrouping** | `scheme_groupings` | versionada | 10 | owner → User | SchemeGrouping (taxonomia §07, RF14/RF22) — coleção/promoção/série/era/fase/temporada/turnê. |
| **DnaScheme** | `dna_schemes` | versionada | 34 | user → User | DNAScheme (taxonomia §04, RF13) — conjunto de 2 a 6 esquemas do próprio usuário com uma narrativa de exibição (11 variações). archetype é sintetizado pela IA e restrito aos 5 arquétipos de Kibbe. |
| **DnaSchemeItem** | `dna_scheme_items` | auditável | 8 | dnaScheme → DnaScheme, scheme → Scheme | Célula do DNA (taxonomia §04 — DNASchemeItem): referencia um ClothesScheme inteiro, não uma peça. |
| **StyleDna** | `style_dna` | versionada | 16 | user → User | Resumo vigente do DNA de Estilo do usuário (um por conta): arquétipo, paleta e frase de identidade sintetizados a partir do DNA mais recente. Alimenta a ordenação por afinidade (RF24.CA6) e o Copilot. |
| **StyleDnaVersion** | `style_dna_versions` | — | 4 | — | HU20 — versionamento do DNA por data de geração (sem a Camada 2, que fica só cifrada em style_dna). |
| **DailyLook** | `daily_looks` | versionada | 6 | user → User, scheme → Scheme, materializedFrom → DailyLook | saiDailyLooks (RF6 §1) — registro datado do Look do Dia: fonte de verdade para histórico, continuidade na virada do dia (materialização lazy) e comparação com o dia anterior. |
| **HypeScoreMetric** | `hype_score_metrics` | versionada | 23 | dailyLook → DailyLook, scheme → Scheme, user → User | — |
| **WeekPlan** | `week_plans` | versionada | 4 | user → User | HU18 — Semana Planejada: sete looks sem repetição de combinação, com lacunas sugeridas. |
| **WeekPlanDay** | `week_plan_days` | auditável | 9 | weekPlan → WeekPlan, scheme → Scheme | HU18 — um dia da semana planejada (evento, ocasião e combinação de peças). |
| **AcervoGroup** | `acervo_groups` | versionada | 7 | user → User | AcervoGroup (RF6 — Acervo Grouping AI): cluster local do acervo de UM usuário, nunca cruza donos (RNF6). |
| **HypeGroup** | `hype_groups` | versionada | 10 | — | HypeGroup (RF6 §8/§9) — itens semelhantes entre usuários (Sim ≥ 0,70) e média do Hype Score pessoal. |
| **MirrorState** | `mirror_states` | auditável | 4 | — | RF33 / DET-D05 — look pendurado no espelho entre sessões e combinações já exibidas (RF33.CA13). |

### Selos, promoções e cupons  ·  RF20, RF21, RF25, RF38  ·  5 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **Seal** | `seals` | versionada | 13 | owner → User | Seal (taxonomia §07, RF14/RF25) — selo de marca ou celebridade. O visual (têxtil/dourado vs. vítreo/holográfico) deriva de owner.profileType; a janela de disponibilidade e o limite de uso atendem RNF12. A arte de fundo d… |
| **SealBond** | `seal_bonds` | versionada | 18 | scheme → Scheme, targetOwner → User, requestedBy → User, seal → Seal | SealBond (taxonomia §07, RF20/RF21) — vínculo esquema × marca/celebridade, da sugestão da IA até a emissão do selo: SUGGESTED → ACCEPTED/EDITED/REFUSED → PENDING_REVIEW → APPROVED/REJECTED. Mudança de estado gera auditor… |
| **Promotion** | `promotions` | versionada | 21 | seal → Seal, sealBond → SealBond | Promotion (taxonomia §07, RF20.CA11-CA15 / RF21.CA21-CA23 / RNF12) — promoção resgatável por selo. |
| **PromotionRedemption** | `promotion_redemptions` | auditável | 9 | promotion → Promotion, sealBond → SealBond, user → User | RF20.CA12 / RF21.CA22 — resgate de promoção: código único de uso único, emissor e (quando houver) marca parceira executora; cupons resgatados sobrevivem à revogação do selo até a própria validade (CA14). |
| **CouponRight** | `coupon_rights` | versionada | 10 | user → User, owner → User | Direito promocional (card Trello RF38): o usuário conquistou, usando o app, o direito a um cupom de uma marca ou celebridade (selo com política de promoção do RF25, combinação FLAIR…). PENDENTE → RESGATADO (cupom emitido… |

### Social e notificações  ·  RF8, RF12, RF19, RNF10  ·  7 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **Follow** | `follows` | versionada | 4 | follower → User, following → User | Vínculo social (RF6/RF8/RF17/RF22): PENDENTE quando a conta alvo é privada, ACEITO quando aprovado. |
| **Comment** | `comments` | versionada | 6 | author → User | RF19.CA04-CA07 — comentário (modal ancorado) com respostas aninhadas; conteúdo cifrado (RNF3). |
| **Reaction** | `reactions` | versionada | 4 | actor → User | RF19.CA01-CA03/CA18 — curtida e reações qualitativas (trend/elegante/criativo), uma por tipo e usuário. |
| **Share** | `shares` | versionada | 6 | user → User | RF19.CA08/CA09 — compartilhamento no feed interno (referencia o original) ou exportação para rede externa. |
| **SavedItem** | `saved_items` | auditável | 5 | user → User | SavedItem (taxonomia §social) — botão "Adicionar ao guarda-roupa" (RF19): bookmark de peça/esquema público de terceiro, alimenta "Looks Salvos"/"Peças Salvas" (RF6). Nunca clona o item. |
| **Notification** | `notifications` | versionada | 12 | recipient → User, actor → User | RNF10 — notificação in-app (sino do topbar). Fonte de verdade no MySQL; a projeção de entrega em escala (inbox por destinatário, TTL de 90 dias — RF3.CA37) vive no Cassandra. |
| **Photo** | `photos` | versionada | 19 | user → User | RF12 "Minhas Fotos" — metadados de cada fotografia do acervo (binário no S3/MinIO). Guarda origem, hash, dimensões, qualidade (alimenta o Photo Curator AI), momento-chave e última visualização. |

### Gamificação (FAI Points, desafios, rankings)  ·  RF29, RF30, RF32, RF41  ·  12 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **FaiPointsLedgerEntry** | `fai_points_ledger` | — | 9 | — | RF35.CA01 — ledger append-only com chave de idempotência (user_id, action_code, ref_id). |
| **FaiPointsRule** | `fai_points_rules` | — | 7 | — | RF35 §5.2 — regra de ganho por ação, com limite diário/semanal. |
| **ChallengeTemplate** | `challenge_templates` | — | 15 | — | RF36 §2 — catálogo de desafios (modos, duração, dimensões do score, recompensa). |
| **ChallengeInstance** | `challenge_instances` | — | 14 | — | RF36 §3 — instância do desafio (rascunho → aguardando → ativo → concluído/expirado). |
| **ChallengeParticipant** | `challenge_participants` | — | 11 | — | RF36 — participante: equipe (duelo de equipes), status, meta pessoal proporcional e fração cumprida. |
| **ChallengeEvent** | `challenge_events` | — | 7 | — | RF36 §4 — evidência verificável do progresso (esquema, look do dia, peça resgatada). |
| **ChallengeNote** | `challenge_notes` | — | 7 | — | RF36 §6 — reações (6 emojis fixos) e bilhetes (frase pronta ou texto livre ≤ 80, moderado). Sem chat livre. |
| **ChallengeVote** | `challenge_votes` | — | 6 | — | RF36.CA08 — voto às cegas (único por votante/entrada). |
| **UserAchievement** | `user_achievements` | — | 5 | — | RF34 §4.3 / DET-G03 — conquista concedida uma única vez (idempotente). |
| **RankingOptIn** | `ranking_opt_ins` | — | 5 | — | RF34.CA08 — participação em rankings por opt-in (cidade só com consentimento explícito). |
| **RankingPosition** | `ranking_positions` | — | 8 | — | RF34 §6 — posição materializada por segmento (fatia superior inclusiva). |
| **InventoryScoreSnapshot** | `inventory_score_snapshots` | — | 9 | — | RF34 §7 — snapshot diário/mensal do Inventory Score (evolução, Rising Wardrobe, conquistas). |

### FLAIR (jogo de cartas)  ·  RF37  ·  11 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **FlairProfile** | `flair_profiles` | versionada | 8 | user → User | FLAIR — perfil de jogo: coins, pontos de rank, vitórias e skins de carta (cosméticas). |
| **FlairCoinEntry** | `flair_coin_entries` | versionada | 4 | user → User | FLAIR — extrato de coins; (motivo, referência) única por usuário: recompensa não paga duas vezes. |
| **FlairCombination** | `flair_combinations` | versionada | 23 | brand → User | FLAIR — combinação definida pela loja (aba "Minhas combinações FLAIR" do perfil RF14/RF22) que completa um jogo e dá cupom. |
| **FlairMatch** | `flair_matches` | versionada | 9 | createdByUser → User | FLAIR — partida: duelo 1×1, batalha de ocasião do dia, duelo de equipes 3×3 ou treino contra a Casa. |
| **FlairMatchEntry** | `flair_match_entries` | versionada | 7 | match → FlairMatch, user → User, scheme → Scheme | FLAIR — deck inscrito numa partida (lado A/B ou SOLO na batalha de ocasião). |
| **FlairModeState** | `flair_mode_states` | versionada | 4 | user → User | FLAIR — estado de um jogador num modo e temporada (liga, World Tour, deck de 12 cartas, Ultimate Team…). |
| **FlairRedemption** | `flair_redemptions` | versionada | 8 | combination → FlairCombination, user → User, scheme → Scheme | FLAIR — cupom emitido quando o deck completa a combinação da loja (um por pessoa e combinação). |
| **FlairTeam** | `flair_teams` | versionada | 5 | owner → User | FLAIR — equipe para os duelos de equipes 3×3 e a liga semanal. |
| **FlairTeamMember** | `flair_team_members` | versionada | 3 | team → FlairTeam, user → User | FLAIR — integrante de equipe (uma equipe por pessoa). |
| **FlairTerritory** | `flair_territories` | versionada | 6 | owner → User | FLAIR — território do Fashion Monopoly (distritos e boutiques) e do Conquest (regiões de estilo). |
| **FlairTrophy** | `flair_trophies` | versionada | 5 | user → User | FLAIR — troféu exibido no perfil (FLAIR Runway Winner, campeão da liga, território conquistado…). |

### Quarto 3D e avatar  ·  RF27, RF30, RF39, RF40  ·  6 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **RoomCatalogItem** | `room_catalog` | — | 24 | — | RF35 §5.4 — Molde + Acabamento = SKU da loja do quarto. |
| **RoomInventoryItem** | `room_inventory` | — | 7 | — | RF35 — itens da loja adquiridos pelo usuário (compra com saldo ou recompensa). |
| **RoomLayout** | `room_layouts` | versionada | 5 | user → User | RF32/RF35 — layout do quarto: nível, módulos aplicados e rótulos das gavetas. |
| **RoomStorageEntry** | `room_storage_map` | auditável | 4 | — | RF32 §1.1 — endereço estável de cada peça no quarto (door:{n}/hanger:{n}, drawer:{n}, top:{n}, base:{n}, shoe:{n}, chair, basket). |
| **UserAvatar3d** | `user_avatars_3d` | versionada | 15 | user → User | RF40 — Meu Avatar 3D: o rosto/busto da própria pessoa (forma em pose neutra + pele + cabelo medidos na foto), confirmado por ela. A textura do rosto (atlas) é biométrica: fica em chave privada do storage e só sai pela AP… |
| **AvatarIdentityVersion** | `avatar_identity_versions` | versionada | 15 | user → User | AVATAR-ID I1 — uma versão da identidade do avatar (o CanonicalAvatarIdentity versionado da auditoria de identidade). Cada reconstrução ou correção cria uma versão nova; refazer não apaga a versão aprovada. A textura do r… |

### IA, visão computacional e pipelines  ·  RF4, RF11, RF16, RF18, RF24, RF45  ·  10 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **AiInferenceLog** | `ai_inference_log` | — | 15 | — | RF24.CA16 — ai_inference_log: usuário, função, provedor, modelo, latência, custo estimado e resultado. inputSummaryJson descreve QUAIS dados alimentaram a inferência (CA12 "por quê?") — nunca foto, senha, token ou conteú… |
| **ModelInference** | `model_inferences` | versionada | 9 | — | RF4 · Qual modelo/versão produziu cada resultado de visão (além do ai_inference_log dos LLMs). |
| **ModelRegistryEntry** | `model_registry` | versionada | 10 | — | RF4 · Model Registry: modelo versionado com dataset, métricas e status de deploy. |
| **DatasetSource** | `dataset_sources` | versionada | 8 | — | RF4 · Proveniência e licença de uma fonte de dados de treinamento. |
| **TrainingCandidate** | `training_candidates` | versionada | 13 | — | RF4 · Candidato ao dataset (Garment Vision ou Hard Examples), com consentimento e licença. |
| **PipelineJob** | `pipeline_jobs` | versionada | 22 | user → User | Job assíncrono (RF4 Flat Lay, RF18 render híbrido, RF5 render do card, RF11 geração de arte, RF24). Estado canônico no MySQL (máquina de estados); o disparo vai para a fila (Redis Streams). Cada etapa registra provedor, … |
| **ProcessingJobLog** | `processing_jobs_log` | — | 15 | — | RFC RF4 — processing_jobs_log: linha append-only por job de padronização concluído (auditoria/custo). |
| **RenderJobLog** | `render_jobs_log` | — | 16 | — | RFC RF18 — render_jobs_log: linha append-only por renderização do provador 2D (custo por provedor). |
| **MetricSnapshot** | `metric_snapshots` | — | 6 | — | Agregados periódicos (RFC RF4 quality_metrics e RF18 rendering_costs) unificados por #kind: QUALITY (aceite/tempo/score médio do Flat Lay) ou RENDER_COST (renders, custo por provedor, média). |
| **AssetPreset** | `asset_presets` | — | 14 | — | Catálogo visual do RF11/RF23 (presets AURA, materiais, combinações, mosaicos, fundos do chrome, gradientes Aura, presets sazonais, skins). Semeado a partir de catalog/asset-manifest.json (scripts/assets/build_asset_catal… |

### HypeScore v2 (sinais, recortes e marcos)  ·  RF26, RF53  ·  4 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **HypeSignalDaily** | `hype_signal_daily` | — | 8 | — | HypeScore v2 — agregado diário de um sinal por entidade (EntityInteractionAggregate). weightedCount aplica o peso da política de integridade (ex.: conta nova pesa menos); eventCount é a contagem bruta aceita. |
| **HypeScoreCurrent** | `hype_scores` | — | 26 | — | HypeScore v2 — estado atual de uma entidade para uma versão do algoritmo (read model). Os cards leem esta tabela em lote; o histórico fica em HypeScoreSnapshot. publicEligible = a entidade pode entrar em ranking, tendênc… |
| **HypeScoreSnapshot** | `hype_score_snapshots` | — | 13 | — | HypeScore v2 — ponto da série histórica (1 por entidade, versão do algoritmo e dia). Nunca é sobrescrito por outra versão: trocar pesos ou fórmula gera uma nova algorithmVersion (HYPE_V2, HYPE_V3…) e séries separadas. |
| **HypeMilestone** | `hype_milestones` | — | 14 | — | RF53 · P1-10 — marco de Hype já alcançado por uma peça ou look (tabela hype_milestones). Serve de dedupe: cada entidade notifica cada marco no máximo uma vez, então a oscilação na borda de uma faixa (o recálculo ao vivo … |

### FashionAI Lens  ·  RF54  ·  3 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **LensScan** | `lens_scans` | versionada | 19 | — | RF54 · FashionAI Lens — um scan por imagem (camada estável: a foto e o que foi lido nela). É sempre privado: só o dono vê, nunca entra em ranking, Hype nem estatística pública. A imagem fica em chave privada (restricted/… |
| **LensDetection** | `lens_detections` | versionada | 20 | — | RF54 · Uma peça encontrada no scan (caixa em % da imagem + atributos da taxonomia). Correções da pessoa sobrescrevem os atributos (o antes/depois fica em lens_feedback); o embedding visual do recorte fica, para a semelha… |
| **LensFeedback** | `lens_feedback` | auditável | 7 | — | RF54 · Correção de uma peça detectada: o que a leitura disse e o que a pessoa corrigiu. Só entra no conjunto de avaliação com training_consent (consentimento AI_MODEL_TRAINING no momento da correção). |

### Moderação, auditoria e operação  ·  RN11, RNF4, RNF5  ·  3 entidades

| Entidade | Tabela | Base | Campos | Relações | Papel (Javadoc) |
|---|---|---|---|---|---|
| **ModerationQueueItem** | `moderation_queue` | versionada | 10 | — | RN11 / RF24 funil de moderação — item roteado à fila humana ("fail-to-queue para decisão"). |
| **AuditLog** | `audit_log` | — | 10 | — | — |
| **BackupRecord** | `backup_records` | — | 9 | — | RNF4 — registro de cada backup/restauração executado por scripts/backup (rotina + teste de restore). |

## Campos por entidade

Lista completa dos campos de cada entidade (além de `id`, datas e autoria herdados da base).

<details><summary><b>Identidade, conta e privacidade</b></summary>

- **User** — `username`: String; `displayName`: String; `email`: String; `emailHash`: String; `emailVerified`: boolean; `phone`: String; `birthDate`: String; `passwordHash`: String; `profileType`: ProfileType ◆; `role`: String; `status`: AccountStatus ◆; `accountOrigin`: AccountOrigin ◆; `fixtureKey`: String; `testAccountColumn`: Boolean; `avatarUrl`: String; `coverUrl`: String; `bio`: String; `privateAccount`: boolean; `verified`: boolean; `twoFactorEnabled`: boolean; `country`: String; `interfaceBackgroundPresetId`: String; `lookDoDiaPanelVersion`: HypeScorePanelVersion ◆; `lastLoginAt`: Instant; `termsAcceptedAt`: Instant; `termsVersion`: String; `deletionRequestedAt`: Instant; `deletionScheduledFor`: Instant; `profileVisibility`: Visibility ◆; `runwayOptOut`: boolean; `pronouns`: String; `linksJson`: String
- **UserPreferences** — `user`: User ⟶; `theme`: ThemeMode ◆; `language`: UiLanguage ◆; `density`: UiDensity ◆; `fontScale`: int; `highContrast`: boolean; `reduceMotion`: boolean; `chromeBackgroundId`: String; `sizeSystem`: SizeSystem ◆; `unitSystem`: UnitSystem ◆; `mannequinSex`: MannequinSex ◆; `mannequinSkinTone`: String; `mannequinBuild`: BodyBuild ◆; `contentContainerColor`: String; `defaultCardSkin`: String; `notificationPushMaster`: boolean; `notificationPrefsJson`: String; `clientUpdatedAt`: Instant; `purchaseSuggestionsEnabled`: boolean; `soundEnabled`: boolean; `hapticsEnabled`: boolean; `coreAesthetic`: String; `lifeIdentityInAi`: boolean; `dashboardLayoutJson`: String; `mannequinFaceJson`: String
- **UserConsent** — `user`: User ⟶; `purpose`: ConsentPurpose ◆; `granted`: boolean; `legalBasis`: String; `policyVersion`: String; `grantedAt`: Instant; `revokedAt`: Instant
- **VerificationCode** — `user`: User ⟶; `purpose`: VerificationPurpose ◆; `codeHash`: String; `target`: String; `expiresAt`: Instant; `consumedAt`: Instant; `attempts`: int; `sendCount`: int; `lastSentAt`: Instant
- **RefreshToken** — `user`: User ⟶; `tokenHash`: String; `familyId`: UUID; `expiresAt`: Instant; `revokedAt`: Instant; `rotatedFromId`: UUID; `createdIp`: String; `userAgent`: String; `deviceName`: String; `locationApprox`: String; `lastUsedAt`: Instant; `persistent`: boolean
- **DataExportRequest** — `user`: User ⟶; `status`: ExportStatus ◆; `fileKey`: String; `readyAt`: Instant; `expiresAt`: Instant

</details>

<details><summary><b>Perfis emissores (marca e celebridade)</b></summary>

- **BrandProfile** — `owner`: User ⟶; `brandName`: String; `slug`: String; `logoUrl`: String; `coverUrl`: String; `bio`: String; `storeUrl`: String; `cnpj`: String; `razaoSocial`: String; `nomeFantasia`: String; `fashionCategory`: String; `commercialContact`: String; `officialHashtag`: String; `activityProofUrl`: String; `approvalStatus`: ApprovalStatus ◆; `source`: BrandSource ◆; `verificationScore`: BigDecimal; `verificationNotes`: String; `approvedBy`: UUID; `approvedAt`: Instant; `identityVerified`: boolean; `documentVerified`: boolean; `requiresSealReview`: boolean; `country`: String; `reviewAttempts`: int; `reviewSubmittedAt`: Instant; `reviewReasons`: String; `reviewChecklist`: String; `reviewOwnerMessage`: String
- **CelebrityProfile** — `owner`: User ⟶; `stageName`: String; `slug`: String; `avatarUrl`: String; `coverUrl`: String; `bio`: String; `realName`: String; `areasJson`: String; `verifiableFollowersJson`: String; `identityProofUrl`: String; `verificationUrl`: String; `professionalHistory`: String; `representationContact`: String; `fashionInterestsJson`: String; `styleSignatureJson`: String; `verificationStatus`: ApprovalStatus ◆; `verificationScore`: BigDecimal; `verificationNotes`: String; `approvedBy`: UUID; `approvedAt`: Instant; `identityVerified`: boolean; `sealConsentGranted`: boolean; `requiresSealReview`: boolean; `reviewAttempts`: int; `reviewSubmittedAt`: Instant; `reviewReasons`: String; `reviewChecklist`: String; `reviewOwnerMessage`: String

</details>

<details><summary><b>Guarda-roupa e peças</b></summary>

- **WardrobeItem** — `user`: User ⟶; `brandProfile`: BrandProfile ⟶; `brand`: Brand ⟶; `name`: String; `category`: String; `subcategory`: String; `sex`: String; `brandName`: String; `brandLogoUrl`: String; `brandSource`: String; `brandRef`: String; `color`: String; `material`: String; `sizeLabel`: String; `market`: String; `styleTags`: String; `occasionTags`: String; `sealIdsJson`: String; `imageUrl`: String; `originalImageUrl`: String; `thumbnailUrl`: String; `defaultImage`: boolean; `aiGeneratedImage`: boolean; `imageHash`: String; `imageMimetype`: String; `imageFileSize`: Long; `price`: BigDecimal; `visibility`: Visibility ◆; `disponivel`: boolean; `availabilityStatus`: AvailabilityStatus ◆; `condition`: ItemCondition ◆; `favorite`: boolean; `forSale`: boolean; `forDonation`: boolean; `wearCount`: int; `lastWornDate`: LocalDate; `lookDoDiaCount`: int; `schemeUsageCount`: int; `likesCount`: long; `sharesCount`: long; `remixesCount`: long; `commentCount`: long; `viewCount`: long; `moderationStatus`: ModerationStatus ◆; `moderationConfidence`: BigDecimal; `moderationReasonsJson`: String; `photoProcessingStatus`: PhotoProcessingStatus ◆; `photoQualityScoresJson`: String; `processingJobId`: UUID; `processingTimeMs`: Integer; `flatLayMetadataJson`: String; `backgroundConfigJson`: String; `hypeScore`: BigDecimal; `hypeScoreGlobal`: BigDecimal; `hypeGroupId`: UUID; `remixedFromPieceId`: UUID; `groupingId`: UUID; `tags`: String; `notes`: String; `purchaseDate`: LocalDate; `purchaseLocation`: String; `sku`: String; `careInstructions`: String; `model3dStatus`: Model3dStatus ◆; `model3dUrl`: String; `studioImageUrl`: String; `studioBackdrop`: String; `studioDetailUrl`: String; `canonicalImageUrl`: String; `userImageUrl`: String; `model3dGeneratedAt`: Instant; `lastViewedAt`: Instant; `pieceOrigin`: String; `mannequinImageUrl`: String; `mannequinImageFace`: String
- **PieceImage** — `sessionId`: UUID; `pieceId`: UUID; `userId`: UUID; `imageType`: PieceImageType ◆; `viewType`: CaptureView ◆; `captureRole`: CaptureRole ◆; `capturePurpose`: CapturePurpose ◆; `captureSource`: CaptureSource ◆; `storageKey`: String; `url`: String; `mimeType`: String; `width`: int; `height`: int; `orientation`: String; `bytesSize`: Long; `sha256`: String; `qualityScore`: Integer; `blurScore`: BigDecimal; `lightingScore`: BigDecimal; `garmentCoverage`: BigDecimal; `detectedCategory`: String; `detectedSubcategory`: String; `photographySpec`: String; `derivedFromId`: UUID; `processingStatus`: PieceImageStatus ◆; `modelVersion`: String; `analysisJson`: String; `superseded`: boolean
- **PieceUsageDiaryEntry** — `id`: UUID; `wardrobeItemId`: UUID; `userId`: UUID; `usedOn`: LocalDate; `occasion`: String; `note`: String; `source`: String; `schemeId`: UUID; `createdAt`: Instant
- **WardrobeAvailabilityChange** — `id`: UUID; `wardrobeItemId`: UUID; `userId`: UUID; `available`: boolean; `changedAt`: Instant
- **CaptureSession** — `userId`: UUID; `draftJobId`: UUID; `category`: String; `subcategory`: String; `profileId`: String; `primaryView`: CaptureView ◆; `status`: CaptureSessionStatus ◆; `identifyModel`: boolean; `complementaryCount`: int; `consecutiveSkips`: int; `identificationJson`: String; `decisionJson`: String; `qualityJson`: String; `pieceId`: UUID; `completedAt`: Instant
- **CaptureRequest** — `sessionId`: UUID; `viewType`: CaptureView ◆; `purpose`: CapturePurpose ◆; `need`: CaptureNeed ◆; `reasonCode`: String; `dominantSignal`: String; `expectedGain`: BigDecimal; `status`: CaptureRequestStatus ◆; `fulfilledImageId`: UUID; `confidenceBefore`: BigDecimal; `confidenceAfter`: BigDecimal; `resolvedAt`: Instant
- **QualityScore** — `wardrobeItemId`: UUID; `pipelineJobId`: UUID; `metricsJson`: String; `overall`: BigDecimal; `accepted`: boolean; `acceptanceThreshold`: BigDecimal; `issuesJson`: String; `recommendationsJson`: String; `expiresAt`: Instant
- **AiReviewItem** — `kind`: AiReviewKind ◆; `status`: AiReviewStatus ◆; `sessionId`: UUID; `pieceId`: UUID; `imageId`: UUID; `userId`: UUID; `field`: String; `aiValue`: String; `aiConfidence`: BigDecimal; `aiModel`: String; `userValue`: String; `adminDecision`: AiReviewDecision ◆; `adminValue`: String; `finalValue`: String; `reviewerId`: UUID; `reviewedAt`: Instant; `addToTraining`: boolean; `hardExampleTags`: String
- **GarmentLandmark** — `imageId`: UUID; `name`: String; `x`: BigDecimal; `y`: BigDecimal; `confidence`: BigDecimal; `visible`: boolean; `modelVersion`: String
- **GarmentEmbedding** — `imageId`: UUID; `userId`: UUID; `modelVersion`: String; `dimensions`: int; `vectorJson`: String; `category`: String; `subcategory`: String; `brand`: String; `labelSource`: String
- **ItemEmbedding** — `entityType`: HypeEntityType ◆; `entityId`: UUID; `userId`: UUID; `provider`: String; `dimensions`: int; `vectorJson`: String
- **BrandPrediction** — `sessionId`: UUID; `pieceId`: UUID; `level`: IdentificationLevel ◆; `value`: String; `confidence`: BigDecimal; `evidenceJson`: String; `alternativesJson`: String; `resolverVersion`: String

</details>

<details><summary><b>Marcas e catálogo global</b></summary>

- **Brand** — `name`: String; `slug`: String; `logoUrl`: String; `website`: String; `source`: BrandSource ◆; `catalogOrigin`: CatalogOrigin ◆; `fixtureKey`: String; `sourceConfidence`: BigDecimal; `verifiedAt`: Instant; `country`: String; `brandProfile`: BrandProfile ⟶
- **BrandAlias** — `brandId`: UUID; `alias`: String; `aliasNorm`: String
- **BrandLogo** — `nameKey`: String; `displayName`: String; `logoUrl`: String; `source`: String; `status`: String; `domain`: String; `originUrl`: String; `confidence`: BigDecimal; `attempts`: int; `checkedAt`: Instant; `lastError`: String
- **CatalogSource** — `brandId`: UUID; `domain`: String; `sourceType`: CatalogSourceType ◆; `country`: String; `allowsImagePersistence`: boolean; `active`: boolean; `notes`: String
- **CatalogProduct** — `brandId`: UUID; `category`: String; `subcategory`: String; `productName`: String; `modelName`: String; `productCode`: String; `sku`: String; `gtin`: String; `ean`: String; `upc`: String; `color`: String; `colorName`: String; `material`: String; `collection`: String; `gender`: String; `officialProductUrl`: String; `canonicalUrl`: String; `sourceType`: CatalogSourceType ◆; `sourceDomain`: String; `sourceStatus`: CatalogSourceStatus ◆; `ingestionStatus`: CatalogIngestionStatus ◆; `dedupKey`: String; `description`: String; `designJson`: String; `searchText`: String; `metadataJson`: String; `ownersCount`: int; `firstSeenAt`: Instant; `lastVerifiedAt`: Instant
- **CatalogProductAlias** — `productId`: UUID; `alias`: String; `aliasNorm`: String
- **CatalogVariant** — `productId`: UUID; `variantKey`: String; `color`: String; `colorName`: String; `variantCode`: String; `sku`: String; `gtin`: String; `availability`: String
- **CatalogImage** — `productId`: UUID; `variantId`: UUID; `imageUrl`: String; `imageUrlHash`: String; `imageType`: CatalogImageType ◆; `sourceUrl`: String; `sourceDomain`: String; `sourceType`: CatalogSourceType ◆; `primary`: boolean; `usageStatus`: CatalogImageUsage ◆; `storedUrl`: String; `retrievedAt`: Instant; `lastVerifiedAt`: Instant
- **CatalogIngestionRun** — `kind`: String; `source`: String; `dryRun`: boolean; `totalRead`: int; `createdCount`: int; `updatedCount`: int; `skippedCount`: int; `duplicatesCount`: int; `errorCount`: int; `reportJson`: String; `startedAt`: Instant; `finishedAt`: Instant
- **KbBrandSignature** — `brandName`: String; `brandSlug`: String; `signalType`: String; `name`: String; `description`: String; `typicalRegions`: String; `categories`: String; `ocrTokens`: String; `weight`: BigDecimal
- **KbProductLine** — `brandSlug`: String; `name`: String; `categories`: String; `ocrTokens`: String
- **KbProductModel** — `productLineId`: UUID; `brandSlug`: String; `name`: String; `subcategory`: String; `ocrTokens`: String; `codePattern`: String; `knownColors`: String; `knownMaterials`: String

</details>

<details><summary><b>Esquemas (looks), DNA e planejamento</b></summary>

- **Scheme** — `user`: User ⟶; `originalScheme`: Scheme ⟶; `title`: String; `description`: String; `creationMode`: CreationMode ◆; `origin`: SchemeOrigin ◆; `style`: String; `occasion`: String; `season`: Season ◆; `mood`: Mood ◆; `visibility`: Visibility ◆; `status`: SchemeStatus ◆; `displayMode`: DisplayMode ◆; `disponivel`: boolean; `lookDoDia`: boolean; `lookDoDiaCount`: int; `communityIndexed`: boolean; `coverImageUrl`: String; `backgroundArtUrl`: String; `backgroundColor`: String; `backgroundGradient`: String; `backgroundAnimationType`: BackgroundAnimation ◆; `studioConfigJson`: String; `cardSkin`: String; `layoutAnatomy`: String; `layoutDensity`: String; `containerOrigin`: ContainerOrigin ◆; `containerColor`: String; `containerMandatory`: boolean; `likeCount`: long; `commentCount`: long; `shareCount`: long; `remixCount`: long; `viewCount`: long; `saveCount`: long; `totalPrice`: BigDecimal; `sealIdsJson`: String; `tags`: String; `renderingStatus`: RenderStatus ◆; `virtualTryOnUrl`: String; `renderingJobId`: UUID; `renderingQualityJson`: String; `cachedUntil`: Instant; `renderingMetadataJson`: String; `hypeScore`: BigDecimal; `hypeScoreGlobal`: BigDecimal; `hypeGroupId`: UUID; `groupingId`: UUID; `revalidationPending`: boolean; `publishedAt`: Instant; `favorite`: boolean; `recommendedDirection`: String; `backgroundVideoUrl`: String; `mannequinImageUrl`: String; `mannequinImageFace`: String
- **SchemeItem** — `scheme`: Scheme ⟶; `wardrobeItem`: WardrobeItem ⟶; `slot`: SchemeSlot ◆; `tryOnLayer`: TryOnLayer ◆; `sortOrder`: int; `zIndex`: int; `positionX`: BigDecimal; `positionY`: BigDecimal; `scale`: BigDecimal; `rotation`: BigDecimal; `opacity`: BigDecimal; `filtersJson`: String; `snapshotJson`: String
- **SchemeGrouping** — `owner`: User ⟶; `type`: GroupingType ◆; `label`: String; `description`: String; `coverUrl`: String; `atmospherePrompt`: String; `periodFrom`: Integer; `periodTo`: Integer; `accentColor`: String; `sortOrder`: int
- **DnaScheme** — `user`: User ⟶; `title`: String; `identityPhrase`: String; `archetype`: StyleArchetype ◆; `boldnessIndex`: Integer; `iconSchemeId`: UUID; `colorPaletteJson`: String; `narrativeType`: NarrativeType ◆; `seasonalTheme`: Season ◆; `occasion`: String; `style`: String; `sealIdsJson`: String; `backgroundColor`: String; `backgroundGradient`: String; `backgroundImageUrl`: String; `backgroundAnimationType`: BackgroundAnimation ◆; `studioConfigJson`: String; `cardImageUrl`: String; `creationMode`: CreationMode ◆; `visibility`: Visibility ◆; `status`: SchemeStatus ◆; `disponivel`: boolean; `groupingId`: UUID; `remixedFromDnaId`: UUID; `likeCount`: long; `commentCount`: long; `shareCount`: long; `remixCount`: long; `hypeScore`: BigDecimal; `aiExplanationJson`: String; `publishedAt`: Instant; `cardLayout`: String; `targetElement`: String; `backgroundVideoUrl`: String
- **DnaSchemeItem** — `dnaScheme`: DnaScheme ⟶; `scheme`: Scheme ⟶; `cell`: DnaCell ◆; `eraLabel`: String; `duplicate`: boolean; `sourceSchemeId`: UUID; `appliedToOriginal`: boolean; `milestone`: boolean
- **StyleDna** — `user`: User ⟶; `archetype`: StyleArchetype ◆; `boldnessIndex`: int; `identityPhrase`: String; `colorPalette`: String; `styleKeywords`: String; `occasionKeywords`: String; `iconPieceName`: String; `synthesizedAt`: Instant; `silhouette`: String; `lifeIdentityJson`: String; `lifePrivateFieldsJson`: String; `interactionsAtSynthesis`: int; `cardImageUrl`: String; `phraseSource`: String; `colorSeason`: String
- **StyleDnaVersion** — `id`: UUID; `userId`: UUID; `snapshotJson`: String; `createdAt`: Instant
- **DailyLook** — `user`: User ⟶; `scheme`: Scheme ⟶; `materializedFrom`: DailyLook ⟶; `lookDate`: LocalDate; `source`: DailyLookSource ◆; `feedback`: DailyLookFeedback ◆
- **HypeScoreMetric** — `dailyLook`: DailyLook ⟶; `scheme`: Scheme ⟶; `user`: User ⟶; `scoreDate`: LocalDate; `likesCount`: long; `commentsCount`: long; `sharesCount`: long; `remixesCount`: long; `engagementRaw`: BigDecimal; `engagementNorm`: BigDecimal; `trendRaw`: BigDecimal; `trendNorm`: BigDecimal; `hypeScore`: BigDecimal; `globalHypeScore`: BigDecimal; `weeklyTopPercent`: BigDecimal; `band`: HypeScoreBand ◆; `trendsetterSeal`: boolean; `styleMatchSeal`: boolean; `aiSuggestion`: String; `breakdownJson`: String; `calibrationWindowDays`: int; `trendWindowDays`: int; `weeklyWindowDays`: int
- **WeekPlan** — `user`: User ⟶; `weekStart`: LocalDate; `status`: WeekPlanStatus ◆; `gapsJson`: String
- **WeekPlanDay** — `weekPlan`: WeekPlan ⟶; `dayDate`: LocalDate; `eventLabel`: String; `occasion`: String; `scheme`: Scheme ⟶; `pieceIdsJson`: String; `combinationKey`: String; `rationale`: String; `editedManually`: boolean
- **AcervoGroup** — `user`: User ⟶; `entityType`: HypeEntityType ◆; `label`: String; `memberIdsJson`: String; `centroidJson`: String; `memberCount`: int; `computedAt`: Instant
- **HypeGroup** — `entityType`: HypeEntityType ◆; `signatureStyle`: String; `signatureOccasion`: String; `signatureBrandsJson`: String; `signatureColorsJson`: String; `signaturePieceTypesJson`: String; `memberIdsJson`: String; `memberCount`: int; `hypeScoreGlobal`: BigDecimal; `computedAt`: Instant
- **MirrorState** — `userId`: UUID; `slotsJson`: String; `shownCombinationsJson`: String; `lastPrompt`: String

</details>

<details><summary><b>Selos, promoções e cupons</b></summary>

- **Seal** — `owner`: User ⟶; `name`: String; `tier`: SealTier ◆; `policyText`: String; `status`: SealStatus ◆; `iconUrl`: String; `premium`: boolean; `backgroundConfigJson`: String; `availableFrom`: Instant; `availableUntil`: Instant; `usageLimit`: Integer; `usageCount`: int; `autoIssued`: boolean
- **SealBond** — `scheme`: Scheme ⟶; `targetOwner`: User ⟶; `requestedBy`: User ⟶; `tier`: SealTier ◆; `linkedPieceIdsJson`: String; `confidence`: BigDecimal; `justification`: String; `basis`: SealBondBasis ◆; `status`: SealBondStatus ◆; `requiresReview`: boolean; `seal`: Seal ⟶; `imageRightsConsent`: Boolean; `respondedAt`: Instant; `reviewedAt`: Instant; `reviewNote`: String; `origin`: SealBondOrigin ◆; `sealCode`: String; `eraLabel`: String
- **Promotion** — `seal`: Seal ⟶; `sealBond`: SealBond ⟶; `type`: PromotionType ◆; `code`: String; `description`: String; `discountPercent`: Integer; `partnerBrandUserId`: UUID; `campaignId`: UUID; `campaignLimit`: Integer; `status`: PromotionStatus ◆; `visibility`: Visibility ◆; `ownerUserId`: UUID; `expiresAt`: Instant; `redeemedAt`: Instant; `title`: String; `rules`: String; `requiredSealKind`: String; `totalQuota`: Integer; `perUserLimit`: int; `redeemedCount`: int; `storeUrl`: String
- **PromotionRedemption** — `promotion`: Promotion ⟶; `sealBond`: SealBond ⟶; `user`: User ⟶; `code`: String; `issuerUserId`: UUID; `partnerBrandUserId`: UUID; `status`: RedemptionStatus ◆; `redeemedAt`: Instant; `expiresAt`: Instant
- **CouponRight** — `user`: User ⟶; `owner`: User ⟶; `sourceType`: String; `sourceId`: UUID; `title`: String; `detail`: String; `status`: String; `schemeId`: UUID; `couponRef`: UUID; `decidedAt`: Instant

</details>

<details><summary><b>Social e notificações</b></summary>

- **Follow** — `follower`: User ⟶; `following`: User ⟶; `status`: FollowStatus ◆; `respondedAt`: Instant
- **Comment** — `author`: User ⟶; `targetType`: TargetType ◆; `targetId`: UUID; `parentCommentId`: UUID; `content`: String; `active`: boolean
- **Reaction** — `actor`: User ⟶; `targetType`: TargetType ◆; `targetId`: UUID; `reactionType`: ReactionType ◆
- **Share** — `user`: User ⟶; `targetType`: TargetType ◆; `targetId`: UUID; `channel`: ShareChannel ◆; `caption`: String; `exportUrl`: String
- **SavedItem** — `user`: User ⟶; `targetType`: TargetType ◆; `targetId`: UUID; `savedAt`: Instant; `favorite`: boolean
- **Notification** — `recipient`: User ⟶; `actor`: User ⟶; `type`: NotificationType ◆; `category`: NotificationCategory ◆; `resourceType`: String; `resourceId`: UUID; `title`: String; `body`: String; `payloadJson`: String; `read`: boolean; `readAt`: Instant; `delivered`: boolean
- **Photo** — `user`: User ⟶; `origin`: PhotoOrigin ◆; `sourceEntityId`: UUID; `storageKey`: String; `publicUrl`: String; `originalUrl`: String; `thumbnailUrl`: String; `contentHash`: String; `mimeType`: String; `width`: Integer; `height`: Integer; `bytesSize`: Long; `qualityScore`: BigDecimal; `moderationStatus`: ModerationStatus ◆; `keyMoment`: boolean; `editedFromPhotoId`: UUID; `lastViewedAt`: Instant; `metadataJson`: String; `deletedAt`: Instant

</details>

<details><summary><b>Gamificação (FAI Points, desafios, rankings)</b></summary>

- **FaiPointsLedgerEntry** — `id`: UUID; `userId`: UUID; `delta`: int; `actionCode`: String; `refType`: String; `refId`: String; `idempotencyKey`: String; `countsLifetime`: boolean; `createdAt`: Instant
- **FaiPointsRule** — `actionCode`: String; `points`: int; `dailyCap`: Integer; `weeklyCap`: Integer; `oncePerRef`: boolean; `active`: boolean; `description`: String
- **ChallengeTemplate** — `code`: String; `name`: String; `ruleText`: String; `ruleBlocksJson`: String; `modesAllowedJson`: String; `durationDays`: Integer; `scoreDimensionsJson`: String; `rewardPoints`: int; `effort`: String; `minParticipants`: int; `maxParticipants`: int; `origin`: String; `authorUserId`: UUID; `roomDecoration`: String; `active`: boolean
- **ChallengeInstance** — `id`: UUID; `templateCode`: String; `mode`: String; `state`: String; `paramsJson`: String; `startsAt`: Instant; `endsAt`: Instant; `acceptDeadline`: Instant; `createdBy`: UUID; `resultJson`: String; `version`: long; `createdAt`: Instant; `updatedAt`: Instant; `newEntity`: boolean
- **ChallengeParticipant** — `id`: UUID; `instanceId`: UUID; `userId`: UUID; `team`: String; `status`: String; `joinedAt`: Instant; `leftAt`: Instant; `personalGoalJson`: String; `progressFraction`: BigDecimal; `bestRecord`: int; `newEntity`: boolean
- **ChallengeEvent** — `id`: UUID; `instanceId`: UUID; `userId`: UUID; `evidenceType`: String; `refId`: UUID; `createdAt`: Instant; `newEntity`: boolean
- **ChallengeNote** — `id`: UUID; `instanceId`: UUID; `userId`: UUID; `kind`: String; `content`: String; `createdAt`: Instant; `newEntity`: boolean
- **ChallengeVote** — `id`: UUID; `instanceId`: UUID; `voterUserId`: UUID; `entrySchemeId`: UUID; `createdAt`: Instant; `newEntity`: boolean
- **UserAchievement** — `id`: UUID; `userId`: UUID; `achievementCode`: String; `secret`: boolean; `grantedAt`: Instant
- **RankingOptIn** — `userId`: UUID; `optedIn`: boolean; `shareCity`: boolean; `city`: String; `updatedAt`: Instant
- **RankingPosition** — `id`: UUID; `segment`: String; `userId`: UUID; `position`: int; `total`: int; `topPercent`: BigDecimal; `value`: BigDecimal; `computedAt`: Instant
- **InventoryScoreSnapshot** — `id`: UUID; `userId`: UUID; `periodType`: String; `periodDate`: LocalDate; `score`: Integer; `dimensionsJson`: String; `metricsJson`: String; `eligible`: boolean; `computedAt`: Instant

</details>

<details><summary><b>FLAIR (jogo de cartas)</b></summary>

- **FlairProfile** — `user`: User ⟶; `coins`: int; `rankPoints`: int; `wins`: int; `losses`: int; `draws`: int; `skinsJson`: String; `activeSkin`: String
- **FlairCoinEntry** — `user`: User ⟶; `delta`: int; `reason`: String; `ref`: String
- **FlairCombination** — `brand`: User ⟶; `name`: String; `description`: String; `gameType`: String; `requiredCategoriesJson`: String; `requiredStylesJson`: String; `requiredOccasionsJson`: String; `minBrandPieces`: int; `minDeckPower`: int; `minRarity`: String; `minWins`: int; `couponTitle`: String; `discountPercent`: Integer; `discountAmount`: BigDecimal; `minPurchase`: BigDecimal; `validDays`: int; `stock`: Integer; `redeemed`: int; `active`: boolean; `startsAt`: Instant; `endsAt`: Instant; `accentColor`: String; `storeUrl`: String
- **FlairMatch** — `mode`: String; `status`: String; `theme`: String; `playDate`: LocalDate; `createdByUser`: User ⟶; `teamAId`: UUID; `teamBId`: UUID; `winnerSide`: String; `resultJson`: String
- **FlairMatchEntry** — `match`: FlairMatch ⟶; `user`: User ⟶; `scheme`: Scheme ⟶; `side`: String; `deckPower`: int; `score`: BigDecimal; `brandPiecesJson`: String
- **FlairModeState** — `user`: User ⟶; `mode`: String; `seasonKey`: String; `stateJson`: String
- **FlairRedemption** — `combination`: FlairCombination ⟶; `user`: User ⟶; `scheme`: Scheme ⟶; `code`: String; `status`: String; `deckPower`: Integer; `expiresAt`: Instant; `usedAt`: Instant
- **FlairTeam** — `name`: String; `code`: String; `owner`: User ⟶; `color`: String; `points`: int
- **FlairTeamMember** — `team`: FlairTeam ⟶; `user`: User ⟶; `role`: String
- **FlairTerritory** — `mapCode`: String; `territoryCode`: String; `owner`: User ⟶; `defenderJson`: String; `capturedAt`: Instant; `defenses`: int
- **FlairTrophy** — `user`: User ⟶; `mode`: String; `title`: String; `seasonKey`: String; `detailJson`: String

</details>

<details><summary><b>Quarto 3D e avatar</b></summary>

- **RoomCatalogItem** — `sku`: String; `name`: String; `moldId`: String; `slotType`: String; `widthCm`: int; `finishJson`: String; `rarity`: String; `pricePoints`: int; `requiredLevel`: String; `stockLimit`: Integer; `soldCount`: int; `maisonBrandUserId`: UUID; `active`: boolean; `kind`: String; `material`: String; `colorName`: String; `description`: String; `logoUrl`: String; `artUrl`: String; `labelText`: String; `bundleJson`: String; `perUserLimit`: Integer; `requiresSeal`: boolean; `version`: Long
- **RoomInventoryItem** — `id`: UUID; `userId`: UUID; `sku`: String; `serial`: Integer; `source`: String; `appliedModule`: String; `acquiredAt`: Instant
- **RoomLayout** — `user`: User ⟶; `level`: String; `modulesJson`: String; `drawerLabelsJson`: String; `previousMapJson`: String
- **RoomStorageEntry** — `userId`: UUID; `wardrobeItemId`: UUID; `address`: String; `assignedBy`: String
- **UserAvatar3d** — `user`: User ⟶; `modelVersion`: int; `modelJson`: String; `adjustJson`: String; `textureKey`: String; `photosCount`: int; `warningsJson`: String; `publicOnRunway`: boolean; `consentAt`: Instant; `textureModeration`: ModerationStatus ◆; `identityId`: UUID; `currentVersion`: int; `approvedVersion`: Integer; `identityStatus`: IdentityStatus ◆; `qualityJson`: String
- **AvatarIdentityVersion** — `user`: User ⟶; `identityId`: UUID; `versionNo`: int; `status`: IdentityStatus ◆; `basedOn`: Integer; `modelVersion`: int; `modelJson`: String; `adjustJson`: String; `textureKey`: String; `photosCount`: int; `warningsJson`: String; `qualityJson`: String; `textureModeration`: ModerationStatus ◆; `approvedAt`: Instant; `approvedWithWarnings`: boolean

</details>

<details><summary><b>IA, visão computacional e pipelines</b></summary>

- **AiInferenceLog** — `id`: UUID; `userId`: UUID; `capability`: String; `hostRf`: String; `provider`: String; `model`: String; `latencyMs`: long; `estimatedCostUsd`: BigDecimal; `result`: AiCallResult ◆; `fallbackUsed`: boolean; `inputSummaryJson`: String; `outputSummary`: String; `consentState`: String; `correlationId`: String; `createdAt`: Instant
- **ModelInference** — `modelName`: String; `modelVersion`: String; `task`: String; `sessionId`: UUID; `imageId`: UUID; `latencyMs`: Integer; `confidence`: BigDecimal; `outputJson`: String; `aiInferenceId`: UUID
- **ModelRegistryEntry** — `name`: String; `modelVersion`: String; `task`: String; `provider`: String; `datasetVersion`: String; `trainingDate`: LocalDate; `evaluationMetricsJson`: String; `deploymentStatus`: ModelDeploymentStatus ◆; `artifactUri`: String; `notes`: String
- **DatasetSource** — `code`: String; `name`: String; `sourceType`: DatasetSourceType ◆; `license`: String; `usagePermission`: DatasetUsage ◆; `commercialUse`: boolean; `consentRequired`: boolean; `attribution`: String
- **TrainingCandidate** — `imageId`: UUID; `userId`: UUID; `sessionId`: UUID; `reviewItemId`: UUID; `dataset`: VisionDataset ◆; `status`: TrainingCandidateStatus ◆; `hardExampleTags`: String; `annotationsJson`: String; `annotationVersion`: String; `sourceId`: UUID; `license`: String; `consentGrantedAt`: Instant; `exportedAt`: Instant
- **PipelineJob** — `user`: User ⟶; `type`: PipelineJobType ◆; `status`: PipelineJobStatus ◆; `provider`: String; `externalJobId`: String; `targetType`: String; `inputResourceId`: UUID; `inputJson`: String; `outputUrl`: String; `resultJson`: String; `stagesJson`: String; `qualityScore`: BigDecimal; `totalCostUsd`: BigDecimal; `totalTimeMs`: Integer; `fallbackUsed`: boolean; `errorCode`: String; `errorMessage`: String; `attempts`: int; `retryCount`: int; `queuedAt`: Instant; `startedAt`: Instant; `finishedAt`: Instant
- **ProcessingJobLog** — `id`: UUID; `pipelineJobId`: UUID; `wardrobeItemId`: UUID; `userId`: UUID; `jobType`: String; `status`: String; `totalProcessingTimeMs`: Integer; `stageTimesJson`: String; `finalQualityScore`: BigDecimal; `totalCostUsd`: BigDecimal; `accepted`: boolean; `retryCount`: int; `fallbackUsed`: boolean; `createdAt`: Instant; `completedAt`: Instant
- **RenderJobLog** — `id`: UUID; `pipelineJobId`: UUID; `schemeId`: UUID; `userId`: UUID; `renderingType`: String; `status`: String; `totalProcessingTimeMs`: Integer; `stageTimesJson`: String; `finalQualityScore`: BigDecimal; `costFashnAi`: BigDecimal; `costCleanupAi`: BigDecimal; `costRembg`: BigDecimal; `totalCost`: BigDecimal; `retryCount`: int; `createdAt`: Instant; `completedAt`: Instant
- **MetricSnapshot** — `id`: UUID; `kind`: String; `periodStart`: Instant; `periodEnd`: Instant; `valuesJson`: String; `createdAt`: Instant
- **AssetPreset** — `id`: String; `kind`: AssetKind ◆; `label`: String; `presetGroup`: String; `staticUrl`: String; `previewUrl`: String; `animatedUrl`: String; `posterUrl`: String; `paletteJson`: String; `metadataJson`: String; `status`: String; `sortOrder`: int; `rfTags`: String; `syncedAt`: Instant

</details>

<details><summary><b>HypeScore v2 (sinais, recortes e marcos)</b></summary>

- **HypeSignalDaily** — `id`: UUID; `entityType`: HypeEntityType ◆; `entityId`: UUID; `signalType`: HypeSignalType ◆; `signalDate`: LocalDate; `eventCount`: int; `weightedCount`: BigDecimal; `updatedAt`: Instant
- **HypeScoreCurrent** — `id`: UUID; `entityType`: HypeEntityType ◆; `entityId`: UUID; `ownerId`: UUID; `algorithmVersion`: String; `status`: HypeStatus ◆; `score`: BigDecimal; `level`: HypeLevel ◆; `dimensions`: HypeDimensions; `deltaPoints`: BigDecimal; `deltaPercent`: BigDecimal; `direction`: String; `momentum`: HypeMomentum ◆; `publicEligible`: boolean; `category`: String; `styles`: String; `occasions`: String; `country`: String; `region`: String; `categories`: String; `subcategories`: String; `signalsJson`: String; `reasonsJson`: String; `windowStart`: Instant; `windowEnd`: Instant; `calculatedAt`: Instant
- **HypeScoreSnapshot** — `id`: UUID; `entityType`: HypeEntityType ◆; `entityId`: UUID; `algorithmVersion`: String; `snapshotDate`: LocalDate; `status`: HypeStatus ◆; `score`: BigDecimal; `level`: HypeLevel ◆; `dimensions`: HypeDimensions; `publicEligible`: boolean; `windowStart`: Instant; `windowEnd`: Instant; `calculatedAt`: Instant
- **HypeMilestone** — `level`: final HypeLevel ◆; `id`: UUID; `entityType`: HypeEntityType ◆; `entityId`: UUID; `ownerId`: UUID; `milestone`: Kind ◆; `level`: HypeLevel ◆; `momentum`: HypeMomentum ◆; `score`: BigDecimal; `publicEligible`: boolean; `algorithmVersion`: String; `achievedAt`: Instant; `digestDate`: LocalDate; `notificationId`: UUID

</details>

<details><summary><b>FashionAI Lens</b></summary>

- **LensScan** — `userId`: UUID; `source`: LensSource ◆; `sourceRefId`: UUID; `intent`: LensIntent ◆; `status`: LensScanStatus ◆; `errorCode`: String; `imageKey`: String; `thumbKey`: String; `width`: int; `height`: int; `facesRedacted`: int; `redactionConfirmed`: boolean; `aiSource`: String; `modelVersion`: String; `algorithmVersion`: String; `aiInferenceId`: UUID; `savedAt`: Instant; `expiresAt`: Instant; `processedAt`: Instant
- **LensDetection** — `scanId`: UUID; `ordinal`: int; `boxJson`: String; `label`: String; `category`: String; `subcategory`: String; `material`: String; `sex`: String; `colorsJson`: String; `pattern`: String; `styleTags`: String; `occasionTags`: String; `confidence`: BigDecimal; `attributeConfidenceJson`: String; `embeddingJson`: String; `embeddingModel`: String; `status`: LensDetectionStatus ◆; `dismissedAt`: Instant; `wantedAt`: Instant; `ownedItemId`: UUID
- **LensFeedback** — `scanId`: UUID; `detectionId`: UUID; `userId`: UUID; `kind`: LensFeedbackKind ◆; `beforeJson`: String; `afterJson`: String; `trainingConsent`: boolean

</details>

<details><summary><b>Moderação, auditoria e operação</b></summary>

- **ModerationQueueItem** — `targetType`: String; `targetId`: UUID; `userId`: UUID; `contentExcerpt`: String; `categoriesJson`: String; `confidence`: BigDecimal; `status`: ModerationQueueStatus ◆; `reviewedBy`: UUID; `reviewedAt`: Instant; `reason`: String
- **AuditLog** — `id`: UUID; `actor`: String; `acao`: String; `recurso`: String; `resultado`: String; `ip`: String; `userAgent`: String; `timestamp`: Instant; `correlationId`: String; `metadataJson`: String
- **BackupRecord** — `id`: UUID; `kind`: String; `status`: String; `fileKey`: String; `sizeBytes`: Long; `checksum`: String; `startedAt`: Instant; `finishedAt`: Instant; `notes`: String

</details>

Legenda: ⟶ relação com outra entidade · ◆ enum.

## Entidades embutidas em JSON

Estruturas que vivem dentro de colunas JSON (validadas no backend, renderizadas no frontend):

| Estrutura | Onde fica | Validação | Campos |
|---|---|---|---|
| SealDesign | `seals.background_config_json.design` | SealDesigns.normalize | kind (CIRCULAR · FOLHA · FASHIONAI), mode (GENERATED · UPLOAD · TEMPLATE), template, label/caption, texts (series, subtitle, style, year, emblem), core (mode ELEMENT · IMAGE · TEXT, imageUrl, text, textColor, zoom), border/field/center/element, uploadUrl |
| SealPolicy | `seals.background_config_json.policy` | SealPolicies.normalize | match (ALL · ANY), rules[≤ 6] (quantifier AT_LEAST · ALL · NONE, count, color, brand, category, subcategory), occasions[≤ 4], styles[≤ 4] |
| Configuração de estúdio do esquema | `schemes.studio_config_json` | BackgroundStudioService | aura {variantId, format IMAGEM_UNICA · MOSAICO}, materialId, gradient/gradientPresetId, seasonalPresetId, aiArt/uploadUrl, container, layoutAnatomy, skin — ver docs/anatomia/anatomia-de-esquemas.md |
| Snapshot da peça no esquema | `scheme_items.snapshot_json` | SchemeService | cópia dos campos da peça no momento do look (remix e histórico não quebram se a peça mudar) |

## Taxonomia de peça e esquema (listas controladas)

| Categoria | Nº | Subcategorias |
|---|---|---|
| upper_piece | 18 | t_shirt, shirt, blouse, tank_top, crop_top, polo_shirt, bodysuit, sweater, sweatshirt, hoodie, cardigan, vest, blazer, jacket, coat, parka, windbreaker, kimono |
| lower_piece | 14 | jeans, tailored_pants, casual_pants, chino_pants, cargo_pants, jogger_pants, sweatpants, leggings, culottes, shorts, bermuda_shorts, denim_shorts, skirt, skort |
| shoes_piece | 18 | casual_sneakers, running_shoes, training_shoes, basketball_shoes, skate_shoes, high_top_sneakers, loafers, moccasins, oxford_shoes, derby_shoes, ankle_boots, long_boots, combat_boots, sandals, flip_flops, heels, flats, espadrilles |
| accessory_piece | 23 | handbag, crossbody_bag, tote_bag, clutch, backpack, belt, cap, hat, beanie, scarf, tie, bow_tie, sunglasses, eyeglasses, necklace, bracelet, earrings, ring, watch, wallet, gloves, socks, hair_accessory |
| full_body_piece | 5 | dress, jumpsuit, romper, matching_set, overalls |

| Família de cor | Nº | Cores (id `hex`) |
|---|---|---|
| Preto | 3 | black `#12100F`, charcoal `#36373B`, washed_black `#2E2B2A` |
| Branco | 4 | white `#FFFFFF`, off_white `#F3EFE7`, ivory `#FAF4E4`, cream `#F0E4CB` |
| Cinza | 4 | light_gray `#D5D2CD`, gray `#8C8A87`, dark_gray `#54524F`, silver `#C3C6C9` |
| Azul | 7 | blue `#2A5FA8`, navy `#1B2A4A`, light_blue `#A9C7E4`, sky_blue `#7EC0E8`, cobalt `#0B4FC4`, denim `#4A6A8C`, teal `#16666B` |
| Vermelho | 5 | red `#C62B28`, crimson `#D6244A`, burgundy `#6B1220`, maroon `#87313F`, rust `#B05330` |
| Rosa | 5 | pink `#EFA8BC`, hot_pink `#E0367E`, rose `#D79A9A`, coral `#F07F63`, salmon `#F2A18B` |
| Laranja | 4 | orange `#E8722A`, terracotta `#C4674A`, amber `#D99418`, apricot `#F2C09A` |
| Amarelo | 4 | yellow `#E8C93C`, mustard `#B8912A`, gold `#C9A227`, butter `#F2E5A8` |
| Verde | 7 | green `#2F7A45`, olive `#6E7A3C`, military_green `#4A5340`, forest_green `#1C4429`, mint `#A9DFC2`, sage `#A3B191`, emerald `#187A5F` |
| Roxo | 5 | purple `#6B3F9E`, violet `#8046D6`, lilac `#C4A5D6`, lavender `#DCD5EC`, plum `#6E3552` |
| Marrom | 6 | brown `#5B3B28`, chocolate `#4A2C1A`, camel `#B98E5E`, tan `#C7A175`, beige `#DFCDB0`, taupe `#7A6B5D` |
| Especiais | 5 | metallic_gold `#C8A64B`, metallic_silver `#B8BCC0`, bronze `#9C6B3C`, multicolor `#9A9A9A`, print `#8A8A8A` |

| Lista | Nº | Valores |
|---|---|---|
| occasions | 20 | casual, work, business, formal, party, night_out, date, wedding, ceremony, sport, gym, travel, beach, vacation, school, university, social, home, outdoor, festival |
| styles | 25 | classic, minimalist, modern, chic, streetwear, sporty, athleisure, preppy, romantic, boho, vintage, grunge, edgy, glam, luxury, avant_garde, y2k, utility, techwear, tailored, urban, resort, basic, statement, futuristic |
| materials | 7 | COTTON, POLYESTER, WOOL, SILK, LEATHER, SYNTHETIC, BLEND |
| sexes | 3 | MASCULINO, FEMININO, UNISSEX |
| sizes | 31 | xs, s, m, l, xl, xxl, br_34, br_36, br_38, br_40, br_42, br_44, br_46, br_48, br_50, br_52, shoe_33, shoe_34, shoe_35, shoe_36, shoe_37, shoe_38, shoe_39, shoe_40, shoe_41, shoe_42, shoe_43, shoe_44, shoe_45, shoe_46, one_size |
| market seasons | 4 | spring, summer, autumn, winter |
| market genders | 3 | male, female, unisex |

| Wearstyle | Ocasiões agrupadas |
|---|---|
| casual | casual, home, school, university, travel, outdoor, vacation |
| social | social, formal, business, wedding, ceremony, date |
| esporte | sport, gym, outdoor |
| festa | party, night_out, festival, date |
| trabalho | work, business |
| praia | beach, vacation, travel |

## Enums de domínio

| Enum | Nº | Valores |
|---|---|---|
| AccountOrigin | 4 | REAL, TEST_SEED, DEMO, SYSTEM |
| AccountStatus | 6 | PENDING_EMAIL_VERIFICATION, ACTIVE, PENDING_VALIDATION, SUSPENDED, DELETION_SCHEDULED, DELETED |
| AiCallResult | 8 | SUCCESS, FALLBACK_LOCAL, TIMEOUT, CIRCUIT_OPEN, RATE_LIMITED, CONSENT_DENIED, PROMPT_REJECTED, ERROR |
| AiReviewDecision | 4 | ACCEPT_USER, ACCEPT_AI, OVERRIDE, DISMISS |
| AiReviewKind | 2 | CORRECTION, LOW_CONFIDENCE |
| AiReviewStatus | 3 | PENDING_REVIEW, CONFIRMED, DISMISSED |
| ApprovalStatus | 5 | PENDENTE, AJUSTES, APROVADO, RECUSADO, SUSPENSO |
| AssetKind | 10 | CHROME_BACKGROUND, AURA_PRESET, AURA_VARIANT, MATERIAL, AURA_MATERIAL_STATIC, AURA_MATERIAL_ANIMATED, AURA_MATERIAL_MOSAIC, GRADIENT_AURA, SEASONAL, CARD_SKIN |
| AvailabilityStatus | 3 | AVAILABLE, UNAVAILABLE, ARCHIVED |
| BackgroundAnimation | 5 | NONE, SNOW, PETALS, LEAVES, SHIMMER |
| BodyBuild | 5 | SLIM, MEDIUM, ATHLETIC, CURVY, PLUS |
| BrandSource | 3 | SEEDED, AUTO_DETECTED, USER_SUBMITTED |
| CaptureNeed | 3 | STRONGLY_RECOMMENDED, RECOMMENDED, OPTIONAL |
| CapturePurpose | 8 | PRIMARY_IDENTIFICATION, BRAND_DISAMBIGUATION, MODEL_IDENTIFICATION, MATERIAL_IDENTIFICATION, PATTERN_IDENTIFICATION, QUALITY_RETAKE, COVERAGE_COMPLETION, DETAIL_RECORD |
| CaptureRequestStatus | 4 | PENDING, FULFILLED, SKIPPED, SUPERSEDED |
| CaptureRole | 2 | PRIMARY, COMPLEMENTARY |
| CaptureSessionStatus | 5 | ANALYZING, AWAITING_CAPTURE, READY_FOR_REVIEW, COMPLETED, ABANDONED |
| CaptureSource | 4 | CAMERA, GALLERY, UPLOAD, IMPORT |
| CaptureView | 22 | FRONT_VIEW, BACK_VIEW, LEFT_SIDE, RIGHT_SIDE, THREE_QUARTER, TOP_VIEW, WATCH_FACE, LOGO_DETAIL, BRAND_DETAIL, TEXTURE_DETAIL, LABEL_DETAIL, INNER_LABEL, INNER_VIEW, SOLE_VIEW, TONGUE_LABEL, SERIAL_DETAIL, CLASP_DETAIL, HARDWARE_DETAIL, BUCKLE_DETAIL, WATCH_BACK, TEMPLE_DETAIL, ENGRAVING_DETAIL |
| CatalogImageType | 8 | FRONT, BACK, SIDE, TOP, DETAIL, SOLE, PACKSHOT, OTHER |
| CatalogImageUsage | 3 | REFERENCE_ONLY, PERSISTED, REJECTED |
| CatalogIngestionStatus | 5 | DISCOVERED, VALIDATED, PERSISTABLE, REFERENCE_ONLY, REJECTED |
| CatalogOrigin | 3 | REAL, SEED, DEMO |
| CatalogSourceStatus | 4 | ACTIVE, UNAVAILABLE, SOURCE_REMOVED, NEEDS_REVALIDATION |
| CatalogSourceType | 5 | OFFICIAL_BRAND, OFFICIAL_STORE, AUTHORIZED_RETAILER, PARTNER_API, MANUAL_ADMIN |
| ConsentPurpose | 9 | AI_RECOMMENDATION, AI_EXTERNAL_PHOTO_PROCESSING, HISTORY_FOR_RECOMMENDATION, PERSONALIZED_ADS, PARTNER_SHARING, BODY_MEASUREMENTS, FACIAL_RECOGNITION, LOCATION_HISTORY, AI_MODEL_TRAINING |
| ContainerOrigin | 3 | INDEFINIDA, MANUAL, AUTO |
| CreationMode | 2 | MANUAL, AI_ASSISTED |
| DailyLookFeedback | 3 | ADOREI, NAO_USEI, NAO_GOSTEI |
| DailyLookSource | 5 | MANUAL, AUTOPILOTO, COPILOT, VISTA_ME, SMART_MIRROR |
| DatasetSourceType | 8 | OWN, USER_CONSENTED, LICENSED, ACADEMIC, BRAND_PARTNER, MANUFACTURER, AUTHORIZED_CATALOG, INTERNAL |
| DatasetUsage | 3 | TRAINING, EVALUATION_ONLY, DISPLAY_ONLY |
| DisplayMode | 3 | CAROUSEL, GRID, STACKED |
| DnaCell | 6 | CELL_1, CELL_2, CELL_3, CELL_4, CELL_5, CELL_6 |
| ExportStatus | 4 | REQUESTED, PROCESSING, READY, EXPIRED |
| FollowStatus | 3 | PENDENTE, ACEITO, BLOQUEADO |
| GroupingType | 9 | COLLECTION, PROMOTION, SIGNATURE_SERIES, EVOLUTION, STYLE_LINE, ERA, PHASE, SEASON, TOUR |
| HypeEntityType | 2 | PIECE, SCHEME |
| HypeLevel | 6 | LOW_SIGNAL, NICHE, RELEVANT, HOT, TRENDING, VIRAL |
| HypeMomentum | 5 | EMERGING, RISING, STABLE, COOLING, CLASSIC |
| HypeScoreBand | 7 | DESPRETENSIOSO, EM_CONSTRUCAO, NOTADO, COM_ESTILO, MUITO_ESTILOSO, ARRASANDO_NO_LOOK, ICONE_DE_ESTILO |
| HypeScorePanelVersion | 6 | SPOTLIGHT_CLASSICO, PASSARELA, RAIO_X_ESTILO, BENTO_DIA, EDITORIAL_MINIMAL, COACH_ESTILO |
| HypeSignalType | 12 | LIKE_CREATED, COMMENT_CREATED, SAVE_CREATED, SHARE_CREATED, FAVORITE_CREATED, LOOK_REMIXED, PIECE_REMIXED, LOOK_VIEWED, PIECE_VIEWED, PIECE_USED, PIECE_IN_LOOK, LOOK_WORN |
| HypeStatus | 2 | AVAILABLE, INSUFFICIENT_DATA |
| IdentificationLevel | 6 | CATEGORY, SUBCATEGORY, BRAND, PRODUCT_LINE, MODEL, VARIANT |
| IdentityStatus | 3 | DRAFT, NEEDS_REFINEMENT, APPROVED |
| ImageOrigin | 3 | CATALOG, USER_PHOTO, DEFAULT |
| ItemCondition | 4 | NEW, GOOD, WORN, DAMAGED |
| LensDetectionStatus | 4 | DETECTED, CORRECTED, ADDED_BY_USER, DISMISSED |
| LensFeedbackKind | 8 | WRONG_CATEGORY, WRONG_COLOR, WRONG_ATTRIBUTE, NOT_CLOTHING, MISSING_PIECE, BAD_BOX, WRONG_MATCH, GOOD_MATCH |
| LensIntent | 2 | IDENTIFY, RECREATE |
| LensScanStatus | 4 | READY, PARTIAL, NO_FASHION_FOUND, FAILED |
| LensSource | 5 | CAMERA, GALLERY, UPLOAD, IN_APP_PIECE, IN_APP_LOOK |
| MannequinSex | 2 | MASCULINO, FEMININO |
| Model3dStatus | 4 | QUEUED, PROCESSING, COMPLETED, FAILED |
| ModelDeploymentStatus | 5 | CANDIDATE, SHADOW, CANARY, PRODUCTION, RETIRED |
| ModerationQueueStatus | 3 | PENDING_REVIEW, APPROVED, REJECTED |
| ModerationStatus | 4 | PENDING, APPROVED, REJECTED_POLICY, REJECTED_NOT_CLOTHING |
| Mood | 4 | ENERGETIC, ELEGANT, COMFORTABLE, SOPHISTICATED |
| NarrativeType | 12 | TIMELINE, MOMENTOS_MARCANTES, PRIMEIRA_VEZ, CAPSULA_VERSATILIDADE, POR_OCASIAO, MOOD_BOARD, PALETA_DOMINANTE, HARMONIA_CROMATICA, MARCAS_FAVORITAS, HYPE_FOCUS, CARTELA_SAZONAL, LEGO |
| NotificationCategory | 5 | SECURITY, SOCIAL, ACHIEVEMENT, SYSTEM, POINTS |
| NotificationType | 30 | PASSWORD_RESET, TWO_FACTOR_CODE, NEW_LOGIN_DEVICE, EMAIL_CONFIRMATION, DATA_EXPORT_READY, FOLLOW_REQUEST, FOLLOW_ACCEPTED, NEW_FOLLOWER, NEW_COMMENT, NEW_LIKE, NEW_REACTION, NEW_REMIX, SEAL_GRANTED, FEATURED_SCHEME, SEAL_BOND_REVIEW, WELCOME, PIECE_CREATED, SCHEME_CREATED, AI_JOB_FINISHED, ACCOUNT_APPROVAL, ISSUER_REVIEW_REQUEST, CONTENT_REVIEW, DAILY_LOOK, CHALLENGE_INVITE, CHALLENGE_RESULT, ACHIEVEMENT_UNLOCKED, ROOM_LEVEL_UP, HYPE_MILESTONE, COUPON_AVAILABLE, FAI_POINTS |
| PhotoOrigin | 8 | WARDROBE_ITEM, SCHEME, TRY_ON, STYLE_DNA, PROFILE, BACKGROUND_STUDIO, LOOSE, EDITOR |
| PhotoProcessingStatus | 6 | NEW, MODERATING, PROCESSING, COMPLETED, NEEDS_REUPLOAD, FAILED |
| PieceImageStatus | 5 | PENDING, PROCESSING, COMPLETED, NEEDS_REVIEW, FAILED |
| PieceImageType | 6 | ORIGINAL, CANONICAL, DETAIL, LOGO_DETAIL, TEXTURE_DETAIL, SEGMENTATION_MASK |
| PipelineJobStatus | 8 | PENDING, RUNNING, RENDERING, ENHANCING, COMPOSITING, COMPLETED, FAILED, CANCELLED |
| PipelineJobType | 14 | PIECE_ANALYSIS, FLAT_LAY_STANDARDIZATION, CONTENT_MODERATION, BACKGROUND_GENERATION, SCHEME_CARD_RENDER, TRY_ON_2D, OUTFIT_RENDER, TRY_ON_POLISH, CATEGORY_FALLBACK_COMPOSITION, STYLE_DNA_SYNTHESIS, EMBEDDING_GENERATION, HYPE_SCORE_RECALC, DATA_EXPORT, THREE_D_GENERATION |
| ProfileType | 4 | PESSOAL, MARCA, CELEBRIDADE, ADMIN |
| PromotionStatus | 4 | AVAILABLE, REDEEMED, EXPIRED, REVOKED |
| PromotionType | 10 | DESCONTO_ECOMMERCE, CUPOM_LOJA, EVENTO, SHOW, FRETE_GRATIS, BRINDE, ACESSO_ANTECIPADO, MEET_GREET, PRE_VENDA, CONTEUDO_EXCLUSIVO |
| ReactionType | 4 | LIKE, TREND, ELEGANTE, CRIATIVO |
| RedemptionStatus | 3 | ISSUED, USED, EXPIRED |
| RenderStatus | 7 | PENDING, RENDERING, ENHANCING, COMPOSITING, CACHED, COMPLETED, FAILED |
| SchemeOrigin | 8 | CRIAR_LOOK, PROVADOR, REMIX, COPILOT, DNA_DUPLICATE, SMART_MIRROR, VISTA_ME, AUTOPILOTO |
| SchemeSlot | 6 | TOP, BOTTOM, SHOES, ACCESSORY, FULL_BODY, OUTERWEAR |
| SchemeStatus | 3 | DRAFT, PUBLISHED, ARCHIVED |
| SealBondBasis | 2 | BRAND_MATCH, STYLE_SIGNATURE |
| SealBondOrigin | 2 | AI_SUGGESTION, MANUAL |
| SealBondStatus | 8 | SUGGESTED, ACCEPTED, EDITED, REFUSED, PENDING_REVIEW, APPROVED, REJECTED, REVOKED |
| SealStatus | 2 | ACTIVE, INACTIVE |
| SealTier | 2 | PECA, LOOK |
| Season | 4 | SPRING, SUMMER, AUTUMN, WINTER |
| ShareChannel | 2 | FEED, EXTERNAL |
| SizeSystem | 4 | BR, EU, US, UK |
| StyleArchetype | 5 | ROMANTIC, DRAMATIC, CLASSIC, NATURAL, GAMINE |
| TargetType | 3 | PIECE, SCHEME, DNA |
| ThemeMode | 3 | LIGHT, DARK, AUTO |
| TrainingCandidateStatus | 5 | CANDIDATE, APPROVED, EXPORTED, REJECTED, REVOKED |
| TryOnLayer | 4 | BASE, INTERMEDIATE, OUTER, ACCESSORY |
| UiDensity | 2 | COMFORTABLE, COMPACT |
| UiLanguage | 3 | PT_BR, EN, ES |
| UnitSystem | 2 | CM, IN |
| VerificationPurpose | 4 | EMAIL_VERIFICATION, EMAIL_CHANGE, TWO_FACTOR, PASSWORD_RESET |
| Visibility | 3 | PRIVATE, FOLLOWERS, PUBLIC |
| VisionDataset | 2 | GARMENT_VISION, HARD_EXAMPLES |
| WeekPlanStatus | 3 | ACTIVE, DISCARDED, COMPLETED |

