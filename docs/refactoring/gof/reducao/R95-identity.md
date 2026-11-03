# Lote R95-identity — `IdentityService`, `AccountService` e `ProfileService` como Facade; `IdentitySecurityTest` por tema

Base: `claude/relaxed-pasteur-5b5466` (merge `--ff-only` antes de começar e merge antes do commit final).
Pacote: `fai-application/src/main/java/br/com/fashionai/application/service/`. Área sensível (cadastro, senhas, tokens,
sessões, códigos de verificação): os corpos foram copiados por faixa de linhas do original (script), sem reescrever.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `IdentityService.java` (`java-service`, 250) | 1007 | 250 | 11 colaboradores + `IdentityUseCases`, tabela abaixo | **Facade** (estrutural) |
| `AccountService.java` (`java-service`, 250) | 746 | 218 | 10 colaboradores, tabela abaixo | **Facade** (estrutural) |
| `ProfileService.java` (`java-service`, 250) | 296 | 231 | `ProfileConnections` (136) | **Facade** (estrutural) |
| `src/test/.../service/IdentitySecurityTest.java` (`teste`, 400) | 596 | 101 | `IdentitySecurityFixture` (237), `IdentityLoginLockoutTest` (148), `IdentityPasswordResetTest` (49), `IdentityRegistrationSecurityTest` (133) | NENHUM |

`RegistrationFormChain` (Chain of Responsibility do lote anterior) não mudou: continua chamado pelo cadastro, agora de
dentro de `IdentityRegistration`, com a mesma entrada e a mesma ordem de regras.

Colaboradores do `IdentityService` (todos `final`, package-private, sem Spring; criados uma vez no construtor):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `IdentityUseCases` | 46 | record com os casos de uso e `wire(...)`, que os monta com as dependências do construtor (o único efeito é o hash descartável do login, como antes) |
| `IdentityPreUploads` | 140 | envios do cadastro antes da conta (`PRE_UPLOAD_SIZE`, limite por IP, recodificação, `restricted/`), conferência/cópia para a conta, `PENDING_TTL`/`PENDING_SCOPES` e o job de limpeza |
| `IdentityRegistration` | 242 | `register` (cadeia de validação, arquivos, e-mail/@ únicos, conta, preferências, perfil de marca/celebridade, avisos, primeira sessão) e os slugs únicos |
| `IdentityFieldRules` | 79 | regras puras: senha forte, CNPJ, @ normalizado/reservado/problema, `RESERVED_USERNAMES` |
| `IdentityUsernames` | 48 | sugestões de @ livres (consultam o repositório) |
| `IdentityCodes` | 114 | códigos de 6 dígitos: emissão (e-mail, 2FA), invalidação, comparação em tempo constante, tentativa errada, cota por hora, idioma dos e-mails |
| `IdentityEmailVerification` | 105 | `verifyEmail` (status e aviso ao analista do emissor), `approved`, reenvio limitado |
| `IdentityLogin` | 144 | `login` (hash sempre conferido, reserva no bloqueio antes da senha, 2FA, aparelho novo), `invalidCredentials`, `findByEmail` |
| `IdentityLockout` | 55 | `MAX_LOGIN_FAILURES`, `LOCK_WINDOW` e `passwordMatchesWithLockout` (troca de senha e reautenticação no bloqueio do login) |
| `IdentitySessions` | 164 | `openSession`/`issue` (refresh com hash, família, avisos), `refresh` (reuso revoga a família), sessões ativas, logout, revogações |
| `IdentityPasswords` | 182 | pedido de redefinição (resposta uniforme, e-mail após o commit no `mailExecutor`), confirmação, troca de senha, reautenticação |
| `IdentityFormats` | 34 | `maskEmail`, `shortAgent`, `escape`, `blank` |

Colaboradores do `AccountService`:

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `AccountLookup` | 30 | `load` (404 da conta) e `mailLocale`, comuns aos casos de uso |
| `AccountConsentPurposes` | 40 | a tabela `PURPOSES` (bloco estático original); `AccountService.PURPOSES` é o mesmo objeto |
| `AccountProfileView` | 68 | `me` |
| `AccountSettings` | 139 | `updateSensitive` (reautenticação primeiro, troca de e-mail por código), `confirmEmailChange`, `updatePrivacy` |
| `AccountConsents` | 80 | `consents`, `setConsent` |
| `AccountExports` | 116 | `requestExport`, `exportKey`, `purgeExpiredExports`, `exportsOf`, `downloadExport` (dono → 403, vencida → 410) |
| `AccountExportData` | 114 | conteúdo do pacote LGPD (`exportData`) |
| `AccountHypeExport` | 154 | Hype pessoal no pacote (`HYPE_EXPORT_CHUNK`, linhas atuais/histórico/marcos, dimensões) |
| `AccountDeletion` | 71 | `requestDeletion` (reautenticação primeiro), `cancelDeletion`, `pendingApproval` |
| `AccountAnonymizer` | 124 | `purgeScheduledDeletions` (limpeza dos módulos antes de tudo; falha interrompe sem anonimizar) |

## Como foi dividido

- Código movido por faixas de linhas do original (`scratchpad/gen/*.py`), sem alterar corpos. As únicas mudanças nos
  corpos são a qualificação das chamadas que passaram a outro colaborador (`sendEmailVerification(u)` →
  `codeBook.sendEmailVerification(u)`, `openSession(…)` → `sessions.openSession(…)`, `revokeOtherSessions(…)` →
  `sessions.revokeOtherSessions(…)`, `passwordMatchesWithLockout(…)` → `lockout.passwordMatchesWithLockout(…)`,
  `findByEmail(mail)` → `login.findByEmail(mail)`, `load(user)` → `lookup.load(user)`, `exportData(u)` →
  `dataPackage.exportData(u)`, `AccountService::hypeMilestoneRow` → `AccountHypeExport::hypeMilestoneRow`) e a leitura
  das dependências definidas depois da construção por `Supplier`: `issuerReview` (setter `setIssuerReview`) vira
  `issuerReview.get()`, e `accountDataCleanup` (campo `@Autowired`, também trocado por `ReflectionTestUtils` nos testes)
  vira `accountDataCleanup.get()`. Records aninhados, constantes e estáticos usados pelos corpos entram por import.
  Uma comparação linha a linha do original com os arquivos novos lista só essas linhas.
- **Segurança idêntica**: mesmas exceções e códigos (`NAO_AUTENTICADO` para bloqueio/inexistente/senha errada,
  `MUITAS_TENTATIVAS` 429, `CODIGO_INVALIDO`/`CODIGO_EXPIRADO`, `LINK_INVALIDO`, `REAUTENTICACAO_FALHOU`…), mesma ordem
  (reserva no bloqueio → hash sempre → bloqueio → senha → conta indisponível → rehash → 2FA; `reauthenticate` antes de
  carregar a conta em `updateSensitive`/`requestDeletion`), mesmo hash (`sha256(userId:código)`, `sha256(token)`,
  Argon2 pela porta, `constantTimeEquals`), o hash descartável continua calculado uma vez no construtor, e nenhum log
  novo (os loggers dos colaboradores mantêm a categoria `IdentityService`/`AccountService` e as mesmas mensagens, sem
  código, token ou senha).
- Os serviços continuam os únicos beans: as **12 `@Transactional`** do `IdentityService` (incluindo os 3
  `noRollbackFor = ApiException.class`, que gravam a tentativa errada) e o `@Scheduled` de `purgeStalePendingUploads`, as
  **13 `@Transactional`** e o `@Scheduled` do `AccountService` e as **8 `@Transactional`** do `ProfileService` ficaram
  nos mesmos métodos. Autochamadas do original (`confirmPasswordReset` → `revokeOtherSessions`, `setConsent` →
  `consents`, `me` → `consents`) continuam sem passar pelo proxy, como antes; as chamadas do `AccountService` ao bean
  `IdentityService` (`reauthenticate`, `invalidateCodes`, `requireCodeAttemptQuota`, `revokeOtherSessions`) continuam
  pelo bean.
- Construtores, records públicos (`BrandData`, `CelebrityData`, `RegisterCommand`, `Session`, `LoginCommand`,
  `SensitiveUpdate`), constantes públicas e todos os métodos públicos e package-private com chamadores ficaram com a
  mesma assinatura; os três construtores do `AccountService` não mudaram. `ServiceFakes` de `fai-web` compila sem
  alteração.
- Saíram dos serviços sem delegação (sem chamador fora da classe, agora no colaborador): `PENDING_TTL`,
  `MAX_LOGIN_FAILURES`, `LOCK_WINDOW`, `log`, `dummyHash` e os privados do `IdentityService`; `HYPE_EXPORT_CHUNK`,
  `hypeExport`, `hypeCurrentRow`, `hypeHistoryRow`, `hypeMilestoneRow`, `hypeDimensions` e `log` do `AccountService`.
  Nenhum método público foi removido.
- Consumidor ajustado: `IdentityAllSessionsTest` injetava por reflexão o campo privado `refreshTokens`; agora injeta o
  campo `cases` com um `IdentitySessions` sobre o mesmo repositório (mesmas asserções).
- **ProfileService**: o grafo de seguir (`relation`, `follow`, `unfollow`, `state`, `requests`, `respond`,
  `connections`, `block`) foi para `ProfileConnections`; o perfil, os looks pelo Hype e os contadores ficaram. `relation` e
  `state` (package-private) continuam como delegação.
- **IdentitySecurityTest**: estado, fakes por proxy, `setUp` e construtores de comando foram para
  `IdentitySecurityFixture` (abstrata); os 28 testes foram distribuídos sem alteração: confirmação e troca de e-mail (7,
  `IdentitySecurityTest`), login/bloqueio/2FA/reautenticação (8), redefinição de senha (3), @ e cadeia do cadastro (10).

## Por que Facade (os três serviços) e NENHUM (testes)

- **Facade**: `AuthController`, `MeController`, `ProfileController`, `SessionActiveFilter`, `AuthRateLimitFilter`,
  `AccountService`, `AdminService`, `PreferencesService`, `IssuerReviewService`, `RegistrationFormChain` e os fakes de
  `fai-web` continuam falando só com os serviços, que escondem os subsistemas coesos e coordenam transação, agendamento
  e contrato. `IdentityUseCases` só monta o grafo (não é interface nem abstração nova).
- **NENHUM (testes)**: herança de fixture de teste não é padrão GoF; não há esqueleto com passos variáveis.

## Testes e equivalência

Caracterização antes (commit `6711533`, sobre o código original), retratos textuais versionados em
`src/test/resources/identity/` (UUIDs → fichas, instantes, hashes/tokens hex, códigos e milissegundos → marcadores;
mapas sem ordem própria ordenados, LinkedHashMap na ordem), com a lista de chamadas de cada porta falsa (e-mail,
notificações, auditoria, storage, limite de tentativas, hash, tokens, análise de emissor) na ordem:
`IdentityRegistrationRetratoTest` (envios, cadastro dos três tipos com cópia dos arquivos, recusas, confirmação, reenvio,
estáticos, job), `IdentitySessionRetratoTest` (login, bloqueio, rehash, 2FA, refresh/reuso, sessões, logout, redefinição,
troca de senha, reautenticação), `AccountServiceRetratoTest` (todos os públicos, pacote exportado e anonimização) e
`ProfileServiceRetratoTest` (perfil em 10 situações, seguir, pedidos, conexões, bloqueio). Estáveis em 3 JVMs seguidas.

```
mvn -B -q -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='Identity*Test,RegistrationFormChainTest,Account*Test,HypePersonalDataTest,CreatorOptOutPreferencesTest,Profile*Test,LookbookPublicationsTest,PreferencesServiceTest' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -q -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,CorsPreflightTest,*Auth*Test,*Session*Test' test
mvn -B -o -pl fai-application -Djacoco.skip=true test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original, testes do lote (com o `IdentitySecurityTest` dividido) + 4 retratos | 78 testes, 0 falhas (retratos gravados) |
| Depois das três fachadas | **78 testes, 0 falhas; os 4 retratos idênticos** (2 execuções) |
| `fai-web` (install compila tudo; `ServiceFakes` sem alteração) | `ControllerDelegacaoTest` 697, `CorsPreflightTest` 5, `AuthRateLimitFilterTest` 8, `ResourceOwnerAuthorizationTest` 2 — 0 falhas |
| Suíte completa de `fai-application` (depois) | 2062 testes, 0 falhas, 0 erros, 27 skipped |
| Catraca | os 4 arquivos do lote só como `APERTAR` (1007 → 250, 746 → 218, 296 → 231, 596 → 101); 0 violações; nenhum arquivo novo acima do limite |

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n.

## Pendências

- `IdentityService.java` ficou exatamente no limite (250): o que sobra é contrato (5 records, constantes, construtor de
  14 argumentos, os delegadores públicos e package-private, 12 `@Transactional`). Nos delegadores cuja javadoc era longa, o
  texto original foi com o corpo para o colaborador (a fachada aponta para eles na javadoc da classe). Qualquer método
  novo exige antes levar algum record para tipo de topo (com ajuste de controllers, `ServiceFakes` e testes).
- `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
