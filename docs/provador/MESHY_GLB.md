# Provador com os `.glb` da Meshy

Como o provador veste o avatar com os modelos 3D de produto gerados pela Meshy (`modelo-web.glb`: ~60 mil triângulos,
uma primitiva, texturas PBR, malha estática sem esqueleto). Piloto: 46 modelos, um por subcategoria, lidos do bucket
de produção **só para leitura** e servidos localmente. Nada foi gravado no bucket nem no banco.

## Pipeline

```
modelo-web.glb ──► scripts/meshy/preparar-glb.mjs ──► modelo-web.fit.json (manifesto, ao lado do .glb)
                         │  lib/avatar3d/meshy/{glb-read,analyze,slots}.ts
                         ▼
provador: use-garment-glbs.ts carrega .glb + .fit.json (sem manifesto: analyze.ts no próprio .glb)
   ├─ roupa (attach "wrap")   → glb-garment: encaixe, tamanho por região, colisão, forro, pesos da pele
   ├─ calçado (attach "rigid") → place.ts (pé de cada lado) + rigid.ts (peso 1 no osso do pé), pé fechado escondido
   └─ acessório ("rigid"/"conform") → place.ts (osso do slot) + rigid.ts / conformGarment (pesos do tronco)
```

### 1. Normalização (offline, com fallback no provador)

`scripts/meshy/preparar-glb.mjs <pasta> [--manifestos <pasta>] [--midia <pasta>]` lê cada
`<subcategoria>/<tarefa>/modelo-web.glb` (o `.glb` e o `tarefa.json` são dados: medidos, nunca executados) e grava
`modelo-web.fit.json`. O mesmo cálculo (`lib/avatar3d/meshy/analyze.ts`) roda no provador quando o `.glb` não tem
manifesto, então um modelo novo veste sem preparo — o manifesto só evita refazer a conta e guarda os ajustes manuais.

| Campo | Como é medido |
|---|---|
| eixo de cima | Y (convenção da Meshy, conferida nos 46) |
| frente / `giroY` | roupa e acessório: +Z. Calçado: o par vem de frente com o bico em +Z (giro 0); o avulso vem de lado com o bico em −X (giro +90°). A regra "o bico é a ponta mais baixa" errou no chinelo e na papete e ficou só como conferência (`heelByHeight`). |
| `centro`, `caixa` | caixa do `.glb`; o centro vira a origem (a origem da Meshy é arbitrária) |
| escala | roupa, calçado e acessório de cabeça/punho: pela medida do corpo do avatar no provador (ombros/cós, pé, cabeça, punho); acessório sem medida do corpo: `escalaNominal` = medida real do maior lado ÷ maior lado do modelo (bolsa 34 cm, mochila 46 cm, brinco 6,5 cm…) |
| `slot`, `osso`, `attach` | tabela por subcategoria (`slots.ts`); subcategoria nova cai na regra da categoria |
| `dicas.par`, `corteX` | maior vão em x entre 25% e 75% da largura (par: 2,3–48% da largura; peça única: ≤ 0,1%) |
| `dicas.abertura` | largura da copa (chapéu/boné/gorro), da frente (óculos) e do aro (pulseira) |
| `dicas.bracosAbertos` | topo da peça > 1,35 × a largura do tronco (nenhum dos 46 veio em T) |
| `dicas.sola`, `aberto` | sola nominal por subcategoria; sandália/chinelo/salto aberto não escondem o pé |
| `dicas.aceite` | aceite afrouxado do modelo, depois de conferido na tela (ajuste manual registrado) |
| `tamanhos` | fatores por passo da grade, por região (ver "Tamanhos") |
| `estado`, `motivo` | `veste`, `ajuste_manual` ou `sem_suporte` |

O manifesto vem do bucket como o `.glb`: `parseManifest` aceita só o formato esperado (versão, ossos conhecidos,
números finitos em faixas plausíveis) e fixa a convenção de tamanho; qualquer coisa fora disso vira o fallback.

### 2. Pesos e pose

- **Roupa**: o caminho do glb-garment já existente (`lib/avatar3d/human/glb-garment`): encaixe pelos ombros/cós,
  mangas e pernas giradas até o eixo do braço/perna, volume, colisão, transferência dos 4 pesos da pele mais próxima
  (manga só do braço do mesmo lado, perna só da perna), volta ao repouso e `SkinnedMesh` no esqueleto do corpo.
- **Calçado e acessório rígido**: peso 1 no osso de âncora (`LeftFoot`/`RightFoot`, `Head`, `Neck`,
  `LeftForeArm`, `LeftHand`, `Hips`, `Spine2`); a posição de repouso é a posada desfeita pela matriz do osso. A peça
  anda inteira com o osso.
- **Acessório flexível** (colar, cachecol): `conformGarment` (wrap.ts) — colisão com a pele do tronco e pesos
  transferidos dela, sem alargar nem dar volume.

### 3. Encaixe sem pele atravessando

- A pele debaixo da roupa vira **forro** na cor da peça (cover.ts). O pé dentro do calçado fechado (`coveredByShoe`)
  simplesmente não é desenhado: a malha do calçado da Meshy é fechada, e o forro na cor da bota aparecia como dedos
  onde o bico de uma bota de salto não alcança o pé plano do avatar.
- Correções no glb-garment feitas para os modelos da Meshy:
  - **punho abaixo da mão** (manga aberta ou comprida): era rotulado tronco, não girava com a manga e virava uma faixa
    larga na barra (o "espinho" do moletom). Agora a manga cresce pela malha (gêmeos da costura de UV incluídos) para
    o que está ligado a ela abaixo do punho e fora do tronco (`parts.ts → growCuffs`);
  - **faixa do tronco que não atravessa o meio do corpo** não é mais alargada em volta do próprio centro (`width.ts`);
  - **espinho** mede a distância até a pele com a cabeça incluída (o capuz caído fica perto da nuca, não do tronco);
  - **folga das camadas**: só conta a camada de baixo que veste a mesma região (a calça larga não engorda o peito do
    moletom — antes, todo top sobre a calça cargo era recusado como ESTICADA);
  - **calça debaixo da peça de cima**: os triângulos da calça de `.glb` inteiros acima da barra do top saem do índice
    (`meshy/tuck.ts`), como a pele debaixo da roupa;
  - **manga em T** (`dicas.bracosAbertos`): o giro máximo da manga até o braço passa de 1,4 para 1,8 rad.
- Tecido não é metal: a roupa de `.glb` usa `metalness = 0` (o mapa da Meshy deixava brilho de plástico molhado).

### 4. Tamanhos (aproximação visual relativa)

O tamanho escolhido no provador (PP…XG, 34…50, 33…46; `lib/tryon/sizes.ts`) muda a peça **por região**, com os fatores
do manifesto (`tamanhos.porPasso`), e não como escala uniforme:

| Peça | largura / passo | comprimento / passo | manga / passo |
|---|---|---|---|
| cima (malha: moletom, suéter) | 4% | 2% | 1,5% |
| cima (estruturada: blazer, parka) | 3% | 1,5% | 1,5% |
| cima (demais) | 3,5% | 2% | 1,5% |
| baixo, numeração | 2,2% | 1,2% | — |
| baixo, letras | 3,5% | 1,8% | — |
| calçado | 1,2% | 2,7% | — |

- roupa: a largura do tronco segue a diferença de tamanho de cada região (peito acima do Spine2, cintura no Spine,
  quadril abaixo), o comprimento cresce a partir do topo, a manga ao longo do braço e a perna ao longo da perna;
  o encaixe pelos ombros/cós e a folga da colisão usam a peça **sem** a parte comum do tamanho (`unsizedSpec`), para o
  tamanho não entrar duas vezes;
- calçado: comprimento e largura pelo número (`shoeScale`), limitado a ±4 números;
- a faixa considerada é `limite` (−3…+4 tamanhos): GG num corpo PP não vira uma tenda;
- o resultado passa pela mesma colisão: um tamanho menor cola na pele, nunca deixa a pele atravessar;
- marcado na geometria e no manifesto como `RELATIVE_VISUAL_APPROXIMATION`, `fitClaim: NONE`,
  `avatarMeasurementsChanged: false` — a mesma convenção do `SizeOptionsService` e do seletor de tamanho
  ("Tamanho M no 3D é uma aproximação visual relativa"). As medidas do avatar não mudam.

### 5. Desempenho

- Texturas acima de 1024 px (9 dos 46 vêm com 2048) são reduzidas uma vez ao carregar (`texture-budget.ts`); o `.glb`
  do bucket não muda.
- Calçado e acessório são O(n) (sem busca na pele, exceto o colar/cachecol); a roupa custa o mesmo do glb-garment
  (~0,5–1,5 s por peça na CPU, em cache por corpo × peça × tamanho × camadas).
- Geometrias e materiais clonados são descartados no desmonte do provador; texturas são do `.glb` em cache
  (`sharedTextures`).
- Não há decimação: 60 mil triângulos por peça couberam no provador; um acessório pequeno (brinco) ainda leva os 60
  mil — é o primeiro candidato a uma versão reduzida no preparo, se o orçamento apertar.

## Resultado por subcategoria

Legenda: **veste** = encaixa e segue a pose; **ajuste manual** = veste, com o defeito descrito (e/ou com o aceite
afrouxado e registrado no manifesto depois de conferido na tela); **sem suporte** = não vai para o avatar.
Números do corpo padrão (feminino, pose de exibição do provador, por cima de uma calça cargo e de um tênis):
`e` esticamento (p95 das arestas, limite padrão 1,8), `f` pele sob a peça que atravessa o pano (vira forro; padrão
3%), `l` maior distância até a pele (padrão 0,25 m), nos tamanhos P / M / GG (calça: 36 / 40 / 46). Fonte:
`lib/avatar3d/meshy/meshy-real.test.ts`.

### Parte de cima (8) — `wrap`, pesos da pele, tamanho por região

| Subcategoria | Estado | Medidas (P · M · GG) | Observação |
|---|---|---|---|
| hoodie | veste | e1,59 f2,3% · e1,53 f1,8% · e1,34 f1,7% | aceite e ≤ 1,95; capuz vira gola alta; vincos da malha rasa da Meshy |
| sweatshirt | veste | e1,96 · e1,80 · e1,54 (f ≤ 2,4%) | aceite e ≤ 2,2 |
| sweater | veste | e1,32 · e1,29 · e1,21 (f 2,3–3,2%) | aceite f ≤ 5% (no provador mediu 4,0%) |
| parka | veste | e1,57 · e1,56 · e1,44 (l 0,21–0,26) | aceite l ≤ 0,30; punho largo serrilhado |
| windbreaker | ajuste manual | e1,43 · e1,40 · e1,28 (f 2,1–2,4%) | aceite e ≤ 1,9 e f ≤ 5% (no provador: e1,73, f3,9%); a malha rala do peito mostra o forro em placas |
| blazer | ajuste manual | e1,49 · e1,47 · e1,35 (f 6,0–6,3%) | malha rala nos bolsos e na barra: furos mostram o forro e a camada de baixo |
| blouse | ajuste manual | e1,88 · e1,88 · e1,88 (f 6,4–6,7%, l 0,25–0,31) | blusa de ombro caído com babado: a manga bufante vira pano rasgado |
| shirt | ajuste manual | e1,81 · e1,67 · e1,68 (f 2,5–3,3%) | manga curta aberta: ao girar até o braço fica serrilhada e solta do tronco |

### Parte de baixo (7) — `wrap`

| Subcategoria | Estado | Medidas (36/P · 40/M · 46/GG) | Observação |
|---|---|---|---|
| cargo_pants | veste | e1,50 · e1,42 · e1,25 (f ≤ 1,6%) | |
| casual_pants | veste | e1,14 · e1,11 · e1,04 | |
| jogger_pants | veste | e1,12 · e1,13 · e1,12 | |
| sweatpants | veste | e1,18 · e1,18 · e1,14 | |
| shorts | veste | e1,20 · e1,05 · e1,07 | |
| bermuda_shorts | veste | e1,38 · e1,23 · e1,20 | |
| skirt | veste | e1,18 · e1,01 · e1,00 (l 0,30 no 36) | aceite l ≤ 0,32 (saia rodada longe da perna no tamanho menor) |

### Peça inteira

Nenhum modelo `full_body_piece` no lote do piloto. A regra existe (`slot: full`, caminho do glb-garment com tronco,
mangas e pernas), sem homologação na tela.

### Calçado (16) — `rigid`, osso do pé de cada lado, tamanho pelo número

| Subcategoria | Estado | Como veio | Observação |
|---|---|---|---|
| ankle_boots | veste | par, bico +Z | bota de cano curto com salto: o pé plano fica escondido dentro dela |
| long_boots | veste | avulso, de lado | cano até a panturrilha, por cima da calça |
| basketball_shoes, casual_sneakers, high_top_sneakers, running_shoes, skate_shoes, training_shoes | veste | avulso, de lado (espelhado no outro pé) | |
| derby_shoes, oxford_shoes, loafers, flats | veste | par, bico +Z | |
| espadrilles | veste | avulso | |
| sandals, flip_flops | veste | avulso / par | abertos: a pele do pé continua desenhada |
| heels | ajuste manual | avulso | o pé do avatar é plano: o salto fica sob o calcanhar, sem a pose de ponta de pé |

### Acessórios (15)

| Subcategoria | Estado | Osso / modo | Observação |
|---|---|---|---|
| beanie | veste | Head, rígido | pela largura da cabeça (+ cabelo) |
| cap | veste | Head, rígido | aba para a frente |
| hat | veste | Head, rígido | copa medida acima da aba |
| eyeglasses, sunglasses | veste | Head, rígido | pela largura do rosto na linha dos olhos |
| earrings | veste | Head, rígido | par: um em cada lóbulo, 6,5 cm |
| bow_tie | veste | Neck, rígido | 12 cm, na frente da gola |
| necklace | veste | pesos do tronco (`conform`) | 30 cm, por cima da roupa |
| bracelet | veste | LeftForeArm, rígido | aro no eixo do antebraço, pelo raio do punho |
| handbag, clutch | veste | LeftHand, rígido | alça na mão, de lado |
| crossbody_bag | ajuste manual | Hips, rígido | a alça transversal veio dobrada sobre a bolsa: fica no quadril sem a alça no tronco |
| backpack | ajuste manual | Spine2, rígido | alças rígidas: ficam atrás do ombro, sem passar por cima dele |
| scarf | ajuste manual | pesos do tronco (`conform`) | veio aberto e plano: vira uma faixa pendurada na frente, sem a volta no pescoço |
| belt | sem suporte | — | veio enrolado (foto do produto): não há a tira aberta para fechar na cintura |

Total: **37 vestem**, **8 com ajuste manual**, **1 sem suporte** (+ peça inteira sem modelo no lote).

### Evidências (`docs/provador/meshy/`, frente e ¾, corpo padrão feminino)

| Arquivo | O que mostra |
|---|---|
| `moletom-cargo-tenis-*` | moletom com capuz + calça cargo + tênis de corrida (cima, baixo, calçado) |
| `camisa-calca-oxford-*`, `parka-jogger-bota-*`, `sueter-bermuda-mocassim-*`, `moletom-sem-capuz-sweatpants-chinelo-*`, `corta-vento-calca-bota-alta-*`, `blazer-shorts-salto-*`, `blusa-saia-sapatilha-*` | demais tops, baixos e calçados |
| `bone-oculos-colar-pulseira-*`, `gorro-brincos-bolsa-*`, `chapeu-gravata-mochila-*`, `oculos-grau-cachecol-transversal-*`, `clutch-sandalia-espadrille-*` | acessórios (com `-detalhe-cabeca`) |
| `tamanho-P-*`, `tamanho-GG-*`, `tamanhos-P-x-GG.jpg`, `tamanhos-P-x-GG-pes.jpg` | o mesmo moletom, calça cargo e tênis em P/36/35 e GG/46/41 |
| `*-detalhe-pes.jpg` | calçado de perto |
| `manifestos/<subcategoria>.fit.json` | os 46 manifestos do piloto |

## O que ainda está errado e por quê

- **Malha rasa e fundida da Meshy**: a peça vem de uma foto, rasa de lado e com a manga colada ao tronco. O encaixe
  dá volume e corta a fusão, mas sobram vincos, punhos serrilhados e furos onde a malha é rala (blazer, blusa,
  camisa). Melhora de verdade pede gerar a peça já vestida/em T (outra foto ou outro modelo), não mais geometria.
- **Aceite afrouxado por modelo**: os 8 modelos de cima e a saia só passam com o limite afrouxado no manifesto. Num corpo bem
  diferente do padrão o aceite pode recusar a peça — então o provador volta ao molde, nunca mostra a peça quebrada.
- **Pé plano**: salto alto e bota de salto não têm a pose de ponta de pé; o calçado fica certo, o pé não.
- **Acessórios rígidos**: alça de mochila e de bolsa transversal não deformam; cachecol e cinto precisariam do modelo
  aberto (o da foto vem dobrado/enrolado).
- **Cabelo**: o chapéu mede o cabelo do avatar para não afundar nele, mas não o amassa; cabelo volumoso pode passar
  pela aba.
- **Tamanhos**: são aproximação visual relativa (sem tabela da marca); o tamanho menor que o corpo cola na pele pela
  colisão em vez de mostrar tensão no tecido.
- **Desempenho**: sem decimação; 60 mil triângulos por acessório (o brinco inclusive) e o encaixe da roupa na CPU.


## Testar localmente

1. `node scripts/meshy/preparar-glb.mjs <pasta-dos-glb> --manifestos docs/provador/meshy/manifestos --midia <midia>/media/catalog/model3d/meshy`
2. Sirva `<midia>` com CORS numa porta local (qualquer servidor estático) e suba o Next com
   `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:<porta> DEV_GATE_ENABLED=false next dev --webpack -p 3010`
   (abra por `localhost`, não `127.0.0.1`: o Next bloqueia o HMR de outra origem).
3. `/lab/scenes?s=fitting-neutral&pieces=meshy-hoodie,meshy-cargo_pants,meshy-running_shoes&sizes=letter:GG,numeric:46,shoes:41`
4. Evidências: `OUT=<pasta> BASE=http://localhost:3010 node scripts/meshy/capturar-provador.mjs`
5. Números no corpo padrão: `MESHY_GLB_DIR=<pasta> MESHY_REPORT=<arquivo> npx vitest run lib/avatar3d/meshy/meshy-real.test.ts`

## Para usar em produção (o que o dono precisa fazer — nada disto foi feito)

1. Importar os `.glb` pelo fluxo existente (`scripts/catalog/import_meshy_glbs.py`, ensaio e depois `--apply` com
   confirmação): ele grava `catalog/model3d/<uuid>/<sha>.glb` no bucket e o `model3d_url`
   (`/media/catalog/model3d/...`) em `catalog_product_models_3d` e nos itens do guarda-roupa. Só a URL de produto do
   catálogo (`isProductModel`) veste o avatar.
2. Gravar o manifesto ao lado de cada `.glb` com o mesmo nome: `catalog/model3d/<uuid>/<sha>.fit.json` (o
   `MediaProxyController` já serve `.json`). Sem ele, o provador mede o `.glb` na hora — veste igual, mas sem os
   ajustes manuais de aceite (`dicas.aceite`): blazer, blusa, camisa e moletom sem capuz tendem a voltar ao molde.
   Os manifestos do piloto estão em `docs/provador/meshy/manifestos/` (por subcategoria; o importador ainda não os
   envia — falta ligar o `preparar-glb.mjs` ao `--apply`).
3. Acessórios só aparecem no avatar quando a peça do look tem `model3d_url` (não há molde de acessório).

## Lote em pose T (19 a 23/11/2026)

As oito peças de cima foram geradas de novo na Meshy em formato de vestida: só a roupa, em manequim invisível, de
frente, com os braços abertos na horizontal e as mangas separadas do tronco (prefixo
`catalog/model3d/meshy-2026-11-19-pose-t/`, 300 créditos: 90 no piloto de blazer e blusa, 210 nas outras seis). O lote
de 18/11 trazia a manga colada ao tronco e a malha rasgava ao abrir a manga até o braço do avatar.

O que o provador passou a fazer para essas peças (tudo com teste; os 46 modelos de 18/11 mantêm o mesmo aceite):

| Problema visto na tela | Correção | Arquivo |
|---|---|---|
| a lateral e a barra largas eram rotuladas manga e giravam junto | a manga é o trecho de fora em que toda coluna acaba na metade de cima da peça | `glb-garment/parts.ts` (`spreadLimit`) |
| o forro do blazer atravessava o pano da frente | o avesso para 6 mm antes do direito na colisão | `glb-garment/depth.ts`, `wrap.ts` |
| a saia sumia onde a blusa de barra torta é curta | a peça de baixo some por setor em volta do corpo | `meshy/tuck.ts` |
| o moletom largo encolhia até o peito e a manga parava no cotovelo | escala pelo comprimento da manga (ombro ao punho), até 1,5 × a do tronco; a manga estica até 35% | `glb-garment/align.ts` |
| a parka comprida era recusada como espinho | a distância da barra até a pele conta a perna | `glb-garment/wrap.ts` |

Aceite no corpo padrão (P, M e GG por cima de calça e tênis): as oito passam nos três tamanhos, com esticamento entre
1,00 e 1,26 (camisa de manga curta: 1,59). Evidências em `docs/provador/meshy/pose-t/`; manifestos em
`docs/provador/meshy/pose-t/manifestos/`.

O que ainda aparece: a camisa de manga curta fica com a borda do ombro serrilhada; o suéter fica volumoso no tronco; a
barra do blazer tem uma linha fina em arco; a blusa tem riscos verticais do laço.
