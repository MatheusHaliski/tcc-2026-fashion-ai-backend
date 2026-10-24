"""Limpeza do Deployment Storage: o plano é conservador e o token nunca sai do cabeçalho."""
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import vercel_deployments_cleanup as vc  # noqa: E402

DAY = 86_400_000
NOW = 1_792_900_000_000


def dep(i, state="READY", target=None, days_ago=0.0, branch="feat/x", aliases=()):
    return vc.Deployment(f"dpl_{i}", f"app-{i}.vercel.app", state, target, NOW - int(days_ago * DAY), branch, list(aliases))


class PlanTest(unittest.TestCase):
    def test_preserva_producao_atual_aliases_e_os_dois_ultimos_ready(self):
        deployments = [
            dep(1, "READY", "production", 0.1, "main"), dep(2, "READY", "production", 1, "main"), dep(3, "READY", "production", 3, "main"),
            dep(4, "ERROR", "production", 2, "main"), dep(5, "CANCELED", None, 0.2, "claude/x"),
            dep(6, "READY", None, 0.5, "feat/aberta"), dep(7, "READY", None, 3, "feat/velha"), dep(8, "READY", None, 5, "feat/mesclada"),
            dep(9, "READY", None, 10, "feat/com-alias", aliases=["preview.fai-network.com"]), dep(10, "BUILDING", None, 0, "feat/agora"),
        ]
        state = {"feat/mesclada": "MERGED", "feat/aberta": "OPEN", "feat/velha": None}
        out = {d.id: why for d, why in vc.plan(deployments, now_ms=NOW, preview_days=2, keep_production=2, pr_state=lambda b: state.get(b))}
        self.assertNotIn("dpl_1", out); self.assertNotIn("dpl_2", out)             # os 2 READY de produção mais recentes
        self.assertIn("produção antiga", out["dpl_3"])
        self.assertIn("produção error", out["dpl_4"])
        self.assertIn("preview canceled", out["dpl_5"])
        self.assertNotIn("dpl_6", out)                                               # preview recente de PR aberta fica
        self.assertIn("3.0 dias", out["dpl_7"])
        self.assertIn("PR merged", out["dpl_8"])
        self.assertNotIn("dpl_9", out)                                               # alias próprio: nunca
        self.assertNotIn("dpl_10", out)                                              # ainda construindo

    def test_sem_token_sai_antes_de_qualquer_chamada(self):
        with mock.patch.dict(os.environ, {"VERCEL_TOKEN": ""}), mock.patch.object(vc, "make_fetch", side_effect=AssertionError("não devia chamar")):
            self.assertEqual(vc.main(["--team", "team_x", "--project", "prj_x"]), 2)

    def test_ensaio_lista_e_nao_apaga_e_apply_apaga_com_yes(self):
        calls = []

        def fetch(method, path):
            calls.append((method, path.split("?")[0]))
            if path.startswith("/v6/deployments"):
                return 200, {"deployments": [
                    {"uid": "dpl_a", "url": "a", "state": "READY", "target": "production", "created": NOW - DAY // 10, "meta": {"githubCommitRef": "main"}},
                    {"uid": "dpl_b", "url": "b", "state": "ERROR", "target": "production", "created": NOW - DAY, "meta": {"githubCommitRef": "main"}},
                    {"uid": "dpl_c", "url": "c", "state": "READY", "target": None, "created": NOW - 5 * DAY, "meta": {"githubCommitRef": "feat/y"}}],
                    "pagination": {"next": None}}
            if "/aliases" in path:
                return 200, {"aliases": []}
            if method == "DELETE":
                return 200, {"state": "DELETED"}
            return 404, {}
        with mock.patch.dict(os.environ, {"VERCEL_TOKEN": "t"}), mock.patch.object(vc, "make_fetch", return_value=fetch), \
                mock.patch.object(vc.time, "time", return_value=NOW / 1000), mock.patch.object(vc.time, "sleep"):
            self.assertEqual(vc.main(["--team", "team_x", "--project", "prj_x"]), 0)
            self.assertFalse([c for c in calls if c[0] == "DELETE"])
            self.assertEqual(vc.main(["--team", "team_x", "--project", "prj_x", "--apply", "--yes"]), 0)
            deleted = sorted(p.rsplit("/", 1)[1] for m, p in calls if m == "DELETE")
            self.assertEqual(deleted, ["dpl_b", "dpl_c"])

    def test_sem_team_nao_manda_teamId_e_alias_de_branch_nao_protege(self):
        calls = []

        def fetch(method, path):
            calls.append((method, path))
            if path.startswith("/v6/deployments"):
                return 200, {"deployments": [
                    {"uid": "dpl_a", "url": "a", "state": "READY", "target": "production", "created": NOW - DAY // 10, "meta": {"githubCommitRef": "main"}},
                    {"uid": "dpl_b", "url": "b", "state": "READY", "target": None, "created": NOW - 5 * DAY, "meta": {"githubCommitRef": "feat/y"}},
                    {"uid": "dpl_c", "url": "c", "state": "READY", "target": None, "created": NOW - 5 * DAY, "meta": {"githubCommitRef": "feat/z"}}],
                    "pagination": {"next": None}}
            if path.startswith("/v2/deployments/dpl_b/aliases"):
                return 200, {"aliases": [{"alias": "app-git-feat-y-123456-time.vercel.app"}]}
            if path.startswith("/v2/deployments/dpl_c/aliases"):
                return 200, {"aliases": [{"alias": "preview.fai-network.com"}]}
            if "/aliases" in path:
                return 200, {"aliases": []}
            if method == "DELETE":
                return 200, {"state": "DELETED"}
            return 404, {}
        with mock.patch.dict(os.environ, {"VERCEL_TOKEN": "t"}), mock.patch.object(vc, "make_fetch", return_value=fetch), \
                mock.patch.object(vc.time, "time", return_value=NOW / 1000), mock.patch.object(vc.time, "sleep"):
            self.assertEqual(vc.main(["--project", "prj_x", "--apply", "--yes"]), 0)
        self.assertFalse([p for _, p in calls if "teamId" in p])
        self.assertIn("teamId=team_x", vc.urllib.parse.urlencode(vc.team_query("team_x")))
        self.assertEqual([p.rsplit("/", 1)[1].split("?")[0] for m, p in calls if m == "DELETE"], ["dpl_b"])   # alias de branch não protege; domínio próprio protege

    def test_token_so_no_cabecalho(self):
        seen = {}

        class R:
            status = 200

            def read(self):
                return b"{}"

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False
        with mock.patch.object(vc.urllib.request, "urlopen", side_effect=lambda req, timeout: seen.setdefault("h", req.get_header("Authorization")) and R()):
            vc.make_fetch("segredo")("GET", "/v2/user")
        self.assertEqual(seen["h"], "Bearer segredo")


if __name__ == "__main__":
    unittest.main()
