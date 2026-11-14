"""Planilha de evidências dos jogos FLAIR 3D.

Lê evidencias/resultados.json (gerado por evidence.mjs) e escreve jogos-flair-3d.xlsx com as colunas
pedidas: Conseguiu concluir?, Cartas inseridas, Cartas utilizadas, Pré-requisitos, Recompensa ganha e Foto de evidência
(hiperlink relativo para a captura). Uso: python3 scripts/flair-games/evidence_xlsx.py <pasta-evidencias>
"""
import json
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

COLUMNS = [
    ("Nº", 6), ("Jogo", 30), ("Série", 7), ("Distrito", 12), ("Dificuldade", 12), ("Raridade", 12),
    ("Nível de XP exigido", 14), ("Nível do guarda-roupa exigido", 18), ("Conseguiu concluir?", 14),
    ("Cartas inseridas", 44), ("Cartas utilizadas", 44), ("Pré-requisitos", 50), ("Recompensa ganha", 40),
    ("Foto de evidência", 36), ("Observação", 50),
]


def main(folder: str) -> None:
    out_dir = Path(folder)
    rows = json.loads((out_dir / "resultados.json").read_text(encoding="utf-8"))
    wb = Workbook()
    ws = wb.active
    ws.title = "Jogos FLAIR 3D"
    for i, (title, width) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=1, column=i, value=title)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1F3A5F")
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.freeze_panes = "A2"
    for r, g in enumerate(rows, start=2):
        values = [
            g["number"], g["name"], g["series"], g.get("district", ""), g.get("difficulty", ""), g.get("rarity", ""),
            g.get("requiredTier", ""), g.get("requiredWardrobeLevel", ""), "Sim" if g.get("completed") else "Não",
            "\n".join(g.get("cardsInserted", [])), "\n".join(g.get("cardsUsed", [])), "\n".join(g.get("prerequisites", [])),
            "\n".join(g.get("rewards", [])), None, g.get("note", ""),
        ]
        for c, v in enumerate(values, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.alignment = Alignment(wrap_text=True, vertical="top")
        shot = g.get("screenshot")
        link = ws.cell(row=r, column=14, value=shot or "(sem captura)")
        if shot:
            link.hyperlink = shot
            link.font = Font(color="0563C1", underline="single")
        if not g.get("completed"):
            ws.cell(row=r, column=9).fill = PatternFill("solid", fgColor="F8D7DA")
    summary = wb.create_sheet("Resumo")
    done = sum(1 for g in rows if g.get("completed"))
    summary.append(["Jogos testados", len(rows)])
    summary.append(["Concluídos", done])
    summary.append(["Não concluídos", len(rows) - done])
    summary.append(["Ambiente", rows[0].get("environment", "") if rows else ""])
    target = out_dir / "jogos-flair-3d.xlsx"
    wb.save(target)
    print(f"{target}: {len(rows)} linhas, {done} concluídos")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "docs/flair/flair-3d-make-up/evidencias")
