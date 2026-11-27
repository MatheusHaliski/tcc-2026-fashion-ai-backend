#!/usr/bin/env python3
"""Lote 3D (Hunyuan3D-2mv + Paint 2.0) numa VM spot com T4 na GCP: piloto e lote, sem tocar no banco nem no bucket de
produção.

    python scripts/cloud/hunyuan_t4_vm.py --project P --bucket B --job piloto-t4 --lot lote.csv --pilot 10   # só o plano
    python scripts/cloud/hunyuan_t4_vm.py … --apply --yes      # sobe o lote ao GCS e cria a VM (confirmação explícita)
    python scripts/cloud/hunyuan_t4_vm.py … --status           # terminou? (gs://B/jobs/JOB/out/DONE)
    python scripts/cloud/hunyuan_t4_vm.py … --fetch ~/glb-t4   # baixa glb/, manifesto.csv, falhas.csv, recortes e logs

A VM (startup-script): clona a branch e o Hunyuan3D-2 no commit fixado, instala (T4: TORCH_CUDA_ARCH_LIST=7.5),
baixa os pesos do recorte FASHN, roda o hunyuan_glb_runner.py em duas etapas (forma turbo, depois textura 2.0), envia
tudo para gs://BUCKET/jobs/JOB/out/ e se apaga; --max-run-duration apaga a VM mesmo se travar. O lote.csv vem do
export_glb_batch.py; --pilot N sorteia N linhas alternando as fontes (FLAT_LAY, WHOLE, FOTO). Os .glb voltam para
o Mac e entram pelo import_meshy_glbs.py --generator hunyuan3d-2mv+2.0 --origin gcp (ensaio antes do --apply).
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from packshot_gpu_vm import GPU, IMAGE_PROJECT, REPO_URL, preflight, run, validate  # noqa: E402

HUNYUAN_REPO, HUNYUAN_COMMIT = "https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git", "f8db63096c8282cb27354314d896feba5ba6ff8a"
FASHN_PARSER = "fashn-human-parser @ git+https://github.com/fashn-AI/fashn-human-parser.git@f2771f2fb8655349e87e2869bbde7ace0bd06f2c"
SECONDS_PER_PRODUCT = (240, 420)       # estimativa na T4 (forma turbo + textura 2.0 turbo + recorte); o piloto mede
SETUP_HOURS = 0.75                     # driver, pip, compilação do rasterizador e ~15 GB de pesos


def read_lot(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def sample(rows: list[dict], n: int) -> list[dict]:
    """N linhas alternando as fontes (o piloto mede cada uma), na ordem do lote dentro de cada fonte."""
    groups: dict[str, list[dict]] = {}
    for row in rows:
        groups.setdefault(row.get("fonte") or "FLAT_LAY", []).append(row)
    picked, queues = [], [list(g) for _, g in sorted(groups.items())]
    while len(picked) < n and any(queues):
        for queue in queues:
            if queue and len(picked) < n:
                picked.append(queue.pop(0))
    return picked


def estimate(products: int, max_hours: float) -> dict:
    spec = GPU["t4"]
    hours = [SETUP_HOURS + products * s / 3600 for s in SECONDS_PER_PRODUCT]
    cost = lambda h, k: round(min(h, max_hours) * spec[k], 2)   # noqa: E731
    return {"products": products, "hours": [round(h, 1) for h in hours], "capped_by_max_run_duration": hours[1] > max_hours,
            "spot_usd": [cost(h, "spot_usd_h") for h in hours], "ondemand_usd": [cost(h, "ondemand_usd_h") for h in hours],
            "note": "estimativa não medida (240–420 s/produto na T4); preços de lista aproximados de southamerica-east1"}


def startup_script(*, job: str, bucket: str, branch: str, zone: str, repo_url: str = REPO_URL) -> str:
    """Bash da VM. Só gera e envia ao GCS de trabalho: banco e bucket de produção nunca são tocados daqui."""
    q = shlex.quote
    return f"""#!/bin/bash
set -euo pipefail
exec > >(tee -a /var/log/fashionai-glb.log) 2>&1
JOB={q(job)}; BUCKET={q(bucket)}; BRANCH={q(branch)}; ZONE={q(zone)}
finish() {{
  gsutil -q cp /var/log/fashionai-glb.log "gs://$BUCKET/jobs/$JOB/out/startup.log" || true
  gcloud compute instances delete "$(hostname)" --zone="$ZONE" --quiet || poweroff
}}
trap finish EXIT
for _ in $(seq 1 90); do nvidia-smi -L && break; sleep 10; done
mkdir -p /opt/fashionai/out && cd /opt/fashionai
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader | tee out/gpu.txt
git clone --depth 1 --branch "$BRANCH" {q(repo_url)} src
git clone {q(HUNYUAN_REPO)} Hunyuan3D-2 && git -C Hunyuan3D-2 checkout -q {HUNYUAN_COMMIT}
export PIP_BREAK_SYSTEM_PACKAGES=1 HF_HOME=/opt/hf TORCH_CUDA_ARCH_LIST=7.5
PY=""
for c in /opt/conda/bin/python python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c "import sys, torch; sys.exit(0 if torch.cuda.is_available() else 1)" 2>/dev/null; then PY="$(command -v "$c")"; break; fi
done
[ -n "$PY" ] || {{ echo "sem python com torch+CUDA na imagem"; exit 1; }}
grep -vE '^(gradio|fastapi|uvicorn)' Hunyuan3D-2/requirements.txt > req.txt
"$PY" -m pip install -q -r req.txt
"$PY" -m pip install -q -e Hunyuan3D-2
(cd Hunyuan3D-2/hy3dgen/texgen/custom_rasterizer && "$PY" setup.py install)
(cd Hunyuan3D-2/hy3dgen/texgen/differentiable_renderer && "$PY" setup.py install)
"$PY" -m pip install -q scipy timm kornia {q(FASHN_PARSER)}
"$PY" src/scripts/catalog/fashn_open.py download --dest /opt/fashn-open --only parser,birefnet
gsutil -q cp "gs://$BUCKET/jobs/$JOB/lote.csv" lote.csv
RUN=("$PY" src/scripts/catalog/hunyuan_glb_runner.py --lot lote.csv --out out --root /opt/fashionai)
"${{RUN[@]}}" --stage shape --shape-turbo --fashn-weights /opt/fashn-open 2>&1 | tee out/shape.log || true
"${{RUN[@]}}" --stage paint --paint 2.0 2>&1 | tee out/paint.log || true
gsutil -m -q rsync -r -x '.*\\.obj$|.*\\.mtl$' out "gs://$BUCKET/jobs/$JOB/out"
date -u +%Y-%m-%dT%H:%M:%SZ > /tmp/DONE && gsutil -q cp /tmp/DONE "gs://$BUCKET/jobs/$JOB/out/DONE"
"""


def plan(args, products: int, lot_path: str, script_path: str = "<startup-script>") -> dict:
    spec, name = GPU["t4"], f"fashionai-glb-{args.job}"
    create = ["gcloud", "compute", "instances", "create", name, f"--project={args.project}", f"--zone={args.zone}",
              f"--machine-type={spec['machine']}", f"--accelerator=type={spec['accelerator']},count=1",
              "--maintenance-policy=TERMINATE", "--provisioning-model=SPOT", "--instance-termination-action=DELETE",
              f"--max-run-duration={int(args.max_hours * 3600)}s",
              f"--image-family={getattr(args, 'image_family', None) or '<família PyTorch+CUDA mais recente>'}",
              f"--image-project={IMAGE_PROJECT}", "--boot-disk-size=150GB", "--boot-disk-type=pd-balanced",
              "--scopes=https://www.googleapis.com/auth/cloud-platform", "--metadata=install-nvidia-driver=True",
              f"--metadata-from-file=startup-script={script_path}", f"--labels=fashionai-job={args.job}"]
    if args.service_account:
        create.append(f"--service-account={args.service_account}")
    upload = ["gsutil", "cp", lot_path, f"gs://{args.bucket}/jobs/{args.job}/lote.csv"]
    return {"executed": False, "vm": name, "gpu": "t4 (16 GB)", "machine": spec["machine"],
            "estimate": estimate(products, args.max_hours), "commands": [shlex.join(upload), shlex.join(create)],
            "follow": [shlex.join(["gcloud", "compute", "instances", "get-serial-port-output", name,
                                   f"--project={args.project}", f"--zone={args.zone}"]),
                       f"gsutil cat gs://{args.bucket}/jobs/{args.job}/out/startup.log"],
            "warning": "cria GPU cobrada até terminar ou até --max-run-duration; precisa de cota de T4 na região"}


def write_lot(rows: list[dict], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0], formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog=__doc__)
    ap.add_argument("--project", required=True)
    ap.add_argument("--zone", default="southamerica-east1-c")
    ap.add_argument("--bucket", required=True, help="bucket GCS de trabalho (lote.csv entra, .glb sai)")
    ap.add_argument("--job", required=True, help="nome do lote: minúsculas, dígitos, hífen")
    ap.add_argument("--lot", type=Path, help="lote.csv do export_glb_batch.py")
    ap.add_argument("--pilot", type=int, help="só N produtos, alternando as fontes")
    ap.add_argument("--branch", default="claude/fashionai-backend-continue-5we6lp")
    ap.add_argument("--max-hours", type=float, default=3, help="teto: a VM é apagada ao atingir (padrão 3)")
    ap.add_argument("--service-account", help="conta de serviço da VM (apagar a própria instância e escrever no bucket)")
    ap.add_argument("--image-family", help=f"família de imagem em {IMAGE_PROJECT} (padrão: a mais recente)")
    ap.add_argument("--apply", action="store_true", help="sobe o lote e cria a VM (sem isto, só o plano)")
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
    if not args.lot or not args.lot.is_file():
        ap.error("--lot é obrigatório para planejar ou criar o lote")
    rows = read_lot(args.lot)
    rows = sample(rows, args.pilot) if args.pilot else rows
    if not rows:
        ap.error("lote vazio")
    print(json.dumps(plan(args, len(rows), str(args.lot)), ensure_ascii=False, indent=1))
    print("fontes: " + json.dumps({f: sum((r.get("fonte") or "FLAT_LAY") == f for r in rows)
                                   for f in ("FLAT_LAY", "WHOLE", "FOTO")}))
    if not args.apply:
        print("plano apenas — nada foi criado (use --apply --yes para criar)")
        return 0
    refused = preflight(args)
    if refused:
        print("recusado: " + refused, file=sys.stderr)
        return 4
    if not args.yes and input(f"Criar a VM T4 spot do lote {args.job} ({len(rows)} produtos)? (digite 'sim') ").strip() != "sim":
        print("cancelado")
        return 1
    with tempfile.TemporaryDirectory() as tmp:
        lot, script = Path(tmp) / "lote.csv", Path(tmp) / "startup.sh"
        write_lot(rows, lot)
        script.write_text(startup_script(job=args.job, bucket=args.bucket, branch=args.branch, zone=args.zone),
                          encoding="utf-8")
        os.chmod(script, 0o600)
        for command in plan(args, len(rows), str(lot), str(script))["commands"]:
            run(shlex.split(command))
    print("VM criada; acompanhe com:\n  " + "\n  ".join(plan(args, len(rows), str(args.lot))["follow"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
