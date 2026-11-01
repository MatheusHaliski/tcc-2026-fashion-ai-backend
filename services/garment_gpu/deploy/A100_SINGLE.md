# Fases 1 e 2 numa única A100 80 GB

Decisão de 01/11/2026: com a cota de **uma** GPU, a `fai-gpu-1` deixa de ser L4 e passa a ser **A100 80 GB**
(`a2-ultragpu-1g`), rodando a API, o Redis, o RustFS e os workers das duas fases. Medido na L4: a Fase 2 em 4 bits
com offload levava ~77 s por imagem (~350 h para o catálogo). Na A100, o modelo roda completo (bf16, sem
quantização nem offload): mais qualidade e estimativa de ~5–10 s por imagem, a confirmar no piloto.

| | L4 (`g2-standard-12`) | A100 (`a2-ultragpu-1g`) |
|---|---|---|
| VRAM / RAM | 24 GB / 48 GB | 80 GB / 170 GB |
| Fase 2 | nf4 + offload, ~77 s/imagem | bf16 completo (~58 GB) + Fase 1 (~2 GB) |
| Custo de referência | ~US$ 1/h | ~US$ 5/h sob demanda |

Ligue para cada lote e desligue ao terminar (`gcloud compute instances stop`): o disco e os pesos ficam.

## 1. Cota (no console ou no Mac)
A cota global continua 1 GPU; a VM é a mesma, então basta a cota regional de A100 80 GB na região da VM:
```bash
gcloud compute regions describe us-east4 --format=json | python3 -c "import json,sys;[print(q['metric'],q['limit'],q['usage']) for q in json.load(sys.stdin)['quotas'] if 'A100' in q['metric']]"
```
`NVIDIA_A100_80GB_GPUS` precisa de limite ≥ 1. Se for 0, peça em IAM e administrador → Cotas.

## 2. Configurar a Fase 2 para a A100 (na VM, antes de desligar)
```bash
cd ~/fashionai/services/garment_gpu
sudo docker compose stop gpu-reconstruct
for kv in RECON_QUANTIZE=none RECON_OFFLOAD=none RECON_MAX_ATTEMPTS=2; do
  k=${kv%%=*}; grep -q "^$k=" .env && sed -i "s/^$k=.*/$kv/" .env || echo "$kv" >> .env
done
grep '^RECON_' .env
```
O LoRA Lightning (8 passos, `RECON_TRUE_CFG=1.0`) continua.

## 3. Trocar o tipo da máquina (no Mac)
```bash
gcloud compute instances stop fai-gpu-1 --zone=us-east4-c
gcloud compute instances set-machine-type fai-gpu-1 --zone=us-east4-c --machine-type=a2-ultragpu-1g
gcloud compute instances start fai-gpu-1 --zone=us-east4-c
```
Se a troca for recusada (mudança de série) ou a zona estiver sem A100 (`ZONE_RESOURCE_POOL_EXHAUSTED`), crie a VM a
partir de uma imagem em outra zona com A100 80 GB, como na mudança de zona da L4: imagem nova da VM parada
(`gcloud compute machine-images create fai-gpu-1-a100-img --source-instance=fai-gpu-1 --source-instance-zone=us-east4-c`),
NAT da região e `instances create fai-gpu-1 --source-machine-image=... --machine-type=a2-ultragpu-1g
--network-interface=network=default,no-address`. As zonas com A100 80 GB saem de
`gcloud compute accelerator-types list --format="value(name,zone.basename())" | awk '$1=="nvidia-a100-80gb"'`.
Nunca ligue duas VMs com o mesmo disco ao mesmo tempo (mesma identidade no Tailscale).

## 4. Subir tudo (na VM)
```bash
nvidia-smi --query-gpu=name,memory.total --format=csv     # NVIDIA A100-SXM4-80GB
cd ~/fashionai && git pull origin main && cd services/garment_gpu
sudo docker compose ps                                     # api, redis, storage, gpu-segment voltam sozinhos
sudo docker compose --profile reconstruct up -d --build gpu-reconstruct
sudo docker compose logs -f gpu-reconstruct                # "modelos carregados" com scheduler lightning
```
Em `/v1/admin/queues`, os dois workers devem mostrar `gpu: NVIDIA A100-SXM4-80GB`.

## 5. Voltar para a L4
Mesmo caminho ao contrário: `RECON_QUANTIZE=nf4`, `RECON_OFFLOAD=model`, `RECON_MAX_ATTEMPTS=1` e
`--machine-type=g2-standard-12` (ver `PHASE2_L4.md`).
