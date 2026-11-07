# FLAIR 3D MAKE UP — catálogo gerado dos 5 jogos

Arquivo GERADO por `scripts/flair-games/build.mjs` a partir de `scripts/flair-games/data/serie-*.json`: não editar à mão.
Jogos no catálogo: 5.

- Por série: A: 1 · B: 1 · C: 1 · D: 1 · E: 1
- Por dificuldade: MEDIUM: 2 · HARD: 1 · LEGENDARY: 2
- Por raridade: LEGENDARY: 3 · COMMON: 1 · RARE: 1
- Por nível de XP: STUDIO: 2 · ESTREIA: 1 · LOFT: 2
- Por nível do guarda-roupa: ORGANIZADO: 2 · VERSATIL: 1 · CLOSET_INTELIGENTE: 2

## Tabela

| Nº | Jogo | Série | Distrito | Dificuldade | Raridade | Nível de XP | Nível do guarda-roupa | Pontos | Cartas mín/máx | Adaptado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Espelho Partido (`a01-espelho-partido`) | A | SUITE | MEDIUM | LEGENDARY | STUDIO | ORGANIZADO | 25 | 5/7 | não |
| 031 | Prova com a Estrela (`b31-prova-com-a-estrela`) | B | RUNWAY | HARD | LEGENDARY | STUDIO | VERSATIL | 45 | 6/9 | não |
| 043 | Rooftop ao Pôr do Sol (`c43-rooftop-ao-por-do-sol`) | C | CITY | MEDIUM | COMMON | ESTREIA | ORGANIZADO | 30 | 5/7 | não |
| 070 | Cinco Clientes (`d70-cinco-clientes`) | D | BACKSTAGE | LEGENDARY | RARE | LOFT | CLOSET_INTELIGENTE | 60 | 11/11 | sim |
| 096 | Chefe: Vellard (`e96-chefe-vellard`) | E | COMMUNITY | LEGENDARY | LEGENDARY | LOFT | CLOSET_INTELIGENTE | 80 | 7/9 | não |

## Regra de derivação (desenho §6 R16)

Os agentes de dados escrevem só a ficha (pontos, vagas, recompensas, `themeTags`); os campos de navegação e bloqueio são derivados sempre da mesma forma:

- **Pontos**: o valor em P da ficha (10..150), gravado em `points`.
- **Dificuldade**: pontos ≤ 20 → EASY; 21–35 → MEDIUM; 36–55 → HARD (56–59 também HARD); ≥ 60 → LEGENDARY.
- **Raridade**: jogos 83, 84, 94 e 97 (marca/celebridade) → COLLAB_DROP; senão, se há recompensa de carta Especial → LEGENDARY; senão, pontos ≥ 35 → RARE; senão COMMON.
- **Nível de XP exigido**: dificuldade LEGENDARY ou raridade COLLAB_DROP → LOFT; dificuldade HARD ou raridade RARE/LEGENDARY → STUDIO; senão ESTREIA.
- **Nível do guarda-roupa exigido**: vagas ≤ 5 → EM_MONTAGEM; 6–7 → ORGANIZADO; 8–9 → VERSATIL; 10–11 → BEM_CURADO; dificuldade LEGENDARY sobe a pelo menos CLOSET_INTELIGENTE; jogo 89 → CLOSET_INTELIGENTE; jogo 99 → CLOSET_ASSINATURA; jogo 100 → MAISON_CLOSET.
- **Tags de tema** (`theme_tags`): 2–4 estilos/cores da taxonomia escolhidos pelo agente de dados em `themeTags`, para o ponto de tema ser alcançável.
- **Vagas** (R15): mínimo = vagas obrigatórias, máximo = todas as vagas (3–11); quando a ficha pedia mais de 11 cartas o jogo fica `adapted` e a sequência diz quantas vagas há no app.

## Visibilidade da carta Especial (R26)

`FlairCollectionService.visible()` esconde cartas que não são de peça (originType ≠ PIECE) nas vistas de terceiros: a carta Especial ganha num jogo
(originType PROGRAM, acquiredVia FLAIR_3D) aparece só na coleção do próprio dono. As capturas de evidência são feitas com a sessão do dono.

## Identificadores

- `flair_challenges.id` = `7d000000-0000-4000-8000-` + número com 12 dígitos; `slug` = `<série minúscula><nn>-<nome>`; `scenario` = `livre`; `sort_order` = 1000 + número.
- Miniatura: `/flair/games/<slug>.webp` (640×400), gerada de `scene_json` por `scripts/flair-games/scene-svg.mjs`.
- Recompensas ITEM viram linhas inativas de `room_catalog` (kind COLLECTIBLE, mold FLAIR3D-DECOR), concedidas só pelo jogo.
