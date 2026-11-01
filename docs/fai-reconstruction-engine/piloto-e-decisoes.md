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

## Pendências conhecidas (01/11/2026)

- Rodar a Fase 2 de verdade na A100 e repetir o piloto (qualidade do flat lay, tempo, custo reais).
- Validar com os modelos reais a escolha entre as três máscaras do SAM.
- Trocar a heurística de pele pelo SAM 3D Body (licença disponível; token só no `.env` da VM).
- Várias caixas para pares e kits (calçados, meias).
- Painel de revisão humana (hoje só pela API).
- CI da `main` com falhas antigas, fora deste serviço (testes do front, do catálogo Python e gitleaks), que impedem
  o deploy automático do backend no Railway.
