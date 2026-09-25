# Segurança de produção

Controles do FashionAI contra o OWASP Top 10 (2021) e o OWASP API Security Top 10 (2023), o gate de desenvolvedor
que fecha o app antes do lançamento público e a lista de variáveis que precisam estar definidas no deploy.

## 1. Gate de desenvolvedor (antes do lançamento)

Enquanto `DEV_GATE_ENABLED` não for `false`, **todas as páginas** (inclusive cadastro e login, RF1/RF2) e **toda a API**
exigem passar pelo `/gate` com usuário e PIN da equipe.

| Camada | Como funciona | Código |
|---|---|---|
| Páginas (Next) | `middleware.ts` confere o cookie `fai_gate` (HttpOnly, 12 h) em toda rota; sem ele, redireciona para `/gate?next=…` | `middleware.ts`, `lib/gate/token.ts` |
| 1º fator: Google | `/gate/google` inicia OpenID Connect (código + PKCE, state e nonce em cookie assinado); `/gate/google/callback` troca o código no servidor, valida emissor, audiência, validade, nonce e e-mail verificado, e só aceita contas de `DEV_GATE_ALLOWED_EMAILS` | `app/gate/google/**` |
| 2º fator: PIN | `POST /gate/verify` exige o 1º fator (cookie de 15 min, uso único) e compara o SHA-256 do PIN em tempo constante; mesma resposta para qualquer fator errado; atraso fixo; 8 erros por IP em 15 min → 429 | `app/gate/verify/route.ts` |
| Tela neutra | `/gate` não carrega nada do app: sem nome, descrição, ícone, catálogos de texto nem provedores (título da aba `/gate`) | `app/gate/page.tsx`, `app/layout.tsx` |
| API (Spring) | `DevGateFilter` exige o cabeçalho `X-Dev-Gate` com o mesmo token HMAC-SHA256; `/actuator/health`, `/actuator/info`, `/media/**` e o preflight CORS ficam de fora | `fai-web/.../support/DevGateFilter.java` |
| Indexação | `X-Robots-Tag: noindex, nofollow, noarchive` e `robots.txt` com `Disallow: /` enquanto o gate estiver ligado | `middleware.ts`, `next.config.ts`, `app/robots.ts` |

Token: `v1.<usuário>.<expira>.<assinatura>`, assinado com `DEV_GATE_SECRET` (o mesmo valor no Vercel e no backend).
O teste `DevGateFilterTest` garante que um token gerado pelo frontend vale no backend.

**O PIN nunca fica no código nem em chat.** Gere o hash no seu computador e cole só o hash nas variáveis do Vercel:

```bash
printf '%s' 'SEU_PIN' | sha256sum          # → DEV_GATE_PIN_HASH (64 caracteres hexadecimais)
openssl rand -base64 48                   # → DEV_GATE_SECRET (use o MESMO valor no Vercel e no backend)
```

Login Google (1º fator): crie um cliente OAuth "Aplicativo da Web" no Google Cloud Console (APIs e serviços →
Credenciais), com URI de redirecionamento autorizado `https://<seu-domínio>/gate/google/callback`, e defina no Vercel
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` e `DEV_GATE_ALLOWED_EMAILS` (e-mails autorizados, separados por
vírgula). `DEV_GATE_PUBLIC_URL` fixa a origem do redirect quando o app tem mais de um domínio. `DEV_GATE_GOOGLE=false`
troca o Google pelo campo de usuário (`DEV_GATE_USER`).

Sem `DEV_GATE_PIN_HASH` (ou `DEV_GATE_PIN`) e `DEV_GATE_SECRET`, o gate falha fechado: ninguém entra (503 no `/gate`).
Sem o cliente Google ou com a lista de e-mails vazia, ninguém passa do 1º fator.
No lançamento público: `DEV_GATE_ENABLED=false` nos dois lados.

## 2. OWASP Top 10 (2021)

| Risco | Controle no FashionAI |
|---|---|
| A01 Controle de acesso quebrado | Rotas autenticadas por padrão (`anyRequest().authenticated()`); leitura pública só na lista `PUBLIC_GET`; `/api/admin/**` e `/actuator/**` (exceto health/info) exigem `ROLE_ADMIN`; `FashionAuthorization` confere dono do recurso (teste `ResourceOwnerAuthorizationTest`); cadastro público nunca cria ADMIN |
| A02 Falhas criptográficas | JWT RS256 com chaves por variável (`JWT_REQUIRE_KEYS=true` impede subir com par efêmero); dados sensíveis cifrados com `DATA_ENCRYPTION_KEY`; e-mail guardado também como hash para busca; HSTS (2 anos no frontend, 1 ano na API) |
| A03 Injeção | JPA com parâmetros nomeados em todas as consultas; `InputSanitizer` nos textos livres; CSP com nonce por requisição (`script-src 'self' 'nonce-…' 'strict-dynamic'`), sem `unsafe-inline` para script; API responde com `Content-Security-Policy: default-src 'none'` |
| A04 Design inseguro | Bloqueio por conta após 5 senhas erradas; limite por IP nas rotas de autenticação; recuperação de senha com código de uso único e limite por hora; prova social só com grupos ≥ 10 pessoas (ETI-03) |
| A05 Configuração insegura | Cabeçalhos: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `server.error.include-stacktrace: never`; `poweredByHeader: false`; Swagger desligável (`API_DOCS_ENABLED=false`); CORS só para as origens de `APP_CORS_ALLOWED_ORIGINS` |
| A06 Componentes vulneráveis | `npm audit --omit=dev`: 0 vulnerabilidades (PostCSS embutido no Next forçado para 8.5.28 por `overrides`). Backend: rodar `mvn org.owasp:dependency-check-maven:check` no CI |
| A07 Falhas de identificação | Senhas com Argon2 (`Argon2PasswordHasher`); sessão ativa conferida a cada requisição (`SessionActiveFilter`: logout e troca de senha derrubam os tokens); aviso de login em aparelho novo; refresh token rotativo |
| A08 Integridade | Migrações versionadas (Flyway); o token do gate e o JWT são assinados; sem desserialização de objetos arbitrários |
| A09 Registro e monitoramento | `audit_log` para login, falhas, acessos negados e ações sensíveis; aba **Sistema** do dashboard de admin com logins falhos e 403 por dia e alertas automáticos |
| A10 SSRF | `JdkWebFetchAdapter` (busca de logos de marca) recusa loopback, rede privada, link-local, CGNAT e IPv6 local, segue no máximo 3 redirecionamentos (reavaliando cada destino), com timeout de 8 s e limite de bytes |

## 3. OWASP API Security Top 10 (2023)

| Risco | Controle |
|---|---|
| API1 Autorização por objeto (BOLA) | Serviços carregam o recurso pelo dono (`owned(user, id)`) e respondem 403/404 para recurso de outra pessoa |
| API2 Autenticação quebrada | JWT curto (15 min) + refresh; bloqueio por conta; `AuthRateLimitFilter` por IP (login 30/10 min, cadastro 10/h, redefinição 10/h) |
| API3 Autorização por propriedade | Entradas são `record`s de DTO com só os campos editáveis (nada de entidade JPA vinda do cliente); campos privados do DNA respeitam `privateFields` |
| API4 Consumo irrestrito | Limites de upload (15 MB por arquivo, 80 MB por requisição); cotas de IA por usuário (`RateLimitPort`); limite por IP na autenticação |
| API5 Autorização por função | `/api/admin/**` e `/actuator/**` com `ROLE_ADMIN`; o `DashboardService` confere de novo (`guard.requireAdmin`) |
| API6 Fluxos sensíveis | Resgate de cupom e compra na loja validam saldo, estoque, limite por pessoa e janela de disponibilidade no servidor |
| API7 SSRF | Ver A10 |
| API8 Configuração | Ver A05; `forward-headers-strategy: framework` para o IP real atrás do proxy |
| API9 Inventário | Swagger documenta todas as rotas por RF; em produção fica desligado; `docs/testes/TABELA_ENDPOINTS_POR_RF.md` lista endpoints por RF |
| API10 Consumo de APIs de terceiros | Respostas de IA e da web passam por validação e fallback local; tempo limite nas chamadas externas |

## 4. Limitações conhecidas

- O contador de tentativas do `/gate/verify` e o `InMemoryRateLimit` da API vivem na memória de cada instância. Com mais
  de uma instância, ligue também a regra de rate limit do firewall do Vercel para `/gate/verify` e use Redis no backend.
- `style-src` mantém `'unsafe-inline'` (estilos inline do React e das cenas 3D). Scripts continuam só com nonce.
- `img-src` aceita `https:` porque os logos de marca podem vir de sites das marcas.

## 5. Variáveis de produção

| Onde | Variável | Valor |
|---|---|---|
| Vercel | `DEV_GATE_ENABLED` | `true` até o lançamento |
| Vercel | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | cliente OAuth do Google (1º fator) |
| Vercel | `DEV_GATE_ALLOWED_EMAILS` | contas Google autorizadas, separadas por vírgula |
| Vercel | `DEV_GATE_USER` | só com `DEV_GATE_GOOGLE=false` (padrão `matheushaliskitcc20233`) |
| Vercel | `DEV_GATE_PIN_HASH` | SHA-256 do PIN (ver §1) |
| Vercel + backend | `DEV_GATE_SECRET` | mesmo segredo nos dois lados |
| Vercel | `NEXT_PUBLIC_API_BASE_URL` | URL pública do backend (https) |
| Backend | `DEV_GATE_ENABLED` | `true` até o lançamento |
| Backend | `JWT_PRIVATE_KEY_PEM`, `JWT_PUBLIC_KEY_PEM`, `JWT_REQUIRE_KEYS=true` | par RSA do JWT |
| Backend | `DATA_ENCRYPTION_KEY` | chave de cifra dos dados sensíveis |
| Backend | `APP_CORS_ALLOWED_ORIGINS` | domínio do Vercel (e o domínio próprio, se houver) |
| Backend | `API_DOCS_ENABLED=false`, `MANAGEMENT_EXPOSURE=health,info` | documentação e métricas fechadas |
| Backend | `FAI_ADMIN_EMAIL`, `FAI_ADMIN_PASSWORD` | primeira conta ADMIN (ver `docs/dashboard/DASHBOARD_ADMIN.md`) |
