# Proposta — Look do Dia Vivido: o look que a pessoa realmente vestiu, no dia em que viveu

**Estado:** proposta (ideia), sem número oficial; confirmar no Trello antes de publicar o cartão.
**Toca:** `schemes.look_do_dia` (hoje um booleano), `daily_looks`, Momentos, Autopiloto (`week_plan_days`),
Clima (`WeatherService`), HypeScore v2 (`LOOK_WORN`), FAI Points (`LOOK_DO_DIA`), Passarela 3D.
**Data:** 2026-11-19.

## 1. O problema que o campo resolve hoje (e o que ele não resolve)

Hoje `Scheme.lookDoDia` responde a uma pergunta binária: "este look já foi, alguma vez, o Look do Dia de alguém?".
A data, a origem e o feedback ficam em `daily_looks` (um registro por pessoa e dia). Isso serve ao histórico e ao
Hype, mas não responde às perguntas que uma pessoa real faz quando se veste de manhã:

- **Para quê** eu estou me vestindo hoje? (entrevista, aula, casamento, consulta, primeiro dia no trabalho,
  aniversário, luto, viagem, dia em casa)
- **Em que ponto do calendário** estou? (segunda-feira, véspera de feriado, Carnaval, semana de provas, inverno de
  São Paulo, quarta semana de dieta, terceiro mês de gravidez, primeiro mês após a mudança de cidade)
- **Quem vai me ver**, e o que eu quero que essa pessoa perceba?

A ideia é fazer o Look do Dia carregar esse **contexto vivido**, e usar o contexto para gerar engajamento social
que hoje só o look "bonito" consegue: o look **certo para o dia** passa a ser o que o app celebra.

## 2. A ideia em uma frase

> O Look do Dia deixa de ser "o look que marquei hoje" e passa a ser **"o que eu vesti para viver este dia"**: cada
> registro recebe um **Contexto do Dia** (por quê, para quem, em que momento do calendário), e esse contexto é o que
> liga a pessoa a quem está vivendo o mesmo dia.

Chamada de tela: **"Hoje eu vesti isso para…"** (uma frase curta completada pela pessoa ou sugerida pelo app).

## 3. O Contexto do Dia (o que entra no registro)

Quatro dimensões, todas opcionais, todas com sugestão automática e confirmação em um toque:

| Dimensão | Pergunta | De onde o app já sabe | Exemplos de valor |
|---|---|---|---|
| **Propósito** (`purpose`) | Para quê? | `WeekPlanDay.eventLabel` / `occasion`, Copilot, texto livre | ENTREVISTA, PRIMEIRO_DIA, APRESENTACAO, ENCONTRO, FESTA, CERIMONIA, VIAGEM, CONSULTA, ESTUDO, TRABALHO_PRESENCIAL, HOME_OFFICE, LAZER, DESCANSO, CUIDADO (luto, hospital: sem Hype, sem ranking) |
| **Calendário** (`calendarMarks`) | Em que ponto do tempo? | `Moment` ativos (SEASONAL/CULTURAL/EVENT), dia da semana, feriado do país (`User.country`), estação, `WeatherService.band` | "Segunda-feira", "Véspera de feriado", "Carnaval 2027", "Primeira semana de aula", "Frio de 9 °C" |
| **Fase pessoal** (`personalPhase`) | Que período da vida? | Momento `PERSONAL` criado pela pessoa, com início e fim | "Primeiro mês no novo emprego", "Gestação · 2.º trimestre", "Pós-cirurgia", "Mês sem comprar", "Preparação para a formatura" |
| **Para quem** (`audience`) | Quem vai me ver? | escolha da pessoa | SO_EU, FAMILIA, TRABALHO, AMIGOS, ALGUEM_ESPECIAL, PUBLICO |

Nada disso exige IA: `WeekPlanDay`, `Moment`, `WeatherService` e o calendário de feriados já existem ou são tabela.
A IA (Copilot) só **sugere** a frase de propósito a partir do que já está no plano da semana.

## 4. Por que isso muda o engajamento social

### 4.1 "Quem mais está vivendo isso hoje" (a feature social central)

O contexto vira **chave de agrupamento**. Ao registrar "Hoje eu vesti isso para: Entrevista · Segunda-feira ·
Frio de 9 °C", a pessoa vê um carrossel: *"17 pessoas também se vestiram para uma entrevista hoje"*. Esses looks
são comparáveis **porque têm a mesma missão**, não porque são do mesmo estilo. Comentários e reações aqui são
mais prováveis e mais úteis ("essa cor fica séria sem ser dura, vou usar na minha quinta").

Regras:
- Só entram looks `PUBLIC` ou cuja visibilidade `Guard.canView` libera; `audience = SO_EU` nunca aparece.
- Propósitos sensíveis (`CUIDADO`) não geram carrossel nem ranking; aparecem só para a pessoa.
- Agrupamento mínimo de 5 looks para mostrar o número (evita identificar alguém pelo contexto).

### 4.2 "Deu certo?" — o feedback vira história, não nota

O `DailyLookFeedback` (ADOREI / NAO_USEI / NAO_GOSTEI) passa a ser perguntado **no fim do dia, com o contexto**:
"Como foi a entrevista com esse look?". A resposta alimenta:
- o DNA de estilo (já acontece),
- um **selo de experiência no card**: "Usado em 3 entrevistas · 2 deram certo" (dado da pessoa, nunca promessa),
- a Passarela 3D: filtro "looks que funcionaram para X" (`feedback = ADOREI` com propósito X, mínimo 5 registros).

### 4.3 Sequências e marcos ligados ao calendário real

Em vez de "7 dias seguidos" genérico, os marcos são do calendário vivido:
- **"Semana completa"**: Look do Dia de segunda a sexta com propósito TRABALHO/ESTUDO (badge semanal, FAI Points
  dentro do teto `LOOK_DO_DIA` existente, 1 por dia).
- **"Primeiro dia"**: todo registro com `PRIMEIRO_DIA` vira uma entrada fixa na linha do tempo do Histórico ("o que
  eu vesti no meu primeiro dia em…"), revisitável anos depois.
- **"Mesma data, outro ano"**: no dia 19/11/2027 o app mostra o look de 19/11/2026 com o contexto da época
  ("há um ano: primeira semana no novo emprego"). É memória, não métrica. Reaproveita o Replay dos Momentos.

### 4.4 Fase pessoal como Momento `PERSONAL`

A fase ("primeiro mês no novo emprego", "gestação") é um `Moment` com `type = PERSONAL`, `scope = PERSONAL`,
`visibility = PRIVATE` por padrão. Cada Look do Dia dentro do período entra como submissão desse Momento. Ao fim
da fase o app monta a **Memória** ("30 dias · 22 looks · as 5 peças que mais te acompanharam"), igual à Memória de
um Momento público. Se a pessoa quiser, publica a memória no perfil: é o tipo de conteúdo que gera conversa real
("como foi se vestir no primeiro mês?").

### 4.5 Convite contextual (sem ser notificação genérica)

Na véspera de um Momento oficial (Carnaval, Denim Week) ou de um `WeekPlanDay` com `eventLabel`, o app pergunta
uma vez: "Amanhã é sua apresentação. Quer preparar o Look do Dia agora?". Preparar hoje e confirmar amanhã usa o
que já existe (`moment_participations.prepared_scheme_id` e `/api/autopilot/days/{dayId}/use`).

## 5. Modelo de dados (mínimo)

Nada muda em `schemes.look_do_dia` (continua o booleano denormalizado) nem em `look_do_dia_count`. O contexto
pertence ao **registro datado**, porque o mesmo look pode ser vestido para uma entrevista numa segunda e para um
jantar num sábado.

```
daily_looks
  + purpose            VARCHAR(30)   -- enum DailyLookPurpose, nulo = não informado
  + purpose_note       VARCHAR(140)  -- frase livre: "Hoje eu vesti isso para…"
  + audience           VARCHAR(20)   -- enum DailyLookAudience
  + calendar_marks_json JSON         -- [{kind: WEEKDAY|HOLIDAY|MOMENT|SEASON|WEATHER, code, label}] congelado no dia
  + personal_moment_id CHAR(36)      -- FK moments (type = PERSONAL), nulo
  + outcome_note       VARCHAR(140)  -- resposta do fim do dia ("a entrevista foi bem")
```

Índice: `(purpose, look_date)` para o carrossel "quem mais está vivendo isso hoje".
`calendar_marks_json` é **congelado** no registro: o clima e o Momento do dia não mudam depois.

Enums novos (fai-domain): `DailyLookPurpose`, `DailyLookAudience`. Regra em `DailyLookPurpose.sensitive()`
(CUIDADO) espelhando `MomentNature.sensitive()`: sem Hype contextual, sem ranking, sem carrossel.

## 6. API (incremento sobre o que existe)

| Método | Rota | O que muda |
|---|---|---|
| POST | `/api/me/daily-look` | aceita `context: {purpose, purposeNote, audience, personalMomentId}`; o serviço preenche `calendarMarks` sozinho |
| GET | `/api/me/daily-look-tab` | devolve `context` e `livingToday: {count, looks[]}` (≥ 5, respeitando visibilidade) |
| PUT | `/api/me/daily-looks/{date}/feedback` | aceita `outcomeNote` |
| GET | `/api/me/daily-looks/suggest-context?date=` | sugestão a partir de `WeekPlanDay`, Momentos ativos, feriados e clima |
| GET | `/api/explorer/runway?purpose=ENTREVISTA&worked=true` | Passarela filtrada por propósito e feedback positivo |
| GET | `/api/me/daily-looks/on-this-day?date=` | "mesma data, outro ano" |

Hype v2: `LOOK_WORN` continua valendo 1. Novo sinal derivado opcional `LOOK_WORKED` (feedback ADOREI com propósito),
peso 1,5, nunca para propósitos sensíveis. FAI Points: nenhuma regra nova; "Semana completa" é badge
(`user_achievements`), não pontos, para não criar farming.

## 7. Telas (incremento)

- **Marcar como Look do Dia** (card expandido, Espelho, Autopiloto): abaixo do botão, uma linha "Hoje eu vesti isso
  para…" com 3 chips sugeridos + "outro". Um toque; dá para pular.
- **Aba Look do Dia**: bloco "Vivendo hoje" (carrossel por propósito) acima do painel de Hype.
- **Fim do dia** (notificação já existente de feedback): a pergunta usa o contexto.
- **Histórico › Timeline**: cada linha mostra o contexto congelado ("Entrevista · Seg · 9 °C · Carnaval 2027").
- **Perfil (público)**: seção "Fases" com as memórias de Momentos PERSONAL que a pessoa publicou.

## 8. Privacidade e cuidado

- Tudo opcional; o Look do Dia sem contexto continua funcionando igual.
- `audience = SO_EU` e propósito `CUIDADO` nunca saem do perfil da pessoa.
- Fase pessoal nasce `PRIVATE`; publicar é ato explícito, por fase.
- Agrupamentos públicos só com ≥ 5 pessoas; feriado e clima vêm do país e da cidade **já informados** pela pessoa.
- Datas religiosas seguem `MomentNature.RELIGIOUS`: contexto sim, competição não.

## 9. Por que esta ideia e não outra

Alternativas consideradas e descartadas para o campo:

| Alternativa | Por que não |
|---|---|
| Transformar `look_do_dia` em data (`look_do_dia_em`) | `daily_looks` já guarda a data; só move a redundância |
| Look do Dia com foto obrigatória ("prova") | barreira de uso; o app é closet-first e já registra peças sem foto |
| Ranking diário de Look do Dia global | compete com a Passarela 3D e premia o mais fotogênico, não o mais vivido |
| Streak genérico de dias seguidos | não se liga ao calendário da pessoa; vira obrigação |

O contexto vivido é o único que **usa o que o produto já tem** (Momentos, plano da semana, clima, feedback, Replay) e
transforma a roupa em motivo de conversa entre pessoas que estão passando pela mesma coisa no mesmo dia.

## 10. Entrega sugerida (fases)

1. **F1 — contexto no registro**: enums, colunas, `suggest-context`, chips no "Marcar como Look do Dia", timeline
   mostrando o contexto. Sem social ainda. (migration nova, aditiva)
2. **F2 — vivendo hoje**: carrossel por propósito na aba, filtro na Passarela, `outcomeNote` no feedback.
3. **F3 — fases**: Momento `PERSONAL` como fase, memória ao fim, publicação no perfil, "mesma data, outro ano".

Cada fase respeita `docs/refactoring/LINE_RULES.md`: `DailyLookService` já está perto do limite; o contexto entra em
`DailyLookContextService` (sugestão e congelamento das marcas) e `DailyLookLivingTodayQuery` (carrossel), com
`DailyLookService` só delegando.
