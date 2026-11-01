# Infraestrutura e operação

## Visão geral

| VM | GPU | Papel | Rede |
|---|---|---|---|
| `fai-gpu-1` | 1× NVIDIA L4 24 GB (`g2-standard-4`) | API, Redis, RustFS, worker da Fase 1 | sem IP público; Cloud NAT para saída; SSH pelo IAP; API publicada em HTTPS pelo Tailscale Funnel |
| `fai-gpu-a100` | 1× A100 80 GB (`a2-ultragpu-1g`) | worker da Fase 2 | sem IP público; entra na fila e no armazenamento da `fai-gpu-1` pelo Tailscale |

Imagem das VMs: Deep Learning VM do Google (`common-cu129-ubuntu-2204-nvidia-580`, driver NVIDIA 580 já incluído).
Contêineres: Docker Engine + Compose; NVIDIA Container Toolkit configurado com `nvidia-ctk`.

## Como o ambiente foi montado (e os obstáculos)

1. **Cota de GPU zerada** (`GPUS_ALL_REGIONS = 0` em projeto novo): pedida e aprovada para 1. Para a Fase 2
   simultânea à L4 é preciso **2**, além da cota regional da A100.
2. **Conta errada no `gcloud`:** o projeto pertence a outra conta Google; foi preciso `gcloud auth login` com ela.
3. **Política da organização proíbe IP público em VM** (`constraints/compute.vmExternalIpAccess`): em vez de
   desligá-la, as VMs ficaram sem IP público, com Cloud NAT para baixar pacotes e pesos e SSH pelo túnel do IAP
   (regra de firewall só para a faixa `35.235.240.0/20`).
4. **Falta de estoque de GPU** (L4 e T4 esgotadas em `us-central1`): um script percorre regiões e zonas até achar
   vaga; a L4 saiu em `us-west4-a`. O mesmo método está em `scripts/gcp_reconstruct_vm.sh` para a A100.
5. **Sem domínio próprio:** o Cloudflare Tunnel exigiria um domínio; a API foi publicada pelo **Tailscale Funnel**
   (URL HTTPS fixa `*.ts.net`, certificado automático, sem porta aberta). O perfil `tunnel` (Cloudflare) continua no
   compose para quando houver domínio.
6. **Imagens do MinIO removidas do Docker Hub:** `minio/minio` e `minio/mc` deixaram de existir; o armazenamento
   passou a ser o RustFS (Apache-2.0, compatível com S3, lifecycle testado) e o backup, o rclone.

## Segurança

- Chaves de API por cliente, só o SHA-256 no `.env`; escopos separados. **Incidente:** as chaves iniciais foram
  coladas no chat de suporte e por isso foram **rotacionadas**; as antigas devolvem 401 (verificado).
- Nenhuma VM com IP público. Redis com senha, RustFS com chaves; abertos só para a rede interna e o Tailscale.
- O Funnel não filtra rotas, então: `METRICS_PUBLIC=false` (métricas exigem chave admin) e `/ready` só mostra o
  detalhe das dependências para chave admin.
- Limite de envios por minuto e de jobs ativos por cliente; formato da imagem verificado pelo conteúdo, teto de
  pixels antes de decodificar, EXIF descartado.
- Retenção: imagens expiram no bucket (`RETENTION_DAYS=30`); o backend apaga cada job após o download.
- Segredos nunca entram no git (`.env`, `worker.env` no `.gitignore`) nem no chat: os scripts geram e copiam os
  arquivos sem imprimir valores.

## Desempenho medido

| Medida | Valor |
|---|---|
| Fase 1 em CPU (validação sem GPU) | 10–15 s por foto |
| Fase 1 na L4 | **1,95–2,6 s por foto** (4,3 s no primeiro job, aquecimento do CUDA) |
| VRAM do worker da Fase 1 | 2,2 GB de 23 GB |
| Fase 2 na A100 | ainda não medida (estimativa: ~5–8 s por imagem com Lightning) |

## Custos (referência, preços sob demanda do GCP)

| Item | Estimativa |
|---|---|
| L4 (`g2-standard-4`) | ~US$ 0,7/h ligada |
| A100 80 GB (`a2-ultragpu-1g`) | ~US$ 5/h sob demanda, ~US$ 1,5–2/h spot |
| Fase 1 no catálogo inteiro (14.321 produtos) | poucos dólares |
| Fase 2 para ~8 mil peças vestidas, com Lightning | ~US$ 25–70 |
| Cloud NAT | ~US$ 1/mês por região + tráfego |

As VMs cobram por hora **ligadas**: desligue ao fim de cada lote (`gcloud compute instances stop …` ou
`scripts/gcp_reconstruct_vm.sh stop`). O disco e os pesos ficam.

## Operação do dia a dia

| Tarefa | Onde |
|---|---|
| Subir/atualizar o servidor central | `services/garment_gpu/README.md` (`docker compose up -d`) |
| Instalar a Fase 2 | `services/garment_gpu/deploy/PHASE2_GCP.md` |
| Rodar o lote/piloto do catálogo | `python -m services.garment_gpu.scripts.catalog_batch` (só lê o MySQL) |
| Ver filas e workers | `GET /v1/admin/queues` com a chave admin |
| Métricas e alertas | perfil `monitoring` (Prometheus, Grafana, DCGM) |
| Backup | `scripts/backup.sh` (bucket com rclone + RDB do Redis) |
| Gerar chave de cliente | `python -m services.garment_gpu.security <cliente> --scopes "submit\|read"` |
| Revisão humana | `POST /v1/jobs/{id}/review` |

No backend Java (Railway): `GARMENT_GPU_URL` (URL do Funnel) e `GARMENT_GPU_API_KEY` (chave com escopos
`submit|read`). Sem elas, nada muda no app.
