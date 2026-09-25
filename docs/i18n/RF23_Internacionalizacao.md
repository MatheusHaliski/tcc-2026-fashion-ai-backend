# RF23 — Internacionalização (pt-BR, en, es)

Especificação do que o Fashion AI faz em três idiomas, como está construído e como a equipe mantém isso sem regressão.

## 1. Escopo

| Camada | O que é traduzido | Onde mora |
|---|---|---|
| Frontend (Next.js) | Toda a interface: telas, botões, avisos, toasts, títulos, `aria-label`, mensagens de formulário, rótulos da taxonomia (categorias, cores, materiais, ocasiões, estilos) | `lib/i18n/messages/{pt-BR,en,es}.json` (2 743 chaves) e `lib/api/labels-{pt,en,es}.ts` |
| Backend (Spring Boot) | Erros da API, validações, notificações, textos das anatomias e do FLAIR, explicações da IA local, e-mails transacionais, exportação LGPD, nomes de desafios e regras de FAI Points semeados | `fai-application/src/main/resources/i18n/messages{,_en,_es}.properties` (2 000+ chaves) |
| Formatos | Datas, horas, números, moeda (BRL, USD, EUR), tempo relativo | `Intl` por locale no frontend (`fmtDate`, `fmtNumber`, `fmtMoney`, `relative`) |
| IA | Prompts pedem a resposta no idioma do usuário; a interpretação de pedidos em linguagem natural (Copilot, Vista-me, DNA) reconhece palavras em pt, en e es | `Msg.languageName()` nos prompts; tabelas de palavras nos serviços |

Fora do escopo, por decisão: texto criado pelo próprio usuário (nome de peça, título e descrição de look, bio, comentários) não é traduzido.

## 2. Critérios de aceite

| CA | Critério | Como verificar |
|---|---|---|
| CA01 | O usuário escolhe pt-BR, en ou es no seletor do topo; a escolha vale imediatamente, sem recarregar. | Trocar o idioma no topo em qualquer tela. |
| CA02 | A escolha fica guardada no navegador (localStorage + cookie) e, com sessão ativa, no perfil (`user_preferences.language`); o idioma da interface no cadastro vira a preferência inicial. | Trocar o idioma, sair e entrar de novo; conferir `GET /api/me/preferences`. |
| CA03 | O primeiro acesso usa o `Accept-Language` do navegador; sem correspondência, pt-BR. | Abrir com o navegador em inglês. |
| CA04 | Nenhum texto de interface fica embutido no código: o `prebuild` falha se o scanner encontrar um literal. | `npm run i18n:scan` |
| CA05 | Os três catálogos têm as mesmas chaves, a mesma sintaxe ICU e os mesmos argumentos; o `prebuild` falha se houver diferença. | `npm run i18n:check` |
| CA06 | Plurais, datas, números e moeda seguem o idioma (ICU `plural`/`select`; `Intl`). | Ver "3 curtidas" / "3 likes" / "3 me gusta" e os preços em BRL/USD/EUR. |
| CA07 | A API responde no idioma do `Accept-Language` e devolve `Content-Language`, inclusive nos 401/403 gerados fora do MVC (filtro antes do Spring Security). | `curl -H "Accept-Language: en" /api/me` → `Sign in to continue.` |
| CA08 | Texto gravado no banco (notificações, resultados de desafio, bônus do FLAIR, consentimentos) é guardado como marcador `§i18n:chave§` e resolvido no idioma de quem lê, na serialização. | Gerar uma notificação e lê-la em dois idiomas. |
| CA09 | Dados de referência semeados na migração (modelos de desafio, regras de FAI Points, taxonomia) aparecem traduzidos pelo código (`challengeTemplate.<código>`, `pointsRule.<código>`, `taxonomy.<chave>`). | `/challenges` e `/points` em inglês. |
| CA10 | E-mails transacionais e a exportação LGPD saem no idioma da preferência do usuário (fallback: idioma da requisição). | Pedir a exportação em inglês e abrir o JSON. |
| CA11 | Pseudo-idioma `qps-ploc` disponível para QA (em desenvolvimento, ou com a flag `fai.i18n.pseudo=1`): todo texto do catálogo aparece `[áššíɱ ~~]`; o que aparecer normal está fora do catálogo. | Selecionar "Pseudo (QA)" no seletor. |
| CA12 | Uma varredura automática visita as telas nos quatro idiomas, captura cada uma e lista português restante, chaves cruas e ICU não resolvido. | `npm run i18n:qa -- --base http://localhost:3000` |

## 3. Arquitetura

### Frontend

- `lib/i18n/state.ts` — locale corrente sem React (lido pelo cliente da API, por `tr()` e pelos rótulos da taxonomia), lista de idiomas, cookie/localStorage.
- `lib/i18n/core.ts` — catálogos, `translate(locale, key, vars)`, fallback (idioma → pt-BR → a própria chave), pseudolocalização.
- `lib/i18n/icu.ts` — MessageFormat ICU: `{n, plural, one {…} other {…}}`, `select`, `#`, marcação `<0>…</0>` para trechos ricos.
- `lib/i18n/i18n.tsx` — `I18nProvider` e o hook `useI18n()` com `t`, `rich`, `fmtDate`, `fmtNumber`, `fmtMoney`, `relative`; grava a escolha no perfil quando há sessão.
- `lib/api/client.ts` — envia `Accept-Language` em toda chamada.
- `app/layout.tsx` — idioma da requisição no servidor (cookie → `Accept-Language` → pt-BR) para o `<html lang>` e os metadados.

### Backend

- `Msg` (`fai-application/.../common/Msg.java`) — `Msg.t(chave, args)` resolve agora no idioma da requisição; `Msg.k(chave, args)` devolve um marcador adiado para o que vai ao banco ou a catálogos estáticos; `Msg.resolve`/`resolveDeep` resolvem marcadores (inclusive aninhados) em texto, mapas e listas.
- `RequestLocaleFilter` (`fai-web/.../support`) — lê o `Accept-Language` antes do Spring Security (ordem −104: depois do `RequestContextFilter` do Boot, que sobrescreveria o locale) e devolve `Content-Language`. Fora de uma requisição (jobs, testes) o idioma é pt-BR, nunca o locale da JVM.
- `I18nConfig` — `AcceptHeaderLocaleResolver` (pt-BR, en, es) e um serializador Jackson de `String` que troca os marcadores pelo texto no idioma de quem lê.
- E-mails: `IdentityService`/`AccountService` usam `mailLocale(user)` (preferência salva, senão a requisição).

## 4. Fluxo de trabalho

1. **Texto novo no frontend**: `t("modulo.chave")` (ou `tr()` fora de componentes) e a chave nos três JSON. O scanner (`scripts/i18n/scan.js`) aponta qualquer literal esquecido.
2. **Texto novo no backend**: `Msg.t("modulo.chave")` para respostas imediatas e `Msg.k(...)` para o que é persistido; chave nos três `.properties` (apóstrofo vira `''`, chaves literais viram `'{'`).
3. **Traduzir em lote**: `python3 scripts/i18n/translations.py todo <pasta>` gera lotes das chaves sem en/es; `apply <lote.json>` grava; `status` mostra o saldo.
4. **Verificar**: `npm run i18n:check` (paridade e ICU), `npm run i18n:scan` (literais), `npm run i18n:qa` (telas nos quatro idiomas, com capturas e relatório JSON). O `prebuild` roda os dois primeiros.
5. **Backend**: `mvn test` cobre `Msg` e os serviços; o `RequestLocaleFilter` é verificado com `curl` e cabeçalhos diferentes.

## 5. Limitações conhecidas

- Registros gravados antes dos marcadores (as 925 notificações do seed) continuam em pt-BR.
- Nomes dos itens da loja do quarto (`room_catalog`) e as descrições do catálogo de IA do painel administrativo ainda estão em pt-BR.
- A preferência salva no perfil só é reaplicada ao abrir Configurações; em outro dispositivo, o idioma local vale até lá.
- Os códigos da taxonomia (`upper_piece`, `casual`, `navy`) são a chave da API e aparecem assim em campos técnicos; a interface mostra o rótulo traduzido.
- O reconhecimento de pedidos em linguagem natural cobre um vocabulário fixo em en/es (ocasiões, tipos de peça, cores); frases fora dele caem no motor de regras.
