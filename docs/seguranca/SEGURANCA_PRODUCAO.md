# Segurança de produção

Controles do FashionAI contra o OWASP Top 10 (2021) e o OWASP API Security Top 10 (2023), o gate de desenvolvedor
que fecha o app antes do lançamento público e a lista de variáveis que precisam estar definidas no deploy.

## 1. Gate de desenvolvedor (antes do lançamento)

Enquanto `DEV_GATE_ENABLED` não for `false`, **todas as páginas** (inclusive cadastro e login, RF1/RF2), os arquivos de
`/public` e **toda a API** exigem passar pelo gate. Há dois modos (`DEV_GATE_MODE`):

- **`builtin`** (padrão): login Google (conta de `DEV_GATE_ALLOWED_EMAILS`) + PIN, na tela `/gate`.
- **`cloudflare`** (recomendado quando houver domínio próprio): o **Cloudflare Access** (Zero Trust) faz o login, com MFA,
  política por e-mail/grupo, log de auditoria por pessoa, revogação imediata e service tokens para testes automatizados. O
  middleware e o `DevGateFilter` conferem o JWT do Access (RS256 pelas chaves da equipe, emissor e audiência
  `CF_ACCESS_AUD`); quem chega pela URL da Vercel ou do Railway sem passar pelo Cloudflare recebe 403.

| Camada | Como funciona (modo `builtin`) | Código |
|---|---|---|
| Identidade | Os tokens carregam a identidade (e-mail Google, ou `DEV_GATE_USER` sem Google) e um id de entrada. A identidade é conferida contra a lista **atual** a cada requisição: tirar um e-mail de `DEV_GATE_ALLOWED_EMAILS` revoga aquela pessoa na hora, sem trocar o segredo de todo mundo | `lib/gate/token.ts` |
| Página | Cookie `fai_gate` (tipo `gp`, HttpOnly, 12 h). Sem ele, toda rota volta para `/`, que mostra o gate; qualquer `/gate/*` desconhecido também mostra o gate | `middleware.ts` |
| API | Cookie `fai_gate_a` (tipo `ga`, 1 h, legível pelo cliente) vai no cabeçalho `X-Dev-Gate`. O middleware renova quando faltam 20 min; `/gate/renew` renova sob demanda. Um token de API não abre páginas, e um token de página não abre a API | `middleware.ts`, `app/(gate)/gate/renew`, `DevGateFilter.java` |
| 1º fator: Google | `/gate/google` inicia OpenID Connect (código + PKCE, state e nonce em cookie assinado); o callback troca o código no servidor e valida emissor, audiência, validade, nonce e e-mail verificado | `app/(gate)/gate/google/**` |
| 2º fator: PIN | `POST /gate/verify` compara o SHA-256 do PIN em tempo constante; mesma resposta para qualquer fator errado; atraso fixo. **PIN errado descarta o 1º fator**: cada tentativa exige um novo login Google com conta autorizada. Além disso, 8 erros por IP em 15 min → 429 | `app/(gate)/gate/verify/route.ts` |
| Auditoria | Cada entrada vai ao log do servidor (`gate.entrada`: e-mail mascarado + hash, id da entrada, IP) | idem |
| Tela neutra | Layout raiz próprio (`app/(gate)/layout.tsx`): a tela do gate não baixa nenhum pacote do produto (sem nome, textos, ícone, provedores ou catálogos) | `app/(gate)/**`, `app/global-error.tsx` |
| Segredo | `DEV_GATE_SECRET` com menos de 32 caracteres gera aviso no Next e impede a API nova de subir (a versão anterior continua no ar) | `lib/gate/token.ts`, `DevGateFilter.java` |
| CSP | O layout do gate é dinâmico (`force-dynamic`) e o 404 passa por `app/(site)/[...missing]`: páginas geradas no build sairiam sem o nonce da CSP e ficariam em branco | `app/(gate)/layout.tsx`, `app/(site)/not-found.tsx` |
| Indexação | `X-Robots-Tag: noindex, nofollow, noarchive` e `robots.txt` com `Disallow: /` | `middleware.ts`, `next.config.ts`, `app/robots.ts` |

`/media/**` continua fora do gate (imagens carregadas por `<img>` não enviam cabeçalhos). Nada sensível mora ali: fotos
do desafio Espelho Real, exportações LGPD, documentos do cadastro e backups ficam em `restricted/` (só ADMIN) ou atrás
de rotas autenticadas; o resto tem caminho com UUID.

**Transição de formato do token da API.** Front e API são publicados em lugares diferentes (Vercel e Railway), então o
token que vai no `X-Dev-Gate` tem um modo de transição que dispensa publicar os dois ao mesmo tempo:

1. Hoje: `DEV_GATE_API_TOKEN=legacy` (padrão na Vercel) — o front manda o formato antigo `v1.<usuário>.…`, aceito pela
   API antiga e pela nova (`DEV_GATE_ACCEPT_LEGACY=true`, padrão na API).
2. Com a API nova no ar e `DEV_GATE_ALLOWED_EMAILS` definida também no Railway: `DEV_GATE_API_TOKEN=v2` na Vercel
   (token por pessoa). Confira o app.
3. Por fim, `DEV_GATE_ACCEPT_LEGACY=false` no Railway (a API passa a exigir o token por pessoa).

**O PIN nunca fica no código nem em chat.** Gere o hash no seu computador e cole só o hash nas variáveis do Vercel:

```bash
printf '%s' 'SEU_PIN' | sha256sum          # → DEV_GATE_PIN_HASH (64 caracteres hexadecimais); PIN de 8+ dígitos
openssl rand -base64 48                   # → DEV_GATE_SECRET (use o MESMO valor no Vercel e no backend)
openssl rand -base64 48                   # → EDGE_PROXY_SECRET (outro valor; o MESMO no Vercel e no backend)
```

Login Google (1º fator): crie um cliente OAuth "Aplicativo da Web" no Google Cloud Console (APIs e serviços →
Credenciais), com **apenas** o URI de redirecionamento `https://<seu-domínio>/gate/google/callback`, e defina no Vercel
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` e `DEV_GATE_ALLOWED_EMAILS`. Defina a **mesma**
`DEV_GATE_ALLOWED_EMAILS` no backend para a revogação valer também na API. `DEV_GATE_PUBLIC_URL` fixa a origem do
redirect quando o app tem mais de um domínio. `DEV_GATE_GOOGLE=false` troca o Google pelo campo de usuário
(`DEV_GATE_USER`) — nesse modo o PIN é o único segredo; prefira o Google.

Firewall da Vercel: crie uma regra de rate limit para `POST /gate/verify` (ex.: 10 por minuto por IP) — o contador do
Next vive na memória de cada instância.

### 1.1 Migrar para o Cloudflare Access

1. Compre/aponte um domínio para o Cloudflare (ex.: `app.<domínio>` → Vercel e `api.<domínio>` → Railway, ambos com proxy).
2. Zero Trust → Access → Applications → *Self-hosted*: uma aplicação cobrindo os dois hostnames; política *Allow* com os
   e-mails da equipe (ou um grupo) e MFA; copie o **Application Audience (AUD) Tag**. Para os testes E2E, crie um
   *Service Token* e uma política *Service Auth*.
3. Vercel: `DEV_GATE_MODE=cloudflare`, `CF_ACCESS_TEAM_DOMAIN=<equipe>.cloudflareaccess.com`, `CF_ACCESS_AUD=<tag>`,
   `NEXT_PUBLIC_GATE_MODE=cloudflare` (as chamadas à API passam a levar o cookie do Access) e
   `NEXT_PUBLIC_API_BASE_URL=https://api.<domínio>`.
4. Railway (API): as mesmas `DEV_GATE_MODE`, `CF_ACCESS_TEAM_DOMAIN` e `CF_ACCESS_AUD`; `APP_CORS_ALLOWED_ORIGINS=https://app.<domínio>`.
5. Mantenha a proteção de deploy da Vercel ligada para as URLs `*.vercel.app`.

### 1.2 Sessão do usuário (RF2) — refresh token fora do alcance do JavaScript

O login, o cadastro e a renovação passam pelo BFF do Next (`app/bff/auth/[action]`): a rota chama a API, guarda o refresh
token num cookie `fai_rt` **HttpOnly + Secure + SameSite=Strict** restrito a `/bff/auth` e devolve ao navegador só o
access token (15 min), que vive na memória da aba. Um XSS não consegue mais uma sessão persistente. As abas coordenam a
renovação (Web Locks + BroadcastChannel) para não disparar a detecção de reuso do refresh token. O BFF só aceita POST da
própria origem e envia à API o IP real do cliente assinado (`X-Fai-Client-Ip` + HMAC com `EDGE_PROXY_SECRET`), para o
limite por IP e a auditoria não verem o IP da Vercel. Sessões antigas (refresh token no `localStorage`) são migradas para
o cookie na primeira abertura e apagadas do armazenamento.

## 2. OWASP Top 10 (2021)

| Risco | Controle no FashionAI |
|---|---|
| A01 Controle de acesso quebrado | Rotas autenticadas por padrão (`anyRequest().authenticated()`); leitura pública só na lista `PUBLIC_GET`; `/api/admin/**` e `/actuator/**` (exceto health/info) exigem `ROLE_ADMIN`; `FashionAuthorization` confere dono do recurso (teste `ResourceOwnerAuthorizationTest`); URL de mídia vinda do cliente só aponta para arquivo da própria pessoa (`MediaService.ownedMedia`/`OwnMedia`: nunca `restricted/`, `..` ou URL externa); `restricted/` só pela API; cadastro público nunca cria ADMIN; promoção de conta existente a ADMIN só com `FAI_ADMIN_PROMOTE_EXISTING` |
| A02 Falhas criptográficas | JWT RS256 com `aud` (`JWT_AUDIENCE`) e chaves por variável (`JWT_REQUIRE_KEYS=true` impede subir com par efêmero); dados sensíveis cifrados com AES-256-GCM (`DATA_ENCRYPTION_KEY`); e-mail guardado também como hash; senhas Argon2id com os parâmetros da OWASP (19 MiB, t=2) e rehash no login; **TLS da API até os quatro bancos** (MySQL `sslMode=REQUIRED`, Cassandra e OpenSearch com CA própria fixada, Redis por ACL); HSTS (2 anos no frontend, 1 ano na API) |
| A03 Injeção | JPA com parâmetros nomeados em todas as consultas; `InputSanitizer` nos textos livres; CSP com nonce por requisição (`script-src 'self' 'nonce-…' 'strict-dynamic'`), sem `unsafe-inline` para script; API responde com `Content-Security-Policy: default-src 'none'` |
| A04 Design inseguro | Bloqueio por conta após 5 senhas erradas, sem revelar se a conta existe; limite por IP nas rotas de autenticação; códigos de e-mail/2FA com contador de tentativas; recuperação de senha com código de uso único e limite por hora; teto diário de gasto com IA global e por pessoa (`AiBudget`); prova social só com grupos ≥ 10 pessoas (ETI-03) |
| A05 Configuração insegura | Cabeçalhos: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `server.error.include-stacktrace: never`; `poweredByHeader: false`; Swagger desligável (`API_DOCS_ENABLED=false`); CORS só para as origens de `APP_CORS_ALLOWED_ORIGINS`; bancos sem acesso público e endurecidos como código (`infra/railway`: usuários de menor privilégio, papel padrão do Cassandra e usuários de demonstração do OpenSearch fora) |
| A06 Componentes vulneráveis | CI (`.github/workflows/ci.yml`) roda `npm audit --omit=dev --audit-level=high` a cada push; Dependabot semanal para Maven, npm, Docker e Actions; imagem do MySQL atualizada para 9.7.2 (CVE-2026-21964) |
| A07 Falhas de identificação | Senhas com Argon2 (`Argon2PasswordHasher`); sessão ativa conferida a cada requisição (`SessionActiveFilter`: logout e troca de senha derrubam os tokens); aviso de login em aparelho novo; refresh token rotativo |
| A08 Integridade | Migrações versionadas (Flyway); o token do gate e o JWT são assinados; sem desserialização de objetos arbitrários; CI com build e testes antes do deploy e **gitleaks** no histórico inteiro; scripts de início dos bancos conferidos por SHA-256 |
| A09 Registro e monitoramento | `audit_log` para login, falhas, acessos negados e ações sensíveis; aba **Sistema** do dashboard de admin com logins falhos e 403 por dia e alertas automáticos; auditoria do OpenSearch (logins recusados, acesso negado) no log do serviço; logs sem segredos (e-mails com corpo só com `EMAIL_LOG_BODIES`) |
| A10 SSRF | `JdkWebFetchAdapter` (busca de logos de marca) recusa loopback, rede privada, link-local, CGNAT e IPv6 local, segue no máximo 3 redirecionamentos (reavaliando cada destino), com timeout de 8 s e limite de bytes |

## 3. OWASP API Security Top 10 (2023)

| Risco | Controle |
|---|---|
| API1 Autorização por objeto (BOLA) | Serviços carregam o recurso pelo dono (`owned(user, id)`) e respondem 403/404 para recurso de outra pessoa |
| API2 Autenticação quebrada | JWT curto (15 min) + refresh rotativo em cookie HttpOnly (BFF); bloqueio por conta; `AuthRateLimitFilter` por IP real (assinado pelo BFF, `ClientIpResolver`) e pelo caminho normalizado (login 30/10 min, cadastro 10/h, redefinição 10/h) |
| API3 Autorização por propriedade | Entradas são `record`s de DTO com só os campos editáveis (nada de entidade JPA vinda do cliente); campos privados do DNA respeitam `privateFields` |
| API4 Consumo irrestrito | Limites de upload (15 MB por arquivo, 80 MB por requisição) e de pixels (`IMAGE_MAX_PIXELS`); cotas de IA por usuário (`RateLimitPort`) e teto em dólar por dia (`AI_DAILY_BUDGET_USD`, `AI_USER_DAILY_BUDGET_USD`); limite por IP na autenticação |
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
- `img-src` não aceita mais `https:` em geral: só a própria origem, a API e `NEXT_PUBLIC_MEDIA_ORIGIN`.
- Senhas de administrador dos bancos (`fai_admin` do Cassandra, `admin` do OpenSearch) não são rotacionadas pelos
  scripts de início (precisariam da senha antiga): rotação manual descrita em `infra/railway/README.md`.
- Um ambiente só (`production`) no Railway: dados de teste convivem com os reais, separados por `test_account`
  (proposta de `account_origin` em `docs/banco/integridade`).

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
| Vercel + backend | `EDGE_PROXY_SECRET` | mesmo segredo nos dois lados (IP do cliente assinado pelo BFF) |
| Vercel + backend | `DEV_GATE_ALLOWED_EMAILS` | mesma lista: revogar uma pessoa vale também na API |
| Backend | `DEV_GATE_ACCEPT_LEGACY` | `true` só durante a transição do front antigo; depois `false` |
| Backend | `JWT_AUDIENCE` | `fashionai-api` (claim `aud` exigido) |
| Backend | `AI_DAILY_BUDGET_USD`, `AI_USER_DAILY_BUDGET_USD` | tetos de gasto com IA (padrão 5,00 e 0,50) |
| Backend | `MYSQL_USER=fai_app`, `MYSQL_PASSWORD=${{MySQL.MYSQL_APP_PASSWORD}}`, `MYSQL_SSL_MODE=REQUIRED` | usuário de menor privilégio, só com TLS |
| Backend | `MYSQL_BACKUP_USER=fai_backup`, `MYSQL_BACKUP_PASSWORD=${{MySQL.MYSQL_BACKUP_PASSWORD}}` | backup só leitura |
| Backend | `CASSANDRA_USERNAME=fai_app`, `CASSANDRA_PASSWORD=${{cassandra.CASSANDRA_APP_PASSWORD}}`, `CASSANDRA_SSL=true`, `CASSANDRA_CA_CERT_PEM` | papel só do keyspace, TLS com a CA fixada |
| Backend | `OPENSEARCH_URL=https://opensearch.railway.internal:9200`, `OPENSEARCH_USERNAME=fai_app`, `OPENSEARCH_PASSWORD=${{opensearch.OPENSEARCH_APP_PASSWORD}}`, `OPENSEARCH_CA_CERT_PEM` | só índices `fai-*`, TLS com a CA fixada |
| Backend | `REDIS_USERNAME=fashionai`, `REDIS_PASSWORD=${{Redis.REDIS_APP_PASSWORD}}` | usuário ACL (quando o perfil `redis` for ligado) |
| Bancos | `FAI_START_SCRIPT` + comando de início | `infra/railway/<banco>/start.sh` (ver `infra/railway/README.md`) |
