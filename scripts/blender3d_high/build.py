"""Gera as salas high poly e as publica em ``public/flair/3d/salas`` (o perfil ``high`` do motor Blender).

    python -m scripts.blender3d_high.build --listar
    python -m scripts.blender3d_high.build --so detetive-entrada --provas /tmp/provas
    python -m scripts.blender3d_high.build                     # todas

Para cada sala: modela, confere o teto de cada objeto (perfil.py), põe os modelos prontos na cena só para a oclusão,
assa a oclusão da casca, captura o mapa de ambiente, exporta o alto, passa ao médio (Decimate, relevo assado, texturas
pela metade), exporta o médio, comprime os dois (meshopt + instancing), mede e confere o orçamento, e escreve a linha
em ``manifest.json``. Com ``--provas`` salva também a foto da sala no Cycles.
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
PASTA = RAIZ / "public/flair/3d/salas"
URL = "/flair/3d/salas"
GERADOR = "scripts/blender3d_high"


def nova_cena() -> None:
    from scripts.blender3d import core

    from . import materiais

    core.nova_cena()
    materiais.limpar()


def gerar(slug: str, pasta: Path, provas: Path | None) -> dict:
    import bpy

    from . import assar, exportar, importados, niveis, perfil, render
    from .resumo import resumo
    from .salas import carregar

    sala = carregar()[slug]
    nova_cena()
    sala.modelar()
    niveis.conferir_tetos()
    for imp in sala.importados:
        importados.por_na_cena(imp.modelo, imp.pos, imp.giro, imp.altura)
    for nome in sala.assar:
        assar.assar_oclusao(bpy.data.objects[nome])
    if provas:
        render.foto(provas / f"{slug}.png", *sala.camera)
    render.ambiente(pasta / f"{slug}-ambiente.webp", sala.ambiente)
    importados.tirar_da_cena()
    for luz in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(luz)
    linha: dict = {"slug": slug, "title": sala.titulo, "family": sala.familia, "games": list(sala.jogos),
                   "author": "FashionAI", "source": f"{GERADOR}/salas", "license": "Própria", "hash": resumo(),
                   "environment": f"{URL}/{slug}-ambiente.webp", "levels": {}}
    with tempfile.TemporaryDirectory() as tmp:
        for nivel in perfil.NIVEIS:
            if nivel == "medio":
                niveis.para_o_medio(sala.relevo)
            bruto = exportar.exportar_bruto(Path(tmp) / f"{nivel}.glb")
            arquivo = pasta / (f"{slug}.glb" if nivel == "alto" else f"{slug}-{nivel}.glb")
            exportar.comprimir(bruto, arquivo)
            m = exportar.medidas(exportar.ler_glb(arquivo))
            fora = perfil.estouros_da_sala(sala.familia, nivel, m["triangulos"], m["chamadas"], arquivo.stat().st_size)
            if fora:
                raise SystemExit(f"{slug}: fora do orçamento\n  " + "\n  ".join(fora))
            linha["levels"][nivel] = {"url": f"{URL}/{arquivo.name}", "triangles": m["triangulos"], "calls": m["chamadas"],
                                      "instanced": m["instanciadas"], "bytes": arquivo.stat().st_size}
    linha["imports"] = [{"model": i.modelo, "url": f"{importados.URL}/{i.modelo}.glb",
                         "medium": f"{importados.URL_MEDIO}/{importados.medio(i.modelo).name}", "pos": list(i.pos),
                         "rotation": i.giro, "height": i.altura, "credit": importados.CREDITO} for i in sala.importados]
    return recontar(linha)


def recontar(linha: dict) -> dict:
    """Soma, em cada nível, os triângulos e as chamadas dos modelos prontos (o que a sala desenha de verdade) e confere
    o orçamento com eles."""
    from . import exportar, perfil

    for nivel, dados in linha["levels"].items():
        tri = chamadas = 0
        for imp in linha.get("imports", []):
            url = imp["medium"] if nivel == "medio" and imp.get("medium") else imp["url"]
            m = exportar.medidas(exportar.ler_glb(RAIZ / "public" / url.lstrip("/")))
            tri, chamadas = tri + m["triangulos"], chamadas + m["chamadas"]
        dados["withImports"] = {"triangles": dados["triangles"] + tri, "calls": dados["calls"] + chamadas}
        fora = perfil.estouros_da_sala(linha["family"], nivel, dados["triangles"] + tri, dados["calls"] + chamadas, dados["bytes"])
        if fora:
            raise SystemExit(f"{linha['slug']}: fora do orçamento com os modelos prontos\n  " + "\n  ".join(fora))
    return linha


def atualizar_manifesto(linhas: list[dict], manifesto: Path, existentes: set[str] | None = None) -> list[dict]:
    """Troca as linhas pelo slug (as outras ficam); com ``existentes``, tira as salas que não têm mais receita."""
    atual = json.loads(manifesto.read_text(encoding="utf-8")) if manifesto.exists() else []
    if existentes is not None:
        atual = [i for i in atual if i["slug"] in existentes]
    novas = {linha["slug"]: linha for linha in linhas}
    resultado = [novas.pop(i["slug"], i) for i in atual] + list(novas.values())
    manifesto.write_text(json.dumps(resultado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return resultado


def main(argv: list[str] | None = None) -> int:
    opcoes = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    opcoes.add_argument("--so", nargs="*", metavar="SLUG")
    opcoes.add_argument("--listar", action="store_true")
    opcoes.add_argument("--provas", type=Path, help="pasta da foto de cada sala (fora do repositório)")
    opcoes.add_argument("--pasta", type=Path, default=PASTA)
    opcoes.add_argument("--recontar", action="store_true", help="só refaz a conta com os modelos prontos (sem Blender)")
    args = opcoes.parse_args(sys.argv[1:] if argv is None else argv)
    if args.recontar:
        manifesto = args.pasta / "manifest.json"
        atual = json.loads(manifesto.read_text(encoding="utf-8"))
        atualizar_manifesto([recontar(linha) for linha in atual], manifesto)
        return 0
    from .salas import carregar

    salas = carregar()
    if args.listar:
        for s in salas.values():
            print(f"{s.slug:24} {s.titulo}")
        return 0
    slugs = args.so or list(salas)
    args.pasta.mkdir(parents=True, exist_ok=True)
    if args.provas:
        args.provas.mkdir(parents=True, exist_ok=True)
    for slug in slugs:
        linha = gerar(slug, args.pasta, args.provas)
        atualizar_manifesto([linha], args.pasta / "manifest.json", set(salas))
        for nivel, n in linha["levels"].items():
            print(f"{slug:24} {nivel:6} {n['triangles']:8} tri {n['calls']:4} chamadas {n['bytes'] / 2**20:6.2f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
