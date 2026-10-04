# Migração Spring Boot 3.5.16 → 4.1.1

Em 03/10/2026 o Dependabot abriu (e foram mergeados) bumps de major — Spring Boot 4.1.1, Testcontainers 2 — e o CI do
`main` ficou vermelho: o Boot 4 não é um bump de versão, é uma migração. Este documento registra a migração feita à mão.

## Versões

| Peça | Antes | Depois |
|---|---|---|
| Spring Boot | 3.5.16 | **4.1.1** (última GA; 4.2 ainda é milestone) |
| Spring Framework / Security / Data | 6.2.19 / 6.5.11 / 2025.0.13 | 7.0.9 / 7.1.1 / 2026.0.1 |
| Hibernate ORM | 6.6.53 | 7.4.5 (JPA 3.2) |
| Jackson | 2.21.4 (`com.fasterxml.jackson`) | **3.1.5** (`tools.jackson`; as anotações continuam em `com.fasterxml.jackson.annotation`) |
| Flyway | 11.7.2 | 12.4 |
| JUnit / Testcontainers | 5.12.2 / 1.21.4 | 6 / 2.0.5 (gerenciados pelo BOM do Boot) |
| springdoc-openapi | 2.8.17 | 3.1.1 |
| Lombok | 1.18.34 | 1.18.46 |
| JVM da imagem Docker | Temurin 24 (não-LTS, sem correções desde mar/2026) | **Temurin 25 LTS** — bytecode continua `--release 21` |

## O que mudou no código

1. **Starters modulares** (o Boot 4 quebrou o `spring-boot-autoconfigure` em um módulo por tecnologia):
   `spring-boot-starter-web` → `spring-boot-starter-webmvc`; `spring-boot-starter-oauth2-resource-server` →
   `spring-boot-starter-security-oauth2-resource-server`; **`spring-boot-starter-flyway` novo** (sem ele as migrations
   simplesmente não rodam: o `flyway-core` sozinho não é mais autoconfigurado); testes `@WebMvcTest` precisam de
   `spring-boot-starter-webmvc-test` e, para a segurança entrar na fatia, de `spring-boot-starter-security-test`.
2. **Pacotes que mudaram**: `EntityScan` → `org.springframework.boot.persistence.autoconfigure`; customizadores do
   Cassandra → `org.springframework.boot.cassandra.autoconfigure`; `WebMvcTest` →
   `org.springframework.boot.webmvc.test.autoconfigure`; `EnvironmentPostProcessor` → `org.springframework.boot`
   (inclusive a chave no `META-INF/spring.factories`).
3. **Jackson 3**: `ObjectMapper` é imutável — o `Json.MAPPER` é montado com `JsonMapper.builder()`; java.time vem
   embutido (sai o `jackson-datatype-jsr310`); `JsonProcessingException` → `JacksonException` (não checada);
   `SerializerProvider` → `SerializationContext`; `JsonNode.fields()` → `properties()`, `asText()` → `asString()`;
   desserializadores não declaram mais `IOException`. **Módulos registrados como bean precisam ser
   `tools.jackson.databind.JacksonModule`**: um bean `Module` do Jackson 2 seria ignorado em silêncio (e com ele o
   tradutor de textos i18n e os apelidos de enums antigos).
4. **Spring Security 7**: `AntPathRequestMatcher` foi removido → `PathPatternRequestMatcher.pathPattern(...)`.
5. **application.yml**: `server.error.include-stacktrace` → `spring.web.error.include-stacktrace`;
   `spring.jackson.serialization.write-dates-as-timestamps` → `spring.jackson.datatype.datetime.write-dates-as-timestamps`
   (o `spring-boot-properties-migrator` foi usado numa subida real para achar as chaves e depois retirado).
6. **Padrões do Jackson 3 que mudam o contrato com o front**: o Jackson 3 recusa `null` em campo primitivo
   (`boolean`, `int`) — o que no Boot 3 virava `false`/`0` passaria a ser 400 "JSON inválido" (ex.: `acceptTerms: null`
   no cadastro). Fixado no `application.yml` (`fail-on-null-for-primitives: false`, `fail-on-unknown-properties: false`)
   e no `Json.MAPPER`, em vez do interruptor genérico `spring.jackson.use-jackson2-defaults`. O `JsonContractTest`
   (fai-bootstrap) monta o JsonMapper com o application.yml real e trava esse contrato. Os demais padrões novos
   (propriedades em ordem alfabética, erro em lixo depois do JSON) ficaram — são mais seguros e não quebram o front.
7. **Armadilha silenciosa**: `spring.autoconfigure.exclude` com uma classe que não existe é **ignorado sem erro**, e o
   Boot 4 renomeou todas as autoconfigurações. Com os nomes antigos, o Cassandra voltaria a ser ligado sem o perfil
   `cassandra`. Os nomes foram atualizados e o `AutoConfigurationExclusionsTest` (fai-bootstrap) falha se algum
   deixar de existir numa atualização futura.

## Como foi validado

- `mvn verify` (JDK 21, igual ao CI): 495 testes (3 novos), 0 falhas, 2 ignorados (os mesmos de antes), em todos os módulos.
- Build completo dentro de `maven:3-eclipse-temurin-25` (javac 25 + Lombok + MapStruct).
- API subindo em `eclipse-temurin:25-jre-noble` contra MySQL 9: Flyway V1–V30 aplicadas, `/actuator/health` UP.
- Cadastro com `acceptTerms: null` e um campo desconhecido chega à validação (mensagem do campo), como no Boot 3.
- Fluxo real: cadastro → JWT → `/api/me` (descriptografia AES dos campos) → notificações com o texto resolvido em
  inglês pelo serializador i18n (prova de que o `JacksonModule` foi registrado), erros 400/401 no formato de sempre
  com datas ISO-8601, `/v3/api-docs` e cabeçalhos de segurança (CSP) iguais.
- Perfil `cassandra` contra o Cassandra endurecido local (TLS com a CA fixada, papel `fai_app`): projeções prontas.

## Implantação

O Railway publica a branch `claude/fashion-ai-interfaces-config-id7naj`, não o `main`: produção só muda quando essa
branch receber o merge. Ordem recomendada: ambiente de staging do Railway → conferir health, login e feed → produção.
Não há migration de banco nesta mudança; voltar atrás é publicar o commit anterior.
