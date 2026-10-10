# 02 — Arquitetura, identidade, contratos e migração

## 1. Visão geral

```
            ┌──────────── mesma conta FashionAI (UUID), mesmo backend ────────────┐
            │                                                                     │
  Web (Next.js, atual)   iOS/iPadOS   Android   Windows   macOS   PS5   Xbox Series
        │                    └──── um projeto Unreal (UE 5.8), um núcleo C++ ────┘
        │                          FaiCore (API, sessão, cache, sync)
        │                          FaiAvatar (corpo/rosto/cabelo canônicos)
        │                          FaiTryOn (4 slots, asset 3D ou prévia 2D)
        │                          FaiUI (CommonUI: layout por família de entrada)
        │                          FaiPlatform (plugins nativos: login, fotos, câmera,
        │                                       compras, push, armazenamento seguro)
        └──────────────── HTTPS / JSON ──────────────── API Spring Boot (fai-*)
                                                        MySQL · S3/CDN · Redis
```

**Decisão sobre a interface:** a Unreal não tem modo oficial "Unreal como biblioteca" dentro de um app SwiftUI/Compose
nos celulares, e embutir o motor em app nativo é caminho sem suporte e frágil para revisão de loja. Por isso:

- **O app é um app Unreal** em todas as plataformas. A interface comum é UMG + **CommonUI**, que troca ícones, foco e
  navegação conforme o dispositivo de entrada ativo (toque, mouse/teclado, controle).
- **O que é do sistema operacional fica nativo**, chamado por plugins C++/Objective-C++/Kotlin a partir da Unreal:
  - autenticação: campos com autofill de senha/passkeys (iOS `ASAuthorizationController`, Android Credential Manager),
    navegador do sistema para links de e-mail (`ASWebAuthenticationSession`, Custom Tabs);
  - fotos e câmera: `PHPickerViewController`/`AVCapture` (iOS), Photo Picker/CameraX (Android), seletor de arquivo e
    webcam (Windows/macOS);
  - compras: StoreKit 2, Play Billing, Microsoft Store, Steamworks/EOS e SDKs de console — **somente depois** da
    verificação de regras do documento 05;
  - armazenamento de credenciais: Keychain, Android Keystore, DPAPI/Credential Locker (Windows), Keychain (macOS),
    armazenamento seguro de cada console;
  - notificações: APNs, FCM, WNS;
  - telas de **conta, consentimento e exclusão** no celular: folha nativa por cima da Unreal, para leitor de tela
    (VoiceOver/TalkBack) e tamanho de fonte do sistema funcionarem com garantia.
- **Acessibilidade**: a Unreal expõe a árvore Slate para leitores de tela em parte das plataformas; a cobertura na UE 5.8
  precisa ser medida por plataforma no marco 3 [verificar]. Onde não houver cobertura suficiente, as telas de texto
  (conta, configurações, termos) usam a camada nativa acima; o provador e o avatar oferecem descrição falada do look.
- **Web atual continua** como cliente web e como fallback dos fluxos longos durante a transição (ferramentas de marca,
  administração, laboratórios).

## 2. Identidade única de usuário

| Item | Decisão |
|---|---|
| Identificador | `users.id` (UUID) — já é único e estável; nenhum dado é migrado de chave |
| Login | Mesmas credenciais da web. Apps chamam `/api/auth/*` direto (não o BFF). Refresh token guardado no armazenamento seguro do SO; access token só em memória |
| Sessões | Cada instalação é uma sessão (`deviceName` = "iPhone de Ana", plataforma no user-agent `FashionAI/<versão> (<plataforma>)`). A tela "Sessões" já lista e revoga |
| Console | Login por **pareamento**: o console mostra um código; a pessoa confirma no celular/computador logado (fluxo de "device authorization" — endpoint novo no marco 5). Sem digitar senha na TV |
| Contas de plataforma (PSN, Xbox, Steam, Epic, Apple, Google) | São **vinculadas** à conta FashionAI (tabela `linked_platform_accounts`, marco 5/6), nunca substituem a conta. Desvincular não apaga dados |
| Menores de idade | Data de nascimento já existe no cadastro; consoles exigem respeitar controles parentais da plataforma [verificar no contrato de cada console] |

## 3. Contratos de API comuns

Cabeçalhos enviados por todos os apps instalados:

| Cabeçalho | Valores | Efeito |
|---|---|---|
| `X-FAI-Platform` | `IOS`, `IPADOS`, `ANDROID`, `WINDOWS`, `MACOS`, `PLAYSTATION`, `XBOX` (ausente = `WEB`) | Capacidades e perfil de qualidade permitidos |
| `X-FAI-Quality` | `MOBILE_LOW`, `MOBILE_HIGH`, `DESKTOP_MID`, `DESKTOP_HIGH`, `CONSOLE` | Qual arquivo 3D devolver; nunca muda a identidade |
| `X-FAI-App-Version` | semver | `updateRequired` em `/api/client/config` |
| `If-Match` | revisão recebida no `ETag` | Gravação condicional (provador; depois os demais agregados editáveis) |

Contratos por domínio (contrato v1; os marcados **novo** foram implementados neste marco):

| Domínio | Leitura | Escrita | Sincronização |
|---|---|---|---|
| Configuração | **novo** `GET /api/client/config` | — | lida ao abrir |
| Avatar | `GET /api/me/avatar3d`, **novo** `GET /api/me/avatar3d/canonical` | `POST/PATCH/DELETE /api/me/avatar3d`, `/versions/{n}/approve|restore` | `identityHash` igual = mesma pessoa em todos os aparelhos |
| Guarda-roupa | `GET /api/me/closet`, `GET /api/pieces/{id}` | `POST/PUT/DELETE /api/pieces/**` | `@Version` existente; expor ETag no marco 4 |
| Catálogo | `GET /api/catalog/*` | `POST /api/pieces/from-catalog` | sem estado do usuário |
| Provador | **novo** `GET /api/try-on/session` | **novo** `PUT/DELETE /api/try-on/session/slots/{slot}`, `DELETE /api/try-on/session/slots` | `ETag`/`If-Match`; 412 devolve o estado atual |
| Looks | `GET /api/me/schemes`, `/api/schemes/{id}` | `POST/PUT/DELETE /api/schemes/**` | `@Version` (expor no marco 4) |
| Perfil | `GET /api/me`, `/api/profiles/{u}` | `PATCH /api/me/profile`, `PUT /api/me/preferences` | preferências já usam `clientUpdatedAt` |
| Feed | `GET /api/feed?cursor=` | interações | cursor opaco existente |

Formato do provador (resumo; o OpenAPI em `/v3/api-docs` é a referência):

```json
{
  "revision": 7, "updatedPlatform": "IOS", "qualityProfile": "DESKTOP_HIGH",
  "slots": {
    "TOP":    { "piece": {"id": "…", "category": "upper_piece", "fullBody": false, "color": "black"},
                "representation": {"mode": "MESH_3D", "assetId": "…", "rigStandard": "FAI_BODY_V1",
                                   "renditionProfile": "DESKTOP_MID", "url": "/media/garments/…/mid.glb",
                                   "bytes": 4000000, "triangles": 40000, "sha256": "…"} },
    "BOTTOM": { "piece": {…}, "representation": {"mode": "PREVIEW_2D",
                "label": "Prévia 2D — esta peça ainda não tem modelo 3D aprovado para vestir o avatar.",
                "imageUrl": "/media/…png"} },
    "SHOES": null, "ACCESSORY": null
  },
  "avatar": {"identityId": "…", "version": 4, "changedSinceLastTryOn": false}
}
```

## 4. Estratégia de migração com compatibilidade

1. **Nada muda para quem usa a web.** Endpoints antigos continuam; os novos são aditivos. Sem cabeçalho de plataforma o
   servidor trata a chamada como `WEB`.
2. **Dados:** contas, guarda-roupas, peças, perfis, looks e conteúdo social já estão no backend com UUID — os apps
   apenas leem. A única migração de esquema deste marco é aditiva (`V55`: `try_on_sessions`, `garment_assets_3d`).
3. **Provador:** o web passa a gravar no `try_on_sessions` no marco 4 (hoje grava no `localStorage`). Até lá, o
   provador do web e o dos apps podem divergir — documentado como limitação.
4. **Avatar:** `model_json` v1 é lido pela Unreal sem conversão. Campos novos (ex.: `facialHair` confirmado) entram como
   opcionais com `v` igual; uma mudança incompatível sobe `v` e o servidor mantém leitura das duas versões por pelo
   menos duas versões de app.
5. **Versão mínima:** `fashionai.clients.min-version` controla atualização obrigatória; mudança incompatível de contrato
   só depois que a versão mínima sobe e as lojas publicaram a nova.
6. **Desligamento do web:** não planejado. Web fica como cliente secundário e ferramenta de marcas/administração.

## 5. Continuação em outro aparelho (console → celular/computador)

Fluxo para foto, edição extensa, cadastro e exclusão iniciados no console (endpoints no marco 5):

1. Console: `POST /api/continuations {purpose}` → `{code (8 caracteres), qr, expiresAt (10 min)}`.
2. Celular/computador **logado na mesma conta** abre `fashionai.app/c/<code>` (universal link) → app confirma
   "Continuar <ação> iniciada no PlayStation?".
3. Servidor só aceita a confirmação da **mesma conta**, uma vez, dentro da validade; código errado 5× bloqueia.
4. Ao concluir no celular, o console recebe o novo estado pela sincronização normal (avatar com nova versão, peça
   nova no guarda-roupa).
5. Nenhum dado pessoal aparece no QR; o código não autentica ninguém — só aponta a ação.
