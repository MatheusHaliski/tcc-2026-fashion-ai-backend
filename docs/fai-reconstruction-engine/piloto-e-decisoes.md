# Piloto com produtos reais e registro de decisões

## Piloto de 01/11/2026 — 200 produtos do catálogo

Amostra determinística de 200 dos 14.321 produtos (`catalog_batch --limit 200`), uma foto por produto, Fase 1 na L4.
A classificação abaixo é a do critério **antigo** (antes do #429), que ainda não mandava toda peça vestida para a
Fase 2.

| Resultado | Fotos |
|---|---|
| Com modelo, peça inteira visível | 74 |
| Peça sozinha (foto de produto), completa | 65 |
| Peça cortada pela borda da foto | 28 |
| Mão/braço sobre a peça | 5 |
| Falhou | 28 |

- **56% das fotos têm pessoa** (97 de 172 processadas). Projeção no catálogo: ~8.100 peças precisam da Fase 2.
- Corte pela borda (28) foi muito mais comum que oclusão por braço (5): fotos de catálogo enquadradas no tronco.
- **Falhas:** 14 recusas 422 sem motivo registrado (o cliente só guardava o status; corrigido no #428), 8 máscaras
  acima de 92% do quadro (fotos de produto bem recortadas), 2 sem peça detectada, 2 links quebrados (404), 2 URLs
  com acento (corrigido no #428).

### O que a revisão visual mostrou (e os números não)

A grade do relatório revelou erros que as métricas classificavam como "completo":

| Erro observado | Exemplos | Causa | Correção (#429) |
|---|---|---|---|
| Produto final mostra o **corpo** e não a peça (grave) | cabelo no lugar da blusa (3), pernas no lugar do short (2), mancha de pele (1) | o SAM, com uma máscara só, pegou o objeto de maior contraste na caixa | três máscaras + escolha pela caixa; recusa `MASK_OUTSIDE_DETECTION` |
| Recorte errado dentro da peça (mão/braço na frente) | blusas com mão na cintura | o preenchimento de buracos colava a mão no recorte | buracos de pele ficam abertos; Fase 2 repinta |
| Peça com forma de corpo ("vestimenta fantasma") | todas as fotos com modelo | a Fase 1 só preserva pixels reais | toda peça vestida vai para a Fase 2, que gera flat lay |
| Calçados e acessórios "sem mudança" | tênis, relógio, boné | o lote usava o quadro original | lote passou a usar o enquadramento centralizado |
| Só o logotipo de uma camiseta preta | 1 | peça escura em fundo escuro | sem correção automática ainda; vai para revisão |
| Só uma meia de um kit de três | 1 | o detector escolhe uma caixa | pendente: várias caixas para pares e kits |

Também ficou claro que a detecção de pele por cor confunde roupa bege/creme/rosa com pele (25% de falsos suspeitos
num primeiro critério), o que motivou o plano de usar o SAM 3D Body.

## Decisões e porquês

| Decisão | Alternativa descartada | Por quê |
|---|---|---|
| Workers com `SimpleWorker` (sem fork) | worker padrão do RQ | o padrão recarregava os pesos a cada foto e fazer fork com CUDA iniciado é inseguro |
| RustFS + rclone | MinIO | imagens do MinIO saíram do Docker Hub |
| Tailscale Funnel | Cloudflare Tunnel, IP público | sem domínio próprio; a política da organização proíbe IP público |
| VMs sem IP público + NAT + IAP | desligar a política da organização | menos superfície de ataque, sem pedir permissão de admin da organização |
| Rotear pelo servidor (`mode=auto`) | cliente decidir | a decisão depende da máscara, que só o servidor tem |
| Toda peça vestida → Fase 2 | só ocluída/cortada | a Fase 1 nunca estica tecido; o produto final é flat lay |
| Recusar máscara suspeita | entregar e revisar depois | um recorte com o corpo no catálogo é pior que nenhum |
| Lightning (8 passos) | 40 passos | ~5× mais rápido e barato; qualidade a confirmar no próximo piloto |
| Fase 3 por textura nos moldes do avatar | malha `.glb` gerada da foto | o avatar já veste moldes com esqueleto; malha gerada é estática e exigiria retopologia e pesos de pele |
| Fases 1 e 2 numa única A100 80 GB (`fai-gpu-1`) | L4 com Fase 2 em 4 bits; segunda VM só para a Fase 2 | cota de uma GPU; na L4 a Fase 2 precisou de 4 bits, offload e 48 GB de RAM e levou ~77 s por imagem (~350 h para o catálogo) |
| Pilha inteira numa A100 da Vultr (`deploy/VULTR_A100.md`); GCP parada como reserva | esperar a cota de A100 na GCP (~2 dias úteis, já negada uma vez) | crédito de conta nova e A100 sem pedido de cota; na Vultr a VM desligada cobra, então ela é destruída ao fim de cada lote |
| Fase 1 do catálogo no Mac (M3 Pro, MPS); GPU alugada só para a lista da Fase 2 | catálogo inteiro na GPU alugada | a Fase 1 cabe no Mac e sai de graça; todo o crédito do RunPod vai para a Fase 2, que o Mac não roda (~58 GB) |
| Vultr descartada; RunPod com crédito pré-pago | Vultr | Vultr sem A100/H100 de 1 GPU disponível e cartão recusado para o crédito promocional |
| Pod do RunPod com processos vigiados por `scripts/runpod_start.sh` (sem Docker); venv, pesos, Redis e RustFS no network volume | reproduzir o compose dentro do pod | o pod é um contêiner sem Docker; com tudo no volume, um pod novo (outra máquina, mesmo template) sobe em ~2 min, então parar/encerrar entre lotes não perde nada |
| Agendador próprio para o LoRA Lightning | agendador padrão do Qwen | com o padrão, o primeiro flat lay saiu como ruído sobre a silhueta (8 passos sem o `shift` da destilação) |
| `catalog_batch` baixa também as costas (`backs/<id>.png`) antes de apagar o job; erro ao baixar marca a foto como falha e não apaga o job | guardar só a imagem final | as costas custam tanto de GPU quanto a frente e só existiam no servidor: o lote as descartava |
| Lista da Fase 2 em `mode=reconstruct` (padrão com `--ids-file`), `retry_ids.txt` e checagem de `/health` antes do lote | `mode=auto` para tudo | no `auto`, foto enviada com o worker da Fase 2 recarregando volta só com o recorte, sem erro; no teste do RunPod a URL antiga (VM desligada) e a porta não exposta falharam em silêncio |
| `runpod_start.sh` escolhe a pasta dos pesos pelo que já está no volume, instala torch+torchvision pelo driver e só diz "pronto" com os dois workers no Redis | seguir o `HF_HOME` da imagem e o torch do `python3` | em 02–03/11 a imagem `runpod/pytorch` 1.4.0 veio sem torch no `python3` e com outro `HF_HOME`: o pip trouxe torch sem torchvision, os 58 GB começaram a baixar de novo e duas fotos foram enviadas antes da Fase 2 carregar |
| Flat lay aprovado no Total frame por colunas próprias (`flat_lay_*`, V85), com selo IA e o recorte real como fallback | gravar nas colunas `whole_*` | `whole_*` é o contrato `WHOLE_FRAME_V3` de pixels reais (SHA da origem, preflight): o flat lay passaria por recorte real e o `process_whole_frames` o sobrescreveria |
| Flat lay aplicado ao card do produto por último (`CatalogFlatLayFrame.onCard`), em qualquer caminho | só no `wholeFrame` do recorte real | em 03/11 os 83 primeiros flat lays foram gravados (`83 APPLIED`) mas o app mostrava o asset padrão: produtos com photo set saíam em modo `DEFAULT` antes de o flat lay ser consultado, e a interface priorizava o `DEFAULT` sobre o Total frame |
| Aprovação humana de toda reconstrução | aprovação automática pelo QA | o QA não certifica logotipos, escudos e textos |

## Primeiro teste da Fase 2 (L4, 01/11/2026)

| Problema | Causa | Correção |
|---|---|---|
| `CUDA out of memory` em todo job | pesos em 4 bits (~17 GB) todos na GPU ao lado da Fase 1 | `RECON_OFFLOAD=model` com nf4 (#435) |
| Worker morto pelo kernel, API sem responder | offload põe ~19 GB de pesos na RAM; 32 GB não bastaram | `g2-standard-12` (48 GB) |
| L4 esgotada em `us-west4-a` e `us-west4-c` | falta de estoque do Google | VM recriada de uma imagem em `us-east4-c` |
| Fotos recusadas (> 16 MP, formato) | fotos do catálogo fora do contrato da API | lote reduz e converte (#436, #437) |
| Flat lay com ruído sobre a peça | LoRA Lightning com o agendador errado | agendador da destilação |
| ~77 s por imagem, ~4 min por peça | L4 em 4 bits com offload | troca para A100 (`deploy/A100_SINGLE.md`) |

## Teste da Fase 2 na A100 do RunPod (02/11/2026)

Pod Secure Cloud com A100-SXM4-80GB: modelo completo em bf16 (57,5 GB de VRAM com a Fase 1), LoRA Lightning aplicado
em 720 camadas, agendador da destilação, pesos carregados em 157 s a partir do network volume. Amostra de 20 produtos
do catálogo em `mode=auto` (a lista da Fase 1 no Mac ainda não existia): 18 processados até a cópia dos resultados,
11 com Fase 2 (frente + costas), 7 só com a Fase 1. O tempo por imagem não foi medido (o `audit.jsonl` só é gravado
no fim do lote e foi copiado antes; o log do worker ficou no volume).

**O ruído sumiu:** todos os flat lays saíram nítidos, em fundo branco, centralizados e sem corpo. As fotos de produto
da Fase 1 (gorro, relógio, chinelo, meia) estavam corretas. Mas só ~3 das 11 reconstruções serviriam ao catálogo:

| Erro observado | Exemplos | Causa | Correção |
|---|---|---|---|
| Estampas, logotipos, textos e etiquetas inventados | estampa no peito de uma camiseta lisa, texto na lateral da legging, logo na barra, etiquetas no pescoço, bordado na gola | com o Lightning, `true_cfg = 1.0`, e nesse valor o diffusers **ignora o prompt negativo**; o prompt ainda pedia "foto de e-commerce" | proibições no prompt positivo (`prompts.py`: "o que é liso nas fotos fica liso"), sem "e-commerce" |
| Estrutura inventada quando a foto corta a peça | manga curta virou manga longa; gola alta virou gola redonda | a foto mostra só o tronco e o lote não mandava o nome do produto | o prompt fixa tipo, gola, manga e comprimento da foto; o lote envia nome e cor do catálogo |
| Mão sobre o tecido virou vazado "de design" | blusa verde com recorte na cintura, frente e costas | o espaço da mão chegava branco à Fase 2; e a Fase 1 nem deixava o buraco aberto (os buracos de pele eram procurados numa máscara já preenchida) | Fase 1 nunca acrescenta pele ao preencher buracos; antes da Fase 2 o espaço da mão (buraco ou "dente" na borda) recebe a cor do tecido vizinho (`reference.py`) |
| Calçado transformado em roupa | tênis virou conjunto de pijama; sandália virou uniforme | sapato encostando na borda contava como peça cortada; o prompt só falava de roupa | calçados e acessórios não vão para a Fase 2 no `auto`; em `mode=reconstruct` usam prompt de foto de produto |
| Frente e costas de cores diferentes | camisa cinza: frente preta, costas azul-marinho | o QA comparava cada vista só com a foto | QA das costas compara com a frente: `BACK_COLOR_MISMATCH` |
| Objeto errado | mulher sentada: saiu uma calça cor de caramelo (a cadeira) | pose confusa; o detector escolheu a cadeira | **sem correção automática ainda**: a cor da cadeira e a do vestido diferem só ΔE ≈ 13, então um filtro pela cor cadastrada não separa os dois; fica para a revisão humana e para o SAM 3D Body |

## Pendências conhecidas (01/11/2026)

- Repetir os mesmos 20 produtos no RunPod com as correções de 02/11 e medir o tempo por imagem.
- Validar com os modelos reais a escolha entre as três máscaras do SAM.
- Trocar a heurística de pele pelo SAM 3D Body (licença disponível; token só no `.env` da VM).
- Várias caixas para pares e kits (calçados, meias).
- Painel de revisão humana (hoje só pela API).
- CI da `main` com falhas antigas, fora deste serviço (testes do front, do catálogo Python e gitleaks), que impedem
  o deploy automático do backend no Railway.

## Etapa 3 — .glb da Meshy do lote do Codex (03/11/2026)

**Pacote** `fashionai-mysql-mac.tar.gz` (1,16 GB, `transfers/meshy/<data>/` no bucket): SHA256SUMS conferido. Não
traz dump de banco nem .glb soltos: os .glb estão dentro do SQLite `generated-glbs.sqlite3` (formato
`FAI_GLB_ARCHIVE_V1`), em pedaços de 1 MiB (`glb_files` → `glb_file_parts` → `glb_blobs`). São 146 produtos ×
5 arquivos (`base` + P/M/G/GG, a mesma malha escalada "relative visual scaling only"); só o `base` é usado.
Os ids do Codex são 20 hex, não o UUID do catálogo: a ligação é pela URL oficial (única por cor) e, sem ela, por
marca + nome (nome repetido entre cores = ambíguo, não entra).

**Medições (146 .glb base, meshy-6-lite, exportados pelo Blender):**

| Medida | Valor |
|---|---|
| Triângulos | 28.251–31.430 (mediana 31.046), 1 malha, 1 material PBR |
| Texturas | 3 × 2048 px (cor JPEG, metal/rugosidade JPEG, normal map **PNG**) |
| Tamanho | 4,8–13,7 MB (mediana 8,1): 133 acima do perfil WEB (6 MB), 4 acima de 12 MB |
| Versão WEB (só texturas) | 113 com normal → JPEG, 24 com texturas em 1024 px, 9 já cabiam; máx. 5,96 MB, mediana 4,69 |
| Espessura (Z / maior lado da frente) | mediana 0,15; 11 abaixo de 0,10 (relevo: `THIN_PROFILE`, REVISAR); 1 jeans com 0,03 |
| Escala | normalizada (maior lado ≈ 1,9), sem medida da marca: cada tela encaixa o modelo na caixa da peça |
| Revisão do Codex | 136 sem pessoa visível; 9 em quarentena por artefato; 1 com manequim → os 10 viram RUIM |

Renders de frente, lado e costas (three.js no Chromium) de 20 peças, com a foto oficial ao lado: a frente
reproduz cor, estampa e logo; as costas dos aprovados pelo Codex são plausíveis; as quarentenas têm defeito real
(costas cinzas na Vans infantil, torso de manequim no VMCHITA, punhos escuros nos VMWILLOW); de lado, camisetas,
jeans e regatas ficam finos.

**Decisão — onde o modelo entra:** tabela nova `catalog_product_models_3d` (V97), não `garment_assets_3d`. O
`garment_assets_3d` é o asset que veste o avatar (esqueleto, GarmentFitGate); o .glb da Meshy não tem esqueleto nem
métricas de vestir, e marcar APPROVED sem elas furaria o gate. O modelo do produto (PUBLISHED) vai como
`model3dUrl` no card do catálogo (lista, busca, detalhe) e é copiado para `wardrobe_items.model3d_url` (o campo de
vitrine do RF16) quando a pessoa leva a peça; o `--apply` também preenche as peças que já vieram desse produto.

**Onde aparece:** card do catálogo ("Ver em 3D"), card expandido da peça, painel 3D da peça, peça exposta no
Meu Quarto 3D e o manequim de cápsula (a reserva quando o avatar humano não carrega). **Onde não aparece:** em
corpo humano (provador, espelho, visualizador do look, desfile e o avatar do quarto), que continua com o molde
paramétrico vestido com a foto: um .glb rígido sem esqueleto atravessaria o corpo ao andar, sentar e levantar os
braços. Para vestir de verdade, cada modelo precisaria de rig + métricas (GarmentFitGate) e virar
`garment_assets_3d` APPROVED. Efeito colateral bom: a peça do catálogo com modelo chega ao provador como
`COMPLETED` e ele não pede outra geração RF16.

## Provador veste o `.glb` do produto (06/11/2026)

Pedido: o avatar do provador vestir o `.glb` da peça em vez do molde paramétrico, respeitando P/M/G/GG.

**SAM 3D Body não resolve isto:** ele reconstrói o *corpo* de uma pessoa numa foto (malha MHR, pose); não veste
roupa. O caminho usado é geométrico, sem IA nem GPU (nada pago): encaixe pela categoria, membros alinhados aos eixos
do avatar, volume onde a Meshy deixou a peça rasa, colisão, transferência de pesos de pele por membro e volta ao
repouso (detalhes em `fase3-provador.md`).

**Medido** (corpo feminino padrão, pose de exibição; render em Chromium/three.js em frente, lado, costas, braços
para frente, caminhada e agachamento):

| Peça (.glb WEB) | Resultado | Dentro do corpo | Esticamento p95 | Mais longe da pele |
|---|---|---|---|---|
| VMHARUKI Blazer, P (−1) | aceito | 0,01% | 1,44 | 6 cm |
| VMHARUKI Blazer, M (0) | aceito | 0,01% | 1,58 | 7 cm |
| VMHARUKI Blazer, GG (+2) | recusado (ESTICADA 1,87) → molde | — | — | — |
| Jeans VMRIVER, M | aceito | 0% | 1,00 | 9 cm |
| Camiseta Billabong (foto com manga aberta) | recusada (ESTICADA 1,87) → molde | — | — | — |

Tempo do ajuste: 0,55 s por peça (33 mil vértices), uma vez por corpo × peça × tamanho. As iterações que mais
contaram: pesos da manga pela altura do eixo do braço, corte da fusão manga × tronco, solda das costuras de UV
(1,8 s → 0,55 s e fim das fendas no jeans agachado) e limite do volume (espinhos de 60 cm na camiseta).

**Situação dos dados:** o `--apply` da importação ainda não rodou (nenhum `.glb` em `catalog/model3d/` no bucket);
até lá nenhum produto tem modelo e o provador segue com o molde.

## Geração dos `.glb` que faltam na RunPod: preparação (14/11/2026)

**Importação do lote do Codex:** o bucket de produção continua sem nenhum objeto em `catalog/model3d/` depois do 2º
`--apply`, então ele também não deixou nenhum `.glb` no bucket. O estado do banco não pôde ser lido da sessão na nuvem (o
proxy não deixa passar MySQL); a conferência fica com `scripts/catalog/audit_model3d_import.py`, rodado no Mac.

**Modelo escolhido:** Hunyuan3D 2.1, oficial, commit `82920d643c0dc2f7bfd7255f45f62d386edfe60c`.
- Licença: Tencent Hunyuan 3D 2.1 Community License. Não vale na UE, no Reino Unido nem na Coreia do Sul; acima de
  1 milhão de MAU exige licença à parte. O projeto (Brasil, TCC) está dentro do território e do limite.
- Memória (README): 10 GB para a forma, 21 GB para a textura, 29 GB para as duas no mesmo processo. Uma GPU de 24 GB
  não comporta as duas carregadas ao mesmo tempo; nesse caso a alternativa é o TRELLIS.2 4B (MIT, mínimo de 24 GB,
  `.glb` PBR).
- Ambiente: Python 3.10, PyTorch 2.5.1 + cu124 (`scripts/catalog/runpod_setup_hunyuan.sh`).
- **Vistas:** no código oficial, a forma usa uma imagem só e a pintura condiciona apenas por `input_images[0]`. Passar
  uma lista em `image_path` quebra a chamada (`image_prompt` fica sem valor). A geração usa a **frente** do flat lay
  aprovado. As costas são baixadas e servem só para a revisão. Usar as costas de verdade exige outro modelo de forma
  (Hunyuan3D-2mv aceita frente/costas/lados) ou uma alteração no código da pintura; nada disso entrou sem decisão.

**Decisão (14/11/2026): forma com o Hunyuan3D-2mv, textura com o 2.1.** A forma usa o Hunyuan3D-2mv (repositório
Hunyuan3D-2, commit `f8db63096c8282cb27354314d896feba5ba6ff8a`, pacote `hy3dgen`, Tencent Hunyuan 3D 2.0 Community
License, mesmo território), condicionado pela frente e pelas costas do flat lay (só pela frente quando não há costas). A
textura vem do 2.1, pela frente. Cada etapa roda num processo (`--stage shape`, depois `--stage paint`), então os
modelos não ficam carregados juntos: o pico esperado é o da textura (~21 GB) e uma GPU de 24 GB serve. Gerador gravado:
`hunyuan3d-2mv+2.1`.

**Fluxo:** `export_glb_batch.py` (Mac, só lê o banco) → `lote.csv` → `runpod_hunyuan_runner.py` (pod, `--stage shape` e depois `--stage paint`, grava só no volume) → `~/glb-hunyuan` → `import_meshy_glbs.py --generator hunyuan3d-2mv+2.1 --origin runpod` (ensaio; `--apply` só
com confirmação). O gerador e a origem vão para `catalog_product_models_3d.generator` e `metrics_json.import`.

**A medir no piloto:** GPU, VRAM de pico, segundos por produto, custo por hora e total, e as notas comparadas com a
Meshy (mesma régua do `glb_quality.py`, renders de frente, lado e costas).

## Provador com os `.glb` da Meshy (19/11/2026)

Uso dos 46 modelos já gerados na Meshy (um por subcategoria, `meshy-7.1`, lidos do bucket só para leitura) no
provador. **Nenhum uso novo de provedor, modelo ou GPU:** normalização, encaixe, pesos e tamanhos rodam na CPU, em
código do repositório (`lib/avatar3d/meshy`, `docs/provador/MESHY_GLB.md`). Custo de geração já registrado na tarefa
de cada modelo (30 créditos, ~3 min por modelo, no `tarefa.json` do lote). Tempo medido no preparo offline: ~10 s
para os 46 manifestos; no provador, a roupa leva o mesmo do glb-garment (~0,5–1,5 s por peça na CPU).

## Motor próprio em Blender no lugar da Meshy (24/11/2026)

**Decisão da dona (24/11/2026): parar de usar a API paga da Meshy** e modelar as peças do zero num motor próprio em
Blender, com medidas reais, tecido e detalhes de construção (gola, manga, barra, cós, costura, capuz, zíper, bolsos,
aberturas). Motivo imediato: o Stockton Sweater importado da Meshy saía enorme no provador mesmo no tamanho P, porque o
`.glb` da Meshy não tem medida e o provador o escala pelo corpo (a manga em pose T era esticada até o punho, até
1,5 × a escala do tronco).

- **Provedor/modelo:** Blender 4.2.0 como módulo Python (`bpy`, PyPI), na CPU. Nenhuma IA, nenhuma API, nenhuma GPU.
- **Custo:** zero. **Tempo medido** (4 vCPU): 1,5 s por peça e tamanho (malha, texturas, `.glb`, manifesto e
  relatório); 12,5 s com a prévia renderizada em Cycles (48 amostras, frente e ¾).
- **Código:** `services/garment_blender/` (README com a ficha técnica e o estado no provador). No provador, o manifesto
  `medidaReal` faz o encaixe usar escala 1 (`realScale` em `lib/avatar3d/human/glb-garment/align.ts`).
- **Cor:** mediana dos pixels da peça na foto de entrada ou na textura de cor do lote da Meshy já no bucket (só
  leitura); quando não há imagem, a cor da variante, dita na ficha (`observacao`).
- **Medido no provador (corpo padrão):** calças (cargo e joelho duplo), suéter, moletom careca e camiseta vestem em
  todos os tamanhos, com a manga caída em torno da articulação do ombro; os moletons com capuz são recusados (o capuz
  precisa de encaixe próprio).

## Peças de cima do catálogo em lote no motor Blender (25/11/2026)

Pedido da dona: produzir em 3D o máximo de peças do catálogo, começando pelas de cima, a partir das bases do motor,
com atenção à cor de cada peça, aos desenhos (estampa, logo e o lugar deles), aos bolsos, golas e mangas. Sugestão
dela no meio do trabalho, adotada: **a base de cada subcategoria é sempre o modelo do motor**; da foto sai só a pintura,
o desenho e o recorte (`services/garment_blender/README.md`, "Peças do catálogo em lote").

- **Provedor/modelo novo:** fashn-ai/fashn-human-parser (SegFormer, 18 classes de pessoa e roupa, pesos do Hugging
  Face, pacote `fashn-human-parser` no commit f2771f2f), na CPU (torch 2.15 CPU). Só separa a peça de cima, a pele e o
  rosto na foto; a cor, as listras, a estampa e os logos são lidos por código do repositório (`catalogo/`). Nenhuma API
  paga, nenhuma GPU. **Custo:** zero.
- **Tempo medido** (4 vCPU, sem GPU): carga do modelo 8–9 s por processo; 2,0–2,3 s por foto no segmentador (2–3
  núcleos, o tamanho da foto quase não muda: a rede trabalha em resolução fixa); 0,4 s de análise da foto; 1,5–3 s
  para montar o `.glb` no M; a prévia em Cycles (só no piloto) ~8 s. Download das fotos com ritmo por site (0,5 s, dobra
  a cada 429).
- **Fonte:** `data/catalog/expansion/products/*.jsonl`, 8.545 peças de cima (8.401 com foto). Pulados pelo nome:
  infantil, moda praia, parte de baixo e vestido listados como peça de cima.
- **Saída:** bucket de produção, prefixo novo do lote (`catalog/model3d/motor-blender-2026-11-25/`, nada existente
  sobrescrito), no formato dos lotes da Meshy; o banco não é tocado (a importação é a do `import_meshy_glbs.py`, com
  `--generator garment-blender-1 --origin local`).
- **Piloto (93 peças, 5 por subcategoria, 25/11):** 85 fichas, 7 puladas (infantil, parte de baixo, sem foto) e 1
  erro (foto de 192 px, corrigido). Pintura lida: 56 lisas, 20 com desenho ou logo, 5 estampas corridas, 4 listradas;
  comprimento ajustado pela foto em 8 (cropped de verdade, casaco longo). Todas montaram no motor (0 falhas) e as
  amostras conferidas no `glb_quality.py` saíram BOM. A revisão visual (foto × prévia) levou às regras que estão no
  código: V fundo e comprimento por subcategoria (blazer, casaco, colete, cardigã, quimono, parka), jaqueta jeans com
  botões e colarinho, "jeans" na descrição não faz a peça de jeans, a roupa de baixo aparecendo pela frente aberta, o
  cordão do capuz, o cadarço do zíper e o fundo da gola não viram desenho, blocos de cor não viram estampa corrida,
  capuz não conta como alto da peça, logo de manga, infantil pelo endereço.
