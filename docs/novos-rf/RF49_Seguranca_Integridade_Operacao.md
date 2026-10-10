# RF49 — Proteger contas e a plataforma: sessão segura, limites contra força bruta, bancos endurecidos, dados demo isolados e entrega confiável

> **Numeração:** RF49, porque RF48 está reservado por duas propostas ainda sem confirmação no Trello (FAI Points:
> resgate e doações; FashionAI Lens). Ver [README](README.md).
> **Diagramas:** [`docs/diagramas/RF49/`](../diagramas/RF49/), mais [`seguranca/`](../diagramas/seguranca/) e
> [`dados-demo/`](../diagramas/dados-demo/).
> **Cartão no Trello:** https://trello.com/c/Dyad3b8m (lista Requisitos Funcionais).
> **Origem:** consolida a sessão de auditoria de segurança e operação de setembro/outubro de 2026 (PRs #88, #112,
> #119 e #125).

## História de usuário

Como **pessoa usuária**, quero que minha conta e meus dados fiquem protegidos contra acesso indevido, força bruta e
vazamento. Como **equipe**, quero ambientes de demonstração isolados dos dados reais e entregas que nunca tirem a
produção do ar.

## Escopo implementado

| Área | O que existe |
|---|---|
| Acesso e sessão | Dev gate por pessoa (conta Google autorizada + PIN, token de API separado, `safeNext`, rotas `/gate` restritas, Cloudflare Access opcional). Sessão pelo BFF: refresh em cookie HttpOnly `fai_rt`, access token só em memória (nada no `localStorage`), logout sempre apaga os cookies. CSP com nonce. Admin do front falha fechado. |
| Autenticação (RF1–RF3) | Argon2id nos parâmetros da OWASP, com rehash no login. JWT RS256 com audiência; chaves geradas por script, fora do git e da imagem. Bloqueio por conta (5 em 15 min) sem enumeração: 401 genérico e hash falso para conta inexistente. Tentativa reservada de forma atômica antes do hash. Reconferência de senha (troca de senha, dados sensíveis, exclusão) no mesmo bloqueio (429). Códigos de verificação com tentativas contadas. Nomes reservados (`admin`, `e2e_*`, `demo_*`…). `AdminBootstrap` não promove conta existente sem opt-in. |
| Limites (OWASP API4:2023) | Limite por IP + método + rota (login 30/10 min · cadastro 10/h · envios do cadastro 40/h · refresh 120/10 min · redefinição 10/h e 20/h · troca de senha 20/h · dados sensíveis 30/h · exclusão 10/h · disponibilidade de username 120/10 min · sugestões 60/10 min). IP confiável: assinado pelo BFF (`EDGE_PROXY_SECRET`, HMAC) › `X-Real-IP` da borda › conexão TCP, nunca o `X-Forwarded-For`; IPv6 conta pelo prefixo /64. Teto de hashes simultâneos (503 + Retry-After): 60 logins paralelos não esgotam mais o pool do MySQL. Teto de pixels na decodificação de imagens. Teto de gasto de IA (`AiBudget`, USD global e por pessoa). |
| Acesso por objeto (BOLA/BFLA) | Mídia só da própria pessoa (`OwnMedia`); `restricted/` só pela API e só para ADMIN; exportação LGPD; envios do cadastro fora do público; travas de concorrência. |
| Segredos | Chaves de IA só no servidor (Vision no cabeçalho, token da Replicate só para `api.replicate.com`). E-mail no log sempre mascarado. Nenhuma senha padrão insegura. Senhas dos bancos geradas pelo Railway (`secret()`), sem passar pelo chat. |
| Bancos endurecidos como código (`infra/railway`) | MySQL 9: TLS obrigatório, `fai_app` e `fai_backup` de menor privilégio. Cassandra: autenticação, papéis, TLS com CA própria, contact points por nome. OpenSearch: plugin de segurança, TLS, `fai_app` só em `fai-*`, auditoria. Redis: ACL sem `@dangerous`. Cada `start.sh` é conferido por SHA-256. |
| Backup | `mysqldump` diário em `restricted/backups`, com sufixo aleatório e retenção. |
| Integridade e dados demo | **V34:** política de ON DELETE por domínio, 131 FKs. Dado de quem é dono → CASCADE; catálogo global → RESTRICT; SET NULL só quando o filho continua válido. Órfão adia só aquela FK; nunca desliga `FOREIGN_KEY_CHECKS`. **V35:** `account_origin` (REAL/TEST_SEED/DEMO/SYSTEM), `fixture_key` e `test_account` gerada. Fixtures versionadas (12 personas + 24 seguidores, `@example.test`, prefixo `demo_`). `DemoEnvironmentGuard`: desligado por padrão; em produção exige override. `MysqlDemoDataAdminAdapter`: plano do reset a partir das FKs reais, limpeza polimórfica, desconto exato de contadores, verificação de desvio da política. Contas de teste fora da vitrine. `purgeUser` nas projeções do Cassandra. |
| Plataforma e entrega | Spring Boot 4.1.1 (Framework 7, Security 7, Hibernate 7, Jackson 3), imagem na JVM 25 LTS. CI com API, front e gitleaks no histórico inteiro; Dependabot (JVM só LTS na imagem). Testes-guarda: `MigrationVersionsTest`, `JsonContractTest`, `AutoConfigurationExclusionsTest`. O healthcheck do Railway mantém a versão anterior quando a nova não sobe. |

**Planejado:** `DemoDataService` (seed/plan/reset/verify), `/api/admin/demo`, CLIs em `scripts/demo` e ambiente
`staging` no Railway.

## Regras de negócio

- **RN49.01** — Nenhum token de sessão no `localStorage`; o refresh fica só em cookie HttpOnly.
- **RN49.02** — O login responde igual (401 genérico, mesmo tempo) para conta inexistente, senha errada e conta bloqueada.
- **RN49.03** — No máximo 5 tentativas de senha por conta em 15 minutos.
  - A tentativa é contada antes de conferir a senha, de forma atômica.
  - Vale também para troca de senha, dados sensíveis e exclusão.
  - A redefinição de senha por e-mail tira a conta do bloqueio.
- **RN49.04** — O limite por IP usa o IP assinado pelo BFF ou o da borda, nunca o `X-Forwarded-For`; IPv6 conta por /64.
- **RN49.05** — Há um teto de hashes de senha simultâneos; o excedente recebe 503 com Retry-After, sem derrubar o resto da API.
- **RN49.06** — Mídia privada (`restricted/`) só pela API e só para o dono ou ADMIN.
- **RN49.07** — Chaves de IA e segredos só no servidor; e-mail em log sempre mascarado.
- **RN49.08** — Bancos só na rede privada, com usuário de menor privilégio e TLS.
- **RN49.09** — Dado de quem é dono → CASCADE; catálogo global → RESTRICT; nunca desligar `FOREIGN_KEY_CHECKS`.
- **RN49.10** — Só contas `TEST_SEED`/`DEMO` podem ser apagadas pelo reset; conta real só é anonimizada (LGPD).
- **RN49.11** — Fixtures usam `@example.test` e o prefixo `demo_` (reservado no cadastro) e nunca recebem e-mail.
- **RN49.12** — Versão de migration é única. Major de framework é migração, não bump. Só JVM LTS na imagem.

## Critérios de aceite

- **CA01** — 60 logins em paralelo: nenhum HTTP 500 e no máximo 5 senhas avaliadas por conta. *(verificado com uma sonda local: eram 50 respostas 500 e 40 senhas avaliadas)*
- **CA02** — Conta bloqueada: até a senha certa recebe 401 genérico. Depois de 15 min, ou de redefinir a senha por e-mail, entra.
- **CA03** — Sessão roubada: o 6º chute da senha atual na troca de senha recebe 429 `MUITAS_TENTATIVAS`.
- **CA04** — Mesmo IP: o 31º login em 10 min recebe 429 com Retry-After; trocar o fim do IPv6 (mesmo /64) não abre balde novo.
- **CA05** — Recarregar a página mantém a sessão pelo cookie `fai_rt`, sem nenhum token no `localStorage`.
- **CA06** — Mídia de outra pessoa ou em `restricted/` não abre para quem não é dono nem ADMIN.
- **CA07** — Banco novo (V1→V36) e banco em V30 com dados (→V36): a API sobe e as FKs seguem a política (0 adiadas).
- **CA08** — O CI fica vermelho para migration com versão repetida, segredo no histórico ou quebra do contrato JSON com o front.
- **CA09** — Um deploy que não sobe não tira a produção do ar: o healthcheck mantém a versão anterior.
- **CA10** — *(planejado)* Seed demo idempotente: rodar duas vezes não duplica nada. O reset exige dry-run e `planHash` e nunca apaga conta real.

## API

`POST /api/auth/login | register | uploads | refresh | password-reset/request | password-reset/confirm` ·
`PUT /api/auth/password` · `PATCH /api/me/sensitive` · `POST /api/me/deletion` ·
`GET /api/usernames/{u}/availability` · `GET /api/auth/username-suggestions` — todos com o limite por IP.

Rotas que calculam Argon2 passam pelo teto de hashes. Respostas de limite: 429 `MUITAS_TENTATIVAS` e 503
`AUTENTICACAO_OCUPADA`, ambas com Retry-After.

*Planejado:* `POST /api/admin/demo/seed?profile=`, `GET /api/admin/demo/verify`,
`POST /api/admin/demo/reset?dryRun=true|confirm=<planHash>`, `POST /api/admin/demo/catalog/reset`.

## Banco

- **Flyway V34:** migração Java da integridade referencial por domínio.
- **Flyway V35:** `account_origin`, `fixture_key`, `test_account` gerada, `brands.catalog_origin`.
- **Produção** segue em V30. As migrations V31–V36 sobem quando o `main` for levado à branch de deploy.

## Dependências

- RF1, RF2, RF3: cadastro, login e conta.
- RF23: configurações.
- RF24: motor de IA, teto de gasto.
- RF47: catálogo global, com RESTRICT.
- RNFs de segurança e disponibilidade.

## Documentos

- [SEGURANCA_PRODUCAO.md](../seguranca/SEGURANCA_PRODUCAO.md)
- [infra/railway/README.md](../../infra/railway/README.md)
- [AUDITORIA_FKS_E_PIPELINE_DEMO.md](../banco/integridade/AUDITORIA_FKS_E_PIPELINE_DEMO.md)
- [MIGRACAO_SPRING_BOOT_4.md](../MIGRACAO_SPRING_BOOT_4.md)
