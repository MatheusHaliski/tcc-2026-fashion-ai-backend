"""VM GPU para packshots: o plano é só texto, a VM tem teto de duração e o lote nunca escreve no banco."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import packshot_gpu_vm as vm  # noqa: E402


def args(**over):
    base = dict(project="fashionai-tcc", zone="southamerica-east1-c", bucket="fashionai-packshot", job="lote-1", rows=Path("rows.json"),
                branch="claude/fashion-ai-interfaces-config-id7naj", gpu="t4", max_hours=6, min_interval=1.0, sd=False, service_account=None)
    base.update(over)
    return SimpleNamespace(**base)


class ValidateTest(unittest.TestCase):
    def test_rejeita_identificadores_invalidos(self):
        for bad in (dict(project="X"), dict(zone="southamerica-east1"), dict(bucket="a"), dict(job="Lote 1"), dict(branch="../x")):
            kw = dict(project="fashionai-tcc", zone="southamerica-east1-c", bucket="fashionai-packshot", job="lote-1", branch="main")
            kw.update(bad)
            with self.assertRaises(ValueError, msg=str(bad)):
                vm.validate(**kw)
        vm.validate("fashionai-tcc", "southamerica-east1-c", "fashionai-packshot", "lote-1", "claude/fashion-ai-interfaces-config-id7naj")


class PlanTest(unittest.TestCase):
    def test_vm_spot_com_teto_e_gpu_certa(self):
        p = vm.plan(args(), photos=7886)
        create = p["commands"][1]
        self.assertFalse(p["executed"])
        for needle in ("--provisioning-model=SPOT", "--max-run-duration=21600s", "--instance-termination-action=DELETE",
                       "--accelerator=type=nvidia-tesla-t4,count=1", "--machine-type=n1-standard-8", "install-nvidia-driver=True"):
            self.assertIn(needle, create)
        self.assertIn("gs://fashionai-packshot/jobs/lote-1/rows.json", p["commands"][0])
        l4 = vm.plan(args(gpu="l4"), photos=10)["commands"][1]
        self.assertIn("g2-standard-8", l4)
        self.assertNotIn("--accelerator", l4)                  # a L4 já vem na família G2

    def test_estimativa_cresce_com_sd_e_respeita_o_teto(self):
        sem = vm.estimate("t4", 7886, with_sd=False)
        com = vm.estimate("t4", 7886, with_sd=True)
        self.assertGreater(com["hours"], sem["hours"])
        self.assertTrue(com["capped_by_max_run_duration"])
        self.assertLessEqual(com["spot_usd"], 6 * vm.GPU["t4"]["spot_usd_h"] + 1e-9)
        self.assertLess(sem["spot_usd"], sem["ondemand_usd"])


class StartupScriptTest(unittest.TestCase):
    def test_script_so_ensaia_e_se_apaga(self):
        script = vm.startup_script(job="lote-1", bucket="fashionai-packshot", branch="main", zone="southamerica-east1-c", extra_args="--sd --steps 20")
        self.assertIn("--engine fashn-open", script)
        self.assertIn("--dry-run", script)
        self.assertNotIn("--apply", script)
        self.assertNotIn("DATABASE_URL", script)
        self.assertIn("fashn_open.py download", script)
        self.assertIn("--sd --steps 20", script)
        self.assertIn("gcloud compute instances delete", script)
        self.assertIn("gs://$BUCKET/jobs/$JOB/out/DONE", script)
        self.assertTrue(script.startswith("#!/bin/bash\nset -euo pipefail"))


class MainTest(unittest.TestCase):
    def test_sem_apply_nao_executa_nada(self):
        with tempfile.TemporaryDirectory() as tmp:
            rows = Path(tmp) / "rows.json"
            rows.write_text(json.dumps([{"id": "a", "image_url": "https://x/a.jpg"}] * 3), encoding="utf-8")
            with mock.patch.object(vm.subprocess, "run", side_effect=AssertionError("não devia executar")):
                self.assertEqual(vm.main(["--project", "fashionai-tcc", "--bucket", "fashionai-packshot", "--job", "lote-1", "--rows", str(rows)]), 0)

    def test_apply_yes_sobe_o_json_e_cria_a_vm(self):
        calls = []
        with tempfile.TemporaryDirectory() as tmp:
            rows = Path(tmp) / "rows.json"
            rows.write_text(json.dumps({"images": [{"id": "a", "image_url": "https://x/a.jpg"}]}), encoding="utf-8")
            with mock.patch.object(vm.subprocess, "run", side_effect=lambda cmd, check: calls.append(cmd)):
                self.assertEqual(vm.main(["--project", "fashionai-tcc", "--bucket", "fashionai-packshot", "--job", "lote-1", "--rows", str(rows),
                                          "--apply", "--yes", "--gpu", "l4"]), 0)
        self.assertEqual([c[0] for c in calls], ["gsutil", "gcloud"])
        script_arg = [a for a in calls[1] if a.startswith("--metadata-from-file=startup-script=")][0]
        self.assertTrue(script_arg.endswith("startup.sh"))


if __name__ == "__main__":
    unittest.main()
