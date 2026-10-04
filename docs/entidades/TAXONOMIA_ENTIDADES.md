# Taxonomia das entidades do FashionAI

**Data:** 2026-10-04 · **Fonte de verdade:** código atual (`fai-domain/src/main/java/br/com/fashionai/domain/model/`, migrações Flyway V1…V30 em `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/`, repositórios e serviços de `fai-application`/`fai-web`).

## Método

1. Varredura de todas as classes com `@Entity` no módulo `fai-domain` (`grep -l "@Entity"` → **99 entidades**; `AuditableEntity` e `VersionedAuditableEntity` são `@MappedSuperclass`, listadas ao fim).
2. Leitura de `@Table(name=…)`, da superclasse, das associações `@ManyToOne`/`@OneToOne` (todas `FetchType.LAZY`), das referências por `UUID …Id` e dos campos tipados por enum de `model/enums/`.
3. Migração de origem = primeiro `CREATE TABLE <tabela>` encontrado nas migrações V1…V30 (o módulo `target/` foi ignorado).
4. Mapa RF → entidades construído do grafo de injeção por construtor controller → serviço → repositório JPA (`fai-web`, `fai-application`), com a numeração convertida para o Trello.
5. Registros antigos usados apenas como vocabulário: `docs/novo-projeto/tabela-entidades-rf-bancos.md` e `docs/planilhas/ETAPA12_IA_E_ENTIDADES_POR_RF.md`.

## Regra de numeração

A numeração oficial dos requisitos é a do **Trello** (board "TCC 2026 (Fashion AI) - Bryan,Matheus", lista *Requisitos Funcionais*). Parte do código e dos `@Operation` do Swagger usa a numeração anterior; a tabela de colisões está em [`docs/novos-rf/README.md`](../novos-rf/README.md). Conversões aplicadas neste documento: código RF32 → Trello **RF27** (Meu Quarto), código RF33 do `MirrorController` → **RF28** (Smart Mirror), código RF34 → **RF29** (Inventory Score), código RF35 → **RF30** (FAI Points), código RF36 → **RF32** (Desafios), código RF4 das classes de V29 → **RF45** (captura adaptativa). RF47 ("Acervo & Busca Catalogada") ainda não tem card no Trello; o número vem do código (`CatalogController`).

Tipos usados na coluna *Tipo*: **raiz** = agregado próprio, criado de forma independente; **filha** = existe em função de uma raiz (FK/UUID obrigatório); **associativa** = liga duas ou mais entidades (vínculo, voto, item de composição); **log** = append-only ou snapshot materializado.

![Visão geral dos contextos](taxonomia-contextos.png)

*Diagrama: [`taxonomia-contextos.puml`](taxonomia-contextos.puml) (PlantUML, layout Smetana).*

## Taxonomia por contexto delimitado

### 1. Identidade & Conta

Conta, sessão, segurança, consentimentos LGPD, preferências e notificações in-app (RF1, RF2, RF3, RF23, RNF2, RNF3, RNF10).

| Entidade | Tabela | Tipo | RF (Trello) | Relações principais | Enum de ciclo de vida | Migração |
|---|---|---|---|---|---|---|
| `User` | `users` | raiz | RF1, RF2, RF3, RF23 | — | AccountStatus {PENDING_EMAIL_VERIFICATION, ACTIVE, PENDING_VALIDATION, SUSPENDED, DELETION_SCHEDULED, DELETED} | V1 |
| `RefreshToken` | `refresh_tokens` | filha | RF2, RF3 | `user` → User (N:1), `familyId` (UUID), `rotatedFromId` (UUID) | — (revogação por `revokedAt`; família = sessão ativa) | V1 |
| `VerificationCode` | `verification_codes` | filha | RF1, RF2, RF3 | `user` → User (N:1) | VerificationPurpose {EMAIL_VERIFICATION, EMAIL_CHANGE, TWO_FACTOR, PASSWORD_RESET} (finalidade; consumo por `usedAt`) | V2 |
| `UserConsent` | `user_consents` | filha | RF3, RF24 | `user` → User (N:1) | ConsentPurpose {AI_RECOMMENDATION, AI_EXTERNAL_PHOTO_PROCESSING, HISTORY_FOR_RECOMMENDATION, PERSONALIZED_ADS, PARTNER_SHARING, BODY_MEASUREMENTS, FACIAL_RECOGNITION, LOCATION_HISTORY, AI_MODEL_TRAINING} (finalidade; estado por `granted`/`revokedAt`) | V2 |
| `UserPreferences` | `user_preferences` | filha | RF3, RF23 | `user` → User (1:1) | — (ThemeMode, UiLanguage, UiDensity, SizeSystem, UnitSystem, MannequinSex, BodyBuild) | V2 |
| `DataExportRequest` | `data_export_requests` | filha | RF3 | `user` → User (N:1) | ExportStatus {REQUESTED, PROCESSING, READY, EXPIRED} | V2 |
| `Notification` | `notifications` | filha | RF3, RF17, RF19 (RNF10) | `recipient` → User (N:1), `actor` → User (N:1), `resourceId` (UUID) | — (NotificationType / NotificationCategory; leitura por `readAt`) | V1 |

Herança/versão: `User` → VersionedAuditableEntity (@Version); `RefreshToken` → VersionedAuditableEntity (@Version); `VerificationCode` → VersionedAuditableEntity (@Version); `UserConsent` → VersionedAuditableEntity (@Version); `UserPreferences` → VersionedAuditableEntity (@Version); `DataExportRequest` → VersionedAuditableEntity (@Version); `Notification` → VersionedAuditableEntity (@Version).

### 2. Guarda-roupa & Peças

A peça do usuário (posse), suas fotos, diário de uso, estados do acervo e agrupamentos locais (RF4, RF6, RF7, RF12, RF31).

| Entidade | Tabela | Tipo | RF (Trello) | Relações principais | Enum de ciclo de vida | Migração |
|---|---|---|---|---|---|---|
| `WardrobeItem` | `wardrobe_items` | raiz | RF4, RF7, RF31, RF45, RF47 | `user` → User (N:1), `brandProfile` → BrandProfile (N:1), `brand` → Brand (N:1), `processingJobId` (UUID), `hypeGroupId` (UUID), `remixedFromPieceId` (UUID), `groupingId` (UUID). *V30 acrescenta `catalogProductId`, `catalogVariantId`, `imageOrigin` (ImageOrigin: CATALOG, USER_PHOTO) e `userImageUrl`* | AvailabilityStatus {AVAILABLE, UNAVAILABLE, ARCHIVED} (+ ModerationStatus, PhotoProcessingStatus, Model3dStatus) | V1 |
| `Photo` | `photos` | filha | RF12, RF15 | `user` → User (N:1), `sourceEntityId` (UUID), `editedFromPhotoId` (UUID) | ModerationStatus {PENDING, APPROVED, REJECTED_POLICY, REJECTED_NOT_CLOTHING} (+ PhotoOrigin) | V1 |
| `PieceUsageDiaryEntry` | `piece_usage_diary` | log | RF28, RF29 | `wardrobeItemId` (UUID), `userId` (UUID), `schemeId` (UUID) | — | V5 |
| `WardrobeAvailabilityChange` | `wardrobe_availability_log` | log | RF29, RF31 | `wardrobeItemId` (UUID), `userId` (UUID) | — | V5 |
| `AcervoGroup` | `acervo_groups` | filha | RF6 | `user` → User (N:1) | — (HypeEntityType) | V2 |

Herança/versão: `WardrobeItem` → VersionedAuditableEntity (@Version); `Photo` → VersionedAuditableEntity (@Version); `PieceUsageDiaryEntry` → sem superclasse; `WardrobeAvailabilityChange` → sem superclasse; `AcervoGroup` → VersionedAuditableEntity (@Version).

### 3. Captura adaptativa & Visão computacional — RF45

Pipeline de validação, filtragem e padronização de imagens canônicas (Trello RF45; no código ainda anotado como RF4). Migração V29 (`adaptive_garment_capture`), mais `quality_scores` (V2, RFC RF4).

| Entidade | Tabela | Tipo | RF (Trello) | Relações principais | Enum de ciclo de vida | Migração |
|---|---|---|---|---|---|---|
| `CaptureSession` | `capture_sessions` | raiz | RF45 (código: RF4) | `userId` (UUID), `draftJobId` (UUID), `pieceId` (UUID) | CaptureSessionStatus {ANALYZING, AWAITING_CAPTURE, READY_FOR_REVIEW, COMPLETED, ABANDONED} | V29 |
| `CaptureRequest` | `capture_requests` | filha | RF45 (código: RF4) | `sessionId` (UUID), `fulfilledImageId` (UUID) | CaptureRequestStatus {PENDING, FULFILLED, SKIPPED, SUPERSEDED} (+ CaptureView, CapturePurpose, CaptureNeed) | V29 |
| `PieceImage` | `piece_images` | filha | RF45 (código: RF4) | `sessionId` (UUID), `pieceId` (UUID), `userId` (UUID), `derivedFromId` (UUID). *ORIGINAL nunca é sobrescrito; derivados apontam `derivedFromId`* | PieceImageStatus {PENDING, PROCESSING, COMPLETED, NEEDS_REVIEW, FAILED} (+ PieceImageType, CaptureView, CaptureRole, CapturePurpose, CaptureSource) | V29 |
| `QualityScore` | `quality_scores` | filha | RF4, RF45 | `wardrobeItemId` (UUID), `pipelineJobId` (UUID) | — (aceite por `accepted`; métricas por etapa) | V2 |
| `BrandPrediction` | `brand_predictions` | filha | RF45 (código: RF4) | `sessionId` (UUID), `pieceId` (UUID) | — (IdentificationLevel) | V29 |
| `GarmentLandmark` | `garment_landmarks` | filha | RF45 (código: RF4) | `imageId` (UUID) | — | V29 |
| `GarmentEmbedding` | `garment_embeddings` | filha | RF45 (código: RF4) | `imageId` (UUID), `userId` (UUID) | — (único por `imageId` + `modelVersion`) | V29 |
| `ModelRegistryEntry` | `model_registry` | raiz | RF45 (código: RF4) | — | ModelDeploymentStatus {CANDIDATE, SHADOW, CANARY, PRODUCTION, RETIRED} | V29 |
| `ModelInference` | `model_inferences` | log | RF45 (código: RF4) | `sessionId` (UUID), `imageId` (UUID), `aiInferenceId` (UUID) | — | V29 |
| `TrainingCandidate` | `training_candidates` | filha | RF45 (código: RF4) | `imageId` (UUID), `userId` (UUID), `sessionId` (UUID), `reviewItemId` (UUID), `sourceId` (UUID) | TrainingCandidateStatus {CANDIDATE, APPROVED, EXPORTED, REJECTED, REVOKED} (+ VisionDataset) | V29 |
| `AiReviewItem` | `ai_review_items` | filha | RF45 (código: RF4) | `sessionId` (UUID), `pieceId` (UUID), `imageId` (UUID), `userId` (UUID), `reviewerId` (UUID) | AiReviewStatus {PENDING_REVIEW, CONFIRMED, DISMISSED} (+ AiReviewKind, AiReviewDecision) | V29 |
| `DatasetSource` | `dataset_sources` | raiz | RF45 (código: RF4) | — | DatasetUsage {TRAINING, EVALUATION_ONLY, DISPLAY_ONLY} (+ DatasetSourceType) | V29 |
| `KbBrandSignature` | `kb_brand_signatures` | raiz | RF45 (código: RF4) | — | — | V29 |
| `KbProductLine` | `kb_product_lines` | raiz | RF45 (código: RF4) | — | — | V29 |
| `KbProductModel` | `kb_product_models` | filha | RF45 (código: RF4) | `productLineId` (UUID) | — | V29 |

Herança/versão: `CaptureSession` → VersionedAuditableEntity (@Version); `CaptureRequest` → VersionedAuditableEntity (@Version); `PieceImage` → VersionedAuditableEntity (@Version); `QualityScore` → AuditableEntity; `BrandPrediction` → VersionedAuditableEntity (@Version); `GarmentLandmark` → VersionedAuditableEntity (@Version); `GarmentEmbedding` → VersionedAuditableEntity (@Version); `ModelRegistryEntry` → VersionedAuditableEntity (@Version); `ModelInference` → VersionedAuditableEntity (@Version); `TrainingCandidate` → VersionedAuditableEntity (@Version); `AiReviewItem` → VersionedAuditableEntity (@Version); `DatasetSource` → VersionedAuditableEntity (@Version); `KbBrandSignature` → VersionedAuditableEntity (@Version); `KbProductLine` → VersionedAuditableEntity (@Version); `KbProductModel` → VersionedAuditableEntity (@Version).

### 4. Catálogo global & Busca catalogada — RF47

Produto global conhecido pelo FashionAI (≠ posse), fontes oficiais, proveniência das imagens e ingestão (RF47 — Acervo & Busca Catalogada). Migração V30 (`catalogo_global`); `brands` (V2) e `brand_logos` (V12) passam a ser a espinha do catálogo.

| Entidade | Tabela | Tipo | RF (Trello) | Relações principais | Enum de ciclo de vida | Migração |
|---|---|---|---|---|---|---|
| `Brand` | `brands` | raiz | RF4, RF24, RF47 | `brandProfile` → BrandProfile (N:1) | — (BrandSource: SEEDED, AUTO_DETECTED) | V2 |
| `BrandAlias` | `brand_aliases` | filha | RF47 | `brandId` (UUID) | — (`alias_norm` único) | V30 |
| `BrandLogo` | `brand_logos` | filha | RF4, RF24, RF47 | — | — (chave = nome normalizado) | V12 |
| `CatalogSource` | `catalog_sources` | filha | RF47 | `brandId` (UUID) | CatalogSourceType {OFFICIAL_BRAND, OFFICIAL_STORE, AUTHORIZED_RETAILER, PARTNER_API, MANUAL_ADMIN} (+ `allowsImageCopy`) | V30 |
| `CatalogProduct` | `catalog_products` | raiz | RF47 | `brandId` (UUID). *`dedup_key` único; FULLTEXT ngram em `search_text`* | CatalogIngestionStatus {DISCOVERED, VALIDATED, PERSISTABLE, REFERENCE_ONLY, REJECTED} (+ CatalogSourceStatus, CatalogSourceType) | V30 |
| `CatalogProductAlias` | `catalog_product_aliases` | filha | RF47 | `productId` (UUID) | — (`product_id` + `alias_norm` únicos) | V30 |
| `CatalogVariant` | `catalog_variants` | filha | RF47 | `productId` (UUID) | — (`product_id` + `variant_key` únicos) | V30 |
| `CatalogImage` | `catalog_images` | filha | RF47 | `productId` (UUID), `variantId` (UUID). *REFERENCE_ONLY guarda só a URL autorizada* | CatalogImageUsage {REFERENCE_ONLY, PERSISTED, REJECTED} (+ CatalogImageType, CatalogSourceType) | V30 |
| `CatalogIngestionRun` | `catalog_ingestion_runs` | log | RF47 | — | — (`kind`/`status` texto) | V30 |

Herança/versão: `Brand` → VersionedAuditableEntity (@Version); `BrandAlias` → VersionedAuditableEntity (@Version); `BrandLogo` → VersionedAuditableEntity (@Version); `CatalogSource` → VersionedAuditableEntity (@Version); `CatalogProduct` → VersionedAuditableEntity (@Version); `CatalogProductAlias` → VersionedAuditableEntity (@Version); `CatalogVariant` → VersionedAuditableEntity (@Version); `CatalogImage` → VersionedAuditableEntity (@Version); `CatalogIngestionRun` → VersionedAuditableEntity (@Version).

### 5. Esquemas & DNA de Estilo

Esquema de vestimenta, itens por slot, agrupamentos, Look do Dia, Hype Score, Semana Planejada, DNA de Estilo e presets visuais do Background Studio (RF5–RF13, RF42, RF43).

| Entidade | Tabela | Tipo | RF (Trello) | Relações principais | Enum de ciclo de vida | Migração |
|---|---|---|---|---|---|---|
| `Scheme` | `schemes` | raiz | RF5, RF6, RF7, RF9, RF11, RF19, RF20, RF21 | `user` → User (N:1), `originalScheme` → Scheme (N:1), `renderingJobId` (UUID), `hypeGroupId` (UUID), `groupingId` (UUID) | SchemeStatus {DRAFT, PUBLISHED, ARCHIVED} (+ RenderStatus, SchemeOrigin, CreationMode, Visibility, Season, Mood, DisplayMode, BackgroundAnimation, ContainerOrigin) | V1 |
| `SchemeItem` | `scheme_items` | associativa | RF5, RF7, RF15 | `scheme` → Scheme (N:1), `wardrobeItem` → WardrobeItem (N:1) | — (SchemeSlot, TryOnLayer) | V1 |
| `SchemeGrouping` | `scheme_groupings` | raiz | RF14, RF22, RF34, RF35 | `owner` → User (N:1) | — (GroupingType) | V2 |
| `DailyLook` | `daily_looks` | raiz | RF6, RF10, RF28, RF42 | `user` → User (N:1), `scheme` → Scheme (N:1), `materializedFrom` → DailyLook (N:1) | DailyLookFeedback {ADOREI, NAO_USEI, NAO_GOSTEI} (+ DailyLookSource) | V1 |
| `HypeScoreMetric` | `hype_score_metrics` | filha | RF6 | `dailyLook` → DailyLook (N:1), `scheme` → Scheme (N:1), `user` → User (N:1) | — (HypeScoreBand) | V1 |
| `HypeGroup` | `hype_groups` | raiz | RF6 | — | — (HypeEntityType) | V2 |
| `WeekPlan` | `week_plans` | raiz | RF10, RF43 | `user` → User (N:1) | WeekPlanStatus {ACTIVE, DISCARDED, COMPLETED} | V4 |
| `WeekPlanDay` | `week_plan_days` | filha | RF10, RF43 | `weekPlan` → WeekPlan (N:1), `scheme` → Scheme (N:1) | — | V4 |
| `DnaScheme` | `dna_schemes` | raiz | RF13 | `user` → User (N:1), `iconSchemeId` (UUID), `groupingId` (UUID), `remixedFromDnaId` (UUID) | SchemeStatus {DRAFT, PUBLISHED, ARCHIVED} (+ StyleArchetype, NarrativeType, Season, BackgroundAnimation, CreationMode, Visibility) | V2 |
| `DnaSchemeItem` | `dna_scheme_items` | associativa | RF13 | `dnaScheme` → DnaScheme (N:1), `scheme` → Scheme (N:1), `sourceSchemeId` (UUID) | — (DnaCell) | V2 |
| `StyleDna` | `style_dna` | filha | RF13, RF24 | `user` → User (1:1) | — (StyleArchetype) | V1 |
| `StyleDnaVersion` | `style_dna_versions` | log | RF13 | `userId` (UUID) | — | V4 |
| `AssetPreset` | `asset_presets` | raiz | RF11, RF23 | — | — (AssetKind; `status` FALLBACK sem asset físico) | V2 |

Herança/versão: `Scheme` → VersionedAuditableEntity (@Version); `SchemeItem` → AuditableEntity; `SchemeGrouping` → VersionedAuditableEntity (@Version); `DailyLook` → VersionedAuditableEntity (@Version); `HypeScoreMetric` → VersionedAuditableEntity (@Version); `HypeGroup` → VersionedAuditableEntity (@Version); `WeekPlan` → VersionedAuditableEntity (@Version); `WeekPlanDay` → AuditableEntity; `DnaScheme` → VersionedAuditableEntity (@Version); `DnaSchemeItem` → AuditableEntity; `StyleDna` → VersionedAuditableEntity (@Version); `StyleDnaVersion` → sem superclasse; `AssetPreset` → sem superclasse.

### 6. Social

Vínculos e interações entre usuários (RF8, RF17, RF19).

| Entidade | Tabela | Tipo | RF (Trello) | Relações principais | Enum de ciclo de vida | Migração |
|---|---|---|---|---|---|---|
| `Follow` | `follows` | associativa | RF8, RF17, RF22 | `follower` → User (N:1), `following` → User (N:1) | FollowStatus {PENDENTE, ACEITO, BLOQUEADO} | V1 |
| `Comment` | `comments` | filha | RF19 | `author` → User (N:1), `targetId` (UUID), `parentCommentId` (UUID) | — (TargetType; respostas por `parentCommentId`) | V1 |
| `Reaction` | `reactions` | associativa | RF19 | `actor` → User (N:1), `targetId` (UUID) | — (TargetType, ReactionType) | V1 |
| `Share` | `shares` | filha | RF19 | `user` → User (N:1), `targetId` (UUID) | — (TargetType, ShareChannel) | V4 |
| `SavedItem` | `saved_items` | associativa | RF6, RF19 | `user` → User (N:1), `targetId` (UUID) | — (TargetType) | V2 |

Herança/versão: `Follow` → VersionedAuditableEntity (@Version); `Comment` → VersionedAuditableEntity (@Version); `Reaction` → VersionedAuditableEntity (@Version); `Share` → VersionedAuditableEntity (@Version); `SavedItem` → AuditableEntity.

### 7. Marcas, Celebridades, Selos & Cupons

Perfis institucionais, selos, vínculos esquema × marca/celebridade, promoções, resgates e direitos de cupom (RF1, RF14, RF20–RF22, RF25, RF38).

| Entidade | Tabela | Tipo | RF (Trello) | Relações principais | Enum de ciclo de vida | Migração |
|---|---|---|---|---|---|---|
| `BrandProfile` | `brand_profiles` | filha | RF1, RF14, RF20 | `owner` → User (1:1) | ApprovalStatus {PENDENTE, APROVADO, RECUSADO, SUSPENSO} (+ BrandSource) | V1 |
| `CelebrityProfile` | `celebrity_profiles` | filha | RF1, RF21, RF22 | `owner` → User (1:1) | ApprovalStatus {PENDENTE, APROVADO, RECUSADO, SUSPENSO} (`verificationStatus`) | V1 |
| `Seal` | `seals` | raiz | RF14, RF25 | `owner` → User (N:1) | SealStatus {ACTIVE, INACTIVE} (+ SealTier) | V2 |
| `SealBond` | `seal_bonds` | associativa | RF20, RF21 | `scheme` → Scheme (N:1), `targetOwner` → User (N:1), `requestedBy` → User (N:1), `seal` → Seal (N:1) | SealBondStatus {SUGGESTED, ACCEPTED, EDITED, REFUSED, PENDING_REVIEW, APPROVED, REJECTED, REVOKED} (+ SealBondBasis, SealBondOrigin, SealTier) | V2 |
| `Promotion` | `promotions` | filha | RF20, RF21, RF25 | `seal` → Seal (N:1), `sealBond` → SealBond (N:1), `partnerBrandUserId` (UUID), `campaignId` (UUID), `ownerUserId` (UUID) | PromotionStatus {AVAILABLE, REDEEMED, EXPIRED, REVOKED} (+ PromotionType, Visibility) | V2 |
| `PromotionRedemption` | `promotion_redemptions` | associativa | RF20, RF21, RF38 | `promotion` → Promotion (N:1), `sealBond` → SealBond (N:1), `user` → User (N:1), `issuerUserId` (UUID), `partnerBrandUserId` (UUID) | RedemptionStatus {ISSUED, USED, EXPIRED} | V4 |
| `CouponRight` | `coupon_rights` | filha | RF25, RF38 | `user` → User (N:1), `owner` → User (N:1), `sourceId` (UUID), `schemeId` (UUID) | `status` texto: PENDENTE → RESGATADO · DISPENSADO · EXPIRADO | V19 |

Herança/versão: `BrandProfile` → VersionedAuditableEntity (@Version); `CelebrityProfile` → VersionedAuditableEntity (@Version); `Seal` → VersionedAuditableEntity (@Version); `SealBond` → VersionedAuditableEntity (@Version); `Promotion` → VersionedAuditableEntity (@Version); `PromotionRedemption` → AuditableEntity; `CouponRight` → VersionedAuditableEntity (@Version).

### 8. Meu Quarto, Pontos, Desafios & FLAIR

Quarto 3D, espelho, Inventory Score, rankings, conquistas, FAI Points, loja do quarto, desafios e o jogo FLAIR (RF27–RF30, RF32, RF37, RF39, RF41, RF44).

| Entidade | Tabela | Tipo | RF (Trello) | Relações principais | Enum de ciclo de vida | Migração |
|---|---|---|---|---|---|---|
| `RoomLayout` | `room_layouts` | filha | RF27, RF30 | `user` → User (N:1) | — | V5 |
| `RoomStorageEntry` | `room_storage_map` | associativa | RF27 | `userId` (UUID), `wardrobeItemId` (UUID) | — | V5 |
| `RoomCatalogItem` | `room_catalog` | raiz | RF30, RF39, RF44 | `maisonBrandUserId` (UUID). *possui `@Version` próprio (não herda de VersionedAuditableEntity)* | — (`kind` texto, padrão COMPONENT) | V5 |
| `RoomInventoryItem` | `room_inventory` | filha | RF30, RF39 | `userId` (UUID) | — | V5 |
| `MirrorState` | `mirror_states` | filha | RF28 | `userId` (UUID) | — | V5 |
| `InventoryScoreSnapshot` | `inventory_score_snapshots` | log | RF29 | `userId` (UUID) | — | V5 |
| `RankingOptIn` | `ranking_opt_ins` | filha | RF29 | `userId` (UUID) | — | V5 |
| `RankingPosition` | `ranking_positions` | log | RF29 | `userId` (UUID) | — | V5 |
| `UserAchievement` | `user_achievements` | filha | RF29 | `userId` (UUID) | — | V5 |
| `FaiPointsLedgerEntry` | `fai_points_ledger` | log | RF30, RF41 | `userId` (UUID) | — (append-only; idempotente por `user_id`+`action_code`+`ref_id`) | V5 |
| `FaiPointsRule` | `fai_points_rules` | raiz | RF30, RF41 | — | — | V5 |
| `ChallengeTemplate` | `challenge_templates` | raiz | RF32 | `authorUserId` (UUID) | — | V5 |
| `ChallengeInstance` | `challenge_instances` | raiz | RF32 | — | `state` texto: rascunho → aguardando → ativo → concluído/expirado | V5 |
| `ChallengeParticipant` | `challenge_participants` | associativa | RF32 | `instanceId` (UUID), `userId` (UUID) | `status` texto | V5 |
| `ChallengeEvent` | `challenge_events` | log | RF32 | `instanceId` (UUID), `userId` (UUID), `refId` (UUID) | — | V5 |
| `ChallengeNote` | `challenge_notes` | filha | RF32 | `instanceId` (UUID), `userId` (UUID) | — | V5 |
| `ChallengeVote` | `challenge_votes` | associativa | RF32 | `instanceId` (UUID), `voterUserId` (UUID), `entrySchemeId` (UUID) | — | V5 |
| `FlairProfile` | `flair_profiles` | filha | RF37 | `user` → User (N:1) | — | V18 |
| `FlairCoinEntry` | `flair_coin_entries` | log | RF37 | `user` → User (N:1) | — ((motivo, referência) única por usuário) | V18 |
| `FlairCombination` | `flair_combinations` | raiz | RF37, RF38 | `brand` → User (N:1) | — | V18 |
| `FlairRedemption` | `flair_redemptions` | associativa | RF37, RF38 | `combination` → FlairCombination (N:1), `user` → User (N:1), `scheme` → Scheme (N:1) | — | V18 |
| `FlairMatch` | `flair_matches` | raiz | RF37 | `createdByUser` → User (N:1), `teamAId` (UUID), `teamBId` (UUID) | `status` texto (+ `mode`) | V18 |
| `FlairMatchEntry` | `flair_match_entries` | associativa | RF37 | `match` → FlairMatch (N:1), `user` → User (N:1), `scheme` → Scheme (N:1) | — | V18 |
| `FlairTeam` | `flair_teams` | raiz | RF37 | `owner` → User (N:1) | — | V18 |
| `FlairTeamMember` | `flair_team_members` | associativa | RF37 | `team` → FlairTeam (N:1), `user` → User (N:1) | — | V18 |
| `FlairModeState` | `flair_mode_states` | filha | RF37 | `user` → User (N:1) | — | V19 |
| `FlairTerritory` | `flair_territories` | filha | RF37 | `owner` → User (N:1) | — | V19 |
| `FlairTrophy` | `flair_trophies` | filha | RF37 | `user` → User (N:1) | — | V19 |

Herança/versão: `RoomLayout` → VersionedAuditableEntity (@Version); `RoomStorageEntry` → AuditableEntity; `RoomCatalogItem` → sem superclasse (@Version); `RoomInventoryItem` → sem superclasse; `MirrorState` → AuditableEntity; `InventoryScoreSnapshot` → sem superclasse; `RankingOptIn` → sem superclasse; `RankingPosition` → sem superclasse; `UserAchievement` → sem superclasse; `FaiPointsLedgerEntry` → sem superclasse; `FaiPointsRule` → sem superclasse; `ChallengeTemplate` → sem superclasse; `ChallengeInstance` → sem superclasse; `ChallengeParticipant` → sem superclasse; `ChallengeEvent` → sem superclasse; `ChallengeNote` → sem superclasse; `ChallengeVote` → sem superclasse; `FlairProfile` → VersionedAuditableEntity (@Version); `FlairCoinEntry` → VersionedAuditableEntity (@Version); `FlairCombination` → VersionedAuditableEntity (@Version); `FlairRedemption` → VersionedAuditableEntity (@Version); `FlairMatch` → VersionedAuditableEntity (@Version); `FlairMatchEntry` → VersionedAuditableEntity (@Version); `FlairTeam` → VersionedAuditableEntity (@Version); `FlairTeamMember` → VersionedAuditableEntity (@Version); `FlairModeState` → VersionedAuditableEntity (@Version); `FlairTerritory` → VersionedAuditableEntity (@Version); `FlairTrophy` → VersionedAuditableEntity (@Version).

### 9. Provador, 3D & Avatar

Provador 2D, renders e o Meu Avatar 3D (RF16, RF18, RF36, RF40). O estado 3D da peça fica em `WardrobeItem.model3dStatus` (Model3dStatus).

| Entidade | Tabela | Tipo | RF (Trello) | Relações principais | Enum de ciclo de vida | Migração |
|---|---|---|---|---|---|---|
| `UserAvatar3d` | `user_avatars_3d` | filha | RF40 | `user` → User (1:1) | ModerationStatus {PENDING, APPROVED, REJECTED_POLICY, REJECTED_NOT_CLOTHING} (`textureModeration`) | V25 |
| `RenderJobLog` | `render_jobs_log` | log | RF18 | `pipelineJobId` (UUID), `schemeId` (UUID), `userId` (UUID) | — | V2 |

Herança/versão: `UserAvatar3d` → VersionedAuditableEntity (@Version); `RenderJobLog` → sem superclasse.

### 10. IA & Governança

Motor transversal de IA, moderação e embeddings (RF24, RN11).

| Entidade | Tabela | Tipo | RF (Trello) | Relações principais | Enum de ciclo de vida | Migração |
|---|---|---|---|---|---|---|
| `AiInferenceLog` | `ai_inference_log` | log | RF24 | `userId` (UUID) | AiCallResult {SUCCESS, FALLBACK_LOCAL, TIMEOUT, CIRCUIT_OPEN, RATE_LIMITED, CONSENT_DENIED, PROMPT_REJECTED, ERROR} | V2 |
| `ModerationQueueItem` | `moderation_queue` | filha | RF24 (RN11) | `targetId` (UUID), `userId` (UUID) | ModerationQueueStatus {PENDING_REVIEW, APPROVED, REJECTED} | V2 |
| `ItemEmbedding` | `item_embeddings` | filha | RF6, RF8, RF12, RF24 | `entityId` (UUID), `userId` (UUID) | — (HypeEntityType) | V2 |
| `MetricSnapshot` | `metric_snapshots` | log | RF4, RF18 (ADM) | — | — (`kind`: QUALITY / RENDER_COST) | V2 |

Herança/versão: `AiInferenceLog` → sem superclasse; `ModerationQueueItem` → VersionedAuditableEntity (@Version); `ItemEmbedding` → VersionedAuditableEntity (@Version); `MetricSnapshot` → sem superclasse.

### 11. Infra & Operação

Auditoria, backup e jobs assíncronos (RNF4, RNF5, RF4/RF18/RF24).

| Entidade | Tabela | Tipo | RF (Trello) | Relações principais | Enum de ciclo de vida | Migração |
|---|---|---|---|---|---|---|
| `AuditLog` | `audit_log` | log | RNF5 (todos os RF) | — | — | V1 |
| `BackupRecord` | `backup_records` | log | RNF4 | — | — (`kind`/`status` texto) | V2 |
| `PipelineJob` | `pipeline_jobs` | raiz | RF4, RF5, RF11, RF16, RF18, RF24 | `user` → User (N:1), `inputResourceId` (UUID) | PipelineJobStatus {PENDING, RUNNING, RENDERING, ENHANCING, COMPOSITING, COMPLETED, FAILED, CANCELLED} (+ PipelineJobType) | V1 |
| `ProcessingJobLog` | `processing_jobs_log` | log | RF4, RF45 | `pipelineJobId` (UUID), `wardrobeItemId` (UUID), `userId` (UUID) | — | V2 |

Herança/versão: `AuditLog` → sem superclasse; `BackupRecord` → sem superclasse; `PipelineJob` → VersionedAuditableEntity (@Version); `ProcessingJobLog` → sem superclasse.

### Classes-base (`@MappedSuperclass`)

| Classe | Campos | Usada por |
|---|---|---|
| `AuditableEntity` | `id` UUID CHAR(36) (`GenerationType.UUID`), `createdAt`, `updatedAt`, `createdBy`, `lastModifiedBy` (`AuditingEntityListener`, RNF5) | 8 entidades diretamente (`DnaSchemeItem`, `SchemeItem`, `WeekPlanDay`, `PromotionRedemption`, `QualityScore`, `SavedItem`, `MirrorState`, `RoomStorageEntry`) + todas as versionadas |
| `VersionedAuditableEntity` | herda `AuditableEntity` + `@Version long version` (concorrência otimista) | 67 entidades (agregados mutáveis) |
| *(sem superclasse)* | `@Id` próprio, sem auditoria JPA — logs, ledgers e tabelas de jogo/quarto (V5) | 24 entidades: `AiInferenceLog`, `AssetPreset`, `AuditLog`, `BackupRecord`, `ChallengeEvent`, `ChallengeInstance`, `ChallengeNote`, `ChallengeParticipant`, `ChallengeTemplate`, `ChallengeVote`, `FaiPointsLedgerEntry`, `FaiPointsRule`, `InventoryScoreSnapshot`, `MetricSnapshot`, `PieceUsageDiaryEntry`, `ProcessingJobLog`, `RankingOptIn`, `RankingPosition`, `RenderJobLog`, `RoomCatalogItem`, `RoomInventoryItem`, `StyleDnaVersion`, `UserAchievement`, `WardrobeAvailabilityChange` |

Total: **99 entidades `@Entity`** + 2 classes-base.

## Regras transversais (confirmadas no código)

| Regra | Evidência no código |
|---|---|
| Concorrência otimista `@Version` | `VersionedAuditableEntity` (67 entidades) e `RoomCatalogItem` (campo `@Version` próprio). Logs, ledgers e tabelas de V5 (desafios, pontos, ranking) não versionam. |
| Associações sempre `FetchType.LAZY` | `grep '@ManyToOne\|@OneToOne' fai-domain … \| grep -v LAZY` → vazio. Nenhuma associação EAGER. |
| Ausência de coleções `@OneToMany`/`@ManyToMany` | `grep -rln '@OneToMany\|@ManyToMany' fai-domain/src/main/java` → nenhum arquivo; listas saem paginadas pelos repositórios. Muitas ligações são `UUID …Id` sem FK JPA (ex.: `CatalogProduct.brandId`, `PieceImage.sessionId`). |
| Cifra AES-GCM em repouso (RNF3) | `br.com.fashionai.domain.security.AesGcmStringConverter` (`AES/GCM/NoPadding`, IV 12 bytes, tag 128 bits, prefixo `enc:v1:`), aplicado via `@Convert` em `User` (5 campos), `BrandProfile` (3), `CelebrityProfile` (3), `StyleDna` (2), `Comment` (1), `DnaScheme` (1), `VerificationCode` (1). |
| Auditoria `AuditService` → `audit_log` em `REQUIRES_NEW` (RNF5) | `MysqlAuditService.record` anotado com `@Transactional(propagation = REQUIRES_NEW)`: um 403 ou erro do fluxo principal não apaga o registro. Padrão repetido em `SideEffectRunner`, `FaiPointsService`, `CouponService`, `InventoryScoreService`, `UploadQuarantine`. |
| Catálogo: `dedup_key` único e FULLTEXT ngram (RF47) | V30: `CONSTRAINT uq_catalog_products_dedup UNIQUE (dedup_key)` (gtin > ean > upc > sku > código > nome normalizado) e `CREATE FULLTEXT INDEX ftx_catalog_products_search ON catalog_products(search_text) WITH PARSER ngram`; também únicos `uq_brand_aliases_norm`, `uq_catalog_sources (brand_id, domain)`, `uq_catalog_product_aliases`, `uq_catalog_variants`, `uq_catalog_images (product_id, image_url_hash)`. |
| Originais nunca sobrescritos (RF45) | `PieceImage` (V29): "ORIGINAL nunca é sobrescrito (chave única)" — `uq_piece_images_key UNIQUE (storage_key)`; CANONICAL/DETAIL/LOGO_DETAIL/TEXTURE_DETAIL derivam por `derived_from_id`; reprocessamento marca `superseded` em vez de apagar. `ModelInference` registra qual modelo/versão produziu cada resultado. |
| Proveniência e licença das imagens do catálogo (RF47) | `CatalogSourceType {OFFICIAL_BRAND, OFFICIAL_STORE, AUTHORIZED_RETAILER, PARTNER_API, MANUAL_ADMIN}`, `CatalogSourceStatus {ACTIVE, UNAVAILABLE, SOURCE_REMOVED, NEEDS_REVALIDATION}`, `CatalogIngestionStatus {DISCOVERED, VALIDATED, PERSISTABLE, REFERENCE_ONLY, REJECTED}`, `CatalogImageUsage {REFERENCE_ONLY, PERSISTED, REJECTED}`. `CatalogIngestService` só aceita URLs https e grava `REFERENCE_ONLY` a menos que `CatalogSource.allowsImageCopy`; `OfficialCatalogDiscovery` busca apenas nos domínios oficiais da marca ("a busca não é licença de reuso"). Para treinamento (RF45), `DatasetSource` guarda `DatasetSourceType`/`DatasetUsage` e `TrainingCandidate` exige consentimento (`ConsentPurpose.AI_MODEL_TRAINING`). |
| Consentimento por finalidade antes de IA externa (RF24.CA15) | `UserConsent` por `ConsentPurpose`; `AiCapability.consentPurpose()` declara a finalidade; sem consentimento a capacidade degrada para o motor local (`AiCallResult.CONSENT_DENIED`). |
| Ledgers idempotentes | `FaiPointsLedgerEntry` (chave `user_id`+`action_code`+`ref_id`), `FlairCoinEntry` ((motivo, referência) única), `UserAchievement` (concedida uma vez), `ChallengeVote` (único por votante/entrada). |

## Mapa RF → entidades

Fonte: construtor de cada controller (`fai-web`) → serviços (`fai-application`) → repositórios JPA (`fai-domain/.../repository`), profundidade 1, mais chamadas explícitas (`FaiPointsService`, `AuditService`). Entidades transversais omitidas em cada linha: `AuditLog` (todo fluxo que chama `AuditService`), `Notification` quando só notifica, `AiInferenceLog` quando só registra.

| RF (Trello) | Requisito | Controllers → serviços | Entidades |
|---|---|---|---|
| RF1 | Cadastrar conta (Pessoal, Marca ou Celebridade) | `AuthController`, `PreferencesController` → `IdentityService` | User, RefreshToken, VerificationCode, UserPreferences, BrandProfile, CelebrityProfile, Notification |
| RF2 | Autenticar usuário | `AuthController` → `IdentityService` | User, RefreshToken, VerificationCode, Notification |
| RF3 | Gerenciar conta, sessão, segurança, privacidade (LGPD) e notificações | `MeController`, `AccountController`, `PreferencesController` → `AccountService`, `IdentityService`, `PreferencesService` | User, RefreshToken, VerificationCode, UserConsent, UserPreferences, DataExportRequest, Notification, Photo (+ leitura/apagamento em cascata de Scheme, SchemeItem, WardrobeItem, Comment, Reaction, SavedItem, Follow, DnaScheme, StyleDna, AiInferenceLog) |
| RF4 | Adicionar peça por fotografia e formulário | `WardrobeController`, `BrandLogoController`, `SealController` → `WardrobeService`, `MultiPieceService`, `BrandLogoService` | WardrobeItem, Photo, PipelineJob, ProcessingJobLog, QualityScore, ModerationQueueItem, Brand, BrandLogo, AiInferenceLog, ItemEmbedding, FaiPointsLedgerEntry (RF41) |
| RF5 | Criar esquema de vestimenta ("Criar Look") | `SchemeController`, `DnaController`, `SealController` → `SchemeService` | Scheme, SchemeItem, WardrobeItem, Reaction, SavedItem, StyleDna, PipelineJob (render do card), AiInferenceLog |
| RF6 | Perfil Lookbook (Closet Digital + Looks Salvos) | `LookbookController`, `SchemeController`, `SocialController` → `LookbookService`, `DailyLookService`, `HypeScoreService` | AcervoGroup, SavedItem, Scheme, SchemeGrouping, SchemeItem, WardrobeItem, DailyLook, HypeGroup, HypeScoreMetric, MetricSnapshot, ItemEmbedding |
| RF7 | Detalhe de uma peça a partir do esquema | `WardrobeController`, `CommentController`, `SchemeController` | WardrobeItem, SchemeItem, Scheme, PieceUsageDiaryEntry, RoomStorageEntry |
| RF8 | Buscar esquemas & peças de outros usuários | `DiscoveryController`, `SocialController`, `CommentController` → `SearchService`, `SocialService` | Scheme, WardrobeItem, User, BrandProfile, CelebrityProfile, Follow, SealBond, Share, StyleDna, ItemEmbedding (Affinity) |
| RF9 | Editar esquema e suas peças | `SchemeController` → `SchemeService` | Scheme, SchemeItem, WardrobeItem, AiInferenceLog (Edit Assistant) |
| RF10 | Copilot / recomendações | `AutopilotController`, `LookbookController` → `CopilotService`, `AutopilotService` | Scheme, SchemeItem, WardrobeItem, DailyLook, StyleDna, UserPreferences, WeekPlan, WeekPlanDay, AiInferenceLog |
| RF11 | Background Studio (arte de fundo do card) | `BackgroundController`, `SchemeController` → `BackgroundStudioService`, `AssetCatalogService` | AssetPreset, Scheme, WardrobeItem, CelebrityProfile, Photo, PipelineJob, AiInferenceLog |
| RF12 | "Minhas Fotos" | `PhotoController`, `WardrobeController`, `SchemeController` → `PhotoService` | Photo, WardrobeItem, Scheme, ItemEmbedding (Photo Curator) |
| RF13 | DNA de Estilo | `DnaController` → `DnaService` | DnaScheme, DnaSchemeItem, StyleDna, StyleDnaVersion, Scheme, SchemeItem, DailyLook, AiInferenceLog |
| RF14 | Aba "Marcas" (feed de perfis de marca) | `ProfileController`, `FlairController`, `LookbookController` → `InstitutionalService`, `ProfileService` | BrandProfile, Seal, SealBond, SchemeGrouping, Follow, Reaction, SavedItem, Scheme, FlairCombination |
| RF15 | Editor Canvas 2D da foto da peça | `WardrobeController`, `PhotoController`, `DiscoveryController` | WardrobeItem, Photo, SchemeItem, ItemEmbedding |
| RF16 | Geração 3D das peças (API externa) | `WardrobeController`, `ShowcaseController` → `Model3dService` | WardrobeItem (`model3dStatus`), PipelineJob, AiInferenceLog |
| RF17 | Perfil de outros usuários | `ProfileController`, `NotificationController`, `WardrobeController`, `SocialController` | User, Follow, Scheme, WardrobeItem, Notification |
| RF18 | Provador 2D virtual | `TryOnController` → `TryOnService` | Scheme, SchemeItem, WardrobeItem, UserPreferences, PipelineJob, RenderJobLog, MetricSnapshot, AiInferenceLog |
| RF19 | Interações sociais (reagir, comentar, salvar, compartilhar, remixar) | `SocialController`, `CommentController`, `SchemeController` → `SocialService` | Comment, Reaction, Share, SavedItem, Scheme, SchemeItem, WardrobeItem, DnaScheme, Notification, FaiPointsLedgerEntry |
| RF20 | Esquema vinculado a marca | `SealController`, `SchemeController` → `SealService` | SealBond, Seal, Scheme, SchemeItem, WardrobeItem, BrandProfile, Promotion, PromotionRedemption, Notification |
| RF21 | Esquema vinculado a celebridade | `SealController` → `SealService` | SealBond, Seal, Scheme, CelebrityProfile, Promotion, PromotionRedemption, Notification |
| RF22 | Aba "Celebridades" | `ProfileController`, `FlairController`, `ShowcaseController`, `SealController` → `InstitutionalService` | CelebrityProfile, Seal, SealBond, SchemeGrouping, Follow, Scheme, FlairCombination |
| RF23 | Preferências de interface e dados não sensíveis | `PreferencesController`, `BackgroundController` → `PreferencesService` | UserPreferences, User, AssetPreset |
| RF24 | Motor transversal de IA | `MeController` (consentimentos), `AdminController` → `AiEngine` | AiInferenceLog, UserConsent, ModerationQueueItem, Brand (Brand Resolver), BrandLogo, StyleDna, ItemEmbedding |
| RF25 | Criar & editar selo + política de promoção | `SealController`, `CouponController` → `SealService`, `SealDesignService`, `CouponService` | Seal, Promotion, PromotionRedemption, SealBond, BrandProfile, CelebrityProfile, CouponRight |
| RF26 | Explorador Global | `DiscoveryController` → `ExplorerService`, `SearchService` | BrandProfile, SealBond, Scheme, WardrobeItem, User, AiInferenceLog (Insight Generator) |
| RF27 | Meu Quarto 3D (código: RF32) | `RoomController` → `RoomService` | RoomLayout, RoomStorageEntry, RoomCatalogItem, RoomInventoryItem, WardrobeItem, Scheme, DailyLook, PieceUsageDiaryEntry, UserAchievement, FaiPointsLedgerEntry, StyleDna |
| RF28 | Smart Mirror + Vista-me (código: RF33 no `MirrorController`) | `MirrorController` → `MirrorService` | MirrorState, Scheme, SchemeItem, WardrobeItem, StyleDna, DailyLook, PieceUsageDiaryEntry |
| RF29 | FAI Inventory Score, destaques e rankings (código: RF34) | `HighlightsController` → `InventoryScoreService`, `AchievementService` | InventoryScoreSnapshot, RankingOptIn, RankingPosition, UserAchievement, WardrobeAvailabilityChange, PieceUsageDiaryEntry, WardrobeItem, Scheme, SchemeItem, ChallengeTemplate |
| RF30 | FAI Points, níveis e loja do quarto (código: RF35) | `RoomController`, `HighlightsController` → `FaiPointsService`, `RoomService` | FaiPointsLedgerEntry, FaiPointsRule, RoomCatalogItem, RoomInventoryItem, RoomLayout |
| RF31 | Estados do acervo (favorita, disponível, indisponível, à venda) | `WardrobeController` → `WardrobeService` | WardrobeItem (`AvailabilityStatus`, `favorite`, `forSale`), WardrobeAvailabilityChange |
| RF32 | Desafios (código: RF36) | `ChallengeController` → `ChallengeService` | ChallengeTemplate, ChallengeInstance, ChallengeParticipant, ChallengeEvent, ChallengeNote, ChallengeVote, Scheme, DailyLook, Follow, PieceUsageDiaryEntry, Notification, FaiPointsLedgerEntry |
| RF33 | Passarela 3D | `ShowcaseController` → `ShowcaseService` | DailyLook, Scheme, SchemeItem, User, UserPreferences, Follow, CelebrityProfile, SchemeGrouping, UserAvatar3d |
| RF34 | Eras da celebridade | `HighlightsController`/`ProfileController` (`@Operation` RF34) → `InstitutionalService` | SchemeGrouping (GroupingType ERA/PHASE), CelebrityProfile, Scheme |
| RF35 | Coleções da marca | `ProfileController` → `InstitutionalService` | SchemeGrouping (GroupingType COLLECTION/SEASON), BrandProfile, Scheme |
| RF36 | Foto com meu manequim | `TryOnController`, `ShowcaseController` → `TryOnService`, `Avatar3dService` | Scheme, WardrobeItem, UserPreferences, UserAvatar3d |
| RF37 | FLAIR (cartas, 15 modos, combinações das lojas) | `FlairController`, `FlairModesController` → `FlairService`, `FlairModesService` | FlairProfile, FlairCoinEntry, FlairCombination, FlairRedemption, FlairMatch, FlairMatchEntry, FlairTeam, FlairTeamMember, FlairModeState, FlairTerritory, FlairTrophy, Scheme, SchemeItem, WardrobeItem, BrandProfile, Reaction |
| RF38 | Cupons Fashion AI | `CouponController` → `CouponService` | CouponRight, FlairCombination, FlairRedemption, Promotion, PromotionRedemption, BrandProfile, CelebrityProfile, Notification |
| RF39 | Criar guarda-roupa 3D + loja do guarda-roupa | `RoomCreatorController` → `WardrobeCreatorService` | RoomCatalogItem, RoomInventoryItem, BrandProfile, CelebrityProfile, Seal, SealBond, User |
| RF40 | Meu Avatar 3D | `Avatar3dController` → `Avatar3dService` | UserAvatar3d, User, UserConsent, AiInferenceLog |
| RF41 | FAI Points em todos os jogos e criações | `FaiPointsService` (chamado por `WardrobeService`, `SchemeService`, `ChallengeService`, `FlairService`, `CatalogService`) | FaiPointsLedgerEntry, FaiPointsRule |
| RF42 | Marcar um look como "Look do dia" | `LookbookController` → `DailyLookService` | DailyLook, Scheme, SchemeItem, HypeScoreMetric |
| RF43 | Autopiloto gera combinações com IA | `AutopilotController` → `AutopilotService` | WeekPlan, WeekPlanDay, Scheme, SchemeItem, WardrobeItem, UserPreferences, AiInferenceLog |
| RF44 | Marcas & celebridades vendem itens únicos do quarto/Background Studio na loja | `RoomCreatorController`, `RoomController` → `WardrobeCreatorService`, `RoomService` | RoomCatalogItem (`maisonBrandUserId`), RoomInventoryItem, FaiPointsLedgerEntry, AssetPreset — *sem controller próprio ainda* |
| RF45 | Processar e padronizar imagens canônicas (captura adaptativa + visão computacional) | **Sem controller/serviço ainda**: só `ProductKnowledgeBase` (`fai-application/.../vision/service`) usa `KbBrandSignatureRepository`, `KbProductLineRepository`, `KbProductModelRepository`; `WardrobeService` grava `QualityScore`. Os demais repositórios de V29 existem mas não são injetados por nenhum serviço. | CaptureSession, CaptureRequest, PieceImage, QualityScore, BrandPrediction, GarmentLandmark, GarmentEmbedding, ModelRegistryEntry, ModelInference, TrainingCandidate, AiReviewItem, DatasetSource, KbBrandSignature, KbProductLine, KbProductModel |
| RF46 | FAI Creative Engine (assets criativos, serviços Adobe) | **Não implementado** neste repositório (card Trello RF46, HU-RF46.01–10). Reutilizaria `PipelineJob`, `ModelInference`, `AssetPreset`. | — |
| RF47 | Acervo & Busca Catalogada (catalog-first) | `CatalogController`, `DiscoveryController` → `CatalogService`, `CatalogIngestService`, `OfficialCatalogDiscovery`, `WardrobeService.createFromCatalog` | Brand, BrandAlias, BrandLogo, CatalogSource, CatalogProduct, CatalogProductAlias, CatalogVariant, CatalogImage, CatalogIngestionRun, WardrobeItem (`catalogProductId`, `catalogVariantId`, `imageOrigin`, `userImageUrl`), User, UserPreferences, FaiPointsLedgerEntry, AiInferenceLog (Catalog Discovery) |

Transversais a todos os RF: `AuditLog` (RNF5), `BackupRecord` (RNF4), `MetricSnapshot` (dashboard/ADM), `PipelineJob` (fila assíncrona).

## Dúvidas e lacunas encontradas

- As 14 entidades de V29 (RF45) têm repositórios, mas só `ProductKnowledgeBase` (Kb*) e `WardrobeService` (`QualityScore`) os usam; `CaptureSession`, `CaptureRequest`, `PieceImage`, `BrandPrediction`, `GarmentLandmark`, `GarmentEmbedding`, `ModelRegistryEntry`, `ModelInference`, `TrainingCandidate`, `AiReviewItem`, `DatasetSource` ainda não são gravados por nenhum serviço.
- Os javadocs das classes de V29 dizem "RF4"; no Trello o pipeline canônico é o **RF45**. Este documento usa RF45 e marca "(código: RF4)".
- RF47 ("Acervo & Busca Catalogada") ganhou card no Trello em 2026-10-04; especificação em `docs/catalogo/RF47_ACERVO_BUSCA_CATALOGADA.md`.
- `ChallengeInstance.state`, `ChallengeParticipant.status`, `CouponRight.status`, `FlairMatch.status`, `BackupRecord.status` e `CatalogIngestionRun.status` são `String`, sem enum Java.
- `RoomCatalogItem` versiona por `@Version` próprio em vez de herdar `VersionedAuditableEntity`.
