#!/usr/bin/env python3
"""Limpeza do Deployment Storage da Vercel (Hobby: "Function Storage 100%"): apaga deployments antigos pela API REST.

    VERCEL_TOKEN=… python3 scripts/ops/vercel_deployments_cleanup.py --team team_xxx --project prj_xxx            # ensaio: só lista
    VERCEL_TOKEN=… python3 scripts/ops/vercel_deployments_cleanup.py --team team_xxx --project prj_xxx --apply    # apaga os candidatos

O que vira candidato (e por quê):
  * produção com estado ERROR ou CANCELED — nunca serviu tráfego; só ocupa armazenamento;
  * preview (target nulo) de branch cuja PR já foi mesclada/fechada ou mais velho que --preview-days (padrão 2);
  * nunca: o deployment de produção atual (READY mais recente), qualquer um com alias próprio, nem os --keep-production
    (padrão 2) READY de produção mais recentes — são o plano de rollback.
Deployment apagado fica 30 dias recuperável no painel (Settings → Security → Recently Deleted). O token vem SÓ de
VERCEL_TOKEN e nunca é impresso; sem token o script sai antes de qualquer chamada. A política de retenção (Settings →
Security → Deployment Retention Policy) não tem API pública: continua pelo painel.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Callable, Optional

API = "https://api.vercel.com"
Fetch = Callable[[str, str], tuple[int, dict]]


def make_fetch(token: str, timeout: float = 30) -> Fetch:
    """fetch(method, path) -> (status, json). O token vai só no cabeçalho; erros voltam como status + corpo (sem segredo)."""
    def fetch(method: str, path: str) -> tuple[int, dict]:
        req = urllib.request.Request(API + path, method=method, headers={"Authorization": "Bearer " + token, "User-Agent": "FashionAI-ops/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read()
                return r.status, (json.loads(body) if body else {})
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read() or b"{}")
            except ValueError:
                return e.code, {}
    return fetch


@dataclass
class Deployment:
    id: str
    url: str
    state: str
    target: Optional[str]
    created: int
    branch: Optional[str]
    aliases: list[str]
    pr_state: Optional[str] = None      # OPEN, MERGED, CLOSED ou None (sem PR)

    @property
    def production(self) -> bool:
        return self.target == "production"


def list_deployments(fetch: Fetch, team: str, project: str, limit: int = 100) -> list[Deployment]:
    """Todos os deployments do projeto (paginado), mais novos primeiro."""
    out: list[Deployment] = []
    until: Optional[int] = None
    while True:
        q = {"teamId": team, "projectId": project, "limit": str(limit)}
        if until:
            q["until"] = str(until)
        status, body = fetch("GET", "/v6/deployments?" + urllib.parse.urlencode(q))
        if status != 200:
            raise SystemExit(f"GET /v6/deployments -> {status}: {body.get('error', {}).get('message', 'sem detalhe')}")
        rows = body.get("deployments", [])
        for d in rows:
            meta = d.get("meta") or {}
            out.append(Deployment(d["uid"], d.get("url") or "", d.get("state") or d.get("readyState") or "", d.get("target"),
                                  int(d.get("created") or d.get("createdAt") or 0), meta.get("githubCommitRef"), []))
        nxt = (body.get("pagination") or {}).get("next")
        if not rows or not nxt or nxt == until:
            break
        until = nxt
    return out


def aliases_of(fetch: Fetch, team: str, deployment_id: str) -> list[str]:
    status, body = fetch("GET", f"/v2/deployments/{deployment_id}/aliases?teamId={team}")
    return [a.get("alias") for a in body.get("aliases", []) if a.get("alias")] if status == 200 else []


def plan(deployments: list[Deployment], *, now_ms: int, preview_days: float = 2, keep_production: int = 2,
         pr_state: Optional[Callable[[str], Optional[str]]] = None) -> list[tuple[Deployment, str]]:
    """Candidatos à exclusão com o motivo. Conservador: dúvida = fica."""
    ready_prod = sorted([d for d in deployments if d.production and d.state == "READY"], key=lambda d: -d.created)
    protected = {d.id for d in ready_prod[:max(1, keep_production)]}
    out = []
    for d in sorted(deployments, key=lambda d: d.created):
        if d.id in protected or d.aliases:
            continue
        if d.state in ("BUILDING", "INITIALIZING", "QUEUED"):
            continue
        if d.production:
            if d.state in ("ERROR", "CANCELED"):
                out.append((d, f"produção {d.state.lower()} (nunca serviu)"))
            elif d.state == "READY":
                out.append((d, f"produção antiga além dos {keep_production} mais recentes"))
            continue
        if d.state in ("ERROR", "CANCELED"):
            out.append((d, f"preview {d.state.lower()}"))
            continue
        state = pr_state(d.branch) if pr_state and d.branch else None
        age_days = (now_ms - d.created) / 86_400_000
        if state in ("MERGED", "CLOSED"):
            out.append((d, f"preview de branch com PR {state.lower()} ({d.branch})"))
        elif age_days > preview_days:
            out.append((d, f"preview com {age_days:.1f} dias ({d.branch or 'sem branch'})"))
    return out


def delete(fetch: Fetch, team: str, deployment_id: str) -> tuple[bool, str]:
    status, body = fetch("DELETE", f"/v13/deployments/{deployment_id}?teamId={team}")
    if status in (200, 204):
        return True, body.get("state", "DELETED")
    return False, f"{status}: {body.get('error', {}).get('message', 'sem detalhe')}"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0], formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("--team", required=True, help="teamId (team_…)")
    ap.add_argument("--project", required=True, help="projectId (prj_…) ou nome")
    ap.add_argument("--preview-days", type=float, default=2, help="preview mais velho que isto vira candidato (padrão 2)")
    ap.add_argument("--keep-production", type=int, default=2, help="deployments READY de produção preservados (padrão 2)")
    ap.add_argument("--apply", action="store_true", help="apaga os candidatos (sem isto, só lista)")
    ap.add_argument("--yes", action="store_true", help="com --apply, não pede confirmação interativa")
    ap.add_argument("--sleep", type=float, default=0.5, help="pausa entre exclusões (s)")
    args = ap.parse_args(argv)
    token = os.getenv("VERCEL_TOKEN", "").strip()
    if not token:
        print("VERCEL_TOKEN não definido no ambiente (crie em Account Settings → Tokens, escopo do time; nunca cole no chat)", file=sys.stderr)
        return 2
    fetch = make_fetch(token)
    deployments = list_deployments(fetch, args.team, args.project)
    for d in deployments:
        d.aliases = aliases_of(fetch, args.team, d.id)
    candidates = plan(deployments, now_ms=int(time.time() * 1000), preview_days=args.preview_days, keep_production=args.keep_production)
    print(f"{len(deployments)} deployments no projeto · {len(candidates)} candidatos a exclusão · {'APLICANDO' if args.apply else 'ensaio (nada apagado)'}")
    for d, why in candidates:
        print(f"  - {d.id} · {d.state} · {d.target or 'preview'} · {d.branch or '-'} · {time.strftime('%Y-%m-%d %H:%M', time.gmtime(d.created / 1000))} · {why}")
    kept = [d for d in deployments if d.id not in {c.id for c, _ in candidates}]
    print(f"ficam {len(kept)}: " + ", ".join(f"{d.id} ({d.state}/{d.target or 'preview'}{'/alias' if d.aliases else ''})" for d in kept))
    if not args.apply or not candidates:
        return 0
    if not args.yes:
        answer = input(f"Apagar {len(candidates)} deployments? (digite 'sim') ")
        if answer.strip().lower() != "sim":
            print("cancelado")
            return 1
    ok = 0
    for d, _ in candidates:
        done, note = delete(fetch, args.team, d.id)
        ok += done
        print(f"  {'✓' if done else '✗'} {d.id} {note}")
        time.sleep(args.sleep)
    print(f"apagados: {ok}/{len(candidates)} · recuperáveis por 30 dias em Settings → Security → Recently Deleted")
    return 0 if ok == len(candidates) else 1


if __name__ == "__main__":
    raise SystemExit(main())
