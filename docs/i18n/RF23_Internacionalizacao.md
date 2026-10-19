# RF23 — Internacionalização (pt-BR, en, es)

Especificação do que o Fashion AI faz em três idiomas, como está construído e como a equipe mantém isso sem regressão.

## 1. Escopo

| Camada | O que é traduzido | Onde mora |
|---|---|---|
| Frontend (Next.js) | Toda a interface: telas, botões, avisos, toasts, títulos, `aria-label`, mensagens de formulário, rótulos da taxonomia (categorias, cores, materiais, ocasiões, estilos) | `lib/i18n/messages/{pt-BR,en,es}.json` (2 743 chaves) e `lib/api/labels-{pt,en,es}.ts` |
| Backend (Spring Boot) | Erros da API, validações, notificações, textos das anatomias e do FLAIR, explicações da IA local, e-mails transacionais, exportação LGPD, nomes de desafios e regras de FAI Points semeados | `fai-application/src/main/resources/i18n/messages{,_en,_es}.properties` (2 000+ chaves) |
| Formatos | Datas, horas, números, tempo relativo | `Intl` por locale no frontend (`fmtDate`, `fmtDateTime`, `fmtNumber`, `relative`) |
| Moeda | Preços gravados em BRL mostrados em BRL, USD ou EUR, convertidos pela cotação de referência do BCE, com o original ao lado | `GET /api/exchange-rates` (`ExchangeRateService`), `lib/i18n/money.ts`, `<Price>` (`components/price.tsx`), preferência `user_preferences.currency` |
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
| CA13 | Preços aparecem na moeda do usuário: a escolhida em Configurações → Aparência → "Moeda dos preços" ou, em "Automática", a do idioma (pt-BR → BRL, en → USD, es → EUR). Em outra moeda, o valor convertido vem com "≈" e o original ao lado; a data da cotação do BCE fica no `title`. Sem cotação, o preço fica na moeda original. A escolha vai para o perfil (`currency`). | Trocar o idioma para inglês e abrir uma peça à venda: `≈ $19.82 (R$100.00)`. `curl /api/exchange-rates`. |

## 2.1 Rubrica "frontend internacionalizado" — onde está cada item

| Item da rubrica | Como o sistema atende | Evidência |
|---|---|---|
| a) Textos estáticos mudam de língua | Catálogos pt-BR/en/es com ICU no frontend e MessageFormat no backend; seletor no topo e em Configurações; `prebuild` falha com texto embutido ou chave faltando | CA01–CA05, CA07, CA11, CA12 |
| b) Formatos de dados (data, número etc.) se alteram | Toda data, hora, número e tempo relativo passa por `Intl` com o locale corrente (`fmtDate`, `fmtDateTime`, `fmtNumber`, `relative`, `currentIntl()` fora de componentes); plurais por ICU. Ex.: `19 de out. de 2026` · `Oct 19, 2026` · `19 oct 2026`; `1.234,5` · `1,234.5` · `1234,5` | CA06; `lib/i18n/i18n.tsx`; `lib/i18n/money.test.ts` |
| c) Dados da base e valores monetários internacionalizados | **Dados da base**: taxonomia (`display_name_en`/`es`), momentos e desafios (`names_json`), regras de FAI Points, modelos de desafio, itens semeados da loja do quarto (`roomCatalog.<SKU>`) e textos gravados como marcador `§i18n:chave§` saem no idioma de quem lê. **Moeda**: preços convertidos para BRL/USD/EUR pela cotação do BCE, com cache, última cotação boa e taxa de reserva | CA08–CA10, CA13; `ExchangeRateServiceTest`, `PreferencesServiceTest` |

### Como demonstrar em 1 minuto

1. Em pt-BR, abrir uma peça à venda: `R$ 100,00`.
2. Trocar para English no topo: datas em `Oct 19, 2026`, preço `≈ $19.82 (R$100.00)` e, passando o mouse, "Converted at the ECB reference rate of Oct 19, 2026…".
3. Em Configurações → Aparência → "Price currency", escolher Euro: o mesmo preço vira `≈ €17.66 (R$100.00)` sem trocar o idioma.
4. Abrir a loja do quarto em Español: "Puerta 60 · Blanco mate" (dado semeado no banco em pt-BR).

## 3. Arquitetura

### Frontend

- `lib/i18n/state.ts` — locale corrente sem React (lido pelo cliente da API, por `tr()` e pelos rótulos da taxonomia), lista de idiomas, cookie/localStorage.
- `lib/i18n/core.ts` — catálogos, `translate(locale, key, vars)`, fallback (idioma → pt-BR → a própria chave), pseudolocalização.
- `lib/i18n/icu.ts` — MessageFormat ICU: `{n, plural, one {…} other {…}}`, `select`, `#`, marcação `<0>…</0>` para trechos ricos.
- `lib/i18n/i18n.tsx` — `I18nProvider` e o hook `useI18n()` com `t`, `rich`, `fmtDate`, `fmtNumber`, `fmtMoney`, `relative`; grava a escolha no perfil quando há sessão.
- `lib/i18n/money.ts` — moeda exibida (preferência ou a do idioma), cotações (6 h no navegador, buscadas só quando a moeda exibida não é BRL), `convert`, `priceParts`, `fmtPriceNow`/`fmtPriceShort` para módulos sem React e `fmtOriginal` para cupons, que valem na moeda da loja. `components/price.tsx` mostra o convertido e o original.
- `lib/api/client.ts` — envia `Accept-Language` em toda chamada.
- `app/layout.tsx` — idioma da requisição no servidor (cookie → `Accept-Language` → pt-BR) para o `<html lang>` e os metadados.

### Backend

- `Msg` (`fai-application/.../common/Msg.java`) — `Msg.t(chave, args)` resolve agora no idioma da requisição; `Msg.k(chave, args)` devolve um marcador adiado para o que vai ao banco ou a catálogos estáticos; `Msg.resolve`/`resolveDeep` resolvem marcadores (inclusive aninhados) em texto, mapas e listas.
- `RequestLocaleFilter` (`fai-web/.../support`) — lê o `Accept-Language` antes do Spring Security (ordem −104: depois do `RequestContextFilter` do Boot, que sobrescreveria o locale) e devolve `Content-Language`. Fora de uma requisição (jobs, testes) o idioma é pt-BR, nunca o locale da JVM.
- `I18nConfig` — `AcceptHeaderLocaleResolver` (pt-BR, en, es) e um serializador Jackson de `String` que troca os marcadores pelo texto no idioma de quem lê.
- E-mails: `IdentityService`/`AccountService` usam `mailLocale(user)` (preferência salva, senão a requisição).
- Câmbio: `ExchangeRatePort` → `FrankfurterExchangeRateAdapter` (BCE, sem chave, `fashionai.fx.base-url`, desligável com `fashionai.fx.enabled=false`) → `ExchangeRateService` (cache de 6 h, nova tentativa a cada 10 min se a fonte cair, última cotação boa e reserva marcada `FALLBACK`) → `GET /api/exchange-rates` (público). A conversão é só informativa: nada é cobrado em outra moeda.

## 4. Fluxo de trabalho

1. **Texto novo no frontend**: `t("modulo.chave")` (ou `tr()` fora de componentes) e a chave nos três JSON. O scanner (`scripts/i18n/scan.js`) aponta qualquer literal esquecido.
2. **Texto novo no backend**: `Msg.t("modulo.chave")` para respostas imediatas e `Msg.k(...)` para o que é persistido; chave nos três `.properties` (apóstrofo vira `''`, chaves literais viram `'{'`).
3. **Traduzir em lote**: `python3 scripts/i18n/translations.py todo <pasta>` gera lotes das chaves sem en/es; `apply <lote.json>` grava; `status` mostra o saldo.
4. **Verificar**: `npm run i18n:check` (paridade e ICU), `npm run i18n:scan` (literais), `npm run i18n:qa` (telas nos quatro idiomas, com capturas e relatório JSON). O `prebuild` roda os dois primeiros.
5. **Backend**: `mvn test` cobre `Msg` e os serviços; o `RequestLocaleFilter` é verificado com `curl` e cabeçalhos diferentes.

## 5. Limitações conhecidas

- Registros gravados antes dos marcadores (as 925 notificações do seed) continuam em pt-BR.
- Itens da loja do quarto criados por marcas, produtos da loja física e descrições do catálogo de IA do painel administrativo são texto do autor e saem como foram escritos (os itens semeados pela FAI são traduzidos).
- Limites de regra definidos em reais (ex.: "preço ≥ R$ 600" na raridade do FLAIR) e campos em que a marca digita valores em R$ continuam em reais; cupons das marcas mostram o desconto na moeda da loja, no formato do idioma.
- A preferência salva no perfil só é reaplicada ao abrir Configurações; em outro dispositivo, o idioma local vale até lá.
- Os códigos da taxonomia (`upper_piece`, `casual`, `navy`) são a chave da API e aparecem assim em campos técnicos; a interface mostra o rótulo traduzido.
- O reconhecimento de pedidos em linguagem natural cobre um vocabulário fixo em en/es (ocasiões, tipos de peça, cores); frases fora dele caem no motor de regras.
