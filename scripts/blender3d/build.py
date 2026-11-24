"""Gera os objetos 3D dos cenários no Blender e os publica para as salas dos jogos.

Uso (com o Blender instalado, ou com o módulo ``bpy`` do pip — ``pip install bpy``):

    blender --background --python-expr "from scripts.blender3d.build import main; main()"   # na raiz do repositório
    python -m scripts.blender3d.build                 # todos os objetos
    python -m scripts.blender3d.build --so trave skate
    python -m scripts.blender3d.build --listar

Cada receita vira ``public/flair/3d/assets/<slug>.glb`` e uma linha em ``manifest.json``. A sala troca sozinha o móvel
procedural pelo objeto quando o slug está no manifesto (lib/flair/nucleos/scene/assets.ts). As linhas de objetos
licenciados de terceiros, já no manifesto, são preservadas.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
PASTA = RAIZ / "public/flair/3d/assets"
MANIFESTO = PASTA / "manifest.json"
#: teto por objeto: as salas somam os triângulos dos objetos no orçamento da cena
MAX_TRIANGULOS = 3000
GERADOR = "scripts/blender3d"


def exportar(slug: str, pasta: Path) -> Path:
    import bpy

    destino = pasta / f"{slug}.glb"
    bpy.ops.export_scene.gltf(filepath=str(destino), export_format="GLB", export_apply=True, export_yup=True,
                              use_selection=False, export_cameras=False, export_lights=False)
    return destino


def gerar(slug: str, pasta: Path) -> dict:
    """Modela um objeto do zero, confere o orçamento, exporta o ``.glb`` e devolve a linha do manifesto."""
    from . import core
    from .receitas import carregar

    receita = carregar()[slug]
    core.nova_cena()
    receita.modelar()
    core.assentar()
    triangulos = core.triangulos()
    if triangulos > MAX_TRIANGULOS:
        raise SystemExit(f"{slug}: {triangulos} triângulos (teto {MAX_TRIANGULOS}); simplifique a receita")
    minimo, maximo = core.caixa_envolvente()
    arquivo = exportar(slug, pasta)
    linha = {"slug": slug, "title": receita.titulo, "category": "scene", "triangles": triangulos,
             "bytes": arquivo.stat().st_size, "author": "FashionAI", "source": f"{GERADOR}/receitas", "license": "Própria",
             "size": [round(maximo.x - minimo.x, 3), round(maximo.z - minimo.z, 3), round(maximo.y - minimo.y, 3)]}
    if receita.movel:
        linha["movel"] = receita.movel
    if receita.jogos:
        linha["games"] = list(receita.jogos)
    return linha


def atualizar_manifesto(linhas: list[dict], manifesto: Path = MANIFESTO, receitas: set[str] | None = None) -> list[dict]:
    """Troca (ou acrescenta) as linhas geradas, pelo slug; o que veio de terceiros fica como está.

    Com ``receitas`` (os slugs que existem hoje), sai do manifesto e da pasta o objeto gerado cuja receita foi
    apagada ou renomeada — um ``.glb`` sem receita não se regenera mais.
    """
    atual = json.loads(manifesto.read_text(encoding="utf-8")) if manifesto.exists() else []
    if receitas is not None:
        orfaos = [i for i in atual if str(i.get("source", "")).startswith(GERADOR) and i["slug"] not in receitas]
        for item in orfaos:
            (manifesto.parent / f"{item['slug']}.glb").unlink(missing_ok=True)
        atual = [i for i in atual if i not in orfaos]
    novas = {linha["slug"]: linha for linha in linhas}
    resultado = [novas.pop(item["slug"], item) for item in atual]
    resultado += list(novas.values())
    manifesto.write_text(json.dumps(resultado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return resultado


def main(argv: list[str] | None = None) -> int:
    from .receitas import carregar

    opcoes = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    opcoes.add_argument("--so", nargs="*", metavar="SLUG", help="gera só estes objetos")
    opcoes.add_argument("--listar", action="store_true", help="lista as receitas e sai")
    opcoes.add_argument("--pasta", type=Path, default=PASTA, help="pasta de saída (padrão: public/flair/3d/assets)")
    args = opcoes.parse_args(sys.argv[1:] if argv is None else argv)
    receitas = carregar()
    if args.listar:
        for r in receitas.values():
            print(f"{r.slug:22} {r.titulo}" + (f"  [móvel: {r.movel}]" if r.movel else ""))
        return 0
    slugs = args.so or list(receitas)
    desconhecidos = [s for s in slugs if s not in receitas]
    if desconhecidos:
        raise SystemExit(f"receita desconhecida: {', '.join(desconhecidos)} (veja --listar)")
    args.pasta.mkdir(parents=True, exist_ok=True)
    linhas = [gerar(slug, args.pasta) for slug in slugs]
    atualizar_manifesto(linhas, args.pasta / "manifest.json", set(receitas))
    for linha in linhas:
        print(f"{linha['slug']:22} {linha['triangles']:5} triângulos  {linha['bytes'] / 1024:6.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
