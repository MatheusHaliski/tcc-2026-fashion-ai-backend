# Deploy

O FashionAI tem duas partes que moram em lugares diferentes:

| Parte | Onde | Por quê |
|---|---|---|
| Frontend Next.js (este repositório, raiz) | **Vercel**, projeto `fashion-ai-tcc-2026` | Next.js roda nativamente lá (middleware do gate, rotas, estáticos) |
| API Spring Boot (Java 21) | Host de contêiner: Railway, Render, Fly.io ou similar (`Dockerfile.backend`) | A Vercel não executa aplicações Java de longa duração |
| MySQL 8 (e, se quiser, Redis, Cassandra, OpenSearch, S3) | Serviço gerenciado do mesmo provedor ou separado | Ver `scripts/provision/README.md` |

O projeto Vercel `sai-tcc-2026` que já existe é construído a partir de **outro repositório** (`SAI-TCC-2026`) e não foi
alterado.

## 1. Frontend na Vercel

1. Em **Settings → Git** do projeto `fashion-ai-tcc-2026`, conecte o repositório `MatheusHaliski/tcc-2026-fashion-ai-backend`
   (o primeiro deploy foi disparado pela API, sem vínculo de Git; com o vínculo, cada push publica sozinho).
2. Em **Settings → Environment Variables** (Production e Preview):

   | Variável | Valor |
   |---|---|
   | `DEV_GATE_ENABLED` | `true` |
   | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | cliente OAuth do Google; redirect `https://<domínio>/gate/google/callback` |
   | `DEV_GATE_ALLOWED_EMAILS` | contas Google da equipe, separadas por vírgula |
   | `DEV_GATE_PIN_HASH` | `printf '%s' 'SEU_PIN' \| sha256sum` (só o hash; nunca o PIN) |
   | `DEV_GATE_SECRET` | `openssl rand -base64 48` (o mesmo valor vai no backend) |
   | `NEXT_PUBLIC_API_BASE_URL` | URL https da API (passo 2) |

3. **Redeploy** (as variáveis só valem para deploys novos). Sem PIN e segredo o `/gate` responde "não configurado" e
   ninguém entra: o app fica fechado por padrão.

As URLs `*.vercel.app` do projeto também exigem login na Vercel (proteção padrão do time). Para abrir ao público depois
do lançamento: `DEV_GATE_ENABLED=false` nos dois lados e desligar a proteção em **Settings → Deployment Protection**.

## 2. API em contêiner

```bash
docker build -f Dockerfile.backend -t fashionai-api .
```

No host (Railway/Render/Fly), use o `Dockerfile.backend`, porta `8080`, health check `GET /actuator/health`, e defina:

| Variável | Observação |
|---|---|
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_USE_SSL=true` | banco gerenciado; o Flyway cria as tabelas na primeira subida |
| `JWT_PRIVATE_KEY_PEM`, `JWT_PUBLIC_KEY_PEM` | `scripts/keys/generate_jwt_keys.sh`; a imagem já liga `JWT_REQUIRE_KEYS=true` |
| `DATA_ENCRYPTION_KEY` | chave de cifra dos dados sensíveis |
| `APP_CORS_ALLOWED_ORIGINS` | URL do frontend na Vercel (e o domínio próprio, se houver) |
| `APP_BASE_URL`, `FRONTEND_URL` | URLs públicas da API e do frontend |
| `DEV_GATE_ENABLED=true`, `DEV_GATE_SECRET` | o mesmo segredo da Vercel |
| `FAI_ADMIN_EMAIL`, `FAI_ADMIN_PASSWORD` | primeira conta ADMIN |
| `STORAGE_TYPE=s3` + `S3_*` | recomendado: o disco do contêiner é efêmero |
| chaves de IA | opcionais; confira com `python3 scripts/provision/ai.py` |

Depois: `python3 scripts/provision/provision.py --check` com as mesmas variáveis confere banco, índices e bucket.

## 3. Domínio

`fashionai.com`, `fashionai.app` e `fashionai.com.br` **não estão disponíveis** para compra (consulta de 25/09/2026 na
Vercel). Uma alternativa livre na mesma consulta: `usefashionai.com` (US$ 11,25 no 1º ano). Compra de domínio é paga e
não reembolsável: fica para a decisão da equipe. Com um domínio próprio, adicione-o em **Settings → Domains** do projeto
`fashion-ai-tcc-2026` e inclua-o em `APP_CORS_ALLOWED_ORIGINS`.
