"""VM T4 do lote 3D: sem --apply só imprime o plano; o piloto alterna as fontes; a VM tem teto, é spot, só envia ao GCS
de trabalho e roda as duas etapas (forma turbo, textura 2.0) com o recorte da foto."""
import csv
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import hunyuan_t4_vm as vm  # noqa: E402

ARGS = dict(project="fashionai-tcc", zone="southamerica-east1-c", bucket="fashionai-glb", job="piloto-t4",
            branch="claude/fashionai-backend-continue-5we6lp", max_hours=3, service_account=None, image_family=None)


def lot(tmp_path, fontes):
    path = tmp_path / "lote.csv"
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["product_id", "fonte", "front_url"])
        writer.writeheader()
        writer.writerows({"product_id": f"p{i}", "fonte": f, "front_url": f"https://x/{i}.jpg"} for i, f in enumerate(fontes))
    return path


def test_pilot_sample_alternates_sources_in_lot_order():
    rows = [{"product_id": f"p{i}", "fonte": f} for i, f in enumerate(["FOTO"] * 5 + ["FLAT_LAY"] * 2 + ["WHOLE"])]
    assert [r["product_id"] for r in vm.sample(rows, 6)] == ["p5", "p0", "p7", "p6", "p1", "p2"]
    assert len(vm.sample(rows, 50)) == 8


def test_estimate_has_a_range_and_respects_the_cap():
    est = vm.estimate(10, max_hours=3)
    assert est["hours"] == [1.4, 1.9] and not est["capped_by_max_run_duration"]
    assert est["spot_usd"][0] < est["spot_usd"][1] < est["ondemand_usd"][1]
    assert vm.estimate(1000, max_hours=3)["spot_usd"][1] == round(3 * vm.GPU["t4"]["spot_usd_h"], 2)


def test_plan_is_spot_t4_with_ceiling_and_no_production_writes():
    planned = vm.plan(SimpleNamespace(**ARGS), 10, "lote.csv")
    create = planned["commands"][1]
    for flag in ("--provisioning-model=SPOT", "--accelerator=type=nvidia-tesla-t4,count=1", "--max-run-duration=10800s",
                 "--instance-termination-action=DELETE"):
        assert flag in create
    assert planned["commands"][0] == "gsutil cp lote.csv gs://fashionai-glb/jobs/piloto-t4/lote.csv"
    script = vm.startup_script(job="piloto-t4", bucket="fashionai-glb", branch=ARGS["branch"], zone=ARGS["zone"])
    assert vm.HUNYUAN_COMMIT in script and "TORCH_CUDA_ARCH_LIST=7.5" in script
    assert "--stage shape --shape-turbo --fashn-weights /opt/fashn-open" in script and "--stage paint --paint 2.0" in script
    assert "trap finish EXIT" in script and "--apply" not in script and "MYSQL" not in script and "S3_" not in script


def test_without_apply_nothing_is_created(tmp_path, capsys):
    path = lot(tmp_path, ["FOTO", "FOTO", "WHOLE", "FLAT_LAY"])
    with mock.patch.object(vm, "run") as run, mock.patch.object(vm, "preflight") as pre:
        code = vm.main(["--project", ARGS["project"], "--bucket", ARGS["bucket"], "--job", "piloto-t4", "--lot",
                        str(path), "--pilot", "3"])
    out = capsys.readouterr().out
    assert code == 0 and not run.called and not pre.called
    assert '"products": 3' in out and '{"FLAT_LAY": 1, "WHOLE": 1, "FOTO": 1}' in out and "nada foi criado" in out


def test_apply_uploads_the_sampled_lot_then_creates_the_vm(tmp_path):
    path = lot(tmp_path, ["FOTO", "WHOLE", "FLAT_LAY", "FOTO"])
    uploaded = []

    def fake_run(command):
        if command[:2] == ["gsutil", "cp"]:
            uploaded.extend(r["product_id"] for r in csv.DictReader(open(command[2], encoding="utf-8")))

    with mock.patch.object(vm, "run", side_effect=fake_run) as run, mock.patch.object(vm, "preflight", return_value=None):
        code = vm.main(["--project", ARGS["project"], "--bucket", ARGS["bucket"], "--job", "piloto-t4", "--lot",
                        str(path), "--pilot", "2", "--apply", "--yes"])
    assert code == 0 and uploaded == ["p2", "p0"]
    assert [c.args[0][:4] for c in run.call_args_list][1] == ["gcloud", "compute", "instances", "create"]


def test_refused_preflight_creates_nothing(tmp_path):
    path = lot(tmp_path, ["FOTO"])
    with mock.patch.object(vm, "run") as run, mock.patch.object(vm, "preflight", return_value="cota 0"):
        assert vm.main(["--project", ARGS["project"], "--bucket", ARGS["bucket"], "--job", "j1", "--lot", str(path),
                        "--apply", "--yes"]) == 4
    assert not run.called


def test_invalid_identifiers_are_rejected():
    with pytest.raises(ValueError):
        vm.main(["--project", "X", "--bucket", "fashionai-glb", "--job", "j1", "--status"])
