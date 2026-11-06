"""Fichas dos jogos FLAIR que não fazem parte do FLAIR 3D.

Lê docs/flair/modos-flair/fichas.json e escreve, na mesma pasta:
- modos-flair.xlsx: uma linha por jogo com cenário (miniatura da foto embutida), objetivo, participantes, cartas mínimas,
  Hype mínimo, efeito visual ao inserir uma carta e os efeitos Aura Hype, Metamorfose e Impersonation;
- README.md: o mesmo conteúdo em texto, uma seção por jogo.
Uso: python3 scripts/flair-modes/sheets.py
"""
import io
import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.drawing.image import Image as XlImage
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "flair" / "modos-flair"
SCENES = ROOT / "public" / "flair" / "games" / "scenes"
THUMB = (192, 120)

COLUMNS = [
    ("Código", "code", 12), ("Jogo", "name", 24), ("Grupo", "group", 16), ("Na lista?", "list", 16),
    ("Foto do cenário", None, 28), ("Cenário", "scene", 40), ("Objetivo", "objective", 44),
    ("Participantes", "participants", 26), ("Cartas mínimas obrigatórias", "minCards", 34),
    ("Hype mínimo obrigatório", "minHype", 30), ("Efeito visual ao inserir uma carta", "insert", 46),
    ("Aura Hype", "auraHype", 44), ("Aura Metamorfose", "metamorfose", 44),
    ("Aura Impersonation", "impersonation", 46), ("Hoje → depois", "today", 40),
]
HEAD = PatternFill("solid", fgColor="2B2140")


def photo_status(game: dict) -> tuple[Path | None, str]:
    venue = game.get("venue")
    if not venue:
        return None, "sem foto (fora da lista)"
    path = SCENES / f"{venue}.webp"
    return (path, venue) if path.exists() else (None, f"{venue} (foto pendente)")


def thumbnail(path: Path) -> XlImage:
    with Image.open(path) as img:
        img = img.convert("RGB")
        img.thumbnail(THUMB)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
    buf.seek(0)
    return XlImage(buf)


def write_xlsx(data: dict) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.title = "Jogos FLAIR"
    for i, (title, _, width) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=1, column=i, value=title)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = HEAD
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.freeze_panes = "C2"
    for r, game in enumerate(data["games"], start=2):
        ws.row_dimensions[r].height = 96
        path, label = photo_status(game)
        for c, (_, key, _) in enumerate(COLUMNS, start=1):
            value = game.get(key) if key else label
            cell = ws.cell(row=r, column=c, value=value)
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            if key is None and path:
                ws.add_image(thumbnail(path), f"{get_column_letter(c)}{r}")
                cell.alignment = Alignment(wrap_text=True, vertical="bottom")
    rules = wb.create_sheet("Regras")
    rules.column_dimensions["A"].width = 120
    for i, line in enumerate([data["rule"], data["hypeBands"]], start=1):
        rules.cell(row=i, column=1, value=line).alignment = Alignment(wrap_text=True, vertical="top")
    out = DOCS / "modos-flair.xlsx"
    wb.save(out)
    return out


def write_markdown(data: dict) -> Path:
    lines = [
        "# Jogos FLAIR fora do FLAIR 3D: fichas",
        "",
        "Gerado por `python3 scripts/flair-modes/sheets.py` a partir de `fichas.json` (não edite à mão).",
        "A planilha `modos-flair.xlsx` tem o mesmo conteúdo, com a miniatura da foto do cenário.",
        "",
        f"**Regra comum.** {data['rule']}",
        "",
        f"**Faixas de Hype.** {data['hypeBands']}",
        "",
        "| Código | Jogo | Grupo | Participantes | Cartas mínimas | Hype mínimo |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for g in data["games"]:
        lines.append(f"| {g['code']} | {g['name']} | {g['group']} | {g['participants']} | {g['minCards']} | {g['minHype']} |")
    for g in data["games"]:
        _, label = photo_status(g)
        lines += [
            "",
            f"## {g['name']} ({g['code']})",
            "",
            f"- **Na lista:** {g['list']}. **Foto:** {label}.",
            f"- **Cenário:** {g['scene']}",
            f"- **Objetivo:** {g['objective']}",
            f"- **Participantes:** {g['participants']}",
            f"- **Cartas mínimas obrigatórias:** {g['minCards']}",
            f"- **Hype mínimo obrigatório:** {g['minHype']}",
            f"- **Efeito visual ao inserir uma carta:** {g['insert']}",
            f"- **Aura Hype:** {g['auraHype']}",
            f"- **Aura Metamorfose:** {g['metamorfose']}",
            f"- **Aura Impersonation:** {g['impersonation']}",
            f"- **Hoje → depois:** {g['today']}",
        ]
    out = DOCS / "README.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out


def main() -> None:
    data = json.loads((DOCS / "fichas.json").read_text(encoding="utf-8"))
    print(write_xlsx(data))
    print(write_markdown(data))


if __name__ == "__main__":
    main()
