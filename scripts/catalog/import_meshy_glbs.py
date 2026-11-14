#!/usr/bin/env python3
"""Etapa 3, lote do Codex: reaproveita os .glb que o Codex já gerou na Meshy e deixa para a geração só o que falta.

Entrada: o manifesto (codex_glb_index.py archive/export) e a pasta com os .glb. Para cada linha: liga ao produto do
catálogo (codex_catalog_match.py), monta a versão WEB ≤ 6 MB (glb_web_rendition.py), mede a qualidade dela
(glb_quality.py), soma a revisão visual do Codex e decide:

- ``IMPORTAR``: nota BOM (vira PUBLISHED) ou REVISAR (vira DRAFT) em catalog_product_models_3d (V97), o modelo de vitrine
  do produto. Sem esqueleto: nunca veste o avatar (isso é o garment_assets_3d APPROVED);
- ``GERAR_DE_NOVO``: nota RUIM, quarentena do Codex ou sem versão que caiba no WEB;
- ``SEM_PRODUTO``, ``JA_IMPORTADO``, ``DUPLICADO``: não entra.

Saídas: ``relatorio.csv``, ``faltam.txt`` (flat lay aprovado sem modelo BOM publicado: a entrada da geração da etapa 3)
e ``revisar.txt`` (o subconjunto de faltam.txt que entrou como DRAFT). Por padrão é um ensaio, com o banco só lido.
``--apply`` envia ao bucket e grava, e só roda com autorização explícita.

    python scripts/catalog/import_meshy_glbs.py --manifest manifesto.csv --root ~/glb-analise --out-dir ~/glb-analise

Outro gerador (manifesto product_id, glb, generator): ``--generator hunyuan3d-2.1 --origin runpod``.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import sys
from pathlib import Path

try:
    from .codex_catalog_match import resolve
    from .glb_source import GENERATORS, ORIGINS, GlbSource
    from .glb_quality import DESKTOP_BYTES, inspect
    from .glb_web_rendition import web_rendition
    from .meshy_glb_apply import apply_one, pieces_without_model
except ImportError:   # rodado como script: scripts/catalog no sys.path
    from codex_catalog_match import resolve
    from glb_source import GENERATORS, ORIGINS, GlbSource
    from glb_quality import DESKTOP_BYTES, inspect
    from glb_web_rendition import web_rendition
    from meshy_glb_apply import apply_one, pieces_without_model

EXISTING = """SELECT catalog_product_id, sha256, status FROM catalog_product_models_3d WHERE status <> 'RETIRED'"""
APPROVED_FLAT_LAYS = "SELECT DISTINCT product_id FROM catalog_images WHERE flat_lay_status = 'APPROVED'"
REPORT = ["arquivo", "codex_id", "product_id", "ligacao", "nome", "categoria", "subcategoria", "marca", "nota",
          "triangulos", "texturas", "maior_textura", "mb_original", "mb_web", "receita_web", "revisao_codex",
          "problemas", "pecas_guarda_roupa", "situacao"]
RANK = {"BOM": 0, "REVISAR": 1, "RUIM": 2}


def read_manifest(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        return [{**r, "product_id": (r.get("product_id") or "").strip().lower()} for r in csv.DictReader(handle)]


def locate(root: Path, glb: str) -> Path | None:
    """Arquivo do manifesto dentro da pasta: caminho relativo ou, se o Codex gravou outro, pelo nome (único)."""
    name = glb.split("?")[0].rstrip("/").split("/")[-1]
    direct = (root / glb.lstrip("/")).resolve()
    if direct.is_file() and root.resolve() in direct.parents:
        return direct
    hits = sorted(root.rglob(name)) if name.lower().endswith(".glb") else []
    return hits[0] if len(hits) == 1 else None   # nome repetido em duas pastas: ambíguo, não adivinha


def query(conn, sql: str, params: dict | None = None) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def existing_models(conn) -> list[dict] | None:
    """Modelos já gravados; None quando a tabela ainda não existe (V97 não aplicada): o ensaio segue, o --apply não."""
    try:
        return query(conn, EXISTING)
    except Exception as exc:   # noqa: BLE001 - só "tabela inexistente" (MySQL 1146) vira None
        if getattr(exc, "args", (None,))[0] == 1146:
            return None
        raise


def renditions(data: bytes) -> dict[str, tuple[bytes, str]]:
    """WEB (sempre, se couber) e DESKTOP_HIGH (o original, quando é outro arquivo e cabe em 12 MB)."""
    web = web_rendition(data)
    if web is None:
        return {}
    out = {"WEB": web}
    if web[1] != "original" and len(data) <= DESKTOP_BYTES:
        out["DESKTOP_HIGH"] = (data, "original")
    return out


def grade(path: Path | None, codex_review: str) -> tuple[dict, int | None, str]:
    """Qualidade da versão WEB (é ela que o app baixa), tamanho e receita; quarentena do Codex rebaixa para RUIM."""
    if path is None:
        return {"grade": "RUIM", "issues": ["FILE_NOT_FOUND"], "bytes": 0}, None, ""
    data = path.read_bytes()
    web = web_rendition(data)
    q = inspect(web[0] if web else data)
    if web is None:
        q = {**q, "grade": "RUIM", "issues": q["issues"] + ["NO_WEB_RENDITION"]}
    if codex_review.upper().startswith("QUARANTINE"):
        q = {**q, "grade": "RUIM", "issues": q["issues"] + ["CODEX_QUARANTINE"]}
    return {**q, "original_bytes": len(data)}, len(web[0]) if web else None, web[1] if web else ""


def assess(rows: list[dict], root: Path, conn, models: list[dict]) -> list[dict]:
    matches = resolve(conn, rows)
    existing = {(str(e["catalog_product_id"]), e["sha256"]) for e in models}
    out = []
    for i, r in enumerate(rows):
        path = locate(root, r.get("glb", ""))
        q, web_bytes, recipe = grade(path, r.get("codex_quality") or "")
        sha = hashlib.sha256(path.read_bytes()).hexdigest() if path else None
        product, match = matches[i]
        pid = str(product["id"]) if product else ""
        if product is None:
            status = "SEM_PRODUTO"
        elif (pid, sha) in existing:
            status = "JA_IMPORTADO"
        else:
            status = "GERAR_DE_NOVO" if q["grade"] == "RUIM" else "IMPORTAR"
        out.append({"row": r, "path": path, "sha": sha, "quality": q, "grade": q["grade"], "web_bytes": web_bytes,
                    "recipe": recipe, "product": product or {}, "product_id": pid, "match": match, "status": status})
    keep_best(out)
    return out


def keep_best(items: list[dict]) -> None:
    """Dois .glb do mesmo produto: entra o de melhor nota (empate: o mais leve); o outro fica como DUPLICADO."""
    best: dict[str, dict] = {}
    for item in (i for i in items if i["status"] == "IMPORTAR"):
        key = (RANK[item["grade"]], item["web_bytes"])
        current = best.get(item["product_id"])
        if current is None or key < (RANK[current["grade"]], current["web_bytes"]):
            if current:
                current["status"] = "DUPLICADO"
            best[item["product_id"]] = item
        else:
            item["status"] = "DUPLICADO"


def report_row(item: dict, root: Path, pieces: dict[str, int]) -> list:
    q, p, r = item["quality"], item["product"], item["row"]
    name = str(item["path"].relative_to(root)) if item["path"] else r.get("glb", "")
    mb = lambda n: round(n / 1e6, 2) if n else ""   # noqa: E731
    return [name, r.get("codex_product_id", ""), item["product_id"], item["match"], p.get("product_name", "?"),
            p.get("category", ""), p.get("subcategory", ""), p.get("brand", ""), item["grade"], q.get("triangles", ""),
            q.get("textures", ""), q.get("max_texture", ""), mb(q.get("original_bytes")), mb(item["web_bytes"]),
            item["recipe"], r.get("codex_quality", ""), " ".join(q["issues"]), pieces.get(item["product_id"], 0),
            item["status"]]


def missing(conn, items: list[dict], models: list[dict]) -> tuple[list[str], list[str]]:
    """(faltam, revisar): flat lay aprovado sem modelo BOM publicado; revisar = os que entram como DRAFT."""
    covered = {str(e["catalog_product_id"]) for e in models if e["status"] == "PUBLISHED"}
    covered |= {i["product_id"] for i in items if i["status"] in ("IMPORTAR", "IMPORTADO") and i["grade"] == "BOM"}
    draft = {i["product_id"] for i in items if i["status"] in ("IMPORTAR", "IMPORTADO") and i["grade"] == "REVISAR"}
    todo = sorted(str(r["product_id"]) for r in query(conn, APPROVED_FLAT_LAYS) if str(r["product_id"]) not in covered)
    return todo, [p for p in todo if p in draft]


def _real_connect():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import db
    return db.connect(), db.describe_target()


def _real_storage():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from category_frame_storage import FrameStorage
    return FrameStorage()


def alive(conn) -> None:
    """A Railway encerra conexão MySQL parada: reabre antes de cada uso longo (o lote leva vários minutos)."""
    if hasattr(conn, "ping"):
        conn.ping(reconnect=True)


def failure(exc: Exception) -> str:
    """Tipo e mensagem curta do erro, numa linha (vai para o relatório: diz o que falhou, sem segredo)."""
    return f"FALHOU {type(exc).__name__}: {' '.join(str(exc).split())[:160]}".rstrip(": ")


def run_apply(conn, storage, items: list[dict], source: GlbSource) -> None:
    for item in (i for i in items if i["status"] == "IMPORTAR"):
        try:
            alive(conn)
            done = apply_one(conn, storage, {**item, "renditions": renditions(item["path"].read_bytes())}, source)
            item["status"], item["pieces"] = f"IMPORTADO_{done['status']}", done["pieces"]
        except Exception as exc:   # um arquivo com problema não para o lote
            item["status"] = failure(exc)


def main(argv=None, connect=_real_connect, make_storage=_real_storage) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--manifest", type=Path, required=True, help="manifesto.csv do codex_glb_index.py")
    parser.add_argument("--root", type=Path, required=True, help="pasta com os .glb (a do manifesto)")
    parser.add_argument("--out-dir", type=Path, default=Path("."), help="onde gravar relatorio.csv e faltam.txt")
    parser.add_argument("--apply", action="store_true", help="envia e grava no banco (produção: só com autorização)")
    parser.add_argument("--generator", choices=list(GENERATORS), default="meshy-6-lite", help="quem gerou os .glb")
    parser.add_argument("--origin", choices=list(ORIGINS), default="codex", help="de onde veio o lote")
    args = parser.parse_args(argv)
    source = GlbSource(args.generator, args.origin)
    conn, target = connect()
    models = existing_models(conn)
    if models is None and args.apply:
        print("catalog_product_models_3d não existe: aplique a migration V97 (deploy do backend) antes do --apply")
        return 2
    items = assess(read_manifest(args.manifest), args.root, conn, models or [])
    pieces = pieces_without_model(conn, [i["product_id"] for i in items if i["status"] == "IMPORTAR"])
    if args.apply:
        run_apply(conn, make_storage(), items, source)
    for item in items:
        item["status"] = "IMPORTADO" if item["status"].startswith("IMPORTADO") else item["status"]
    args.out_dir.mkdir(parents=True, exist_ok=True)
    with (args.out_dir / "relatorio.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(REPORT)
        writer.writerows(report_row(i, args.root, pieces) for i in items)
    alive(conn)
    todo, review = missing(conn, items, models or [])
    (args.out_dir / "faltam.txt").write_text("".join(f"{p}\n" for p in todo), encoding="utf-8")
    (args.out_dir / "revisar.txt").write_text("".join(f"{p}\n" for p in review), encoding="utf-8")
    counts: dict[str, int] = {}
    for item in items:
        label = f"{item['status']} {item['grade']}" if item["status"] in ("IMPORTAR", "IMPORTADO") else item["status"]
        counts[label] = counts.get(label, 0) + 1
    mode = "GRAVANDO" if args.apply else "ensaio (nada é gravado)"
    print(f"glb {source.generator} ({source.origin}): {len(items)} arquivos · {mode} · {target}")
    if models is None:
        print("  aviso: catalog_product_models_3d ainda não existe (V97 não aplicada); contado como vazio")
    for key, count in sorted(counts.items()):
        print(f"  {count:5d}  {key}")
    print(f"  {sum(pieces.values()):5d}  peças de guarda-roupa que recebem o modelo (vindas desses produtos)")
    print(f"  {len(todo):5d}  flat lay aprovado ainda sem modelo 3D bom (faltam.txt; {len(review)} em DRAFT: revisar.txt)")
    return 1 if any(i["status"].startswith("FALHOU") for i in items) else 0


if __name__ == "__main__":
    raise SystemExit(main())
