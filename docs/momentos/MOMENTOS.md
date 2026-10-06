# FashionAI MOMENTOS — o tempo da moda dentro do FashionAI

> MODA + TEMPO + OCASIÃO + EXPRESSÃO INDIVIDUAL + PARTICIPAÇÃO SOCIAL.
> A antiga aba **Desafios** deixa de ser uma lista estática de missões e passa a representar a dimensão temporal da
> moda: estações, festas, encontros, rituais, tendências, memórias, comunidades e transformações individuais.
> "O que vestir" depende também de "quando", "onde", "com quem" e "para quê".

## Domínios que conversam sem se misturar

| Domínio | Pergunta | Onde está |
|---|---|---|
| Guarda-roupa | o que EU TENHO | `WardrobeItem` |
| DNA de estilo | QUEM EU SOU | `StyleDna` / `StyleCompatibility` |
| HypeScore | O QUE ESTÁ ACONTECENDO | `application/hype` |
| **Momentos** | **QUANDO e EM QUAL CONTEXTO** | `application/moments` |
| Copilot | O QUE POSSO FAZER COM ISSO | `CopilotService` (lê os Momentos ativos) |
| Lookbook | COMO EU ME EXPRESSO | `Scheme` |
| FLAIR | COMO EU PARTICIPO COM OUTRAS PESSOAS | Momentos privados de grupo (`flair_teams`) |
| Histórico | COMO EU MUDEI | participações + Replay |

Nenhum deles vira uma métrica única: um look mostra **Hype**, **Seu estilo**, **Momento** (MomentMatch) e
**Reutilização** lado a lado.

## Auditoria do que existia (e o que foi reaproveitado)

| Área | Antes | Decisão |
|---|---|---|
| Desafios (RF36) | `ChallengeTemplate`/`ChallengeInstance`, catálogo fixo, estados em português, `tick()` a cada 15 min | Mantidos intactos em `/challenges` ("desafios de rotina": Espelho de Verdade, Vista-me…). "Desafio" passa a ser **um tipo** de Momento (`MomentType.CHALLENGE`, `MomentChallenge` dentro de um Momento). A navegação aponta para **Momentos**; a home dos Momentos linka a área antiga. |
| FAI Points | `fai_points_ledger` append-only, chave de idempotência `usuário:ação:referência`, tetos diário/semanal, extrato nas notificações | Reutilizado como está. Só regras novas (`MOMENT_*`) na V42; referência sempre `momento(:look|:desafio)` → paga 1× (anti-farming). |
| FLAIR / grupos | `FlairTeam` + `FlairTeamMember` (entra por código) | Grupo = `FlairTeam`. Momento privado = `Moment` com `scope=GROUP`, `group_id`, `visibility≠PUBLIC`. |
| Notificações | `NotificationType` por tipo, opt-out por tipo, `Msg.k` adiado | 4 tipos novos (`MOMENT_STARTING`, `MOMENT_GROUP_CREATED`, `MOMENT_DEADLINE`, `MOMENT_COMPLETED`), dedupe por participação (`remind_sent`, `deadline_notified`). |
| HypeScore v2 | fatias por região/país/categoria/estilo/ocasião; nada temporal | **Hype contextual** derivado: `clamp(hype + (match − 50) · 0,5)` — nunca sobrescreve o global; "em alta no Momento" vem dos envios. |
| Looks / peças | `Scheme.style/occasion/season`, `WardrobeItem.styleTags/color/lastWornDate`, diário de uso | Base do MomentMatch e dos fatos de reutilização/redescoberta. |
| Perfil | `profileVisibility`, `Guard.canView` | Linha do tempo pública só do que a pessoa marcou (`public_on_profile`) e em Momentos públicos. |
| Conquistas | `user_achievements` (idempotente) | Badges de Momento = `achievement_code` do Momento (`MOMENT_<SLUG>`), 1 por Momento. |
| Calendário | só `WeekPlanDay.eventLabel` | Novo: `/api/moments/calendar` (ano/mês no fuso do Momento). |
| Fuso | servidor fixo em `America/Sao_Paulo`, sem campo do usuário | `moments.timezone` por Momento + `users.timezone` (opcional) na V42. |

## Modelo

`moments` (tema, tags, interpretações, regras, pontos, fonte, grupo, memória) · `moment_challenges` (vários por Momento:
STYLE, COLOR, THEME, NO_BUY, REDISCOVERY, ONE_PIECE_MANY_LOOKS, EXPERIMENTAL, REMIX) · `moment_participations`
(INTERESTED → JOINED → SUBMITTED → COMPLETED | LEFT; abordagem, lembrete, look preparado, pontos, ranking, badge,
visibilidade no perfil) · `moment_submissions` (um look entra 1× por Momento; match e pontos congelados) ·
`moment_votes` (por dimensão: TREND, ELEGANT, CREATIVE, ORIGINAL, THEME; nunca no próprio look).

Enums: `MomentType` (SEASONAL, CULTURAL, EVENT, FASHION_EVENT, COMMUNITY, CHALLENGE, PRIVATE_GROUP, PERSONAL,
BRAND_EVENT, FLAIR_EVENT) · `MomentNature` (CULTURAL, SEASONAL, COMMERCIAL, RELIGIOUS, FASHIONAI, PRIVATE — RELIGIOUS
nunca vira competição: sem pontos, sem votação) · `MomentStatus` (DRAFT, SCHEDULED, ACTIVE, ENDED, ARCHIVED, CANCELLED)
· `MomentScope` · `MomentVisibility` (PRIVATE, INVITE_ONLY, FRIENDS, GROUP, PUBLIC) · `FlairMomentMode` (BATTLE,
TOURNAMENT, GROUP_CHALLENGE, COOPERATIVE, MOMENT, TEAM_VS_TEAM, LOOK_LEAGUE).

## Tempo (§54)

`start_at`/`end_at` em UTC + `timezone` IANA do Momento. O job (`MomentService.tick`, a cada 5 min) mantém o status
gravado; **toda consulta calcula o status efetivo pelo relógio do servidor** (`MomentTime.effective`) e devolve `now`,
`startsInSeconds`, `endsInSeconds` e `daysLeft`: o cliente formata, nunca decide. Dias do calendário saem no fuso do
Momento (`localStart`/`localEnd`), não no do navegador.

## MomentMatch (§13–§15)

`MomentMatch.score(contexto, look)` → 0–100 com partes (`styleMatch` 0,30 · `colorMatch` 0,25 · `occasionMatch` 0,15 ·
`themeMatch` 0,15 · `itemMatch` 0,10 · `creativeInterpretation` 0,05) e razões. Sobreposição sobre as taxonomias
existentes, sem IA no caminho da pontuação. Não existe "HalloweenLook = true/false": a interface explica
("forte associação ao tema pela combinação de preto, laranja e elementos dark"). `creativeInterpretation` premia
estilos **fora** do tema combinados com o tema (descoberta ≠ uniformização, §18).

## FAI Points sazonais (§10–§11, §39)

`MomentPointsPolicy.compute` é determinística: MOMENT_LOOK (base × multiplicador; match ≥ 40) · MOMENT_PUBLISH ·
MOMENT_WARDROBE_BONUS (só peças anteriores ao início) · MOMENT_REDISCOVERY_BONUS (peça sem uso há ≥ N dias) ·
MOMENT_REMIX_BONUS · MOMENT_NEW_STYLE · MOMENT_CHALLENGE (por desafio cumprido) · MOMENT_COMPLETED · MOMENT_FLAIR ·
MOMENT_PRIZE / MOMENT_COOP_GOAL (ao encerrar). Nada premia compra. O ledger paga 1× por referência, então reenviar,
apagar/recriar looks ou entrar/sair não gera pontos novos; tetos diários seguram o resto.

## API

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/moments` | home: agora, próximos, destaque, resumo pessoal, grupo |
| GET | `/api/moments/active` · `/upcoming` · `/now` · `/calendar?year&month&tz` | listas, banner "Agora no FashionAI", calendário |
| GET | `/api/moments/{id|slug}` · `/feed` · `/leaderboard` · `/trending` · `/looks` | MomentPage genérica |
| PUT/DELETE | `/api/moments/{id}/save` | salvar no calendário / lembrar-me / preparar look |
| POST | `/api/moments/{id}/join` · `/leave` · `/preview` · `/submit` · `/votes` | participação |
| PUT | `/api/moments/{id}/profile-visibility` | controle do perfil |
| GET | `/api/me/moments` · `/api/me/moments/replay?year` · `/api/users/{id}/moments` | meus Momentos, Replay, linha do tempo |
| GET | `/api/moments/context/{PIECE|SCHEME}/{id}` | verso do card: MomentMatch + Hype contextual por Momento ativo |
| GET/POST | `/api/flair/groups/{id}/moments` | calendário do grupo e criação de Momento privado |
| * | `/api/admin/moments[...]` | criar, editar, `schedule`, `feature`, `cancel`, `archive`, `end`; job `tick` |

Leituras públicas estão em `SecurityConfig.PUBLIC_GET`; Momentos não públicos são filtrados por membro no serviço.

## Conteúdo oficial (V42)

Primavera 2026, Halloween 2026 (destaque, ×1,5, 7 desafios), Denim Week, Natal e Festas (RELIGIOUS: sem pontos nem
votação), Réveillon, Verão 2027, No-Buy Week (7 dias / 7 looks), Carnaval 2027 (×1,5), Festa Junina 2027, Inverno 2027.
Tudo editável em **/admin/moments**. Fashion weeks, premiações e festivais **não** foram semeados: eventos externos
exigem fonte verificada (`source_url`/`source_note`) na administração (§21). Momentos de marca aparecem sempre como
PATROCINADO (§47).

## Frontend

`/moments` (Agora · Próximos · Calendário · Meus · FLAIR), `/moments/[id]` (MomentPage genérica recebendo tema, regras
e conteúdo como dados), banner "Agora no FashionAI" no feed (só com Momento relevante), seção **Momentos** no perfil,
linhas de Momento no verso analítico dos cards, criação de Momento privado no FLAIR, `/admin/moments`. Tema do Momento é
uma camada (`--moment-accent`, `--moment-gradient`) sobre a identidade FashionAI. Acessível (teclado, aria, foco,
contraste, reduced motion) e mobile-first (calendário mensal/semanal no celular, anual no desktop).

## Fora deste lote (preparado, não implementado)

Clima no Copilot por Momento, Brand Moments com fluxo comercial, exportação LGPD das participações (tabelas já em
cascata por usuário), comentários dentro do Momento (reusa o mural quando entrar), recorrência automática anual
(hoje: duplicar na administração).
