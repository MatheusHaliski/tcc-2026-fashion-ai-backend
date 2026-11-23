# Anatomia dos cards únicos do Look do Dia (card do dia e card no painel do calendário)

Data: 23/11/2026. Escopo: o **card único de vestimenta** do Look do Dia Vivido
([proposta](../novos-rf/PROPOSTA_LOOK_DO_DIA_VIVIDO.md) §4): a versão **cheia** (semana do calendário de Momentos e
blocos "vivendo hoje", "mesma data, outro ano" e peças da fase) e a versão **compacta dentro da célula do painel do
calendário** (grade do mês). Componente: `components/moments/moment-day-look.tsx` (`DayLookCard`); estilos em
`app/(site)/_styles/50-look-do-dia-vivido.css`. O card social do look (248 × 520) e o card ampliado não mudam: este
card é a **leitura de um dia**, não a vitrine do look.

## Princípio

Um dia = um card. O card responde a três perguntas, nesta ordem: **o que vesti** (foto e título), **para quê e em que
contexto** (propósito, nota, para quem, marcas do dia) e **como isso conversa com o Momento do dia** (coerência). Nada
depende só de cor: a coerência tem texto e número; o dia de cuidado tem cadeado e rótulo; a moldura sólida ou tracejada
sempre vem acompanhada do texto.

## Zonas (card cheio)

| # | Zona | Classe | Conteúdo | Medida |
|---|---|---|---|---|
| 0 | Moldura | `.day-look` | contorno **tracejado** = sem coerência com Momento; **sólido** na cor do fio = coerente (`.is-coherent`) | padding 8, raio 10, gap 6 entre zonas; largura = coluna (mín. 248, máx. 360 na semana) |
| 1 | Fotografia | `.day-look-thumb` | capa do look (`cover`); sem capa, cabide 👗 | 44 × 56, raio 6 |
| 2 | Identidade | `.day-look-text` | rótulo "Look do Dia" (12 px, versalete, muted) + título do look (14 px, 1 linha, reticências); a zona inteira é o link para `/schemes/{id}` | altura 2 linhas |
| 3 | Contexto | `.dl-context` | chip do **propósito** (12–13 px, fundo fio-suave; `.is-sensitive` = cinza com 🔒), **nota** em itálico, "para {quem}" muted; abaixo, as **marcas do dia** como chips de 12 px com ícone (📅 dia da semana, 🍃 estação, 🌤 clima, ícone do Momento) | chips 1 × 6 px de padding, raio 999; marcas raio 6, borda fina |
| 4 | Coerência | `.day-look-moments` | uma linha por Momento do dia: ícone + "Coerente com {Momento} · {match}" (negrito) ou "Fora do tema de {Momento} · {match}" (muted); até 4 | 12 px, gap 2 |

Estados da zona 4: **sem Momento** → "Sem Momento neste dia" (12 px, faint); **dia de cuidado** → "Dia de cuidado: sem
comparação com o Momento." no lugar das linhas; **sem contexto** → zona 3 ausente, zona 4 normal.

## Card no painel do calendário (`.day-look.is-compact`)

Entra **dentro da célula do dia** (`.moment-day`), abaixo das faixas dos Momentos, e nunca muda a largura da grade.

| Zona | O que muda | Medida |
|---|---|---|
| Moldura | padding 4, raio 8, gap 3 | largura = célula (≥ 96 px no desktop); a célula com card tem altura mín. 112 px |
| Fotografia | reduzida | 28 × 36 |
| Identidade | some o rótulo "Look do Dia"; título em 12 px, 1 linha | — |
| Contexto | só o chip do propósito e as marcas compactas (sem nota, sem "para quem") | chips com padding 0 4, entrelinha 1,4 |
| Coerência | **só o primeiro Momento** (o mais relevante do dia) | 1 linha |
| Celular (≤ 640 px) | coerência e marcas ocultas; ficam foto + título + propósito; o dia inteiro continua na visão **Semana** | — |

Abaixo da grade, a legenda do mês: "{N} dias com Look do Dia · {M} em sintonia com um Momento" (`.moment-month-looks`).

## Parentes com a mesma anatomia

| Onde | Componente | O que reaproveita |
|---|---|---|
| "Quem mais está vivendo isso hoje" (aba Look do Dia) | `LivingToday` em `components/lookbook/daily-tab-extras.tsx` | zonas 1–2 (`.day-look-main`), item de 200 px em trilho horizontal com rolagem e encaixe (`.living-today-item`); "@pessoa · deu certo" no lugar do rótulo |
| "Mesma data, outro ano" | `OnThisDay` | zona 3 compacta sob o título, com "há N anos" como rótulo |
| Peças que mais acompanharam uma fase | `PhaseSummary` em `daily-phases.tsx` | zona 1 (44 × 56) em grade de 72 px por peça, com "nome ×N" |
| Selo de experiência no card ampliado | `ExperienceBadges` | linha com borda esquerda no fio: "Usado N vezes para X · M deram certo" |

## Tipografia e acessibilidade

Rótulos 12 px (mínimo do projeto), títulos 14 px no card cheio e 12 px no compacto, números com `tabular`. O card é um
`article` com `aria-label` "Look do Dia de {data}"; a lista de coerência tem `aria-label` "Coerência com os Momentos do
dia"; as marcas, "Marcas do dia". Foco visível no link da zona 2 (sublinhado no título). Tema do Momento só colore a borda
esquerda das marcas de Momento (`--moment-accent`); o restante segue a identidade FashionAI nos dois temas.

## Verificação

Testes: `components/moments/moment-calendar.test.tsx` (card compacto na grade e cheio na semana, dia de cuidado, legenda),
`components/lookbook/daily-tab-extras.test.tsx` (trilho "vivendo hoje"), `components/lookbook/daily-phases.test.tsx`
(peças da fase). Medidas aplicadas no CSS citado; capturas ficam para a próxima rodada de auditoria visual.
