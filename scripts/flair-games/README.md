# FLAIR 3D — gerador do catálogo dos 100 jogos

Os 100 jogos FLAIR (docs/flair/flair-3d-100-jogos) são **dados**: cada série vive em `data/serie-{a..e}.json`
(20 jogos por arquivo, schema no desenho §4) e tudo o que o app precisa é **gerado** daqui, de forma determinística:

| Saída | Caminho | Conteúdo |
|---|---|---|
| Migração | `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V98__flair_3d_jogos.sql` | DDL fixo (colunas novas de `flair_challenges`, tabela `flair_game_rewards`, regras `FLAIR_3D*`), um colecionável de `room_catalog` por recompensa ITEM e **um INSERT de `flair_challenges` por jogo**, ordenado por número |
| Miniaturas | `public/flair/games/<slug>.webp` | 640×400 a partir de `scene_json` (`scene-svg.mjs` + sharp); sem IA |
| Catálogo | `docs/flair/flair-3d-100-jogos/catalogo.gen.md` | tabela resumo com os campos derivados e a regra de derivação por extenso |

```bash
node scripts/flair-games/build.mjs                       # dados reais: exige exatamente 100 jogos
node scripts/flair-games/build.mjs --allow-partial       # séries ainda incompletas
node scripts/flair-games/build.mjs --no-thumbs           # só SQL + catálogo
node scripts/flair-games/build.mjs --data scripts/flair-games/fixtures --allow-partial --out /tmp/ge   # prova com a fixture, sem tocar no repo
node --test scripts/flair-games/build.test.mjs           # testes (não rodam no vitest)
```

Saída 1 = erros de validação (todos listados de uma vez, com o número do jogo); 2 = sem dados ou argumento inválido.

## Módulos

- `lib/constants.mjs` — vocabulário do motor (posições, tipos da DSL, faixas de Hype), níveis, objetos de cena, caminhos e ids.
- `lib/validate.mjs` — validação do catálogo (§4, R12, R15): vagas 3–11, chaves únicas, `minCards` = vagas obrigatórias,
  tipos da DSL, `count` ≤ vagas, três idiomas em todo texto, ICU balanceado, props e cores válidos, recompensas com código
  único (≤ 40), slugs únicos e diferentes dos 16 da V56, números 1..100 únicos, 20 por série e 100 no total.
- `lib/derive.mjs` — derivação R16 (dificuldade, raridade, nível de XP e do guarda-roupa) a partir de pontos, vagas,
  recompensas e número do jogo. Os agentes de dados **não** escrevem esses campos.
- `lib/sql.mjs` — a migração: literais com aspas simples duplicadas, JSON compactado, nenhuma barra invertida.
- `scene-svg.mjs` — renderizador SVG puro (os 28 `PropKind` do `CbcSceneArt`, pinos numerados, faixa com número e série).
- `lib/thumbs.mjs` — SVG → WebP com sharp. `lib/markdown.mjs` — o catálogo gerado.
- `fixtures/serie-x.json` — dois jogos de exemplo no schema (um da série A com módulos do quarto, um da série B).
- `evidence_xlsx.py` — planilha de evidências (fase final, ver desenho §5).
