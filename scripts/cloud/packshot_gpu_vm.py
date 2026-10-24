#!/usr/bin/env python3
"""Packshots do catálogo (process_local_sd.py --engine fashn-open) numa VM spot com GPU na GCP.

    python scripts/cloud/packshot_gpu_vm.py --project P --zone southamerica-east1-c --bucket fashionai-packshot \
        --job 2026-10-24 --rows rows.json                      # só o plano: comandos, custo estimado, nada criado
    python scripts/cloud/packshot_gpu_vm.py … --apply --yes    # sobe o JSON, cria a VM (confirmação explícita)
    python scripts/cloud/packshot_gpu_vm.py … --status         # a VM já terminou? (gs://…/out/DONE)
    python scripts/cloud/packshot_gpu_vm.py … --fetch ./saida  # baixa output_images, report.jsonl, metadata_clean.json

O que a VM faz (startup-script): clona a branch, instala requirements-fashn-open.txt, baixa e confere os pesos fixados
(fashn_open.py download), roda o lote com --dry-run (gera PNG + relatórios; NUNCA escreve no banco), envia tudo para
gs://BUCKET/jobs/JOB/out/ e se apaga. --max-run-duration apaga a VM mesmo que o script trave: o custo tem teto.
Credenciais: só o gcloud já autenticado no ambiente; nada é lido do chat nem impresso. Sem --apply nada é criado.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_URL = "https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend.git"
IMAGE_FAMILY, IMAGE_PROJECT = "pytorch-latest-gpu", "deeplearning-platform-release"   # CUDA pronto; driver via metadado
GPU = {
    # preços aproximados de southamerica-east1 (US$/h, VM + GPU); conferir em cloud.google.com/compute/gpus-pricing
    "t4": {"machine": "n1-standard-8", "accelerator": "nvidia-tesla-t4", "spot_usd_h": 0.30, "ondemand_usd_h": 0.95,
           "seconds_per_photo": 2.2, "sd_seconds": 5.0},
    "l4": {"machine": "g2-standard-8", "accelerator": None, "spot_usd_h": 0.45, "ondemand_usd_h": 1.10,
           "seconds_per_photo": 1.4, "sd_seconds": 2.5},
}
SETUP_HOURS = 0.25                     # boot, driver, pip e download dos pesos (~1,4 GB)


def validate(project: str, zone: str, bucket: str, job: str, branch: str) -> None:
    if not re.fullmatch(r"[a-z][a-z0-9-]{4,61}[a-z0-9]", project):
        raise ValueError("projeto inválido")
    if not re.fullmatch(r"[a-z]+-[a-z]+[0-9]-[a-z]", zone):
        raise ValueError("zona inválida (ex.: southamerica-east1-c)")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]", bucket):
        raise ValueError("bucket inválido")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,40}", job):
        raise ValueError("job: só minúsculas, dígitos e hífen")
    if not re.fullmatch(r"[A-Za-z0-9._/-]{1,120}", branch) or ".." in branch:
        raise ValueError("branch inválida")


def estimate(gpu: str, photos: int, with_sd: bool, min_interval: float = 1.0, max_hours: float = 6) -> dict:
    spec = GPU[gpu]
    per_photo = max(spec["seconds_per_photo"] + (spec["sd_seconds"] if with_sd else 0), min_interval)
    hours = SETUP_HOURS + photos * per_photo / 3600
    return {"photos": photos, "hours": round(hours, 1), "capped_by_max_run_duration": hours > max_hours,
            "spot_usd": round(min(hours, max_hours) * spec["spot_usd_h"], 2),
            "ondemand_usd": round(min(hours, max_hours) * spec["ondemand_usd_h"], 2),
            "note": "estimativa (tempo por foto medido em T4/L4 + intervalo mínimo entre downloads); preços de lista aproximados"}


def startup_script(*, job: str, bucket: str, branch: str, zone: str, weights_dir: str = "/opt/fashn-open", extra_args: str = "",
                   repo_url: str = REPO_URL) -> str:
    """Bash executado pela VM ao subir. Só --dry-run: o banco nunca é tocado a partir da nuvem."""
    extra = extra_args.strip()
    return f"""#!/bin/bash
set -euo pipefail
exec > >(tee -a /var/log/fashionai-packshot.log) 2>&1
JOB={shlex.quote(job)}; BUCKET={shlex.quote(bucket)}; BRANCH={shlex.quote(branch)}; ZONE={shlex.quote(zone)}
finish() {{
  gsutil -q cp /var/log/fashionai-packshot.log "gs://$BUCKET/jobs/$JOB/out/startup.log" || true
  # se a conta de serviço da VM não puder apagar a instância, ela só desliga; --max-run-duration apaga depois
  gcloud compute instances delete "$(hostname)" --zone="$ZONE" --quiet || poweroff
}}
trap finish EXIT
for _ in $(seq 1 90); do nvidia-smi -L && break; sleep 10; done
nvidia-smi -L
mkdir -p /opt/fashionai && cd /opt/fashionai
git clone --depth 1 --branch "$BRANCH" {shlex.quote(repo_url)} src
PY=/opt/conda/bin/python
[ -x "$PY" ] || {{ python3 -m venv venv; PY=/opt/fashionai/venv/bin/python; }}
"$PY" -m pip install -q -r src/scripts/catalog/requirements-fashn-open.txt
"$PY" src/scripts/catalog/fashn_open.py download --dest {shlex.quote(weights_dir)}
gsutil -q cp "gs://$BUCKET/jobs/$JOB/rows.json" rows.json
cd src
"$PY" scripts/catalog/process_local_sd.py --engine fashn-open --weights {shlex.quote(weights_dir)} --input ../rows.json \\
  --limit 1000000 --out-dir ../out --dry-run {extra}
gsutil -m -q rsync -r ../out "gs://$BUCKET/jobs/$JOB/out"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > /tmp/DONE && gsutil -q cp /tmp/DONE "gs://$BUCKET/jobs/$JOB/out/DONE"
"""


def plan(args, photos: int, script_path: str = "<startup-script>") -> dict:
    spec = GPU[args.gpu]
    name = f"fashionai-packshot-{args.job}"
    create = ["gcloud", "compute", "instances", "create", name, f"--project={args.project}", f"--zone={args.zone}",
              f"--machine-type={spec['machine']}", "--maintenance-policy=TERMINATE", "--provisioning-model=SPOT",
              "--instance-termination-action=DELETE", f"--max-run-duration={int(args.max_hours * 3600)}s",
              f"--image-family={IMAGE_FAMILY}", f"--image-project={IMAGE_PROJECT}", "--boot-disk-size=100GB", "--boot-disk-type=pd-balanced",
              "--scopes=https://www.googleapis.com/auth/cloud-platform", "--metadata=install-nvidia-driver=True",
              f"--metadata-from-file=startup-script={script_path}", f"--labels=fashionai-job={args.job}"]
    if spec["accelerator"]:
        create.insert(8, f"--accelerator=type={spec['accelerator']},count=1")
    if args.service_account:
        create.append(f"--service-account={args.service_account}")
    upload = ["gsutil", "cp", str(args.rows), f"gs://{args.bucket}/jobs/{args.job}/rows.json"]
    return {"executed": False, "vm": name, "gpu": args.gpu, "machine": spec["machine"],
            "estimate": estimate(args.gpu, photos, args.sd, args.min_interval, args.max_hours),
            "commands": [shlex.join(upload), shlex.join(create)],
            "follow": [shlex.join(["gcloud", "compute", "instances", "get-serial-port-output", name, f"--project={args.project}", f"--zone={args.zone}"]),
                       f"gsutil ls gs://{args.bucket}/jobs/{args.job}/out/"],
            "warning": "cria capacidade GPU cobrada até terminar ou até --max-run-duration; precisa de cota GPUS_ALL_REGIONS e da GPU na zona"}


def count_rows(path: Path) -> int:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = raw.get("products", raw.get("images", [])) if isinstance(raw, dict) else raw
    return len(rows)


def run(command: list[str]) -> None:
    print("$ " + shlex.join(command), flush=True)
    subprocess.run(command, check=True)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0], formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("--project", required=True)
    ap.add_argument("--zone", default="southamerica-east1-c")
    ap.add_argument("--bucket", required=True, help="bucket GCS do projeto (rows.json entra, output_images sai)")
    ap.add_argument("--job", required=True, help="nome do lote: minúsculas, dígitos, hífen")
    ap.add_argument("--rows", type=Path, help="JSON com as linhas (id, image_url, product_id, brand, category, subcategory)")
    ap.add_argument("--branch", default="claude/fashion-ai-interfaces-config-id7naj")
    ap.add_argument("--gpu", choices=sorted(GPU), default="t4")
    ap.add_argument("--max-hours", type=float, default=6, help="teto: a VM é apagada ao atingir (padrão 6)")
    ap.add_argument("--min-interval", type=float, default=1.0, help="segundos mínimos entre downloads no mesmo host")
    ap.add_argument("--sd", action="store_true", help="também o Stable Diffusion por cima do LaMa (mais lento)")
    ap.add_argument("--service-account", help="conta de serviço da VM (precisa poder apagar a própria instância e escrever no bucket)")
    ap.add_argument("--extra-args", default="", help="argumentos extras para o process_local_sd.py (ex.: --steps 20)")
    ap.add_argument("--apply", action="store_true", help="cria a VM (sem isto, só o plano)")
    ap.add_argument("--yes", action="store_true", help="com --apply, não pede confirmação")
    ap.add_argument("--status", action="store_true", help="só verifica se gs://…/out/DONE existe")
    ap.add_argument("--fetch", type=Path, help="baixa gs://…/out para esta pasta")
    args = ap.parse_args(argv)
    validate(args.project, args.zone, args.bucket, args.job, args.branch)
    out = f"gs://{args.bucket}/jobs/{args.job}/out"
    if args.status:
        done = subprocess.run(["gsutil", "-q", "stat", out + "/DONE"], check=False).returncode == 0
        print("terminado" if done else "ainda rodando (ou não começou)")
        return 0 if done else 3
    if args.fetch:
        args.fetch.mkdir(parents=True, exist_ok=True)
        run(["gsutil", "-m", "-q", "rsync", "-r", out, str(args.fetch)])
        return 0
    if not args.rows or not args.rows.is_file():
        ap.error("--rows é obrigatório para planejar ou criar o lote")
    photos = count_rows(args.rows)
    extra = args.extra_args + (" --sd" if args.sd else "") + f" --min-interval {args.min_interval}"
    script = startup_script(job=args.job, bucket=args.bucket, branch=args.branch, zone=args.zone, extra_args=extra)
    planned = plan(args, photos)
    print(json.dumps(planned, ensure_ascii=False, indent=1))
    if not args.apply:
        print("plano apenas — nada foi criado (use --apply --yes para criar)")
        return 0
    if not args.yes:
        answer = input(f"Criar {planned['vm']} ({args.gpu} spot, teto {args.max_hours} h, ≈ US$ {planned['estimate']['spot_usd']})? (digite 'sim') ")
        if answer.strip().lower() != "sim":
            print("cancelado")
            return 1
    with tempfile.TemporaryDirectory() as tmp:
        script_path = Path(tmp) / "startup.sh"
        script_path.write_text(script, encoding="utf-8")
        os.chmod(script_path, 0o600)
        final = plan(args, photos, str(script_path))
        for command in final["commands"]:
            run(shlex.split(command))
    print("VM criada; acompanhe com:\n  " + "\n  ".join(planned["follow"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
