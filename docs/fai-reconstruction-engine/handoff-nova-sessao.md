# Prompt inicial para uma nova sessão do Claude Code (FAI Reconstruction Engine)

Cole o bloco abaixo como **primeira mensagem** na nova conta. Ele resume o estado em 01/11/2026 e a próxima
missão: rodar as Fases 1 e 2 do catálogo inteiro numa A100 alugada no RunPod, dentro de um orçamento de ~R$ 600.

---

```text
Você vai continuar o trabalho no FAI Reconstruction Engine do repositório MatheusHaliski/tcc-2026-fashion-ai-backend
(TCC FashionAI). Responda em português. Antes de qualquer ação, leia nesta ordem:
1. CLAUDE.md (limites de linhas por arquivo, checados no CI; rode `python -m scripts.refactoring.line_ratchet`
   antes de cada commit);
2. docs/fai-reconstruction-engine/ (README, arquitetura-e-fases, infraestrutura-e-operacao, piloto-e-decisoes,
   fase3-provador e este handoff-nova-sessao.md);
3. services/garment_gpu/README.md e services/garment_gpu/deploy/*.md.

## O que é
Serviço próprio (services/garment_gpu) que transforma a foto de uma peça do catálogo, muitas vezes vestida por
modelo, num produto final em flat lay: a peça sozinha, centralizada, esticada sobre uma superfície, sem corpo nem
"manequim fantasma". FastAPI + Redis/RQ (SimpleWorker) + RustFS (S3). Fase 1: Grounding DINO + SAM 2.1 (recorte).
Fase 2: Qwen-Image-Edit-2511 + LoRA lightx2v/Qwen-Image-Edit-2511-Lightning (arquivo
Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors, 8 passos, true_cfg 1.0) gera o flat lay de frente e
de costas. `mode=auto` roteia: foto de produto completa termina na Fase 1; peça vestida, ocluída ou cortada vai
para a Fase 2. Toda reconstrução fica pendente de aprovação humana. Fase 3 (planejada): o flat lay vira textura
dos moldes que vestem o avatar 3D do provador (docs/fai-reconstruction-engine/fase3-provador.md).
Integração: adaptadores Java GarmentGpuSegmentationAdapter e GarmentGpuImageEditAdapter (backend no Railway).

## Estado em 01/11/2026
- Código das Fases 1 e 2 na main (PRs #418 a #444), 63 testes em services/garment_gpu/tests passando.
- Catálogo: 14.321 produtos (MySQL do Railway, tabela catalog_products/catalog_images). Piloto de 200: 56% com
  pessoa → ~8.100 peças para a Fase 2 → ~16.200 imagens (frente + costas).
- GCP: VM fai-gpu-1 em us-east4-c, g2-standard-12 (L4 24 GB, 48 GB RAM), sem IP público, Cloud NAT, SSH pelo IAP,
  API publicada pelo Tailscale Funnel. Fase 1 ~2–2,6 s/foto. Fase 2 em nf4 + offload: ~77 s/imagem (3 gerações em
  3 min 51 s) → ~350 h para o catálogo: lenta demais. Sobras para apagar depois (o usuário executa): VM antiga
  fai-gpu-1 em us-west4-a (parada), imagem de máquina fai-gpu-1-img, Cloud NAT/routers de us-west4.
- Pedido de cota de A100 na GCP aberto (resposta prevista ~04/11; o pedido anterior de 2 GPUs foi negado por o
  projeto ser novo). Vultr descartada: sem A100/H100 de 1 GPU disponível e o cartão não aceitou o crédito
  promocional (deploy/VULTR_A100.md fica só como referência).
- NÃO VALIDADO: o primeiro flat lay da Fase 2 saiu como ruído sobre a silhueta. Causa provável corrigida no #443
  (agendador da destilação do Lightning: shift 3, sem shift_terminal; o worker recusa LoRA não aplicado). Ainda
  falta ver um flat lay limpo. Isso é a primeira coisa a validar.

## Missão: catálogo inteiro numa A100 do RunPod com ~R$ 600
Orçamento: ~R$ 600 de crédito pré-pago → ~US$ 100 depois do câmbio e do IOF (o usuário confere o valor exato).
Preços de referência (confirmar no painel; as fontes divergem): A100 80 GB Community Cloud ~US$ 1,19–1,59/h,
Secure Cloud ~US$ 1,49–1,79/h; cobrança por segundo; network volume US$ 0,07/GB/mês (cobra parado ou ligado);
container disk apaga ao parar. Preferir Secure Cloud (fotos com pessoas; LGPD) se a diferença for pequena.

Divisão de trabalho (decidida em 01/11): a Fase 1 do catálogo inteiro roda NO MAC do usuário (M3 Pro 18 GB, GPU via
MPS, grátis; guia services/garment_gpu/deploy/MAC_PHASE1.md, script scripts/catalog_local.py, que retoma de onde
parou e gera phase2_ids.txt). O RunPod recebe SÓ a lista da Fase 2 (`catalog_batch --ids-file phase2_ids.txt`).
A Fase 2 não cabe no Mac (~58 GB; bitsandbytes é só NVIDIA).

Divisão do orçamento (US$ 100):
| Item | US$ |
|---|---|
| Network volume 150 GB por 1 mês (pesos ~70 GB, imagens, jobs) | ~11 |
| Instalação, download dos pesos, testes (~3 h) | ~5 |
| Refazer a Fase 1 no servidor só para as peças da lista (~8.100 × ~1 s ≈ 2–3 h) | ~4 |
| Reserva (falhas, novas tentativas) | ~10 |
| Fase 2 | ~70 → ~45–50 h de A100 |

Conta-chave: ~16.200 imagens em ~47 h exige ≤ ~10 s/imagem. A100 80 GB em bf16 completo (RECON_QUANTIZE=none,
RECON_OFFLOAD=none) é estimada em ~8–12 s (não medido). Por isso a execução tem portões:
1. Teste de 10 fotos da lista → medir s/imagem real (log "Successfully completed ... in"). Projeção:
   custo_fase2 = imagens_restantes × s_por_imagem / 3600 × preço_hora.
2. Se não couber: (a) RECON_MAX_ATTEMPTS=1 (obrigatório desde o início); (b) primeira passada só de frente
   (RECON_BACK_VIEW=false; ~8.100 imagens) e costas depois, se sobrar crédito; (c) RECON_MAX_SIDE=768 (~1,7× mais
   rápido, menos detalhe). Nunca reduzir a qualidade sem o usuário aprovar.
3. Piloto de 200 da lista → revisão humana das miniaturas com o pod PARADO (parado só cobra o volume).
4. Resto da lista em lotes de 2.000 (`--ids-file ... --limit 2000 --offset N`), conferindo o saldo a cada lote.
5. Ao terminar: baixar os resultados, apagar pod e volume.

## Primeira tarefa de código (antes de o usuário criar o pod)
Pod do RunPod é contêiner, sem Docker dentro: o compose não roda. Criar, num único PR para a main:
- services/garment_gpu/scripts/runpod_start.sh: sobe dentro do pod (template PyTorch/CUDA 12 do RunPod) o
  redis-server e o RustFS (binário 1.0.4) só em 127.0.0.1, a API (uvicorn na porta 8000, exposta como HTTP port
  do RunPod → URL https://<pod-id>-8000.proxy.runpod.net), o worker de segmentação e o de reconstrução
  (WORKER_STAGE=segment/reconstruct), HF_HOME e dados no volume (/workspace), instala as dependências de
  requirements-segment.txt e requirements-reconstruct.txt numa venv no volume (instala uma vez só), reinicia
  processo que cair e grava logs em /workspace/logs. Ler compose.yaml, Dockerfile.api e Dockerfile.worker para
  reproduzir as mesmas variáveis e comandos.
- services/garment_gpu/deploy/RUNPOD.md: escolha do pod (A100 80 GB, 1 GPU, não interruptible), network volume
  150 GB, porta HTTP 8000, segredos como variáveis do pod (Secrets do RunPod) digitadas pelo usuário a partir dos
  arquivos dele, nunca pelo chat; teste, piloto, lotes, parar/apagar; troca da URL no Railway e no Mac.
- Testes onde couber (ex.: parse de configuração) e line_ratchet sem violações.
Depois do PR: o usuário cria o pod e roda os comandos; você analisa as saídas e as miniaturas que ele enviar.

## Onde ficam os segredos (só NOMES aqui; valores nunca no chat, em log, commit ou PR)
- .env do servidor de GPU (hoje na VM da GCP, em ~/fashionai/services/garment_gpu/.env): FAI_API_KEYS (só
  SHA-256), REDIS_PASSWORD, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, METRICS_PUBLIC=false, RETENTION_DAYS,
  PRIVATE_BIND, HF_TOKEN (licença do SAM 3D Body, Fase 3), RECON_QUANTIZE, RECON_OFFLOAD, RECON_LORA_PATH,
  RECON_LORA_WEIGHT_NAME, RECON_STEPS=8, RECON_TRUE_CFG=1.0, RECON_MAX_ATTEMPTS, RECON_BACK_VIEW,
  RECON_MAX_SIDE, SEGMENT_GPU, RECONSTRUCT_GPU.
- ~/fai-garment-keys.txt na VM: chaves em texto puro (linha ADMIN=... e a do backend). Ler com
  `$(sed -n 's/^ADMIN=//p' ~/fai-garment-keys.txt)` dentro de comandos, sem imprimir.
- Railway (backend Java): GARMENT_GPU_URL e GARMENT_GPU_API_KEY (opcionais GARMENT_GPU_*_TIMEOUT_SECONDS,
  GARMENT_GPU_DELETE_AFTER_DOWNLOAD, GARMENT_GPU_EDIT_COST_USD). Trocar só a URL ao mudar de servidor.
- Mac do usuário, ~/fai-catalog.env (lote do catálogo, leitura apenas): MYSQL_HOST, MYSQL_PORT, MYSQL_USER,
  MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_SSL_MODE, FAI_API_URL, FAI_API_KEY. Rodar da raiz do repositório:
  `cd ~/fashionai && set -a; source ~/fai-catalog.env; set +a && ~/.venv-fai/bin/python -m
  services.garment_gpu.scripts.catalog_batch ...`.
A sessão na nuvem do Claude não precisa de nenhum desses segredos.

## Conectores e ambiente desta conta
- Obrigatório: GitHub (app do Claude com acesso ao repositório; PRs pelas ferramentas mcp__github__*).
- Ambiente do Claude Code na web com rede para github.com, pypi.org, download.pytorch.org e huggingface.co
  (testes rodam em CPU: `pip install -r services/garment_gpu/requirements-test.txt`, torch CPU e
  `requirements-reconstruct.txt` para os testes de reconstrução).
- Opcionais: Gmail (respostas de cota do Google Cloud), Vercel (frontend), Trello. Railway, RunPod e GCP não têm
  conector: o usuário executa e cola as saídas.

## Regras de trabalho
- Você não executa nada pago (criar/ligar VM ou pod, comprar crédito), não faz deploy, não roda migrations, não
  escreve no banco de produção (scripts de escrita: ensaio por padrão e `--apply` só pelo usuário).
- Segredos nunca no chat: se o usuário colar uma chave, peça a rotação.
- Um PR por vez, direto para a main; não empilhar branches. Rodar os testes e o line_ratchet antes do commit.
- O usuário roda comandos em três lugares; sempre diga onde: Mac (prompt Matheuss-MacBook-Pro), VM/pod (prompt
  da máquina) ou painel web. Já houve confusão entre Mac e VM.
- Não colocar id do projeto GCP nem a URL do Funnel/pod nos documentos versionados.
- Registrar decisões e medições em docs/fai-reconstruction-engine/piloto-e-decisoes.md.

## Pendências depois do catálogo
Fase 3 itens 2–4 (gravar o flat lay aprovado no photoSet com ensaio/--apply; mapeamento por painéis no avatar;
SAM 3D Body na análise); detecção de pares e kits (várias caixas); painel de revisão humana; CI da main com falhas
antigas fora deste serviço (vitest do front, testes Python do catálogo, gitleaks).

Se o usuário ainda estiver rodando a Fase 1 no Mac, ajude com MAC_PHASE1.md e analise o relatório (index.html,
summary.json) que ele enviar. Comece confirmando que leu os documentos e então implemente a primeira tarefa de
código.
```
