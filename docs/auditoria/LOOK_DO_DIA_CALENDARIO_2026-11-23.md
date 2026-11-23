# Auditoria visual — Look do Dia no calendário de Momentos (23/11/2026)

Escopo: o card único do Look do Dia na grade do mês (compacto) e na semana (cheio) do calendário de Momentos, em
desktop 1440 × 900, celular 390 × 844 e tema escuro, com a API simulada (Playwright) e seis dias de novembro de 2026:
trabalho, encontro com clima, lazer coerente com a Denim Week (78), entrevista coerente (64), apresentação fora do tema
(12) e um dia de cuidado. Anatomia de referência:
[look-do-dia-vivido-cards-2026-11-23](../anatomias/look-do-dia-vivido-cards-2026-11-23.md).

Como rodar: `DEV_GATE_ENABLED=false npx next dev -p 3100` e, em outro terminal,
`BASE=http://localhost:3100 node scripts/e2e/verify-daily-look-calendar.mjs docs/correcoes/2026-11-23-look-do-dia-calendario`.
O script grava as capturas e `resultado.json` com as medidas conferidas (cards, rótulos, foto, largura, altura da célula,
linhas de coerência, dia de cuidado, legenda, rolagem horizontal, links sem nome).

## Resultado

| Tela | Nota | O que foi conferido | Problemas e correções | Captura |
|---|---|---|---|---|
| Mês · desktop | **8,5** | 6 cards, um por dia, rótulo "Look do Dia de 23 de nov." em todos; foto 28 × 36; largura do card = célula (137 px); moldura sólida nos 2 dias coerentes e tracejada nos demais; "Coerente com Denim Week · 64" e "Fora do tema de Denim Week · 12" em texto; dia de cuidado com cadeado; legenda "6 dias com Look do Dia · 2 em sintonia com um Momento"; sem rolagem horizontal; nenhum link sem nome | O compacto mostrava "· para Trabalho" e o clima inteiro ("22 °C · parcialmente nublado" em 3 linhas), fora da anatomia. **Corrigido:** compacto sem "para quem", clima só com a temperatura (rótulo completo no `title`), e a frase do dia de cuidado só no card cheio. A célula com card chega a 230 px de altura (a anatomia pedia mín. 112): aceito, a grade continua alinhada por linha | [grade](../correcoes/2026-11-23-look-do-dia-calendario/mes-grade-desktop.png) · [célula de hoje](../correcoes/2026-11-23-look-do-dia-calendario/celula-hoje-desktop.png) |
| Semana · desktop | **9** | 3 cards cheios (23, 24 e 25) com 360 px, foto 44 × 56, rótulo "Look do Dia" em versalete, propósito + nota + "para Trabalho", 4 marcas, coerência em 1 linha; dia de cuidado sem comparação | — | [card cheio](../correcoes/2026-11-23-look-do-dia-calendario/card-cheio-desktop.png) · [dia de cuidado](../correcoes/2026-11-23-look-do-dia-calendario/card-cuidado-desktop.png) · [semana](../correcoes/2026-11-23-look-do-dia-calendario/semana-desktop.png) |
| Mês · celular | **4 → 8** | célula de 37 px | **Bloqueava:** o card compacto transbordava a célula — título, propósito e marcas invadiam os dias vizinhos (veja a captura "antes" descrita abaixo). **Corrigido:** até 640 px o card na célula vira só a foto (24 × 30) com a moldura (sólida = coerente, tracejada = sem Momento); a leitura do dia fica na visão Semana. Depois: 6 cards, célula de 91 px, sem rolagem horizontal | [grade](../correcoes/2026-11-23-look-do-dia-calendario/mes-grade-celular.png) · [página](../correcoes/2026-11-23-look-do-dia-calendario/mes-celular.png) |
| Semana · celular | **9** | card cheio com 318 px, todas as zonas legíveis em 390 px; dia de cuidado com a frase | A barra inferior do app cobre o card da terça na captura de página inteira (comportamento normal de rolagem) | [card cheio](../correcoes/2026-11-23-look-do-dia-calendario/card-cheio-celular.png) · [semana](../correcoes/2026-11-23-look-do-dia-calendario/semana-celular.png) |
| Mês e semana · escuro | **9** | mesmas medidas do claro; moldura coerente no fio claro, chips do propósito no fundo escuro suave, Denim Week com a borda esquerda no acento do Momento; contraste dos textos muted mantido | — | [grade](../correcoes/2026-11-23-look-do-dia-calendario/mes-grade-desktop-escuro.png) · [card cheio](../correcoes/2026-11-23-look-do-dia-calendario/card-cheio-desktop-escuro.png) |

Erros de console: nenhum nas cinco combinações. Única chamada sem simulação: `/api/me/preferences` (respondida com `{}`,
sem efeito no calendário).

## Correções aplicadas nesta rodada

1. `components/daily-look/context-chips.tsx`: compacto sem "para quem"; marca de clima reduzida à temperatura (rótulo
   completo no `title`).
2. `components/moments/moment-day-look.tsx`: a frase "Dia de cuidado: sem comparação…" só no card cheio (o chip com
   cadeado continua no compacto).
3. `app/(site)/_styles/50-look-do-dia-vivido.css`: até 640 px o card na célula do mês mostra só a foto.
4. Anatomia atualizada (linha "Celular") e testes `context-chips.test.tsx` (novo) e `history-timeline.test.tsx`.

## Fora desta rodada

Capturas da aba Look do Dia ("vivendo hoje", véspera, fases) e do selo de experiência no card ampliado: ficam para a
próxima auditoria da aba, com o backend real.
