# -*- coding: utf-8 -*-
"""Fonte única dos requisitos funcionais do Dine Explorer (varejo culinário,
gastronomia, restaurantes e comida).

O mesmo esqueleto do Fashion AI (RF1 cadastro, RF2 login, RF3 conta/LGPD,
RF23 telas de configuração) aplicado ao mundo culinário. Daqui saem:
  - os diagramas PlantUML/PNG em docs/dine-explorer/diagramas/RF<n>/
  - a planilha docs/dine-explorer/planilhas/Entidades_BD_por_RF.xlsx
  - o JSON usado para popular o board do Trello.

Bancos de produção: MySQL (transacional, fonte da verdade), Cassandra (séries
temporais/feeds de alto volume), Redis (cache, sessão, rate limit, rankings
"sorted set"), OpenSearch (busca full-text, geo e agregações de heatmap) e
S3 (mídia, exportações LGPD, tiles do globo).
"""

# Entidade: (Nome, tabela/chave, banco, [atributos], observação)
# Estado:   {"nome": str, "estados": [(alias, rótulo)], "transicoes": [(de, para, evento)], "nota": str}
# Atividade: lista de passos (raia, texto) ou ("if", raia, condição, [erro, ...]) ou ("switch", raia, [(caso, ação)])
# Sequência: participantes [(alias, tipo, rótulo)] e mensagens [(de, para, texto, retorno?)] ou ("alt", cond, [(...)]) ou ("==", título)

SPRING = "Spring Boot 4.0 · Java 25 (virtual threads)"

RFS = []


def rf(**kw):
    RFS.append(kw)


USER = ("User", "users", "MySQL",
        ["id: UUID", "username: String", "displayName: String", "email: String", "emailHash: String",
         "emailVerified: boolean", "phone: String", "birthDate: LocalDate", "passwordHash: String (Argon2id)",
         "profileType: ProfileType", "accountStatus: AccountStatus", "countryCode: String", "city: String",
         "avatarUrl: String", "bio: String", "createdAt: Instant", "lastLoginAt: Instant", "deletedAt: Instant"],
        "Fonte da verdade da identidade; e-mail cifrado em repouso (AES-GCM) + hash para busca")
PREFS = ("UserPreferences", "user_preferences", "MySQL",
         ["id: UUID", "user: User", "theme: ThemeMode (LIGHT/DARK/AUTO)", "language: UiLanguage",
          "fontScale: int", "highContrast: boolean", "reduceMotion: boolean", "accentColor: String",
          "cardDensity: UiDensity", "unitSystem: UnitSystem (METRIC/IMPERIAL)", "currency: String",
          "dietaryRestrictions: Set<Diet>", "allergens: Set<Allergen>", "clientUpdatedAt: Instant"],
         "Aparência, idioma, unidades e restrições alimentares")
REFRESH = ("RefreshToken", "refresh_tokens", "MySQL",
           ["id: UUID", "user: User", "tokenHash: String", "familyId: UUID", "expiresAt: Instant",
            "revokedAt: Instant", "rotatedFromId: UUID", "createdIp: String", "userAgent: String", "deviceName: String"],
           "Rotação de refresh token com detecção de reuso por família")
SESSION = ("SessionCache", "session:{jti}", "Redis",
           ["jti: String", "userId: UUID", "deviceName: String", "ip: String", "issuedAt: Instant", "ttl: 15 min"],
           "Allow-list do access token (logout imediato) e rate limit de login")
VCODE = ("VerificationCode", "verification_codes", "MySQL",
         ["id: UUID", "user: User", "purpose: VerificationPurpose", "codeHash: String", "target: String",
          "expiresAt: Instant", "consumedAt: Instant", "attempts: int", "sendCount: int"],
         "Códigos de e-mail/SMS/2FA (TOTP) e recuperação de senha")
RESTAURANT_PROFILE = ("RestaurantProfile", "restaurant_profiles", "MySQL",
                      ["id: UUID", "owner: User", "tradeName: String", "slug: String", "cnpj: String",
                       "razaoSocial: String", "cuisineTypes: Set<Cuisine>", "priceLevel: int (1-4)",
                       "latitude: double", "longitude: double", "address: Address", "countryCode: String",
                       "regionCode: String", "openingHours: JSON", "approvalStatus: ApprovalStatus",
                       "logoUrl: String", "coverUrl: String", "deliveryEnabled: boolean", "reservationEnabled: boolean"],
                      "Perfil empresarial do restaurante (aprovação manual + CNPJ)")
CHEF_PROFILE = ("ChefProfile", "chef_profiles", "MySQL",
                ["id: UUID", "owner: User", "stageName: String", "slug: String", "specialties: Set<Cuisine>",
                 "michelinStars: int", "verifiedFollowers: JSON", "approvalStatus: ApprovalStatus"],
                "Perfil de chef/celebridade gastronômica")
CONSENT = ("UserConsent", "user_consents", "MySQL",
           ["id: UUID", "user: User", "purpose: ConsentPurpose", "granted: boolean", "legalBasis: LegalBasis",
            "policyVersion: String", "grantedAt: Instant", "revokedAt: Instant", "ip: String"],
           "Consentimento por finalidade (LGPD art. 7º, 8º e 11 — dados de saúde são sensíveis)")
EXPORT = ("DataExportRequest", "data_export_requests", "MySQL",
          ["id: UUID", "user: User", "status: ExportStatus", "requestedAt: Instant", "readyAt: Instant",
           "expiresAt: Instant", "s3Key: String", "sha256: String"],
          "Portabilidade (LGPD art. 18, V)")
EXPORT_FILE = ("DataExportArchive", "s3://dine-lgpd-exports/{userId}/{id}.zip", "S3",
               ["key: String", "sizeBytes: long", "sseKms: true", "presignedUrlTtl: 24h", "lifecycle: 7 dias"],
               "ZIP JSON+mídia cifrado SSE-KMS")
AUDIT = ("AuditEvent", "audit_events (por userId, dia)", "Cassandra",
         ["userId: UUID (partition)", "day: LocalDate (partition)", "ts: TimeUUID (clustering)", "action: String",
          "ip: String", "userAgent: String", "payload: Map<String,String>"],
         "Trilha de auditoria imutável, TTL 5 anos")
NOTIF = ("Notification", "notifications_by_user", "Cassandra",
         ["userId: UUID (partition)", "createdAt: TimeUUID (clustering DESC)", "type: NotificationType",
          "title: String", "body: String", "deepLink: String", "readAt: Instant"],
         "Feed de notificações por usuário")
NOTIF_PREF = ("NotificationPreference", "notification_preferences", "MySQL",
              ["id: UUID", "user: User", "channel: Channel (PUSH/EMAIL/IN_APP)", "type: NotificationType",
               "enabled: boolean", "quietHoursStart: LocalTime", "quietHoursEnd: LocalTime"],
              "Preferências por canal e tipo")
FOOD_ITEM = ("FoodPiece", "food_pieces", "MySQL",
             ["id: UUID", "owner: User", "name: String", "category: FoodCategory", "cuisine: Cuisine",
              "originCountry: String", "ingredients: List<Ingredient>", "allergens: Set<Allergen>",
              "kcalPer100g: int", "proteinG: decimal", "carbsG: decimal", "fatG: decimal", "portionG: int",
              "status: PieceStatus", "visibility: Visibility", "photoKey: String", "createdAt: Instant"],
             "Peça de alimento (prato, ingrediente, bebida, sobremesa)")
FOOD_PHOTO = ("FoodPhoto", "s3://dine-media/food/{ownerId}/{photoId}.webp", "S3",
              ["key: String", "originalKey: String", "width: int", "height: int", "contentType: image/webp",
               "variants: thumb/card/full", "blurHash: String"],
              "Original + variantes geradas por Lambda/Spring Batch")
FOOD_INDEX = ("FoodPieceDoc", "idx_food_pieces", "OpenSearch",
              ["id: keyword", "name: text (pt/en/es analyzers)", "cuisine: keyword", "category: keyword",
               "allergens: keyword[]", "kcal: integer", "ownerId: keyword", "hype: float", "embedding: knn_vector(768)"],
              "Busca textual + semântica (k-NN) de peças")
MEAL_SCHEME = ("MealScheme", "meal_schemes", "MySQL",
               ["id: UUID", "owner: User", "title: String", "mealType: MealType", "occasion: Occasion",
                "cuisine: Cuisine", "servings: int", "prepMinutes: int", "difficulty: Difficulty",
                "totalKcal: int", "healthScore: int (0-100)", "status: SchemeStatus", "visibility: Visibility",
                "backgroundArtId: UUID", "restaurant: RestaurantProfile (opcional)", "publishedAt: Instant"],
               "Esquema de alimentação (refeição/prato composto) — análogo ao Look")
MEAL_ITEM = ("MealSchemeItem", "meal_scheme_items", "MySQL",
             ["id: UUID", "scheme: MealScheme", "piece: FoodPiece", "quantityG: int", "layer: PlateLayer",
              "posX: decimal", "posY: decimal", "zIndex: int", "note: String"],
             "Itens do esquema e sua posição no prato")
SCHEME_INDEX = ("MealSchemeDoc", "idx_meal_schemes", "OpenSearch",
                ["id: keyword", "title: text", "cuisine: keyword", "mealType: keyword", "countryCode: keyword",
                 "location: geo_point", "healthScore: integer", "hype: float", "publishedAt: date"],
                "Feed/busca de esquemas")
REACTION = ("Reaction", "reactions", "MySQL",
            ["id: UUID", "user: User", "targetType: TargetType (PIECE/SCHEME/RESTAURANT)", "targetId: UUID",
             "kind: ReactionKind", "createdAt: Instant"],
            "Uma reação por (user,target,kind); UNIQUE")
REACTION_COUNTER = ("ReactionCounter", "reaction_counters_by_target", "Cassandra",
                    ["targetId: UUID (partition)", "kind: text (clustering)", "count: counter"],
                    "Contadores distribuídos de alta escrita")
COMMENT = ("Comment", "comments", "MySQL",
           ["id: UUID", "author: User", "targetType: TargetType", "targetId: UUID", "parentId: UUID",
            "body: String (≤ 1000)", "status: CommentStatus", "toxicityScore: decimal", "createdAt: Instant"],
           "Comentários com moderação por IA")
SHARE = ("ShareEvent", "share_events_by_target", "Cassandra",
         ["targetId: UUID (partition)", "ts: TimeUUID", "userId: UUID", "channel: ShareChannel"],
         "Compartilhamentos (WhatsApp, Instagram, link)")
SAVE = ("SavedItem", "saved_items", "MySQL",
        ["id: UUID", "user: User", "targetType: TargetType", "targetId: UUID", "collection: String", "createdAt: Instant"],
        "Salvos / coleções")
HYPE = ("DineHypeScore", "dine_hype_scores", "MySQL",
        ["id: UUID", "targetType: TargetType", "targetId: UUID", "score: decimal", "algorithmVersion: String",
         "computedAt: Instant", "regionCode: String", "countryCode: String"],
        "Score consolidado (snapshot diário)")
HYPE_RANK = ("HypeRanking", "rank:{scope}:{region}:{period}", "Redis",
             ["key: String", "type: ZSET", "member: targetId", "score: double", "ttl: 1h"],
             "Rankings Top 10 mundo / Top 20 região em sorted sets")
METRIC_EVENT = ("EngagementEvent", "engagement_events_by_target_day", "Cassandra",
                ["targetId: UUID (partition)", "day: date (partition)", "ts: TimeUUID", "userId: UUID",
                 "event: EngagementType", "weight: float", "countryCode: text", "regionCode: text"],
                "Eventos brutos (view, dwell, reação, share, save, check-in, pedido)")
METRIC_SNAPSHOT = ("MetricSnapshot", "metric_snapshots", "MySQL",
                   ["id: UUID", "targetType: TargetType", "targetId: UUID", "period: Period", "views: long",
                    "uniqueViewers: long", "reactions: Map<ReactionKind,long>", "comments: long", "shares: long",
                    "saves: long", "engagementRate: decimal", "sentimentIndex: decimal", "computedAt: Instant"],
                   "Agregados por período para dashboard")
GUIDELINE = ("SchemeGuideline", "scheme_guidelines", "MySQL",
             ["id: UUID", "schemeKind: SchemeKind (MEAL/FOOD_PIECE/RESTAURANT)", "version: String",
              "requiredFields: JSON Schema", "rules: List<GuidelineRule>", "status: GuidelineStatus",
              "publishedAt: Instant"],
             "Diretrizes versionadas (anatomia obrigatória de cada esquema)")
GUIDE_RULE = ("GuidelineRule", "guideline_rules", "MySQL",
              ["id: UUID", "guideline: SchemeGuideline", "code: String", "severity: Severity (BLOQUEANTE/AVISO)",
               "expression: String (SpEL)", "message: String"],
              "Regra validada no backend (Bean Validation + SpEL)")
VALIDATION = ("SchemeValidationReport", "scheme_validation_reports", "MySQL",
              ["id: UUID", "schemeKind: SchemeKind", "schemeId: UUID", "guidelineVersion: String",
               "passed: boolean", "violations: JSON", "validatedAt: Instant"],
              "Resultado da validação antes de publicar")
RESTAURANT_SCHEME = ("RestaurantScheme", "restaurant_schemes", "MySQL",
                     ["id: UUID", "restaurant: RestaurantProfile", "headline: String", "signatureDishes: List<FoodPiece>",
                      "ambience: Set<Ambience>", "priceLevel: int", "avgTicket: Money", "dietOptions: Set<Diet>",
                      "status: SchemeStatus", "backgroundArtId: UUID", "publishedAt: Instant"],
                     "Card de restaurante no mesmo formato do card de esquema")
MENU_ITEM = ("MenuItem", "menu_items", "MySQL",
             ["id: UUID", "restaurant: RestaurantProfile", "piece: FoodPiece", "price: Money", "available: boolean",
              "section: MenuSection", "prepMinutes: int"],
             "Cardápio vendável (varejo)")
RESTAURANT_INDEX = ("RestaurantDoc", "idx_restaurants", "OpenSearch",
                    ["id: keyword", "name: text", "cuisines: keyword[]", "priceLevel: integer", "location: geo_point",
                     "countryCode: keyword", "regionCode: keyword", "city: keyword", "rating: float", "hype: float",
                     "avgTicketUsd: float", "dietOptions: keyword[]", "openNow: boolean"],
                    "Visualizador mundial com filtros, geo_distance e agregações")
GLOBE_LAYER = ("GlobeLayer", "globe_layers", "MySQL",
               ["id: UUID", "code: LayerCode", "title: String", "metric: String", "colorScale: String",
                "source: String", "refreshCron: String", "lastBuiltAt: Instant"],
               "Catálogo de camadas do globo (obesidade, caros, populares, típicas...)")
GLOBE_TILES = ("GlobeTileSet", "s3://dine-globe/{layer}/{version}/h3-{res}.pbf", "S3",
               ["key: String", "h3Resolution: int", "format: MVT/PBF", "cdn: CloudFront", "version: String"],
               "Tiles hexagonais H3 pré-agregados para heatmap")
REGION_DISH = ("RegionalDish", "regional_dishes", "MySQL",
               ["id: UUID", "name: String", "countryCode: String", "regionCode: String", "lat: double", "lng: double",
                "illustrationKey: String", "lottieKey: String", "description: String", "isTypical: boolean"],
               "Comidas típicas com ilustração animada (Lottie/Rive)")
REGION_DISH_MEDIA = ("DishIllustration", "s3://dine-globe/illustrations/{dishId}.lottie", "S3",
                     ["key: String", "format: Lottie/Rive/WebM", "frames: int", "loop: boolean"],
                     "Desenhos ilustrativos animados")
HEALTH_STAT = ("HealthIndicator", "health_indicators", "MySQL",
               ["id: UUID", "countryCode: String", "regionCode: String", "year: int",
                "obesityRateAdult: decimal", "source: String (OMS/NCD-RisC)", "importedAt: Instant"],
               "Indicador agregado público (sem dado pessoal)")
GLOBE_CACHE = ("GlobeLayerCache", "globe:{layer}:{bbox}:{zoom}", "Redis",
               ["key: String", "value: GeoJSON compactado", "ttl: 10 min"], "Cache quente de viewport")
INVENTORY = ("FoodInventory", "food_inventories", "MySQL",
             ["id: UUID", "owner: User", "name: String", "totalPieces: int", "totalSchemes: int", "updatedAt: Instant"],
             "Inventário de Alimentação Virtual")
PHOTO_EDIT = ("PhotoEditRecipe", "photo_edit_recipes", "MySQL",
              ["id: UUID", "photoKey: String", "operations: JSON (crop, rotate, filters, removeBg)",
               "outputKey: String", "version: int", "createdAt: Instant"],
              "Edição não destrutiva")
ART = ("BackgroundArt", "background_arts", "MySQL",
       ["id: UUID", "owner: User", "palette: List<Color>", "pattern: PatternKind", "animation: AnimationKind",
        "texture: String", "assetKey: String", "createdAt: Instant"],
       "Arte de fundo do card")
ART_ASSET = ("BackgroundAsset", "s3://dine-media/art/{artId}.webp", "S3",
             ["key: String", "width: int", "height: int", "animated: boolean"], "Render final")
MODEL3D = ("Food3DJob", "food_3d_jobs", "MySQL",
           ["id: UUID", "piece: FoodPiece", "provider: String", "status: JobStatus", "attempts: int",
            "glbKey: String", "requestedAt: Instant", "finishedAt: Instant"], "Geração 3D assíncrona")
MODEL3D_FILE = ("Food3DModel", "s3://dine-media/3d/{pieceId}.glb", "S3",
                ["key: String", "polycount: int", "textureRes: int", "usdzKey: String"], "Modelo glTF/USDZ")
FOLLOW = ("Follow", "follows", "MySQL",
          ["id: UUID", "follower: User", "followee: User", "status: FollowStatus", "createdAt: Instant"], "Seguir")
FEED = ("FeedEntry", "home_feed_by_user", "Cassandra",
        ["userId: UUID (partition)", "ts: TimeUUID (clustering DESC)", "targetType: text", "targetId: UUID",
         "reason: text"], "Fan-out on write do feed")
DNA = ("TasteDna", "taste_dna", "MySQL",
       ["id: UUID", "user: User", "flavorProfile: Map<Flavor,int> (doce, salgado, ácido, amargo, umami, picante)",
        "favoriteCuisines: List<Cuisine>", "diet: Diet", "spiceTolerance: int", "adventurousness: int",
        "embedding: vector", "updatedAt: Instant"], "DNA de Alimentação (identidade de paladar)")
BRAND = ("FoodBrandProfile", "food_brand_profiles", "MySQL",
         ["id: UUID", "owner: User", "brandName: String", "slug: String", "cnpj: String", "category: BrandCategory",
          "countryCode: String", "logoUrl: String", "approvalStatus: ApprovalStatus"], "Marca de alimentos")
BRAND_LINK = ("SchemeBrandLink", "scheme_brand_links", "MySQL",
              ["id: UUID", "scheme: MealScheme", "brand: FoodBrandProfile", "status: LinkStatus",
               "requestedAt: Instant", "decidedAt: Instant"], "Vínculo esquema ↔ marca (aprovação da marca)")
RECO = ("Recommendation", "recommendations", "MySQL",
        ["id: UUID", "user: User", "prompt: String", "constraints: JSON (kcal, diet, budget)", "status: RecoStatus",
         "result: JSON", "model: String", "createdAt: Instant"], "Pedido ao Copilot")
RECO_CACHE = ("RecoCache", "reco:{userId}:{hash}", "Redis", ["key", "value: JSON", "ttl: 6h"], "Cache semântico")
AI_LOG = ("AiInferenceLog", "ai_inference_log", "Cassandra",
          ["day: date (partition)", "ts: TimeUUID", "userId: UUID", "feature: text", "model: text",
           "latencyMs: int", "tokensIn: int", "tokensOut: int", "costUsd: decimal"], "Observabilidade da IA")
BIODEVICE = ("BioDineDevice", "biodine_devices", "MySQL",
             ["id: UUID", "owner: User", "serial: String", "model: String", "firmware: String",
              "status: DeviceStatus", "pairedAt: Instant", "lastSeenAt: Instant", "mqttClientId: String"],
             "Dispositivo ciber-físico (balança/sensor)")
BIOREADING = ("BioDineReading", "biodine_readings_by_device_day", "Cassandra",
              ["deviceId: UUID (partition)", "day: date (partition)", "ts: TimeUUID", "weightG: int",
               "temperatureC: decimal", "humidity: decimal", "kcalEstimated: int"], "Telemetria IoT")
SNAPSHOT = ("PlateSnapshot", "plate_snapshots", "MySQL",
            ["id: UUID", "device: BioDineDevice", "imageKey: String", "detectedPieces: JSON", "confidence: decimal",
             "status: SnapshotStatus", "schemeId: UUID", "capturedAt: Instant"], "Captura do prato pelo sensor")
SNAPSHOT_IMG = ("PlateSnapshotImage", "s3://dine-iot/snapshots/{deviceId}/{id}.jpg", "S3",
                ["key: String", "width: int", "height: int", "exif: removido"], "Imagem crua")
ORDER = ("Order", "orders", "MySQL",
         ["id: UUID", "customer: User", "restaurant: RestaurantProfile", "type: OrderType (DELIVERY/TAKEAWAY/DINE_IN)",
          "status: OrderStatus", "subtotal: Money", "deliveryFee: Money", "discount: Money", "total: Money",
          "paymentId: String", "address: Address", "createdAt: Instant"], "Pedido de varejo culinário")
ORDER_ITEM = ("OrderItem", "order_items", "MySQL",
              ["id: UUID", "order: Order", "menuItem: MenuItem", "quantity: int", "unitPrice: Money", "notes: String"], "Itens")
RESERVATION = ("Reservation", "reservations", "MySQL",
               ["id: UUID", "customer: User", "restaurant: RestaurantProfile", "partySize: int", "slot: Instant",
                "status: ReservationStatus", "createdAt: Instant"], "Reserva de mesa")
CART = ("Cart", "cart:{userId}", "Redis",
        ["userId", "restaurantId", "items: Hash<menuItemId,qty>", "ttl: 48h"], "Carrinho efêmero")
ORDER_TRACK = ("OrderTracking", "order_tracking_by_order", "Cassandra",
               ["orderId: UUID (partition)", "ts: TimeUUID", "status: text", "lat: double", "lng: double"],
               "Linha do tempo/rastreamento")
BIOSCORE = ("NutritionDiary", "nutrition_diary", "MySQL",
            ["id: UUID", "user: User", "date: LocalDate", "kcal: int", "proteinG: decimal", "carbsG: decimal",
             "fatG: decimal", "waterMl: int", "source: DiarySource"], "Diário nutricional (dado de saúde)")

C_ACC = ["IdentityService", "AccountService", "PreferencesService", "NotificationService"]

# ---------------------------------------------------------------- RF1
rf(n=1, sprint=1, tela="Tela de Cadastro (/signup)",
   titulo="Cadastrar usuário na plataforma com dados de acesso (perfil Pessoal, Restaurante, Chef ou Marca de alimentos)",
   resumo="Wizard de 3 passos: tipo de perfil → dados de acesso → preferências alimentares e consentimentos LGPD. "
          "Senha Argon2id, verificação de e-mail por código de 6 dígitos, passkey (WebAuthn) opcional e login social OIDC (Google/Apple). "
          "Restaurante/Marca exigem CNPJ e passam por aprovação (PENDING_VALIDATION).",
   telas=["Escolha do tipo de perfil (Pessoal · Restaurante · Chef · Marca de alimentos)",
          "Dados de acesso (nome, @username com sugestões, e-mail, senha com medidor de força, data de nascimento)",
          "Dados empresariais (CNPJ com consulta Receita, endereço com geocodificação, tipo de cozinha)",
          "Preferências alimentares (dieta, alergias, cozinhas favoritas) — opcional e com consentimento de saúde separado",
          "Termos + Política de Privacidade (checkbox não pré-marcado) e consentimentos por finalidade",
          "Verificação de e-mail (código de 6 dígitos, reenviar com cooldown)"],
   controller="AuthController", rotas=["POST /api/auth/register", "GET /api/auth/username-suggestions",
                                        "POST /api/auth/verify-email", "POST /api/auth/verify-email/resend",
                                        "POST /api/auth/passkeys/register"],
   service="IdentityService", metodos=["register()", "suggestUsername()", "verifyEmail()", "resendVerification()", "registerPasskey()"],
   portas=["PasswordHasherPort «Argon2PasswordHasher»", "EmailSenderPort «SesEmailSender»", "CnpjLookupPort «ReceitaWsAdapter»",
           "GeocodingPort «MapboxGeocoder»", "RateLimitPort «RedisRateLimit»"],
   externos=["AWS SES", "ReceitaWS", "Mapbox"],
   entidades=[USER, PREFS, RESTAURANT_PROFILE, CHEF_PROFILE, BRAND, CONSENT, VCODE, AUDIT],
   enums={"ProfileType": ["PESSOAL", "RESTAURANTE", "CHEF", "MARCA_ALIMENTOS", "ADMIN"],
          "AccountStatus": ["PENDING_EMAIL_VERIFICATION", "ACTIVE", "PENDING_VALIDATION", "SUSPENDED", "DELETION_SCHEDULED", "DELETED"]},
   erros=["EMAIL_EM_USO", "USERNAME_EM_USO", "SENHA_FRACA", "MENOR_DE_IDADE", "CNPJ_INVALIDO", "TERMOS_NAO_ACEITOS"],
   estado={"nome": "Conta", "estados": [("PEV", "PENDING_EMAIL_VERIFICATION"), ("PV", "PENDING_VALIDATION\n(Restaurante/Chef/Marca)"),
                                        ("ACT", "ACTIVE"), ("SUS", "SUSPENDED"), ("DS", "DELETION_SCHEDULED"), ("DEL", "DELETED\n(anonimizada)")],
           "transicoes": [("[*]", "PEV", "POST /register"), ("PEV", "ACT", "código válido [Pessoal]"),
                          ("PEV", "PV", "código válido [Restaurante/Chef/Marca]"), ("PV", "ACT", "moderação aprova CNPJ"),
                          ("PV", "SUS", "moderação recusa"), ("ACT", "SUS", "violação de política"), ("SUS", "ACT", "recurso aceito"),
                          ("ACT", "DS", "pedido de exclusão (RF3)"), ("DS", "ACT", "cancelou em 30 dias"), ("DS", "DEL", "job D+30"),
                          ("PEV", "DEL", "não verificou em 7 dias"), ("DEL", "[*]", "")],
           "nota": "Pessoal ativa direto após o e-mail;\nperfis empresariais aguardam validação do CNPJ."})

# ---------------------------------------------------------------- RF2
rf(n=2, sprint=1, tela="Tela de Login (/login)",
   titulo="Autenticar usuário na plataforma com credenciais de acesso",
   resumo="Login por e-mail/@username + senha, passkey (WebAuthn) ou OIDC (Google/Apple). 2FA TOTP opcional. "
          "Access token JWT (15 min, ES256) + refresh token rotativo em cookie HttpOnly/SameSite=Strict. "
          "Rate limit progressivo no Redis e bloqueio temporário após 5 falhas; 'Esqueci minha senha' por código.",
   telas=["Login (e-mail/username, senha, mostrar senha, lembrar dispositivo)", "Botões 'Entrar com passkey', 'Google', 'Apple'",
          "Desafio 2FA (TOTP 6 dígitos ou código de recuperação)", "Esqueci minha senha → código → nova senha",
          "Conta bloqueada temporariamente (contagem regressiva)"],
   controller="AuthController", rotas=["POST /api/auth/login", "POST /api/auth/login/2fa", "POST /api/auth/refresh",
                                        "POST /api/auth/passkeys/assert", "POST /api/auth/password/forgot", "POST /api/auth/password/reset"],
   service="IdentityService", metodos=["login()", "verifySecondFactor()", "refresh()", "assertPasskey()", "forgotPassword()", "resetPassword()"],
   portas=["PasswordHasherPort «Argon2PasswordHasher»", "TokenIssuerPort «JwtTokenIssuer (ES256)»", "RateLimitPort «RedisRateLimit»",
           "OidcPort «Spring Security OAuth2 Client»", "EmailSenderPort «SesEmailSender»"],
   externos=["Google OIDC", "Apple Sign-In", "AWS SES"],
   entidades=[USER, REFRESH, SESSION, VCODE, AUDIT],
   enums={"LoginResult": ["OK", "DOIS_FATORES_NECESSARIO", "BLOQUEADO", "CREDENCIAIS_INVALIDAS"]},
   erros=["NAO_AUTENTICADO", "CONTA_INDISPONIVEL", "DOIS_FATORES_NECESSARIO", "MUITAS_TENTATIVAS", "TOKEN_REUTILIZADO"],
   estado={"nome": "Sessao", "estados": [("ANON", "Anônima"), ("MFA", "Aguardando 2FA"), ("AUT", "Autenticada\n(access 15 min)"),
                                         ("EXP", "Access expirado"), ("BLK", "Bloqueada\n(5 falhas / 15 min)"), ("REV", "Revogada")],
           "transicoes": [("[*]", "ANON", ""), ("ANON", "AUT", "senha/passkey/OIDC ok"), ("ANON", "MFA", "senha ok + 2FA ativo"),
                          ("MFA", "AUT", "TOTP válido"), ("ANON", "BLK", "5ª falha"), ("BLK", "ANON", "15 min"),
                          ("AUT", "EXP", "15 min"), ("EXP", "AUT", "POST /refresh (rotação)"), ("EXP", "REV", "refresh reutilizado → revoga família"),
                          ("AUT", "REV", "logout / encerrar sessão (RF3)"), ("REV", "[*]", "")],
           "nota": "Reuso de refresh token = roubo provável:\nrevoga toda a família e notifica."})

# ---------------------------------------------------------------- RF3
rf(n=3, sprint=1, tela="Minha Conta (/settings/account)",
   titulo="Gerenciar a conta: dados pessoais, sessão, segurança, privacidade (LGPD) e notificações",
   resumo="Central de conta: editar perfil (nome, foto, bio, cidade, preferências alimentares), alterar e-mail/senha/telefone com reautenticação, "
          "ver e encerrar sessões/dispositivos, ativar 2FA e passkeys, gerir consentimentos por finalidade, exportar dados (portabilidade), "
          "excluir conta com carência de 30 dias e configurar notificações por canal/tipo/horário de silêncio.",
   telas=["Dados pessoais (nome, @username, foto, capa, bio, cidade, dieta, alergias)",
          "Segurança (senha, e-mail, telefone, 2FA TOTP, passkeys, códigos de recuperação)",
          "Sessões e dispositivos (lista, encerrar uma, encerrar todas)",
          "Privacidade LGPD (consentimentos por finalidade, visibilidade do perfil, exportar meus dados, excluir conta)",
          "Notificações (push, e-mail, in-app × reações, comentários, pedidos, reservas, rankings; horário de silêncio)"],
   controller="MeController", rotas=["GET /api/me", "PATCH /api/me/profile", "PATCH /api/me/sensitive", "GET /api/auth/sessions",
                                      "DELETE /api/auth/sessions/{id}", "PUT /api/me/consents/{purpose}", "POST /api/me/exports",
                                      "POST /api/me/deletion", "PUT /api/notifications/preferences"],
   service="AccountService", metodos=["updateProfile()", "updateSensitive()", "listSessions()", "revokeSession()", "setConsent()",
                                      "requestExport()", "scheduleDeletion()", "updateNotificationPrefs()"],
   portas=["MediaStoragePort «S3MediaStorageAdapter»", "EmailSenderPort «SesEmailSender»", "PushPort «FirebaseCloudMessaging»",
           "EventPublisherPort «Kafka (Spring Cloud Stream)»"],
   externos=["AWS S3", "AWS SES", "FCM / APNs", "Kafka"],
   entidades=[USER, PREFS, REFRESH, SESSION, CONSENT, EXPORT, EXPORT_FILE, NOTIF, NOTIF_PREF, AUDIT],
   enums={"ConsentPurpose": ["MARKETING", "PERSONALIZACAO_IA", "DADOS_SAUDE_NUTRICAO", "LOCALIZACAO_PRECISA", "COMPARTILHAR_PARCEIROS"],
          "ExportStatus": ["SOLICITADA", "PROCESSANDO", "PRONTA", "BAIXADA", "EXPIRADA", "FALHOU"]},
   erros=["REAUTENTICACAO_NECESSARIA", "EMAIL_EM_USO", "SESSAO_INEXISTENTE", "EXPORTACAO_EM_ANDAMENTO", "FINALIDADE_INVALIDA"],
   estado={"nome": "Exclusao", "estados": [("ATV", "Ativa"), ("AGD", "Exclusão agendada\n(carência 30 dias)"), ("ANO", "Anonimizada"),
                                           ("PUR", "Purgada\n(backups expirados)")],
           "transicoes": [("[*]", "ATV", ""), ("ATV", "AGD", "POST /api/me/deletion + senha"), ("AGD", "ATV", "login + 'cancelar exclusão'"),
                          ("AGD", "ANO", "job D+30: anonimiza MySQL,\napaga S3, tombstone Cassandra,\nremove docs OpenSearch, chaves Redis"),
                          ("ANO", "PUR", "D+90 rotação de backups"), ("PUR", "[*]", "")],
           "nota": "Direitos do titular (LGPD art. 18): acesso,\ncorreção, portabilidade, eliminação e revogação."})

# ---------------------------------------------------------------- RF4..RF22 (board original)
rf(n=4, sprint=2, tela="Adicionar Peça de Alimento (/pieces/new)",
   titulo="Adicionar uma nova peça de alimento ao inventário pessoal através de formulário e fotografia",
   resumo="Formulário com foto (câmera/galeria). A IA reconhece o alimento, sugere nome, categoria, cozinha, ingredientes, alérgenos e macros; "
          "o usuário confirma. Segue a Diretriz de Peça de Alimento (RF25).",
   telas=["Captura/Upload de foto (recorte 4:5, remoção de fundo)", "Formulário: nome, categoria, cozinha, país de origem, ingredientes, alérgenos, porção, macros",
          "Sugestões da IA com nível de confiança", "Status da peça (Tenho em casa · Quero provar · Favorita · Receita própria)"],
   controller="FoodPieceController", rotas=["POST /api/pieces/photo (multipart / presigned)", "POST /api/pieces/recognize", "POST /api/pieces", "PATCH /api/pieces/{id}/status"],
   service="FoodPieceService", metodos=["uploadPhoto()", "recognize()", "create()", "changeStatus()"],
   portas=["MediaStoragePort «S3»", "FoodVisionPort «Spring AI + modelo de visão»", "NutritionPort «USDA FoodData / TACO»", "SearchIndexPort «OpenSearch»", "GuidelinePort (RF25)"],
   externos=["AWS S3", "Modelo de visão (Spring AI)", "USDA FoodData Central / TACO"],
   entidades=[FOOD_ITEM, FOOD_PHOTO, FOOD_INDEX, INVENTORY, AI_LOG],
   enums={"FoodCategory": ["PRATO_PRINCIPAL", "ENTRADA", "SOBREMESA", "BEBIDA", "INGREDIENTE", "LANCHE", "MOLHO"],
          "PieceStatus": ["RASCUNHO", "NO_INVENTARIO", "QUERO_PROVAR", "FAVORITA", "ARQUIVADA"]},
   erros=["FOTO_INVALIDA", "CAMPO_OBRIGATORIO", "ALERGENO_DESCONHECIDO", "VIOLA_DIRETRIZ"],
   estado={"nome": "Peca", "estados": [("RAS", "Rascunho"), ("REC", "Reconhecendo (IA)"), ("REV", "Revisão do usuário"),
                                       ("INV", "No inventário"), ("QP", "Quero provar"), ("FAV", "Favorita"), ("ARQ", "Arquivada")],
           "transicoes": [("[*]", "RAS", "foto enviada"), ("RAS", "REC", "POST /recognize"), ("REC", "REV", "sugestões prontas"),
                          ("REC", "REV", "IA falhou → preenchimento manual"), ("REV", "INV", "salvar [diretriz ok]"),
                          ("INV", "FAV", "favoritar"), ("INV", "QP", "marcar quero provar"), ("QP", "INV", "provei"),
                          ("FAV", "INV", "desfavoritar"), ("INV", "ARQ", "arquivar"), ("ARQ", "INV", "restaurar")],
           "nota": "A peça só entra no inventário se\npassar na Diretriz de Peça (RF25)."})

rf(n=5, sprint=2, tela="Criar Prato (/create)",
   titulo="Criar um esquema de alimentação & sua respectiva lista de peças de alimento, através da aba \"Criar Prato\"",
   resumo="Monta um esquema (refeição) escolhendo peças do inventário, porções e posição no prato; calcula kcal/macros e Health Score; "
          "assistente de IA sugere combinações. Publica no feed conforme a Diretriz de Esquema de Alimentação (RF25).",
   telas=["Seleção de peças do inventário (filtros por categoria/cozinha)", "Composição: porções, camadas e ordem",
          "Resumo nutricional + Health Score", "Dados do esquema (título, tipo de refeição, ocasião, tempo, dificuldade, porções)",
          "Pré-visualização do card (botões de reação culinária) e publicar"],
   controller="MealSchemeController", rotas=["POST /api/schemes", "PUT /api/schemes/{id}/items", "POST /api/schemes/{id}/publish", "POST /api/schemes/assist"],
   service="MealSchemeService", metodos=["createDraft()", "setItems()", "computeNutrition()", "publish()", "assist()"],
   portas=["GuidelinePort (RF25)", "SearchIndexPort «OpenSearch»", "FeedFanoutPort «Kafka → Cassandra»", "LlmPort «Spring AI»"],
   externos=["Kafka", "Spring AI (LLM)"],
   entidades=[MEAL_SCHEME, MEAL_ITEM, FOOD_ITEM, SCHEME_INDEX, FEED],
   enums={"MealType": ["CAFE_DA_MANHA", "ALMOCO", "JANTAR", "LANCHE", "CEIA", "BRUNCH"],
          "SchemeStatus": ["RASCUNHO", "VALIDANDO", "PUBLICADO", "PRIVADO", "ARQUIVADO", "REMOVIDO"]},
   erros=["ESQUEMA_VAZIO", "PECA_NAO_E_SUA", "VIOLA_DIRETRIZ", "TITULO_OBRIGATORIO"],
   estado={"nome": "Esquema", "estados": [("RAS", "Rascunho"), ("VAL", "Validando diretriz"), ("PUB", "Publicado"),
                                          ("PRV", "Privado"), ("ARQ", "Arquivado"), ("REM", "Removido (moderação)")],
           "transicoes": [("[*]", "RAS", "criar"), ("RAS", "VAL", "publicar"), ("VAL", "RAS", "violação bloqueante"),
                          ("VAL", "PUB", "ok → indexa + fan-out"), ("RAS", "PRV", "salvar privado"), ("PRV", "VAL", "publicar"),
                          ("PUB", "PRV", "tornar privado"), ("PUB", "ARQ", "arquivar"), ("PUB", "REM", "denúncia procedente"),
                          ("ARQ", "PRV", "restaurar")], "nota": ""})

rf(n=6, sprint=2, tela="Inventário de Alimentação (/inventory)",
   titulo="Acessar & Gerenciar a página do Inventário de Alimentação Virtual do perfil Usuário",
   resumo="Grade de peças e esquemas do usuário com filtros (categoria, cozinha, status, alérgenos), busca, ordenação, ações em lote e 'Prato do dia'.",
   telas=["Abas Peças · Esquemas · Salvos", "Filtros e busca", "Seleção múltipla (arquivar, mudar status, mover para coleção)", "Prato do dia em destaque"],
   controller="InventoryController", rotas=["GET /api/inventory", "GET /api/inventory/pieces", "GET /api/inventory/schemes", "POST /api/inventory/bulk"],
   service="InventoryService", metodos=["overview()", "listPieces()", "listSchemes()", "bulkAction()", "setDishOfTheDay()"],
   portas=["SearchIndexPort «OpenSearch»", "CachePort «Redis»"], externos=[],
   entidades=[INVENTORY, FOOD_ITEM, MEAL_SCHEME, SAVE],
   enums={"BulkAction": ["ARQUIVAR", "RESTAURAR", "MUDAR_STATUS", "MOVER_COLECAO", "EXCLUIR"]},
   erros=["ITEM_NAO_E_SEU", "LOTE_GRANDE_DEMAIS"],
   estado={"nome": "PratoDoDia", "estados": [("NEN", "Nenhum"), ("DEF", "Definido hoje"), ("EXP", "Expirado (00:00 local)")],
           "transicoes": [("[*]", "NEN", ""), ("NEN", "DEF", "marcar prato do dia"), ("DEF", "DEF", "trocar"), ("DEF", "EXP", "meia-noite"), ("EXP", "NEN", "")], "nota": ""})

rf(n=7, sprint=2, tela="Detalhe da Peça (/pieces/{id})",
   titulo="Acessar um item de peça de alimento disponível na lista de um esquema de alimentação salvo",
   resumo="Abre a peça a partir do esquema: foto, ficha nutricional, alérgenos, origem, em quais esquemas aparece e onde comprar/pedir (RF29).",
   telas=["Ficha da peça (foto, macros, alérgenos, origem)", "Esquemas que usam a peça", "Restaurantes que servem (link varejo)"],
   controller="FoodPieceController", rotas=["GET /api/pieces/{id}", "GET /api/pieces/{id}/schemes", "GET /api/pieces/{id}/where-to-eat"],
   service="FoodPieceService", metodos=["detail()", "usedIn()", "whereToEat()"],
   portas=["SearchIndexPort «OpenSearch geo»", "CachePort «Redis»"], externos=[],
   entidades=[FOOD_ITEM, MEAL_ITEM, MENU_ITEM, RESTAURANT_INDEX],
   enums={"Visibility": ["PUBLICA", "SEGUIDORES", "PRIVADA"]}, erros=["PECA_INEXISTENTE", "PECA_PRIVADA"],
   estado={"nome": "Disponibilidade", "estados": [("DISP", "Disponível no inventário"), ("ACAB", "Acabou"), ("COMP", "Na lista de compras")],
           "transicoes": [("[*]", "DISP", ""), ("DISP", "ACAB", "consumi"), ("ACAB", "COMP", "adicionar à lista"), ("COMP", "DISP", "comprei")], "nota": ""})

rf(n=8, sprint=2, tela="Buscar (/search)",
   titulo="Visualizar esquemas de alimentação & peças de alimento criados por outros usuários na rede social, através da aba \"Buscar\"",
   resumo="Feed descoberta com busca full-text e semântica, filtros (cozinha, dieta, kcal, tipo de refeição, país) e cards com as reações culinárias.",
   telas=["Barra de busca com autocomplete", "Chips de filtro", "Grade de cards (esquemas e peças)", "Abrir card → detalhe"],
   controller="SearchController", rotas=["GET /api/search?q=&filters=", "GET /api/search/suggest"],
   service="SearchService", metodos=["search()", "suggest()"],
   portas=["SearchIndexPort «OpenSearch (BM25 + k-NN híbrido)»", "CachePort «Redis»"], externos=[],
   entidades=[SCHEME_INDEX, FOOD_INDEX, HYPE],
   enums={"SortMode": ["RELEVANCIA", "HYPE", "RECENTES", "MAIS_SAUDAVEIS"]}, erros=["CONSULTA_INVALIDA"],
   estado={"nome": "Esquema", "estados": [("VIS", "Visível"), ("OCU", "Oculto p/ mim"), ("DEN", "Denunciado")],
           "transicoes": [("[*]", "VIS", ""), ("VIS", "OCU", "não tenho interesse"), ("VIS", "DEN", "denunciar"), ("OCU", "VIS", "desfazer")], "nota": ""})

rf(n=9, sprint=2, tela="Editar Esquema (/schemes/{id}/edit)",
   titulo="Editar os dados de um esquema de alimentação & seus respectivos esquemas de peça de alimento salvos",
   resumo="Edição com controle otimista (@Version), histórico de versões e revalidação da diretriz antes de republicar.",
   telas=["Editor do esquema", "Editor das peças vinculadas", "Histórico de versões e restaurar"],
   controller="MealSchemeController", rotas=["PATCH /api/schemes/{id}", "PATCH /api/pieces/{id}", "GET /api/schemes/{id}/versions"],
   service="MealSchemeService", metodos=["update()", "updatePiece()", "versions()", "restoreVersion()"],
   portas=["GuidelinePort (RF25)", "SearchIndexPort «OpenSearch»"], externos=[],
   entidades=[MEAL_SCHEME, MEAL_ITEM, FOOD_ITEM, VALIDATION],
   enums={"EditOutcome": ["SALVO", "CONFLITO", "VIOLA_DIRETRIZ"]}, erros=["CONFLITO_DE_VERSAO", "VIOLA_DIRETRIZ"],
   estado={"nome": "Edicao", "estados": [("LIM", "Limpo"), ("SUJ", "Alterações não salvas"), ("SAL", "Salvando"), ("CON", "Conflito")],
           "transicoes": [("[*]", "LIM", ""), ("LIM", "SUJ", "editar"), ("SUJ", "SAL", "salvar"), ("SAL", "LIM", "200"),
                          ("SAL", "CON", "409 versão"), ("CON", "SUJ", "mesclar")], "nota": ""})

rf(n=10, sprint=3, tela="Copilot (/copilot)",
   titulo="Gerar recomendações de esquemas de alimentação & de peças de alimento através da aba \"Copilot\"",
   resumo="Chat com IA (Spring AI + RAG sobre OpenSearch k-NN) que monta cardápio do dia/semana respeitando dieta, alergias, kcal, orçamento e o DNA de Alimentação; "
          "sugere restaurantes próximos e pratos para pedir.",
   telas=["Chat Copilot", "Restrições (kcal, dieta, orçamento, tempo)", "Plano semanal gerado (arrastar e soltar)", "Salvar como esquemas"],
   controller="CopilotController", rotas=["POST /api/copilot/recommendations (SSE)", "POST /api/copilot/week-plan", "POST /api/copilot/{id}/save"],
   service="CopilotService", metodos=["recommend()", "weekPlan()", "save()"],
   portas=["LlmPort «Spring AI ChatClient»", "VectorStorePort «OpenSearch k-NN»", "CachePort «Redis semântico»", "ConsentPort (PERSONALIZACAO_IA)"],
   externos=["Provedor LLM", "OpenSearch"],
   entidades=[RECO, RECO_CACHE, DNA, AI_LOG, MEAL_SCHEME],
   enums={"RecoStatus": ["PENDENTE", "GERANDO", "PRONTA", "FALHOU", "SALVA"]}, erros=["SEM_CONSENTIMENTO_IA", "COTA_EXCEDIDA"],
   estado={"nome": "Semana", "estados": [("VAZ", "Vazia"), ("GER", "Gerando"), ("PRO", "Proposta"), ("AJU", "Ajustando"), ("CON", "Confirmada")],
           "transicoes": [("[*]", "VAZ", ""), ("VAZ", "GER", "gerar"), ("GER", "PRO", "stream concluído"), ("PRO", "AJU", "trocar refeição"),
                          ("AJU", "PRO", ""), ("PRO", "CON", "salvar"), ("GER", "VAZ", "falha/timeout")], "nota": ""})

rf(n=11, sprint=2, tela="Background Studio (modal)",
   titulo="Utilizar o \"Background Studio\" para confeccionar a arte de estilo e personalização de esquemas & peças de alimento",
   resumo="Editor de fundo do card: paletas sazonais/culinárias (toalha xadrez, mármore, madeira rústica, neon street food), padrões, texturas e animação leve.",
   telas=["Paletas e texturas", "Padrões (xadrez, azulejo, mármore...)", "Animação (vapor, faíscas, confete de especiarias)", "Pré-visualização do card"],
   controller="BackgroundStudioController", rotas=["GET /api/studio/presets", "POST /api/studio/arts", "PUT /api/schemes/{id}/background"],
   service="BackgroundStudioService", metodos=["presets()", "render()", "apply()"],
   portas=["MediaStoragePort «S3»", "RenderPort «Sharp/ImageMagick worker»"], externos=["AWS S3"],
   entidades=[ART, ART_ASSET, MEAL_SCHEME],
   enums={"PatternKind": ["LISO", "XADREZ", "MARMORE", "MADEIRA", "AZULEJO", "NEON"]}, erros=["PRESET_INVALIDO"],
   estado={"nome": "Arte", "estados": [("EDI", "Editando"), ("REN", "Renderizando"), ("PRT", "Pronta"), ("APL", "Aplicada")],
           "transicoes": [("[*]", "EDI", ""), ("EDI", "REN", "salvar"), ("REN", "PRT", "ok"), ("REN", "EDI", "erro"), ("PRT", "APL", "aplicar ao card")], "nota": ""})

rf(n=12, sprint=3, tela="Minhas Fotos (/photos)",
   titulo="Visualizar & Editar a página \"Minhas Fotos\" — fotos cadastradas através da adição de peças & criação de esquemas",
   resumo="Galeria das fotos enviadas, com upload em lote (várias peças por vez) e reaproveitamento de foto em novas peças.",
   telas=["Galeria (grid com blurhash)", "Upload em lote com fila", "Detalhe da foto → peças vinculadas"],
   controller="PhotoController", rotas=["GET /api/photos", "POST /api/photos/batch", "DELETE /api/photos/{id}"],
   service="PhotoService", metodos=["list()", "batchUpload()", "delete()"],
   portas=["MediaStoragePort «S3 presigned»"], externos=["AWS S3"],
   entidades=[FOOD_PHOTO, FOOD_ITEM],
   enums={"BatchItemStatus": ["NA_FILA", "ENVIANDO", "RECONHECENDO", "PRONTO", "ERRO"]}, erros=["LIMITE_LOTE", "FOTO_EM_USO"],
   estado={"nome": "ItemLote", "estados": [("FIL", "Na fila"), ("ENV", "Enviando"), ("REC", "Reconhecendo"), ("PRO", "Pronto"), ("ERR", "Erro")],
           "transicoes": [("[*]", "FIL", ""), ("FIL", "ENV", ""), ("ENV", "REC", "upload ok"), ("REC", "PRO", ""), ("ENV", "ERR", ""), ("ERR", "FIL", "tentar de novo")], "nota": ""})

rf(n=13, sprint=4, tela="DNA de Alimentação (/dna)",
   titulo="Criar um esquema de identidade pessoal de alimentação na página \"DNA de Alimentação\"",
   resumo="Quiz de paladar (doce, salgado, ácido, amargo, umami, picante), cozinhas favoritas, dieta e aventura gastronômica → radar e embedding usado nas recomendações.",
   telas=["Quiz de paladar (cards swipe)", "Radar de sabores", "Cozinhas do coração (mapa)", "Compartilhar DNA"],
   controller="TasteDnaController", rotas=["GET /api/dna", "PUT /api/dna", "POST /api/dna/quiz"],
   service="TasteDnaService", metodos=["get()", "update()", "scoreQuiz()"],
   portas=["EmbeddingPort «Spring AI»", "ConsentPort (PERSONALIZACAO_IA)"], externos=["Spring AI"],
   entidades=[DNA, PREFS],
   enums={"Flavor": ["DOCE", "SALGADO", "ACIDO", "AMARGO", "UMAMI", "PICANTE"]}, erros=["QUIZ_INCOMPLETO"],
   estado={"nome": "Esquema", "estados": [("NOV", "Novo"), ("QUI", "Quiz em andamento"), ("DEF", "DNA definido"), ("DES", "Desatualizado")],
           "transicoes": [("[*]", "NOV", ""), ("NOV", "QUI", "iniciar"), ("QUI", "DEF", "concluir"), ("DEF", "DES", "90 dias"), ("DES", "QUI", "refazer")], "nota": ""})

rf(n=14, sprint=3, tela="Marcas de alimentos (/brands)",
   titulo="Visualizar a aba \"Marcas\" — Feed de Perfil de Marcas de alimentos cadastradas no Dine Explorer",
   resumo="Feed de marcas com top bar de filtros (categoria, país, selo, mais seguidas), perfil da marca com produtos e esquemas vinculados.",
   telas=["Top bar de filtros", "Grade de marcas", "Perfil da marca (produtos, esquemas, seguidores)"],
   controller="BrandController", rotas=["GET /api/brands", "GET /api/brands/{slug}"],
   service="BrandService", metodos=["list()", "profile()"], portas=["SearchIndexPort «OpenSearch»"], externos=[],
   entidades=[BRAND, BRAND_LINK, FOLLOW],
   enums={"BrandCategory": ["LATICINIOS", "BEBIDAS", "CONGELADOS", "SNACKS", "ORGANICOS", "PADARIA"]}, erros=["MARCA_INEXISTENTE"],
   estado={"nome": "PerfilMarca", "estados": [("PEN", "Pendente"), ("APR", "Aprovada"), ("SUS", "Suspensa")],
           "transicoes": [("[*]", "PEN", ""), ("PEN", "APR", "moderação"), ("APR", "SUS", "violação"), ("SUS", "APR", "recurso")], "nota": ""})

rf(n=15, sprint=4, tela="Editor de Foto (modal canvas)",
   titulo="Editar a fotografia de uma peça de alimento através de um Editor Canvas Interativo 2D",
   resumo="Edição não destrutiva: recorte, rotação, remoção de fundo, filtros food-friendly (realce de cor, brilho, vapor), salvando receita de edição.",
   telas=["Canvas (Konva.js)", "Ferramentas de recorte/rotação", "Filtros", "Comparar antes/depois"],
   controller="PhotoEditController", rotas=["POST /api/photos/{id}/edits", "GET /api/photos/{id}/edits"],
   service="PhotoEditService", metodos=["apply()", "history()"], portas=["MediaStoragePort «S3»", "BgRemovalPort «modelo de segmentação»"], externos=["AWS S3"],
   entidades=[PHOTO_EDIT, FOOD_PHOTO], enums={"EditOp": ["CROP", "ROTATE", "REMOVE_BG", "FILTER", "ADJUST"]}, erros=["RECEITA_INVALIDA"],
   estado={"nome": "Foto", "estados": [("ORI", "Original"), ("EDI", "Editada (receita)"), ("REN", "Renderizada")],
           "transicoes": [("[*]", "ORI", ""), ("ORI", "EDI", "aplicar operação"), ("EDI", "REN", "salvar"), ("REN", "EDI", "editar de novo"), ("EDI", "ORI", "reverter")], "nota": ""})

rf(n=16, sprint=4, tela="Visualizador 3D (/pieces/{id}/3d)",
   titulo="Implementar geração de imagem 3D das peças de alimento do inventário utilizando serviços de API externas",
   resumo="Job assíncrono (fila SQS/Kafka) que gera modelo glTF/USDZ da peça a partir das fotos; visualização com React Three Fiber e AR Quick Look.",
   telas=["Botão 'Gerar 3D'", "Progresso do job", "Visualizador 3D/AR"],
   controller="Food3DController", rotas=["POST /api/pieces/{id}/3d", "GET /api/3d-jobs/{id}"],
   service="Food3DService", metodos=["request()", "status()", "onProviderCallback()"],
   portas=["Model3DProviderPort «API externa image-to-3D»", "MediaStoragePort «S3»", "JobQueuePort «Kafka»"], externos=["API image-to-3D", "AWS S3"],
   entidades=[MODEL3D, MODEL3D_FILE, FOOD_ITEM], enums={"JobStatus": ["NA_FILA", "PROCESSANDO", "CONCLUIDO", "FALHOU", "CANCELADO"]}, erros=["JOB_EM_ANDAMENTO"],
   estado={"nome": "Job", "estados": [("FIL", "Na fila"), ("PRO", "Processando"), ("CON", "Concluído"), ("FAL", "Falhou")],
           "transicoes": [("[*]", "FIL", ""), ("FIL", "PRO", "worker"), ("PRO", "CON", "callback ok"), ("PRO", "FAL", "erro"), ("FAL", "FIL", "retry (≤3, backoff)")], "nota": ""})

rf(n=17, sprint=3, tela="Perfil público (/u/{username})",
   titulo="Visualizar a página de perfil de outros Usuários cadastrados na rede social do Dine Explorer",
   resumo="Perfil com capa, DNA de Alimentação, esquemas publicados, peças, métricas sociais (RF24), seguir/deixar de seguir e respeito à visibilidade.",
   telas=["Cabeçalho do perfil", "Abas Esquemas · Peças · Restaurantes favoritos · DNA", "Seguir / Mensagem / Denunciar"],
   controller="ProfileController", rotas=["GET /api/users/{username}", "POST /api/users/{id}/follow", "DELETE /api/users/{id}/follow"],
   service="ProfileService", metodos=["publicProfile()", "follow()", "unfollow()"], portas=["CachePort «Redis»", "FeedFanoutPort «Kafka»"], externos=[],
   entidades=[USER, FOLLOW, MEAL_SCHEME, DNA], enums={"FollowStatus": ["SOLICITADO", "SEGUINDO", "BLOQUEADO"]}, erros=["PERFIL_PRIVADO", "USUARIO_BLOQUEADO"],
   estado={"nome": "Follow", "estados": [("NAO", "Não segue"), ("SOL", "Solicitado (perfil privado)"), ("SEG", "Seguindo"), ("BLO", "Bloqueado")],
           "transicoes": [("[*]", "NAO", ""), ("NAO", "SEG", "seguir [público]"), ("NAO", "SOL", "seguir [privado]"), ("SOL", "SEG", "aceito"),
                          ("SEG", "NAO", "deixar de seguir"), ("SEG", "BLO", "bloquear"), ("BLO", "NAO", "desbloquear")], "nota": ""})

rf(n=18, sprint=2, tela="Criador de Prato 2D (/plate-builder)",
   titulo="Possibilitar ao usuário o uso do Criador de prato virtual 2D do Dine Explorer",
   resumo="Prato virtual em canvas: arrastar peças (recortadas sem fundo) sobre louças/mesas, camadas, porções proporcionais e exportar para o esquema (RF5).",
   telas=["Mesa e louça (prato raso, bowl, tábua, bento)", "Arrastar peças do inventário", "Camadas e escala por porção", "Exportar imagem do prato"],
   controller="PlateBuilderController", rotas=["GET /api/plate-builder/tableware", "POST /api/schemes/{id}/plate"],
   service="PlateBuilderService", metodos=["tableware()", "savePlate()"], portas=["MediaStoragePort «S3»"], externos=["AWS S3"],
   entidades=[MEAL_ITEM, MEAL_SCHEME, ART_ASSET], enums={"PlateLayer": ["BASE", "PRINCIPAL", "GUARNICAO", "MOLHO", "FINALIZACAO"]}, erros=["PECA_SEM_RECORTE"],
   estado={"nome": "Prato", "estados": [("VAZ", "Vazio"), ("MON", "Montando"), ("SAL", "Salvo no esquema")],
           "transicoes": [("[*]", "VAZ", ""), ("VAZ", "MON", "arrastar peça"), ("MON", "MON", "mover/escalar"), ("MON", "SAL", "salvar"), ("SAL", "MON", "editar")], "nota": ""})

rf(n=19, sprint=3, tela="Card do esquema (feed / detalhe)",
   titulo="Usar as interações de rede social culinárias (curtir, comentar, compartilhar, salvar + reações Delicioso, Saboroso, Enjoei, Eca, Saudável...) em esquemas, peças e restaurantes",
   resumo="Linha de ações do card idêntica à do card de moda do Fashion AI (curtir · comentar · compartilhar · salvar) + barra de reações culinárias únicas: "
          "😋 Delicioso, 🤤 Saboroso, 🤢 Enjoei, 🤮 Eca, 🥗 Saudável, 🌶️ Apimentado, 👵 Comida de vó, 🍽️ Quero provar, 💸 Vale o preço, ✨ Gourmet, 🔥 Viciante, 🧂 Sem sal. "
          "Comentários com moderação por IA.",
   telas=["Barra de ações do card (♥ · 💬 · ↗ · 🔖)", "Seletor de reações culinárias (long-press)", "Folha de comentários com respostas", "Compartilhar (link, WhatsApp, Instagram Stories com arte do card)"],
   controller="InteractionController", rotas=["PUT /api/{targetType}/{id}/reactions/{kind}", "DELETE /api/{targetType}/{id}/reactions/{kind}",
                                               "POST /api/{targetType}/{id}/comments", "POST /api/{targetType}/{id}/share", "POST /api/{targetType}/{id}/save"],
   service="InteractionService", metodos=["react()", "unreact()", "comment()", "share()", "save()"],
   portas=["ModerationPort «Spring AI classificador»", "EventPublisherPort «Kafka engagement-events»", "CounterPort «Cassandra counters»", "NotificationService"],
   externos=["Kafka"],
   entidades=[REACTION, REACTION_COUNTER, COMMENT, SHARE, SAVE, METRIC_EVENT, NOTIF],
   enums={"ReactionKind": ["CURTIR", "DELICIOSO", "SABOROSO", "ENJOEI", "ECA", "SAUDAVEL", "APIMENTADO", "COMIDA_DE_VO", "QUERO_PROVAR", "VALE_O_PRECO", "GOURMET", "VICIANTE", "SEM_SAL"]},
   erros=["REACAO_INVALIDA", "COMENTARIO_TOXICO", "ALVO_PRIVADO"],
   estado={"nome": "Comentario", "estados": [("ENV", "Enviado"), ("MOD", "Em moderação (IA)"), ("PUB", "Publicado"), ("OCU", "Oculto"), ("EXC", "Excluído")],
           "transicoes": [("[*]", "ENV", ""), ("ENV", "MOD", ""), ("MOD", "PUB", "toxicidade < 0.7"), ("MOD", "OCU", "toxicidade ≥ 0.7"),
                          ("PUB", "OCU", "denúncia procedente"), ("PUB", "EXC", "autor exclui"), ("OCU", "PUB", "revisão humana")],
           "nota": "Reações positivas e negativas pesam\ndiferente no DineHype (RF24)."})

rf(n=20, sprint=4, tela="Publicar com marca (/create → vincular marca)",
   titulo="Criar & publicar um esquema de alimentação vinculado a uma marca de alimentos cadastrada (aba \"Marcas de alimentos\")",
   resumo="Ao publicar, o usuário marca produtos de uma marca; a marca aprova/recusa o vínculo e o esquema aparece no perfil da marca.",
   telas=["Buscar marca e produto", "Pedido de vínculo", "Painel da marca: aprovar/recusar"],
   controller="BrandLinkController", rotas=["POST /api/schemes/{id}/brand-links", "PATCH /api/brand-links/{id}"],
   service="BrandLinkService", metodos=["request()", "decide()"], portas=["NotificationService"], externos=[],
   entidades=[BRAND_LINK, BRAND, MEAL_SCHEME], enums={"LinkStatus": ["SOLICITADO", "APROVADO", "RECUSADO", "REVOGADO"]}, erros=["MARCA_NAO_APROVADA"],
   estado={"nome": "Vinculo", "estados": [("SOL", "Solicitado"), ("APR", "Aprovado"), ("REC", "Recusado"), ("REV", "Revogado")],
           "transicoes": [("[*]", "SOL", ""), ("SOL", "APR", "marca aprova"), ("SOL", "REC", "marca recusa"), ("APR", "REV", "qualquer lado revoga")], "nota": ""})

rf(n=21, sprint=4, tela="BioDine™ (/biodine)",
   titulo="Acessar a aba BioDine™ — serviço de sistema ciber-físico dentro do Dine Explorer",
   resumo="Pareamento de balança/sensor IoT (MQTT via AWS IoT Core), painel de consumo diário, diário nutricional e metas — dado de saúde com consentimento específico.",
   telas=["Parear dispositivo (QR/BLE)", "Painel diário (kcal, macros, água)", "Histórico e metas", "Consentimento DADOS_SAUDE_NUTRICAO"],
   controller="BioDineController", rotas=["POST /api/biodine/devices", "GET /api/biodine/dashboard", "GET /api/biodine/diary"],
   service="BioDineService", metodos=["pair()", "dashboard()", "diary()", "ingestTelemetry()"],
   portas=["IotPort «AWS IoT Core MQTT»", "ConsentPort (DADOS_SAUDE_NUTRICAO)"], externos=["AWS IoT Core"],
   entidades=[BIODEVICE, BIOREADING, BIOSCORE, CONSENT], enums={"DeviceStatus": ["NAO_PAREADO", "PAREANDO", "ONLINE", "OFFLINE", "DESPAREADO"]},
   erros=["SEM_CONSENTIMENTO_SAUDE", "DISPOSITIVO_JA_PAREADO"],
   estado={"nome": "Dispositivo", "estados": [("NP", "Não pareado"), ("PAR", "Pareando"), ("ON", "Online"), ("OFF", "Offline"), ("DES", "Despareado")],
           "transicoes": [("[*]", "NP", ""), ("NP", "PAR", "ler QR"), ("PAR", "ON", "certificado X.509 ok"), ("ON", "OFF", "sem heartbeat 5 min"),
                          ("OFF", "ON", "heartbeat"), ("ON", "DES", "desparear"), ("DES", "[*]", "")], "nota": ""})

rf(n=22, sprint=4, tela="BioDine™ Snapshot",
   titulo="Criar um esquema de alimentação através do BioDine™ Snapshot — Sensor IoT de Captura Fotográfica do Prato",
   resumo="O sensor fotografa o prato; a IA detecta as peças e o peso (balança) e propõe um esquema pré-preenchido para o usuário confirmar.",
   telas=["Notificação 'Prato capturado'", "Revisão das peças detectadas", "Confirmar → esquema (RF5)"],
   controller="SnapshotController", rotas=["POST /api/iot/snapshots (device)", "GET /api/snapshots/{id}", "POST /api/snapshots/{id}/confirm"],
   service="SnapshotService", metodos=["ingest()", "detect()", "confirm()"],
   portas=["FoodVisionPort «Spring AI visão»", "MediaStoragePort «S3»", "IotPort «AWS IoT Core»"], externos=["AWS IoT Core", "Modelo de visão"],
   entidades=[SNAPSHOT, SNAPSHOT_IMG, BIOREADING, MEAL_SCHEME], enums={"SnapshotStatus": ["CAPTURADO", "DETECTANDO", "PARA_REVISAO", "CONFIRMADO", "DESCARTADO"]},
   erros=["IMAGEM_ILEGIVEL"],
   estado={"nome": "Snapshot", "estados": [("CAP", "Capturado"), ("DET", "Detectando"), ("REV", "Para revisão"), ("CON", "Confirmado"), ("DES", "Descartado")],
           "transicoes": [("[*]", "CAP", ""), ("CAP", "DET", ""), ("DET", "REV", ""), ("REV", "CON", "usuário confirma"), ("REV", "DES", "descartar"), ("CAP", "DES", "TTL 24h")], "nota": ""})

# ---------------------------------------------------------------- RF23
rf(n=23, sprint=1, tela="Configurações (/settings)",
   titulo="Criar as telas de configuração do usuário (Conta, Privacidade/LGPD, Aparência, Idioma, Seus dados) no padrão LGPD, com i18n",
   resumo="Mesmo esqueleto do RF23 do Fashion AI: menu lateral de configurações com as telas Conta, Privacidade (LGPD), Aparência (tema claro/escuro/auto, cor de destaque, "
          "tamanho de fonte, alto contraste, reduzir animações, densidade dos cards), Idioma & Região (pt-BR/en/es, moeda, sistema métrico), "
          "Preferências alimentares e 'Seus dados' (exportar, histórico de consentimentos, excluir conta). Last-write-wins por clientUpdatedAt.",
   telas=["Conta (atalhos para RF3: perfil, segurança, sessões)",
          "Privacidade / LGPD (consentimentos por finalidade com texto claro, visibilidade do perfil, quem pode reagir/comentar, localização)",
          "Aparência (tema, cor de destaque, fonte 80–160%, alto contraste, reduzir animações do globo, densidade)",
          "Idioma & Região (idioma da UI, moeda, unidades, país para rankings regionais)",
          "Seus dados (baixar meus dados, histórico de consentimentos, encarregado/DPO, excluir conta)"],
   controller="PreferencesController", rotas=["GET /api/me/preferences", "PUT /api/me/preferences", "GET /api/me/consents",
                                               "PUT /api/me/privacy", "GET /api/me/exports", "POST /api/me/exports"],
   service="PreferencesService", metodos=["get()", "update()", "updatePrivacy()", "listConsents()", "listExports()"],
   portas=["CachePort «Redis»", "MediaStoragePort «S3»", "I18nPort «MessageSource + ICU4J»"], externos=["AWS S3"],
   entidades=[PREFS, USER, CONSENT, EXPORT, EXPORT_FILE, AUDIT],
   enums={"ThemeMode": ["LIGHT", "DARK", "AUTO"], "UiLanguage": ["PT_BR", "EN", "ES"], "UnitSystem": ["METRIC", "IMPERIAL"]},
   erros=["FONTE_INVALIDA", "COR_INVALIDA", "IDIOMA_INVALIDO", "MOEDA_INVALIDA", "VISIBILIDADE_INVALIDA"],
   estado={"nome": "Exportacao", "estados": [("SOL", "Solicitada"), ("PRO", "Processando"), ("PRT", "Pronta\n(link 24h)"), ("BAI", "Baixada"), ("EXP", "Expirada"), ("FAL", "Falhou")],
           "transicoes": [("[*]", "SOL", "POST /api/me/exports"), ("SOL", "PRO", "worker"), ("PRO", "PRT", "ZIP no S3 + e-mail"), ("PRO", "FAL", "erro"),
                          ("FAL", "SOL", "tentar de novo"), ("PRT", "BAI", "download"), ("PRT", "EXP", "7 dias"), ("BAI", "EXP", "7 dias"), ("EXP", "[*]", "")],
           "nota": "Prazo legal de resposta: 15 dias (art. 19, II).\nO sistema entrega em minutos."})

# ---------------------------------------------------------------- RF24 métricas
rf(n=24, sprint=3, tela="Métricas (/me/insights e painel do restaurante)",
   titulo="Calcular e exibir as métricas da rede social (DineHype Score, engajamento, sentimento culinário e rankings)",
   resumo="Pipeline de eventos (Kafka → Cassandra) e agregação (Spring Batch / Kafka Streams) que calcula, por peça, esquema, usuário e restaurante: views, "
          "alcance, reações por tipo, Índice de Sentimento Culinário (Delicioso/Saboroso/Saudável vs Eca/Enjoei/Sem sal), comentários, shares, salvos, "
          "taxa de engajamento e DineHype Score com decaimento temporal. Alimenta o Top 10 mundial e o Top 20 regional do Explorador (RF27).",
   telas=["Insights do meu perfil (gráficos 7/30/90 dias)", "Painel do restaurante (alcance, sentimento, conversão em pedidos)",
          "Distribuição das reações culinárias", "Posição nos rankings (região/país/mundo)"],
   controller="MetricsController", rotas=["GET /api/metrics/{targetType}/{id}?period=", "GET /api/rankings?scope=WORLD|REGION&region=", "GET /api/me/insights"],
   service="MetricsService", metodos=["ingest()", "aggregate()", "computeHype()", "rankings()", "insights()"],
   portas=["EventStreamPort «Kafka Streams»", "CounterPort «Cassandra»", "RankingPort «Redis ZSET»", "SearchIndexPort «OpenSearch (atualiza hype)»"],
   externos=["Kafka"],
   entidades=[METRIC_EVENT, METRIC_SNAPSHOT, HYPE, HYPE_RANK, REACTION_COUNTER],
   enums={"EngagementType": ["VIEW", "DWELL_3S", "REACAO", "COMENTARIO", "SHARE", "SAVE", "FOLLOW", "CHECK_IN", "PEDIDO", "RESERVA"],
          "Period": ["DIA", "SEMANA", "MES", "TRIMESTRE"]},
   erros=["PERIODO_INVALIDO", "METRICA_PRIVADA"],
   estado={"nome": "Hype", "estados": [("FRI", "Frio (< 20)"), ("MOR", "Morno (20–49)"), ("QUE", "Quente (50–79)"), ("VIR", "Viral (≥ 80)")],
           "transicoes": [("[*]", "FRI", "publicado"), ("FRI", "MOR", "engajamento ↑"), ("MOR", "QUE", "engajamento ↑"), ("QUE", "VIR", "engajamento ↑\n+ entra no Top"),
                          ("VIR", "QUE", "decaimento 48h"), ("QUE", "MOR", "decaimento"), ("MOR", "FRI", "decaimento")],
           "nota": "hype = Σ peso(evento)·e^(−λ·Δt) normalizado 0–100;\nreações negativas reduzem o sentimento,\nnão o alcance. Antifraude: 1 voto/usuário/alvo/tipo."})

# ---------------------------------------------------------------- RF25 diretrizes
rf(n=25, sprint=2, tela="Validação de esquema (inline nos formulários) + /admin/guidelines",
   titulo="Definir e aplicar as diretrizes dos esquemas: Esquema de Alimentação, Esquema de Peça de Alimento e Esquema de Restaurante",
   resumo="Anatomia obrigatória de cada esquema, na mesma lógica dos esquemas de vestimenta do Fashion AI, versionada e validada no backend: "
          "PEÇA = foto 4:5 + nome + categoria + cozinha + ingredientes + alérgenos + porção + macros; "
          "ALIMENTAÇÃO = título + tipo de refeição + ≥ 1 peça + porções + kcal total + Health Score + arte de fundo; "
          "RESTAURANTE = perfil aprovado + geolocalização + faixa de preço + ≥ 3 pratos assinatura + horário + opções de dieta. "
          "Todos compartilham o mesmo card: mídia, título, selos, linha de ações (curtir · comentar · compartilhar · salvar) e barra de reações culinárias (RF19).",
   telas=["Painel de diretrizes (admin): versões, regras, severidade", "Validação inline nos formulários (RF4, RF5, RF26)", "Relatório de violações antes de publicar"],
   controller="GuidelineController", rotas=["GET /api/guidelines/{kind}", "POST /api/guidelines/{kind}/validate", "POST /api/admin/guidelines", "POST /api/admin/guidelines/{id}/publish"],
   service="GuidelineService", metodos=["current()", "validate()", "createVersion()", "publish()"],
   portas=["RuleEnginePort «SpEL + Jakarta Validation»", "CachePort «Redis (diretriz vigente)»"], externos=[],
   entidades=[GUIDELINE, GUIDE_RULE, VALIDATION],
   enums={"SchemeKind": ["MEAL", "FOOD_PIECE", "RESTAURANT"], "Severity": ["BLOQUEANTE", "AVISO"], "GuidelineStatus": ["RASCUNHO", "VIGENTE", "OBSOLETA"]},
   erros=["VIOLA_DIRETRIZ", "VERSAO_INEXISTENTE"],
   estado={"nome": "Diretriz", "estados": [("RAS", "Rascunho"), ("REV", "Em revisão"), ("VIG", "Vigente"), ("OBS", "Obsoleta")],
           "transicoes": [("[*]", "RAS", "criar versão"), ("RAS", "REV", "enviar"), ("REV", "RAS", "ajustes"), ("REV", "VIG", "publicar\n(a anterior fica obsoleta)"),
                          ("VIG", "OBS", "nova versão vigente"), ("OBS", "[*]", "")],
           "nota": "Esquemas já publicados guardam a versão\nda diretriz com que foram validados."})

# ---------------------------------------------------------------- RF26 restaurante
rf(n=26, sprint=3, tela="Meu Restaurante (/restaurant/manage)",
   titulo="Criar & gerenciar o Esquema de Restaurante (card do restaurante, cardápio, pratos assinatura e horários)",
   resumo="Restaurante aprovado publica seu card (mesmo formato dos cards de esquema), cardápio vendável com preços, fotos, pratos assinatura, horários, ambiente e opções de dieta.",
   telas=["Card do restaurante (capa, selo, faixa de preço, cozinhas)", "Cardápio por seções com preços e disponibilidade", "Pratos assinatura", "Horários, delivery e reservas"],
   controller="RestaurantController", rotas=["PUT /api/restaurants/{id}/scheme", "POST /api/restaurants/{id}/menu-items", "PATCH /api/menu-items/{id}", "POST /api/restaurants/{id}/scheme/publish"],
   service="RestaurantService", metodos=["upsertScheme()", "addMenuItem()", "updateMenuItem()", "publish()"],
   portas=["GuidelinePort (RF25)", "SearchIndexPort «OpenSearch idx_restaurants»", "MediaStoragePort «S3»"], externos=["AWS S3"],
   entidades=[RESTAURANT_SCHEME, RESTAURANT_PROFILE, MENU_ITEM, RESTAURANT_INDEX],
   enums={"Ambience": ["FAMILIAR", "ROMANTICO", "CASUAL", "FINE_DINING", "STREET_FOOD", "BAR"], "Cuisine": ["BRASILEIRA", "ITALIANA", "JAPONESA", "MEXICANA", "INDIANA", "FRANCESA", "TAILANDESA", "ARABE", "PERUANA", "CHINESA", "..."]},
   erros=["RESTAURANTE_NAO_APROVADO", "VIOLA_DIRETRIZ", "PRECO_INVALIDO"],
   estado={"nome": "Restaurante", "estados": [("RAS", "Rascunho"), ("PUB", "Publicado (aberto)"), ("FEC", "Fechado agora"), ("PAU", "Pausado"), ("ENC", "Encerrado")],
           "transicoes": [("[*]", "RAS", ""), ("RAS", "PUB", "publicar [diretriz ok]"), ("PUB", "FEC", "fora do horário"), ("FEC", "PUB", "abriu"),
                          ("PUB", "PAU", "pausar pedidos"), ("PAU", "PUB", "retomar"), ("PUB", "ENC", "encerrar atividades")], "nota": ""})

# ---------------------------------------------------------------- RF27 explorador
rf(n=27, sprint=4, tela="Explorador (/explore) — Globo",
   titulo="Acessar a aba \"Explorador\": globo 3D animado com comidas de cada região do mundo, mapas de calor e rankings",
   resumo="Globo 3D (React Three Fiber + three-globe/deck.gl GlobeView) com desenhos ilustrativos animados (Lottie/Rive) das comidas típicas de cada região. "
          "Camadas de mapa de calor (hexágonos H3): obesidade adulta por país (OMS/NCD-RisC, dado público agregado), restaurantes mais caros, mais populares, "
          "destaques de comidas típicas, sentimento culinário. Painel lateral com Top 20 restaurantes mais populares da região focada e Top 10 do mundo, "
          "calculados pelas métricas da rede social (RF24).",
   telas=["Globo 3D com rotação e zoom (região → país → cidade)", "Ilustrações animadas das comidas típicas sobre cada região",
          "Seletor de camadas de calor: Obesidade · Mais caros · Mais populares · Comidas típicas · Sentimento · Saudável",
          "Painel 'Top 20 da região' (atualiza ao girar o globo)", "Painel 'Top 10 do mundo'", "Legenda e fonte dos dados", "Sub-aba Restaurantes do Mundo (RF28)"],
   controller="ExplorerController", rotas=["GET /api/explorer/layers", "GET /api/explorer/layers/{code}?bbox=&zoom=", "GET /api/explorer/dishes?region=",
                                            "GET /api/rankings?scope=REGION&region=&limit=20", "GET /api/rankings?scope=WORLD&limit=10"],
   service="ExplorerService", metodos=["layers()", "heatmap()", "typicalDishes()", "topRegion()", "topWorld()"],
   portas=["GeoAggregationPort «OpenSearch geohex_grid»", "RankingPort «Redis ZSET»", "TileStoragePort «S3 + CloudFront»", "OpenDataPort «OMS GHO API»"],
   externos=["OMS Global Health Observatory", "CloudFront CDN", "Mapbox/Natural Earth"],
   entidades=[GLOBE_LAYER, GLOBE_TILES, GLOBE_CACHE, REGION_DISH, REGION_DISH_MEDIA, HEALTH_STAT, HYPE_RANK, RESTAURANT_INDEX],
   enums={"LayerCode": ["OBESIDADE", "MAIS_CAROS", "MAIS_POPULARES", "COMIDAS_TIPICAS", "SENTIMENTO", "SAUDAVEL", "DENSIDADE_RESTAURANTES"],
          "RankScope": ["WORLD", "CONTINENT", "REGION", "COUNTRY", "CITY"]},
   erros=["CAMADA_INEXISTENTE", "BBOX_INVALIDO"],
   estado={"nome": "Globo", "estados": [("CAR", "Carregando tiles"), ("ORB", "Órbita (rotação automática)"), ("FOC", "Região focada"),
                                        ("CAM", "Camada de calor ativa"), ("DET", "Detalhe do restaurante/prato")],
           "transicoes": [("[*]", "CAR", ""), ("CAR", "ORB", "tiles prontos"), ("ORB", "FOC", "clique/zoom numa região\n→ Top 20 da região"),
                          ("FOC", "ORB", "afastar"), ("FOC", "CAM", "escolher camada"), ("CAM", "FOC", "remover camada"),
                          ("FOC", "DET", "clicar ilustração/marcador"), ("DET", "FOC", "fechar")],
           "nota": "reduceMotion (RF23) desliga a rotação\ne as animações Lottie."})

# ---------------------------------------------------------------- RF28 visualizador
rf(n=28, sprint=4, tela="Explorador › Restaurantes do Mundo (/explore/restaurants)",
   titulo="Visualizar a sub-aba \"Restaurantes do Mundo\" do Explorador, com filtros na top bar (como a sub-aba Marcas), cobrindo restaurantes de todas as regiões do mundo",
   resumo="Visualizador em grade/mapa com top bar de filtros idêntica à da aba Marcas: continente, país, cidade, cozinha, faixa de preço, avaliação, DineHype, "
          "dieta (vegano, sem glúten, halal, kosher), aberto agora, delivery, reserva, distância. Paginação por search_after (infinite scroll) sobre o índice "
          "OpenSearch com milhões de restaurantes (cadastrados + base aberta importada: OpenStreetMap/Overture Places, com atribuição).",
   telas=["Top bar de filtros (chips + dropdowns, contagem por facet)", "Alternar Grade · Mapa · Lista", "Card do restaurante (mesmo layout do esquema)",
          "Ordenação: Popularidade, Avaliação, Preço, Distância, Novos"],
   controller="RestaurantExplorerController", rotas=["GET /api/explorer/restaurants?continent=&country=&city=&cuisine=&price=&diet=&openNow=&sort=&after=",
                                                      "GET /api/explorer/restaurants/facets"],
   service="RestaurantExplorerService", metodos=["search()", "facets()", "importOpenData()"],
   portas=["SearchIndexPort «OpenSearch (geo_distance, aggs, search_after)»", "CachePort «Redis facets»", "PlacesImportPort «Overture/OSM batch»"],
   externos=["Overture Maps / OpenStreetMap", "OpenSearch"],
   entidades=[RESTAURANT_INDEX, RESTAURANT_PROFILE, RESTAURANT_SCHEME, HYPE],
   enums={"RestaurantSort": ["POPULARIDADE", "AVALIACAO", "PRECO_ASC", "PRECO_DESC", "DISTANCIA", "NOVOS"]},
   erros=["FILTRO_INVALIDO", "CURSOR_EXPIRADO"],
   estado={"nome": "Visualizador", "estados": [("INI", "Inicial (região do usuário)"), ("FIL", "Filtrando"), ("RES", "Resultados"), ("VAZ", "Sem resultados"), ("MAI", "Carregando mais")],
           "transicoes": [("[*]", "INI", ""), ("INI", "FIL", "alterar filtro"), ("FIL", "RES", "hits > 0"), ("FIL", "VAZ", "hits = 0"),
                          ("RES", "MAI", "fim da rolagem"), ("MAI", "RES", "search_after"), ("VAZ", "FIL", "limpar filtro"), ("RES", "FIL", "alterar filtro")], "nota": ""})

# ---------------------------------------------------------------- RF29 varejo
rf(n=29, sprint=4, tela="Pedir & Reservar (/restaurants/{slug}/order)",
   titulo="Realizar pedidos (delivery/retirada) e reservas de mesa nos restaurantes — varejo culinário",
   resumo="Carrinho no Redis, checkout com pagamento (Pix/cartão via gateway com tokenização PCI), acompanhamento do pedido em tempo real (WebSocket/SSE) "
          "e reservas com escolha de horário. Cada pedido/reserva gera evento de engajamento (RF24).",
   telas=["Cardápio do restaurante com 'Adicionar'", "Carrinho", "Checkout (endereço, pagamento Pix/cartão, cupom)", "Acompanhar pedido (linha do tempo + mapa)", "Reservar mesa"],
   controller="OrderController", rotas=["PUT /api/cart/items", "POST /api/orders", "GET /api/orders/{id}/stream (SSE)", "POST /api/reservations", "POST /api/payments/webhook"],
   service="OrderService", metodos=["addToCart()", "checkout()", "track()", "reserve()", "onPaymentWebhook()"],
   portas=["PaymentPort «Gateway (Stripe/Pagar.me) tokenizado»", "CartPort «Redis»", "EventPublisherPort «Kafka»", "NotificationService"],
   externos=["Gateway de pagamento", "Kafka"],
   entidades=[CART, ORDER, ORDER_ITEM, ORDER_TRACK, RESERVATION, MENU_ITEM],
   enums={"OrderStatus": ["CRIADO", "AGUARDANDO_PAGAMENTO", "PAGO", "EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE", "CANCELADO", "ESTORNADO"]},
   erros=["RESTAURANTE_FECHADO", "ITEM_INDISPONIVEL", "PAGAMENTO_RECUSADO"],
   estado={"nome": "Pedido", "estados": [("CRI", "Criado"), ("AGP", "Aguardando pagamento"), ("PAG", "Pago"), ("PRE", "Em preparo"),
                                         ("SAI", "Saiu para entrega"), ("ENT", "Entregue"), ("CAN", "Cancelado"), ("EST", "Estornado")],
           "transicoes": [("[*]", "CRI", "checkout"), ("CRI", "AGP", "intenção de pagamento"), ("AGP", "PAG", "webhook aprovado"), ("AGP", "CAN", "recusado/expirou"),
                          ("PAG", "PRE", "restaurante aceita"), ("PAG", "EST", "restaurante recusa"), ("PRE", "SAI", "despachado"), ("SAI", "ENT", "entregue"),
                          ("ENT", "[*]", "")], "nota": "Idempotency-Key no POST /orders e\nno webhook de pagamento."})

N = max(r["n"] for r in RFS)
