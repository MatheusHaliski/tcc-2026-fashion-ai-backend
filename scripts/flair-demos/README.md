# Demonstrações da Central FLAIR

Grava, com o app de verdade, os clipes que a Central FLAIR (`/flair`) mostra para cada modo, e as capturas de
desktop e celular da documentação. Nada aqui usa a API real: a gravação roda sobre uma **API simulada em memória**
(`mock-api.mjs`), com dados fictícios. Assistir às demonstrações no app é só carregar arquivos estáticos de
`public/flair/demos`: não consome cartas, não debita saldo nem concede pontos.

| Arquivo | Para quê |
|---|---|
| `mock-api.mjs` | API simulada (sessão, FLAIR, Desafios de Montagem, Momentos, Desafios) na porta 8099. Com `DEMO_HIDE_GUIDES=1` os tutoriais vêm marcados como "não mostrar" (os clipes mostram o jogo, não a explicação) |
| `record.mjs` | Roteiros de gravação (Playwright + Chromium), um por modo, com cursor visível e cliques marcados. Saída: `out/<modo>.raw.webm` |
| `encode.mjs` | Converte em MP4 (H.264) + WebM (VP9) sem áudio e gera a capa JPG, cortando o início (carregamento) |
| `shots.mjs` | Capturas desktop (1360×900) e celular (390×844) em `docs/flair/capturas` |

## Como gravar

```bash
# 1) dependências da ferramenta (fora do package.json do app)
cd scripts/flair-demos && npm install playwright@1.56 --no-save && cd ../..

# 2) app apontando para a API simulada, sem o gate de desenvolvimento
printf 'NEXT_PUBLIC_API_BASE_URL=http://localhost:8099\nDEV_GATE_ENABLED=false\n' > .env.local
npm run dev &
DEMO_HIDE_GUIDES=1 node scripts/flair-demos/mock-api.mjs 8099 &

# 3) gravar, codificar e capturar
node scripts/flair-demos/record.mjs            # ou: node scripts/flair-demos/record.mjs cbc moments
node scripts/flair-demos/encode.mjs            # public/flair/demos/<modo>.{mp4,webm,jpg}
node scripts/flair-demos/shots.mjs             # docs/flair/capturas/*.png
```

Variáveis: `PW_CHROMIUM` (executável do Chromium, se não for o do Playwright), `DEMO_APP` (origem do app, padrão
`http://localhost:3000`), `DEMO_TRIM` (segundos cortados do início de cada clipe, padrão 1,6).

## Roteiros

| Modo | Sequência gravada |
|---|---|
| `matches` | Abre a peça → Converter para FLAIR → prévia (nível e nota) → Gerar carta → carta pronta → Partidas → Duelo 1×1 → Treinar com a Casa → rodadas e resultado |
| `cbc` | Lista de desafios → Montar → toca em cada vaga do mini mapa e escolhe a carta → requisitos e sintonia conferidos pelo servidor → Entregar → modal de recompensa |
| `moments` | Momentos → Calendário → evento → período e requisitos → Participar |
| `challenges` | Catálogo → Começar → modo → desafio aberto com progresso → Meus desafios |
| `cards`, `decks`, `shops`, `wallet`, `quests` | A tela da coleção correspondente em uso (álbum, decks, troca pelo cupom, cupom na carteira, resgate de missão) |

Cada clipe é uma gravação real da interface em ambiente de teste (o selo "Gravado no app em ambiente de teste"
aparece embaixo do vídeo na central). Se um dia um clipe for encenado, marque `recorded: false` em
`lib/flair/hub.ts`: a central passa a mostrar "Demonstração encenada".
