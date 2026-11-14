# Backend para o app nativo (Unreal): o que o sistema atual oferece

> Estudo de 07/11/2026 sobre `main` (último commit `4fe3364`). Pedido do dono: projetar o FashionAI como aplicativo de
> loja (App Store, PlayStation Store, Xbox Store) que renderize os gráficos do FLAIR 3D; o web app (fashion-ai.com) é
> temporário e serve de banco de testes do app, que vai suportar mais carga de dados e Unreal Engine.
>
> Este documento olha **só o que o sistema atual entrega a um cliente Unreal** e o que falta no backend. Motor, regras de
> loja e certificação ficam no documento irmão `docs/plataforma/APP_NATIVO_UNREAL.md`. Ele complementa o estudo
> multiplataforma de 10/10/2026 (`docs/multiplataforma/`), cujos contratos (`/api/client/config`, avatar canônico,
> sessão do provador) já estão no código e são citados aqui sem repetir.
>
> Nomes: os jogos são o **FLAIR 3D** (cinco jogos, `docs/flair/flair-3d/JOGOS.md`) e o **FLAIR Card Building
> Challenge (CBC)** (cinco elencos, `docs/flair/cbc/CINCO_ELENCOS.md`).

## Resumo

- **A API já serve um app nativo no essencial.** É stateless, usa JWT RS256 e refresh token no corpo da requisição,
  e o web só usa cookie porque passa por um BFF próprio. Um cliente Unreal chama `/api/auth/*` direto.
- **O que mais exige mudança é o formato das respostas, mais que os endpoints.** Quase tudo devolve
  `Map<String,Object>` sem esquema no OpenAPI. O texto chega de três jeitos diferentes, as URLs são relativas à origem
  do web, e a arte das cartas e dos cenários é montada em TypeScript.
- **Faltam peças inteiras:** vínculo com contas de plataforma (Apple, Google, PSN, Xbox), login por pareamento no
  console, push, telemetria, validação de recibos de loja, manifesto de assets 3D por plataforma e URLs assinadas.
- **Sob carga, o primeiro gargalo é a sessão.** Cada requisição autenticada lê todos os refresh tokens da família, e
  essa lista cresce a cada renovação sem nunca ser limpa. Depois vêm o catálogo do FLAIR 3D, recalculado por
  requisição, e a soma do extrato de FAI Points.
- **Dois bloqueios de loja do estudo anterior continuam abertos:** a exclusão de conta agendada nunca é executada (B1)
  e `/media/**` é público (B2).

---

## 1. Autenticação e sessões

### 1.1 Como funciona hoje

| Peça | Como é | Onde |
|---|---|---|
| Access token | JWT RS256, 15 min, claims `sub`, `user_id`, `sid` (família da sessão), `username`, `role`, `profile_type`; emissor `fashionai` e audiência `fashionai-api` conferidos | `fai-web/.../security/JwtTokenIssuer.java`, `fai-web/.../config/JwtConfig.java` |
| Refresh token | opaco de 32 bytes, guardado como SHA-256; dura 30 dias com `rememberMe` e 1 dia sem; rotação a cada uso; reuso de um token já rotacionado revoga a família inteira | `IdentityService.issue` e `refresh` (`fai-application/.../service/IdentityService.java`, l. 713–765) |
| Sessão por aparelho | cada família é uma sessão com `deviceName`, user-agent, IP e país; `GET/DELETE /api/auth/sessions[/{id}]` lista e revoga | `AuthController.java`, `IdentityService.sessions` |
| Sessão encerrada | depois do JWT, `SessionActiveFilter` recusa um `sid` revogado com 401 `SESSAO_ENCERRADA` | `fai-web/.../security/SessionActiveFilter.java` |
| 2FA | código enviado por e-mail; o login responde `twoFactorRequired` e o cliente reenvia com `twoFactorCode` | `IdentityService.LoginCommand` e `login` (l. 609–681) |
| Web (navegador) | BFF Next `POST /bff/auth/{login,register,refresh,logout}` guarda o refresh token no cookie `fai_rt` (HttpOnly, Secure, SameSite=Strict, `path=/bff/auth`) mais o sinal `fai_rt_h`; o access token fica só na memória da aba, com `BroadcastChannel` e `navigator.locks` para renovar entre abas | `app/bff/auth/[action]/route.ts`, `lib/bff/auth-session.ts`, `lib/api/client.ts` |
| CSRF | a API desliga CSRF (bearer stateless, sem cookie de sessão); o BFF só aceita POST da própria origem (`Origin`/`Sec-Fetch-Site`); CORS com lista de origens | `SecurityConfig.java` (`csrf(disable)`, `corsConfigurationSource`), `route.ts` (`sameOrigin`) |
| OAuth / login social | **não existe para contas.** O Google (OIDC com PKCE) só protege o portão de desenvolvimento | `app/(gate)/gate/google/route.ts`, `lib/gate/token.ts` |
| Portão de desenvolvimento | toda `/api/**` exige `X-Dev-Gate` (token HMAC curto emitido pelo `/gate` do Next) ou, no modo `cloudflare`, o JWT do Cloudflare Access; ficam abertos só saúde, preflight e `/media/` | `fai-web/.../support/DevGateFilter.java` |
| IP real | o BFF manda `X-Fai-Client-Ip` assinado com `EDGE_PROXY_SECRET`; o backend confere | `lib/bff/auth-upstream.ts`, `fai-web/.../support/ClientIpResolver.java` |
| Freios | por IP: login 30/10 min, cadastro 10/h, refresh 120/10 min; teto de hashes Argon2 simultâneos (503 com `Retry-After`) | `fai-web/.../support/AuthRateLimitFilter.java` (l. 75–87) |

### 1.2 O que o cliente nativo precisa

| Necessidade | Situação atual | O que mudar no backend |
|---|---|---|
| Login com senha e refresh | **Pronto.** `POST /api/auth/login` com `rememberMe=true` e `deviceName` e `POST /api/auth/refresh {refreshToken}` (`AuthController.java`) | Nada. O app guarda o refresh token no Keychain, Keystore ou armazenamento seguro do console, e o access token só em memória |
| Renovação sem perder a sessão | Rotação com detecção de reuso: se o app morre depois de o servidor rotacionar mas antes de gravar o token novo, a próxima renovação usa o antigo e **derruba a família** (`IdentityService.refresh`, l. 750–755) | Janela de tolerância curta (ex.: 30 s) em que o token anterior ainda devolve o mesmo par novo. No cliente, a renovação precisa ser única (single-flight), como o web já faz com `navigator.locks` |
| Vínculo com o aparelho | O refresh token não está ligado a aparelho nenhum; `deviceName` é texto livre | `installation_id` (UUID gerado na instalação) e `platform` (de `X-FAI-Platform`) em `refresh_tokens`; o refresh só vale com o mesmo `installation_id`. Atestado opcional: App Attest (iOS), Play Integrity (Android) |
| Console sem teclado | Não existe | Fluxo de autorização de dispositivo (RFC 8628): `POST /api/auth/device/code` → `{userCode, verificationUri, interval}`, aprovação no celular ou no web logado, e `POST /api/auth/device/token` com consulta periódica. Já previsto em `docs/multiplataforma/02-arquitetura-e-contratos.md` §2 |
| Contas de plataforma | Não existe | Tabela `linked_platform_accounts (user_id, provider, subject, linked_at)`; `POST /api/auth/platform/{provider}` valida o token da plataforma no servidor (Sign in with Apple, Google, PSN, Xbox/XSTS, Steam, EOS) e abre sessão **só se** houver vínculo; `POST/DELETE /api/me/linked-accounts/{provider}`. A conta FashionAI continua sendo a dona. Se houver qualquer login de terceiros no iOS, o Sign in with Apple passa a ser obrigatório (`docs/multiplataforma/01-inventario-e-destino-das-telas.md` §1) |
| Portão nas versões de teste | O app não passa pelo cookie do `/gate`. O modo `cloudflare` aceita token de serviço do Access, mas isso põe um segredo dentro do binário | Ambiente de staging próprio para os builds nativos, com o portão desligado e uma lista de contas permitidas no backend. Na loja pública, o portão sai ou passa a aceitar atestado do app (bloqueio B4 em `docs/multiplataforma/01` §4) |
| IP real e auditoria | O app chama a API direto, então o IP do socket já é o do cliente | Nada. O `X-Fai-Client-Ip` só existe para o BFF |
| Logout e sair de todos | **Pronto** (`/api/auth/logout` usa o `sid`; `DELETE /api/auth/sessions`) | Mostrar a plataforma em cada sessão listada (depende do `platform` acima) |

---

## 2. Superfície de API para os jogos e o avatar

Legenda: **Pronto** = um cliente Unreal consome como está. **Ajustar** = funciona, mas precisa de versão nova ou de
mudança de formato. **Só web** = continua no navegador.

| Grupo | Endpoints | Código | Classe | Observações para o cliente Unreal |
|---|---|---|---|---|
| Configuração do app | `GET /api/client/config` (público) | `MultiplatformController`, `ClientConfigService` | Pronto | Já traz `contractVersion "1.0"`, `minVersion`, `updateRequired`, perfil de qualidade e capacidades. Falta um mapa `features` e as URLs base dos assets (§5 e §6) |
| FLAIR 3D: catálogo | `GET /api/flair/games/summary`, `GET /api/flair/games?level&wardrobe&difficulty&rarity&series&district&q`, `GET /api/flair/games/{slug}` | `FlairGameController`, `FlairGameService`, `FlairGameViews` | Ajustar | `scene` é o `scene_json` (V98): um layout **2D** (céu, chão, `props` com x/y no `viewBox` 160×100 e `slots` com coordenadas em %), feito para o SVG de `components/flair/cbc-scene.tsx`. Para a Unreal falta um bloco `scene3d` (mapa ou nível, versão do conteúdo, socket de cada vaga). `thumbnail` é `/flair/games/*.webp`, servido pelo `public/` do Next. O javadoc ainda fala em "100 jogos", mas `V98__flair_3d_jogos.sql` insere 5 |
| FLAIR 3D: jogar | `POST /api/flair/games/{slug}/check`, `POST .../submit` (corpo `BuildRequest {slots: {vaga: cardId}, interpretation}`) | `FlairGameService.check/submit`, `Flair3dAccess`, `FlairGame3dScore`, `Flair3dRewards` | Pronto (regra) / Ajustar (formato) | O servidor é a autoridade: bloqueio por nível (403 com código), pontuação, penalidades, efeitos de Aura, bônus de perfeição e recompensas, tudo numa transação. Isso combina com um cliente que só desenha. Faltam `Idempotency-Key` no `submit` (rede móvel instável) e esquema tipado do bloco `flair3d` (`slots[].effect/kind/bonus/text`, `hypeTotal`, `penalties`, `perfect`) |
| FLAIR CBC (elencos) | `GET /api/flair/challenges[/{idOrSlug}]`, `POST .../check`, `POST .../submit`, `POST /api/flair/moments/{id}/challenges` | `FlairChallengeController`, `FlairChallengeService`, `CbcRules`, `CbcRequirements*` | Ajustar | O motor de links do elenco (`fai-application/.../flair/CbcLinks.java`, commit `4fe3364`) **ainda não sai em resposta nenhuma**. A tela do elenco precisa da força e da cor de cada linha e da química por carta e do elenco no `check` |
| Partidas e modos | `/api/flair/duels`, `/arena`, `/teams/**`, `/api/flair/modes/**` (batalha, squad, liga, passarela, turnê, territórios, combo, tag-team, chefes, wardrobe wars, draft, deck, xadrez, ultimate), `/api/flair/adventure/**` | `FlairController`, `FlairModesController`, `FlairCardModesController`, `FlairAdventureController` | Pronto (lógica) / Ajustar (formato) | Tudo se resolve no servidor por turno, numa requisição; não há PvP em tempo real. As respostas são `Map` sem esquema |
| Cartas e decks | `GET /api/flair/cards`, `GET /api/me/flair/cards`, `GET /api/users/{id}/flair/cards`, `POST /api/flair/cards[/preview]`, `GET /api/flair/decks[/{schemeId}]` | `FlairController`, `FlairCollectionController`, `FlairCollectionService` | Ajustar | A carta traz dados (`ovr`, `stats`, `tier`, `rarity`, `imageUrl`, `tags`), mas a **arte** (aura × material × skin × mosaico × moldura) é montada no cliente por `lib/card-art.ts` e `lib/fashion-card.ts` a partir do manifesto. A Unreal teria de reimplementar essa composição, ou o servidor passa a gerar a textura da carta (já existe o precedente `GET /api/schemes/*/card.png`). `/api/me/flair/cards` devolve a coleção inteira, sem paginação |
| Carteira e recompensas | `GET /api/flair/me` (coins, rank, extrato dos últimos 30), `GET /api/flair/quests`, `POST /api/flair/quests/{code}/claim`, `GET /api/flair/vouchers`, `POST /api/flair/skins/{skin}`, `GET /api/me/points`, `GET /api/points/shop`, `POST /api/points/shop/{sku}/purchase` (com `Idempotency-Key`), `GET /api/me/coupons`, `POST /api/me/coupon-rights/{id}/redeem` | `FlairController`, `FlairService`, `HighlightsController`, `FaiPointsService`, `CouponController` | Pronto | FAI Points e coins só se **ganham**, nunca se compram (`FlairService`, l. 88–89; `docs/multiplataforma/05-lojas-e-comercio.md` §3.4), então não há compra dentro do app aqui. Cupom de marca abre a loja externa: fora do console |
| Combinações das lojas (marcas) | `GET /api/flair/combinations`, `.../check`, `.../redeem`; `/api/flair/brand/**`; `GET /api/institutional/{slug}/flair` | `FlairController` | Pronto (resgate) / Só web (gestão pela marca) | A marca cria e valida no portal web; o jogador só vê e resgata |
| Aura | `GET /api/me/aura-permissions`; `/api/aura-store/**` (licença de arte paga em pontos, só marcas e celebridades aprovadas) | `AuraPermissionsController`, `AuraCommerceController`, `AuraPermissionsService` | Pronto (permissões) / Só web (loja) | As permissões decidem Metamorfose e Impersonation no FLAIR 3D (`FlairGameService.player`) |
| Avatar 3D | `GET/POST/PATCH/DELETE /api/me/avatar3d`, `/versions`, `/versions/{n}/approve`, `/restore`, `POST /body-scan`, `POST /stylized-portrait`, `GET /api/avatar3d/{userId}/texture`, `GET /api/me/avatar3d/canonical` | `Avatar3dController`, `Avatar3dService`, `AvatarCanonicalService` | Pronto (leitura) / Ajustar (captura) | O `model_json` v1 tem `shape` 468×3 em cm (`lib/avatar3d/model.ts`; `Avatar3dModelRules.SHAPE_LEN`), `skin`, `hair`, `body` com a origem de cada medida e `bodySkin`, mais o atlas do rosto em JPEG. A captura (MediaPipe e face-api no navegador: `lib/avatar3d/detect.ts`, `pipeline.ts`) e a deformação do corpo e do rosto (`lib/avatar3d/human/*`) são **TypeScript** e precisam ser portadas. O corpo base `FAI_BODY_V1` está em `public/avatar3d/body/` (`fai-body-v1.bin` com 4,3 MB, mais `.json`) |
| Provador e manequim | `GET /api/try-on/session`, `PUT/DELETE .../slots/{slot}` (ETag/If-Match); `GET /api/pieces/{id}/look3d`, `GET /api/schemes/{id}/look3d` | `MultiplatformController`, `TryOnSessionService`, `ShowcaseController` | Pronto (sessão) / Ajustar (`look3d`) | A sessão já devolve a representação por perfil (`MESH_3D` com `url`, `bytes`, `triangles`, `sha256`, ou `PREVIEW_2D`). O `look3d` foi feito para a cena three.js |
| Guarda-roupa | `GET /api/me/closet`, `GET /api/pieces/{id}`, upload multipart de imagem, `GET /api/taxonomy`; `POST/GET /api/pieces/{id}/model3d` | `WardrobeController`, `WardrobeService`, `Model3dService` | Pronto (leitura) / Só web (edição, no início) | O `POST .../model3d` dispara geração 3D (RF16) que pode usar provedor pago quando há chave configurada. O app não deve chamar automaticamente |
| Hype | `GET /api/hype/summaries?type&ids` (até 100 por chamada, `HypeQueryService.MAX_BATCH`), `/api/hype/pieces/{id}`, `/looks/{id}`, `/trending`, `/ranking`, `/globe`, `/api/me/hype/wardrobe` | `HypeController` | Pronto | É leitura pública em lote, boa para cache. O cálculo é periódico (`HypeSnapshotService` a cada 6 h, `HypeLiveRecalc` a cada 30 s) |
| Quarto (cenário do Capítulo A) | `GET /api/me/room` e `/api/me/room/**` | `RoomController`, `RoomService` | Ajustar | O jogo 1 (Espelho Partido) usa o quarto da pessoa como cena (`components/flair/games/room-scenario.tsx`). Os modelos `public/models/fai-room/bed-fai.glb` (11 MB) e `rack-fai.glb` (9,9 MB) estão no `public/` do web |

### 2.1 Formatos feitos para o React e como a Unreal os consumiria

1. **`Map<String,Object>` sem esquema.** O OpenAPI (`/v3/api-docs`, `OpenApiConfig.java`) lista as rotas, mas quase
   nenhuma resposta tem esquema; não dá para gerar structs `USTRUCT` nem testar o contrato. O cliente Unreal de hoje
   lê o JSON campo a campo (`clients/unreal/FashionAI/Source/FashionAI/Private/FaiApiSubsystem.cpp`). Proposta: records
   tipados nas rotas novas (§6, item 2).
2. **Texto em três formas.**
   (a) resolvido no servidor pelo `Accept-Language` (`RequestLocaleFilter`, `Msg.t`, `MomentViews.label`), por exemplo
   a `ficha` do jogo e as mensagens de erro;
   (b) **chave e variáveis** que o web traduz com o próprio catálogo, por exemplo a história do CBC
   (`CbcStory`: `cbc.story.*`, `cbc.scenario.*`), cujas frases só existem em `lib/i18n/messages/{pt-BR,en,es}.json`
   (cerca de 9.950 chaves, 2 MB, formato ICU de `lib/i18n/icu.ts`);
   (c) mapa com os três idiomas (`{"pt-BR","en","es"}`), por exemplo o cenário da ficha na abertura da história
   (`FlairGameViews.story`) e o texto dos efeitos no `flair3d`.
   Para a Unreal, a saída mais simples é um endpoint de pacote de traduções com versão
   (`GET /api/v2/i18n/{locale}?ns=cbc,games,flair` com ETag), importado como String Table, e o servidor passando a
   devolver sempre (b). Hoje a forma (a) também exige que o cache varie por idioma.
3. **URLs relativas à origem do web.** `thumbnail` (`/flair/games/…`), arte de aura e material (`/aura_sem_GIF/…`,
   `/_derived/…`) e mídia (`/media/…`) dependem dos rewrites do Next (`next.config.ts`, `lib/media/static-media.ts`)
   ou do host da API. O app precisa de URLs absolutas, ou de bases declaradas em `/api/client/config`.
4. **Visual montado no cliente.** A cena SVG do CBC (`components/flair/cbc-scene.tsx`), a cena fotográfica
   (`components/flair/games/photo-scene.tsx`) e a arte das cartas (`lib/card-art.ts`) são código de interface. Na
   Unreal elas viram níveis, materiais e widgets UMG; o backend só precisa dar referências estáveis (ids de
   preset, `levelId`, socket de cada vaga) em vez de coordenadas em porcentagem.
5. **Erros.** O formato é uniforme: `{status, code, message, details, path, timestamp, correlationId}`
   (`fai-web/.../error/ApiError.java`). O cliente decide pelo `code`, nunca pela `message`.

---

## 3. Mídia e assets 3D

### 3.1 Onde estão hoje

| Origem | Conteúdo e tamanho (medido em 07/11/2026) | Como é servido |
|---|---|---|
| `public/` (127 MB) | `mediapipe` 57 MB (modelos de visão); `models/fai-room` 21 MB (os **2 únicos GLBs** do repositório); `icons` 19 MB; `_derived` 17 MB (prévias webp); `avatar3d` 4,4 MB (`FAI_BODY_V1`); `flair` 3,2 MB (6 capas de jogo) | estático do Next/Vercel |
| `media/` (1,1 GB) | auras, materiais, mosaicos e peças padrão: 671 MP4 (743 MB, somando `public/`) e 905 PNG (270 MB) | rewrites para `STATIC_MEDIA_ORIGIN` ou para o **jsDelivr no commit do deploy**, lendo o repositório público (`lib/media/static-media.ts`); no Docker, a API recebe `media/` (`AssetCatalogService`) |
| Mídia de usuários | fotos de peças, perfis, atlas do rosto (`restricted/`), exportações | `MediaStoragePort`: S3/R2 (`fai-infrastructure/storage-s3/.../S3MediaStorageAdapter.java`) com `public-base-url` (CDN ou bucket) ou entregue pela API em `/media/**` (`MediaProxyController`); disco local em dev (`LocalFileMediaStorage`) |
| HDRIs | **nenhum** (0 arquivos `.hdr`/`.exr`). A luz vem do `RoomEnvironment` procedural do three.js (`components/three/common.tsx`, l. 124) e as texturas do Met Gala Heist são geradas em canvas (`components/heist/scene/*-tex-*.ts`) | — |
| Roupas 3D | `garment_assets_3d` (V59: `rig_standard`, `renditions_json`, `metrics_json`, aprovação), `catalog_product_models_3d` (V97: `sha256`, `renditions_json`, `PUBLISHED`) | URL por rendição, devolvida na sessão do provador |

Pontos de atenção:

- `MediaProxyController.media` lê o objeto inteiro para um `byte[]`, sem suporte a `Range`, com cache de 1 dia
  (`cacheFor`). Uma rendição de roupa pode ter até 12 MB (`QualityProfile.maxGarmentBytes`), e um pacote de conteúdo
  muito mais. Isso não pode passar pela JVM.
- O presign do S3 hoje só existe para **upload** (PUT, 10 min). A leitura é pública e permanente (bloqueio B2).
- **Já existe um manifesto:** `GET /api/assets/manifest` (`BackgroundController`, `AssetCatalogService`, arquivo
  `fai-web/src/main/resources/catalog/asset-manifest.json`, versão 2, cerca de 200 KB, gerado por
  `scripts/assets/build_asset_catalog.py`) com `bytes` e `sha256` dos assets 2D. Ele não tem plataforma, versão de
  conteúdo nem assets 3D, mas é o ponto de partida.

### 3.2 O que um pipeline de assets da Unreal pede do backend

- **No pacote instalado (Pak/IoStore, por plataforma):** corpo `FAI_BODY_V1` já importado como Skeletal Mesh, os cinco
  cenários do FLAIR 3D (suíte, camarim, rooftop, boutique, salão de gala), molduras e materiais das cartas, a interface
  e as fontes. Isso é cozido no CI de build, não pelo backend.
- **Sob demanda (chunks ou downloads):** rendições de roupa por perfil de qualidade, vídeos de aura e material
  (convertidos para o formato de mídia de cada plataforma [verificar suporte a MP4 nos consoles]), texturas do avatar
  e capas.
- **O que o backend precisa oferecer:**
  1. `GET /api/v2/assets/manifest?platform&quality&contentVersion` com `{contentVersion, minAppVersion, chunks:[{id,
     url, bytes, sha256}], items:[{id, kind, chunkId|url, bytes, sha256}]}`, `ETag` e `304`;
  2. chaves de objeto endereçadas por conteúdo (`…/{sha256}.pak`) com `Cache-Control: public, immutable`, entregues
     por CDN com `Range`;
  3. **URLs assinadas de vida curta** para tudo que é pessoal (atlas do rosto, fotos), emitidas por endpoint
     autenticado (resolve B2 também para o web);
  4. um bucket próprio para o conteúdo cozido, **fora do jsDelivr**: o repositório é público e arte licenciada de marca
     não pode ficar lá;
  5. tabela `content_releases (platform, content_version, manifest_json, published_at)` para publicar e reverter um
     pacote sem lançar versão nova do app.

---

## 4. Tempo real e carga

### 4.1 Situação atual

| Tema | Situação | Onde |
|---|---|---|
| WebSocket ou SSE | **Nenhum** (sem `SseEmitter`, STOMP ou `EventSource` no código) | busca no código de `fai-*`, `app/`, `lib/` e `components/` |
| Atualização | por consulta: contador de notificações a cada 60 s; `useApi` com `refreshInterval` | `components/app-shell.tsx` (l. 221–222), `lib/hooks/use-api.ts` |
| Limite de taxa | por IP só nas rotas de autenticação; cotas por usuário dentro dos serviços via `RateLimitPort` (Redis se `fashionai.redis.enabled`, senão memória) | `AuthRateLimitFilter`, `RedisAdapters`, `InMemoryRateLimit` |
| Cache | sem Spring Cache; caches em `ConcurrentHashMap` locais a cada réplica (17 ocorrências), por exemplo o Inventory Score com 1 h e sem limite de tamanho | `InventoryScoreService` (l. 80 e 123) |
| Cache HTTP | pontual: câmbio 1 h, mídia 1 dia, textura do avatar 10 min; ETag só no provador e no quarto | `ExchangeRateController`, `MediaProxyController`, `Avatar3dController`, `MultiplatformController`, `RoomController` |
| Paginação | cursor opaco no feed; a maioria das listas devolve tudo (coleção de cartas, catálogo de jogos, notificações) | `DiscoveryController`; `FlairCollectionController.mine`; `FlairGameService.list` |
| Banco | MySQL com Hikari de **10 conexões** por padrão | `fai-bootstrap/src/main/resources/application.yml` (l. 13) |
| Jobs | 15 `@Scheduled` **sem trava distribuída**: com duas réplicas, cada job roda duas vezes | por exemplo `HypeLiveRecalc` (30 s), `ChallengeService` (15 min), `HypeSnapshotService` (6 h) |
| Telemetria | só Web Vitals, gravados como linha de log | `app/bff/metrics/route.ts` |

### 4.2 O que cede primeiro com "maior carga de dados"

1. **Validação de sessão em toda requisição.** `IdentityService.sessionActive` (l. 767–773) carrega **todas** as linhas
   de `refresh_tokens` da família e filtra em memória. Cada renovação acrescenta uma linha, e nada apaga as antigas (não
   há limpeza de `refresh_tokens` no código). Um app aberto o dia todo renova a cada 15 min: são cerca de 2.900 linhas
   por família em 30 dias, lidas em **cada** chamada. *Sugestão:* consulta `EXISTS` com índice
   `(family_id, revoked_at, expires_at)`, conjunto de famílias revogadas no Redis com TTL igual ao do access token, e
   job diário que apaga tokens vencidos.
2. **Catálogo do FLAIR 3D e do CBC.** `FlairGameService.list` e `FlairChallengeService` leem `flair_challenges`
   inteira, as entregas da pessoa e o nível (soma no extrato e Inventory Score) **a cada requisição**. O catálogo só
   muda por migração. *Sugestão:* catálogo em cache com ETag por `contentVersion`, e a parte "minha" (acesso e
   tentativas) num endpoint separado e leve.
3. **Soma do extrato de FAI Points.** `FaiPointsLedgerEntryRepository.lifetime` faz `SUM(delta)` sobre
   `fai_points_ledger` sempre que o nível é calculado. *Sugestão:* tabela de saldo (`user_points_balance`)
   atualizada na mesma transação do lançamento.
4. **Tabelas que crescem com o jogo:** `flair_challenge_submissions`, `flair_card_instance`, `flair_matches` e
   `flair_match_entries`, `flair_coin_entries`, `flair_game_rewards`. Revisar índices por `(user_id, created_at)` e
   paginar extratos e histórico.
5. **Mídia pela JVM** (§3.1). Com o pool de 10 conexões e a JVM segurando arquivos inteiros, downloads de 3D derrubam a
   API antes do banco.
6. **Telemetria de jogo**, quando existir, não deve ir para o MySQL. O módulo Cassandra já existe e é opcional
   (`fai-infrastructure/persistence-cassandra`, perfil `cassandra`); outra opção é um coletor externo.

Tempo real: o FLAIR é por turnos e resolvido no servidor, então **não precisa de WebSocket agora**. Um canal SSE
(`GET /api/v2/events`) para notificações, recompensas e fim de Momento substitui as consultas periódicas. WebSocket
só se surgir partida PvP ao vivo.

---

## 5. O que fica no web e o que o app precisa ter

| Área | Web (fashion-ai.com) | App nativo (Unreal) |
|---|---|---|
| FLAIR 3D (cinco jogos) | protótipo e banco de testes | **essencial**: cena 3D, encaixes, efeitos de Aura, avatar ou manequim |
| FLAIR CBC (tela do elenco) | protótipo | **essencial**: formação, linhas de link e química |
| Avatar 3D | captura e edição (hoje) | **essencial**: ver e vestir; captura no celular depois do porte do MediaPipe |
| Carteira de recompensas (FAI Points, coins, vouchers, cupons) | sim | **essencial** (só leitura e resgate; nada se compra com dinheiro) |
| Provador | sim | recomendado (contrato pronto) |
| Social (feed, comentários, perfis, Momentos) | **fica** | leitura opcional mais tarde |
| Loja e catálogo, guarda-roupa (cadastro e edição de peças, estúdio) | **fica** | só leitura no início |
| Administração, portais de marca e celebridade (dashboard, cupons, combinações FLAIR, loja AURA), `/lab` | **fica só no web** | — |

**O web como banco de testes:**

- **Mesma API e mesmos dados.** Sem `X-FAI-Platform`, a plataforma é `WEB` (`ClientPlatform.parse`), e as rotas
  novas são aditivas (`docs/multiplataforma/02` §4).
- **Interruptores de funcionalidade:** não há sistema de flags hoje. A única é `fashionai.features.rf16-3d` em
  `application.yml`, e `/api/client/config` só expõe `commerce.enabled=false`. Proposta: um mapa
  `features` em `/api/client/config` por plataforma e versão do app (por exemplo `flair3d.games`, `cbc.links`,
  `avatar.capture`), lido pelo web e pelo app, para ligar um jogo primeiro no web e depois no app.
- **Cenas de referência em three.js:** `components/room3d/room-scene.tsx` (a suíte do Capítulo A),
  `components/flair/afterparty-scene.tsx` (aventura), `components/heist/scene/*` (Met Gala Heist: cidade e salão
  procedurais), `components/flair/games/photo-scene.tsx` e `components/flair/cbc-scene.tsx` (2D). Elas servem de
  referência de jogabilidade, câmera e enquadramento das vagas para os níveis Unreal; não são para portar linha a
  linha.
- **Paridade garantida pelo servidor:** como `check`/`submit` decidem tudo, os testes de contrato podem usar as
  fichas de `scripts/flair-games/data/serie-{a..e}.json` como entrada e comparar web e Unreal com o mesmo resultado
  esperado.
- **Continuar em outro aparelho:** o que o console não faz (foto, cadastro, exclusão) abre no celular ou no web pelo
  fluxo de continuação (`docs/multiplataforma/02` §5; `ClientConfigService`, `continueElsewhere`).

---

## 6. Mudanças no backend, em ordem

Esforço para uma pessoa [estimativa]: **P** até 3 dias, **M** 1 a 2 semanas, **G** 3 semanas ou mais. Toda mudança de
esquema é uma migração nova (nunca editar V98 ou anteriores). Os arquivos novos respeitam `docs/refactoring/LINE_RULES.md`
(controller até 200 linhas, DTO e repositório até 120, serviço até 250).

| # | Mudança | Onde | Esforço | Riscos e dependências |
|---|---|---|---|---|
| 0 | Fechar os bloqueios de loja **B1** (agendar `AccountService.purgeScheduledDeletions`, que hoje não tem chamador) e **B2** (leitura de mídia pessoal por URL assinada) | `AccountService`, `S3MediaStorageAdapter`, `MediaProxyController`, `SecurityConfig.PUBLIC_GET` | M | B1 executa exclusões reais pendentes em produção e precisa de decisão do dono e de revisão da fila. B2 muda URLs que o web usa |
| 1 | Estratégia de versão: rotas remodeladas em **`/api/v2/...`** (FLAIR 3D, CBC, cartas, carteira, manifesto), o restante em v1; `X-FAI-Contract` informativo; grupo OpenAPI `v2` | `fai-web` (controllers novos), `OpenApiConfig` | P | Duplicar lógica: o v2 deve só adaptar a saída dos mesmos serviços |
| 2 | **DTOs tipados** (records) para jogo, vaga, `flair3d`, carta, deck, carteira e erro, com esquema no OpenAPI | `fai-application` (views), `fai-web` | M–G | Caracterizar a saída v1 antes (regra do `CLAUDE.md`); muitos `Map` aninhados |
| 3 | **Pacote de traduções** `GET /api/v2/i18n/{locale}?ns=` com ETag, mais a regra "v2 devolve chave e variáveis" | fonte única com `lib/i18n/messages/*.json` | M | Duas fontes de verdade, se o catálogo não sair do `lib/` do web |
| 4 | `/api/client/config` com `features` e `assetBases` (API, mídia, conteúdo); URLs absolutas no v2 | `ClientConfigService` | P | — |
| 5 | **Sessão nativa:** `installation_id` e `platform` em `refresh_tokens`, janela de tolerância na rotação, `sessionActive` com `EXISTS` e cache de revogação no Redis, limpeza diária de tokens vencidos | `IdentityService`, `SessionActiveFilter`, migração | M | A tolerância precisa ser curta e de uso único, para não reabrir o roubo de token |
| 6 | **Ambiente de staging para os builds nativos** (portão desligado e lista de contas no backend) | configuração (`DevGateFilter`) | P | Não expor dados reais; contas de teste apenas |
| 7 | **Login por pareamento** (RFC 8628) para consoles e TVs | `AuthController` (ou controller novo), `IdentityService` | M | Força bruta do `userCode`: limite e validade de 10 min |
| 8 | **Vínculo de contas de plataforma** + Sign in with Apple e Google; identidade PSN, Xbox (XSTS), Steam e EOS quando houver acesso | tabela `linked_platform_accounts`, controller novo | G | Regras de loja (Apple 4.8); contratos com Sony e Microsoft antes dos SDKs |
| 9 | **Bloco `scene3d`** nos jogos (`levelId`, `contentVersion`, socket por vaga) gerado pelo `scripts/flair-games/build.mjs`, numa migração nova | `scripts/flair-games/`, `FlairGameViews` | P–M | Manter o `scene` 2D para o web |
| 10 | **Links do CBC** no `check` e no `submit` (força, cor, química por carta e do elenco) | `CbcLinks` → `FlairChallengeService` | P | Teste de caracterização da resposta atual antes |
| 11 | `Idempotency-Key` em `games/submit`, `challenges/submit`, `quests/claim`, `combinations/redeem`, `flair/cards` | controllers FLAIR | P | O razão de pontos já tem `idempotency_key` único; reaproveitar |
| 12 | **Manifesto de assets v2** + bucket de conteúdo por plataforma + chaves por `sha256` + CDN com `Range`; tabela `content_releases` | `AssetCatalogService`, storage, CI de build | M–G | Custo de CDN; licença dos assets de marca; mídia pesada fora da JVM |
| 13 | **Desempenho:** cache do catálogo FLAIR com ETag, saldo materializado de FAI Points, trava distribuída nos `@Scheduled`, paginação de cartas, notificações e extratos, pool do Hikari medido | `FlairGameService`, `FaiPointsService`, jobs, `application.yml` | M | Invalidação de cache; teste de carga sem dados reais |
| 14 | **Push:** `device_push_tokens (user_id, installation_id, provider, token)` e envio por APNs, FCM e WNS a partir das notificações atuais | `NotificationController`, adaptador novo | M | Consentimento; tokens inválidos |
| 15 | **Telemetria:** `POST /api/v2/telemetry/batch` (gzip, limite de tamanho, amostragem, sem dado pessoal) gravando em Cassandra ou coletor externo | controller novo, `persistence-cassandra` | M | LGPD: consentimento e retenção; volume |
| 16 | **SSE** `GET /api/v2/events` (notificações, recompensas, Momentos) | controller novo | M | Conexões abertas por réplica; proxy da Railway [verificar timeouts] |
| 17 | **Recibos de loja:** tabela `entitlements` e verificadores (App Store Server API, Play Developer API, Microsoft Store, Steam, Epic, consoles) + notificações servidor a servidor de reembolso | módulo novo | G | **Só depois** de verificar as regras de cada loja (`docs/multiplataforma/05` §3.7). Hoje não há produto pago e FAI Points não se vendem |

**Ordem mínima para um vertical slice do FLAIR 3D no app** (celular e Windows, contas de teste): 0 (B2) → 1 → 2
(só FLAIR 3D e carteira) → 3 → 4 → 5 → 6 → 9 → 11 → 12 (só o conteúdo dos cinco cenários). Os itens 7, 8, 14–17 entram
quando houver loja de console ou compra.
