# 01 — Inventário do web app e destino de cada tela

> Auditoria feita em 10/10/2026 sobre `main` (commit `c9804e6`). Fonte: código do repositório (backend `fai-*`, frontend
> `app/`, `components/`, `lib/`) e migrações V1–V54. Nada foi inferido de documentação sem conferir no código.

## 1. O que existe hoje

| Camada | Estado atual | Implicação para os apps instalados |
|---|---|---|
| Backend | Spring Boot 4.1 / Java 21, monólito hexagonal, MySQL + Flyway (V1–V54), Redis/Cassandra/OpenSearch/S3 opcionais | **Reaproveitado inteiro.** Todos os clientes falam com a mesma API. |
| Identidade | UUID por usuário; JWT RS256 (15 min) + refresh token opaco rotativo (30 d com "lembrar"), detecção de reuso, sessões por aparelho (`deviceName`, user-agent) | Serve para apps nativos sem mudança de modelo: a API já aceita o refresh no corpo (`POST /api/auth/refresh`). O web usa um BFF Next (`app/bff/auth`) com cookie HttpOnly — os apps **não** usam o BFF. |
| Login social | Não existe (o Google só protege o portão de desenvolvimento) | "Sign in with Apple" passa a ser obrigatório no iOS **se** algum login de terceiros for adicionado (diretriz 4.8) — decisão de produto |
| API | ~40 controllers, sem versionamento de caminho, muitas respostas `Map<String,Object>`, OpenAPI 3 (springdoc) | Contratos novos dos apps (este marco) têm forma estável e cabeçalhos de plataforma; tipar as respostas antigas é trabalho do marco 2 |
| Concorrência | `@Version` em ~70 entidades, mas a versão não vai ao cliente; sem ETag/If-Match | O provador sincronizado (novo) usa `ETag`/`If-Match`; estender aos outros agregados editáveis no marco 4 |
| Avatar 3D | three.js no navegador; MediaPipe (rosto, cabelo, pose, segmentação) + face-api **no navegador**; o servidor recebe só `model_json` (468 pontos, pele, cabelo, corpo com origem por medida) e o atlas do rosto (chave `restricted/`) | **Pipeline de captura precisa ser portado** para iOS/Android/desktop (MediaPipe tem SDK nativo). Fotos de origem continuam sem sair do aparelho. Console não captura. |
| Identidade do avatar | Versionada (V42): DRAFT / NEEDS_REFINEMENT / APPROVED, gate de qualidade, histórico de 5 | Base do avatar canônico (ver `03`). Barba e bigode **não** são parâmetros (só textura); corpo tem origem por medida; rosto não tem confiança por região. |
| Provador | 4 lugares por categoria (cima, baixo, calçado, acessório); experimentar não exige título; estado só no `localStorage` do navegador | Novo: sessão do provador **na conta**, sincronizada (este marco) |
| Roupa 3D | Web: malhas procedurais "crescidas" da pele, foto projetada só na frente. RF16: GLB por peça (Meshy → Stability → relevo local), sem esqueleto, sem aprovação. Catálogo: só fotos | **Não há nenhum asset de roupa que vista de verdade.** Novo modelo `garment_assets_3d` com esqueleto, níveis de detalhe, métricas e aprovação (este marco). Até existir asset aprovado, a peça é **prévia 2D identificada**. |
| Mídia | `GET /media/**` público; S3 com URL pública permanente; proteção só pelo UUID no caminho | **Bloqueio de privacidade** antes das lojas (ver seção 4) |
| Exclusão de conta | `POST /api/me/deletion` agenda 30 dias, mas `purgeScheduledDeletions()` **não é chamado por nenhum agendador** | **Bloqueio de loja**: Apple 5.1.1(v) e Google exigem exclusão efetiva (ver seção 4) |
| Comércio | Nenhum pagamento real. FAI Points e moedas FLAIR são ganhos, nunca vendidos; cupons são códigos de marca resgatados fora | Nada a migrar; política nova em `05` |
| Offline | Sem PWA, service worker ou cache | Apps instalados precisam de cache local (avatar, assets, guarda-roupa) — marco 3/4 |
| Idiomas | pt-BR (padrão), en, es (ICU) | Reaproveitar os arquivos `lib/i18n/messages/*.json` como fonte das strings dos apps |
| Assets estáticos | `public/` 1,1 GB: 98 % mídia de marketing/estúdio (vídeos de aura, materiais); `public/avatar3d` 4,4 MB (corpo MPFB2 CC0); `public/mediapipe` 29 MB | O app instalado leva só corpo base + modelos de visão; o resto é baixado sob demanda |

## 2. APIs por área (o que os apps consomem)

| Área | Endpoints principais | Situação para os apps |
|---|---|---|
| Conta e sessão | `/api/auth/register`, `/login`, `/refresh`, `/logout`, `/sessions`, `/password-reset/*`, `/email-verification*` | Prontos. Faltam: atestado de app (App Attest / Play Integrity) para o portão de desenvolvimento e limites por aparelho |
| Perfil | `/api/me`, `/api/me/profile`, `/api/me/preferences`, `/api/profiles/{u}`, follows | Prontos; preferências já resolvem conflito por `clientUpdatedAt` |
| Privacidade | `/api/me/consents`, `/api/me/exports`, `/api/me/deletion`, `/api/me/privacy` | Exclusão precisa do agendador (bloqueio) |
| Guarda-roupa | `/api/me/closet`, `/api/pieces/**`, `/api/taxonomy`, `/api/pieces/{id}/image` (multipart) | Prontos; upload multipart funciona em app nativo |
| Catálogo | `/api/catalog/search`, `/suggestions`, `/brands`, `/stores`, `/products/{id}`, `/api/pieces/from-catalog` | Prontos |
| Avatar | `/api/me/avatar3d` (GET/POST/PATCH/DELETE), `/versions`, `/approve`, `/restore`, `/api/avatar3d/{id}/texture` | Prontos + **novo** `GET /api/me/avatar3d/canonical` |
| Provador | `/api/try-on` (estado, legado), `/preferences`, `/renders` (FASHN 2D, sem uso na tela), `/schemes` (legado) | **Novo** `/api/try-on/session` (GET) e `/api/try-on/session/slots/{TOP|BOTTOM|SHOES|ACCESSORY}` (PUT/DELETE) |
| Looks | `/api/schemes/**`, `/api/me/schemes`, `/api/me/saved-looks` | Prontos |
| Feed e social | `/api/feed` (cursor), `/api/runway`, `/api/search`, `/api/interactions/**`, `/api/notifications` | Prontos; comentários e notificações sem paginação (ajustar no marco 4) |
| Configuração do app | — | **Novo** `GET /api/client/config` |
| Assets 3D de roupa | — | **Novo** `POST /api/admin/garment-assets`, `POST /api/admin/garment-assets/{id}/review` |

## 3. Destino de cada tela (55 rotas)

Legenda das colunas de plataforma: **U** = tela em Unreal (UMG/CommonUI) desenhada para a família; **N** = componente
nativo do sistema sobre o app Unreal (folha/diálogo do SO, seletor de fotos, câmera, compra, login); **W** = abre no
navegador do sistema ou web view in-app; **C** = no console, mostra código/QR para continuar no celular ou computador;
**—** = não existe nessa família.

| Rota web | Celular (iPhone/Android) e iPad | Computador (Windows/macOS) | Console (PS5/Xbox) | Justificativa |
|---|---|---|---|---|
| `/login` | N (campos nativos, preenchimento automático de senha, passkeys) | U (campos com gerenciador de senha do SO via plugin) | U: código de pareamento com o celular ("entre em fashionai.app/tv") | Senha e autofill são do SO; console não deve exigir digitação |
| `/register` | N | U + N (data de nascimento, termos) | C | Formulário longo, consentimentos, idade |
| `/forgot-password`, `/reset-password`, `/verify-email` | W (link do e-mail abre o app por universal link / app link) | W | C | Fluxo nasce no e-mail |
| `/gate` | — (atestado do app substitui) | — | — | Portão de desenvolvimento não vai para loja |
| `/` → `/feed` | U: feed vertical, toque, puxar para atualizar | U: feed em colunas com painel lateral de detalhes | U: grade grande, leitura a 3 m, foco visível | Conteúdo visual rico; Unreal renderiza cards e prévias 3D |
| `/closet` | U: grade 2–3 colunas, filtros em folha inferior | U: grade densa, seleção múltipla, arrastar, atalhos | U: grade com D-pad, filtros por gatilhos | Gerenciamento de peças é o forte do computador |
| `/pieces/new` | U + N (câmera e seletor de fotos nativos; recorte na tela) | U + N (arrastar arquivo, seletor do SO) | C | Foto de peça precisa de câmera/arquivo |
| `/pieces/[id]` | U (detalhe + botão "provar") | U (detalhe em painel, edição inline) | U (só leitura + provar) | — |
| `/photos` | U + N (galeria do SO para importar) | U | — | Curadoria de fotos não faz sentido na TV |
| `/history`, `/highlights` | U | U (gráficos maiores) | U (só leitura) | — |
| `/looks`, `/schemes/[id]` | U | U | U | — |
| `/schemes/new`, `/schemes/[id]/edit` | U (montagem por toque) | U (tela de montagem com arrastar e redimensionar) | U simplificado: escolher peças por slot, sem edição de canvas livre | Canvas livre não funciona com controle |
| `/lookbook` → `/u/[me]` | U | U | U | — |
| `/autopilot`, `/copilot` | U + N (teclado do SO para o chat) | U | U: sugestões prontas; perguntar em texto vai por continuação ou teclado virtual opcional | Chat depende de texto |
| `/mirror` | U (espelho com avatar 3D) | U | U | Já é uma experiência 3D |
| `/try-on` (**provador**) | **U** (avatar Unreal, 4 slots em abas, busca catalogada em folha) | **U** (provador em tela maior, catálogo lateral, janela redimensionável) | **U** (ambiente explorável, slots nos bumpers, grade de peças no D-pad) | Núcleo 3D do produto |
| `/avatar` | U (ver/girar) + N (câmera/fotos para criar ou refazer, confirmação de consentimento biométrico) | U + N (webcam ou arquivo) | U (ver, girar, escolher versão aprovada) + C (refazer) | Captura biométrica precisa de câmera e consentimento explícito |
| `/room` | U | U | U (exploração do quarto) | Ambiente 3D |
| `/search` | U + N (teclado) | U | U com filtros por categoria/cor/marca sem digitar | — |
| `/explorer` (globo, ranking, passarela) | U | U | U | Visual 3D |
| `/brands`, `/brands/[slug]` (vitrine) | U | U | U | — |
| `/brands/[slug]` (ferramentas de emissor: selos, cupons, políticas, criador de guarda-roupa) | W | W (ou U no marco 6) | — | Ferramentas de marca são de trabalho, uso raro e formulário extenso |
| `/dashboard` (emissor) | W | W | — | Painel analítico |
| `/lens`, `/lens/[scanId]` | U + N (câmera) | U + N (arquivo/webcam) | — | Câmera |
| `/dna`, `/dna-schemes/*` | U | U | U (só leitura e escolha) | — |
| `/u/[username]` | U | U | U | — |
| `/notifications` | U + N (push do SO: APNs/FCM/WNS) | U + notificações do SO | U (notificações da plataforma, se permitido pela certificação) | — |
| `/settings` (conta, sessões, consentimentos, exportação, **exclusão**) | N (telas nativas: exigidas para exclusão de conta e consentimentos legíveis por leitor de tela) | U + W para exportação | C (excluir conta: link e código para o celular/computador; a loja do console pode exigir caminho próprio [verificar]) | Acessibilidade e exigência de loja |
| `/moments`, `/moments/[id]` | U | U | U | — |
| `/points`, `/coupons`, `/challenges`, `/challenges/[id]` | U | U | U (sem resgate de cupom externo) | Cupom abre loja externa — não no console |
| `/flair` (jogo de cartas) | U | U | U | — |
| `/admin/*` (6 telas) | — | — | — | **Permanece só web**. Administração não vai para loja. |
| `/lab/*` (3 telas) | — | — | — | Ferramentas internas de medição; continuam web |
| `[...missing]` | — | — | — | — |

Regra geral: **nenhuma tela é a mesma em todas as famílias mudando só a resolução.** Cada família tem layout próprio
(CommonUI com "input-aware" widgets): celular = uma coluna e folhas inferiores; computador = painéis lado a lado,
hover, atalhos e menus de contexto; console = grade grande, foco explícito, áreas seguras de TV, sem campo de texto
obrigatório.

## 4. Bloqueios encontrados na auditoria (antes de qualquer loja)

| # | Bloqueio | Onde | Por que bloqueia | Proposta |
|---|---|---|---|---|
| B1 | Exclusão agendada nunca executa | `AccountService.purgeScheduledDeletions()` sem `@Scheduled` e sem chamador | Apple 5.1.1(v) e política de exclusão de conta do Google Play exigem exclusão efetiva | Agendar o job diário (ex.: 03:30) com trava distribuída; teste de ponta a ponta. **Não ativado neste marco** porque ativa exclusões reais pendentes em produção — precisa de decisão e revisão da fila atual |
| B2 | `/media/**` público e URLs S3 permanentes | `SecurityConfig.PUBLIC_GET`, `S3MediaStorageAdapter` | Fotos pessoais acessíveis por quem tiver a URL; declarações de privacidade das lojas ficariam falsas | URLs assinadas de curta duração para `users/**`; público só para conteúdo publicado |
| B3 | Endpoints protegidos só por Origin/CORS | ver auditoria de identidade | Origin não existe em app nativo | Revisar cada um e exigir sessão/escopo |
| B4 | Portão de desenvolvimento (`X-Dev-Gate`) | `DevGateFilter` | App da loja não passa pelo portão | Desligar em produção pública ou aceitar atestado do app |
| B5 | Atlas do rosto público quando avatar é público e aprovado | `Avatar3dService.forMannequin` | Dado biométrico derivado | Manter, mas declarar nas lojas e permitir "avatar público sem textura do rosto" |
