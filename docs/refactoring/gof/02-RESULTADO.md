# Módulo 02 — identidade: lote FLOW-AUTH-REGISTER-FORM-005

Base: `bcaee73` (main após PR #416). Branch: `claude/serene-thompson-yetcg5`. `git status --short` limpo antes do lote.
Os módulos 00/01/21/22 já tinham sido executados em lotes anteriores; este é o primeiro lote temático do domínio 02.

## Mapeamento real do fluxo de cadastro

`app/(site)/(auth)/register/page.tsx` (client component, `api.post("/bff/auth/register", …)`)
→ `app/bff/auth/[action]/route.ts` (ações login/register/refresh/logout; o BFF guarda o refresh token em cookie
httpOnly com `path=/bff/auth` e devolve ao navegador só o access token)
→ `AuthController.register` (`POST /api/auth/register`, `fai-web`)
→ `IdentityService.register` (`@Transactional`)
→ **`RegistrationFormChain.validate`** (novo, puro) → arquivos pendentes (`MediaStoragePort`) → `UserRepository`,
`UserPreferencesRepository`, `BrandProfileRepository`, `CelebrityProfileRepository` → e-mail/notificações/auditoria
→ `openSession` (`RefreshToken`, `TokenIssuerPort`) → `IdentityService.Session` → BFF → `useAuth().signIn`.

Endpoints do controller confirmados no código (15): register, uploads, username-suggestions, login, refresh, logout,
email-verification(+resend), password-reset/request|confirm, PUT password, GET/DELETE sessions, DELETE sessions/{id}.

## Problema concreto e decisão

`register()` tinha ~205 linhas misturando 19 regras de formulário (comuns + específicas de marca/celebridade) com
leitura de uploads, persistência, envio de e-mail e abertura de sessão. A validação é uma sequência ordenada de regras
independentes em que **a ordem é observável**: `details` da resposta 400 `FORMULARIO_INVALIDO` é um `LinkedHashMap` e o
formulário destaca os campos nessa ordem. Isso justifica **Chain of Responsibility (variante pipeline)**: cada elo
decide se se aplica ao tipo de perfil e registra o motivo no seu campo; todos os elos rodam (acumulação, não curto-circuito).

`RegistrationFormChain` (package-private, mesmo pacote do serviço): `Input(cmd, type, mail, today)` + 10 elos em
`RULES` (nome, e-mail, senha, confirmação, termos, nascimento, marca, celebridade, manequim, @). Sem Spring, repositório,
storage ou relógio global — a data de referência é injetada (o serviço passa `LocalDate.now()`, como antes).

Permanecem no serviço, sem alteração: recusa de `ADMIN` antes da validação (`TIPO_INVALIDO`), checagem dos arquivos
pendentes (precisa do storage; continua acrescentando chaves **depois** dos elos, com a mesma sobrescrita),
`EMAIL_EM_USO` (409, mesma mensagem que não vaza dados da conta), `USERNAME_EM_USO`, criação de entidades, transação,
auditoria, e-mails e sessão. As funções estáticas públicas `validatePassword`, `validCnpj`, `normalizeUsername`,
`reservedUsername` e `usernameProblem` mantêm assinatura (usadas por `PreferencesService`/`AccountService`).

### Padrões avaliados e não aplicados neste lote

- **Strategy (provedores de autenticação):** só existe um mecanismo (senha + 2FA por e-mail); não há variação real.
- **State (verificação de e-mail):** o fluxo é `PENDING_EMAIL_VERIFICATION → ACTIVE` com quota de tentativas; um `if`
  é mais claro que uma máquina de estados.
- **Facade:** `IdentityService` já é a fachada transacional do controller; criar outra camada só adicionaria indireção.
- **Adapter BFF:** `app/bff/auth/[action]/route.ts` já adapta o contrato (cookie httpOnly ↔ JSON); fica para lote próprio
  com testes de BFF.
- **Singleton:** beans Spring; nenhum Singleton manual introduzido.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** da extração (6 testes novos em `IdentitySecurityTest`: ordem exata das chaves para pessoal/marca/celebridade, mensagens de idade/data/@, ADMIN antes da validação) | `mvn -pl fai-application -Dtest=Identity*Test test` | 35 testes, 0 falhas |
| Depois da extração + `RegistrationFormChainTest` (6 testes: relógio controlado nos 13 anos exatos, aplicabilidade por tipo, ordem dos 10 elos, @ em branco) + consumidores das funções estáticas | `mvn -pl fai-application '-Dtest=Identity*Test,RegistrationFormChainTest,PreferencesService*Test,AccountService*Test' test` | 57 testes, 0 falhas |
| Suíte completa `fai-application` + `fai-web` | `mvn -pl fai-application,fai-web -am test` | BUILD SUCCESS: fai-application 1831 testes (27 skipped preexistentes), fai-web 790; 0 falhas/erros |
| Auditoria offline (workflow `architecture.yml`) | `python -m unittest scripts.refactoring.test_audit_repository scripts.refactoring.test_line_policy` e `discover -p 'test_gof_*.py'` | 5 + 18 testes OK |

Logs: `evidence/auth-register-baseline.log`, `auth-register-after.log`, `auth-register-full-suite.log`.

Sem banco, servidor, navegador, rede de produção, e-mail real, GPU ou contas reais. Nenhuma sessão revogada.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `IdentityService.java` | 1079 linhas | 1007 (−72; −6,67 %) |
| `register()` | ~205 linhas | ~135 |
| `RegistrationFormChain.java` (novo) | — | 167 |
| Runtime combinado | 1079 | 1174 (+95: javadoc, assinaturas dos elos) |
| Tokens de ramificação (if/for/catch/?/&&/\|\|, contagem lexical) | 165 | 142 + 25 = 167 (+2: guardas de aplicabilidade por tipo) |

O ganho é coesão e testabilidade isolada da regra de formulário, não redução global de complexidade.

## Contratos preservados

URL, método, payload `RegisterCommand`, códigos `TIPO_INVALIDO`/`FORMULARIO_INVALIDO`/`EMAIL_EM_USO`/`USERNAME_EM_USO`,
chaves e mensagens i18n, ordem de `details`, `@Transactional` do método, idade mínima 13, normalização do e-mail.
Sem mudança de DTO, schema, migration ou configuração.

## Riscos e pendências do domínio 02

- `IdentityService` continua PARTIAL (1007 linhas): login com lockout/2FA, emissão/rotação de refresh (família, reuso),
  reset de senha e sessões ainda no mesmo bean. Próximo candidato: isolar a emissão/rotação de sessões apenas com
  caracterização de refresh concorrente e reuso de token (testes já existentes em `IdentityServiceSessoesTest`).
- Frontend: `register/page.tsx` (137 linhas) mistura estado de formulário e envio; BFF sem testes de rota dedicados.
  Não alterados neste lote.
- `DevAuthGate`/middleware não foram tocados.
- COVERAGE.csv/COVERAGE_FINAL.csv: `IdentityService.java` passou a PARTIAL com decisão registrada; nova linha DONE para
  `RegistrationFormChain.java`. As demais 15 entradas de endpoint do `AuthController` continuam PENDING.
