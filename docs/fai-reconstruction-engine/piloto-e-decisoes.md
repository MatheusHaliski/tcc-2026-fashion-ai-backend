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
