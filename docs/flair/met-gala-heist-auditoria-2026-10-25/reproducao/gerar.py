import json, sys
br = lambda v, d=1: f"{v:.{d}f}".replace(".", ",")
sys.path.insert(0, sys.argv[1]); from notas import SECOES, DIMENSOES
out = []
def media(secs, skip=()):
    v = [n for s in secs if s not in skip for (_, n, _, _) in SECOES[s][1] if n is not None]
    return (sum(v) / len(v) / 4 * 100) if v else None, len(v)
resumo = {}
for k, (titulo, itens) in SECOES.items():
    m, n = media([k]); resumo[k] = {"titulo": titulo, "pct": round(m, 1), "itens": len(itens), "avaliados": n}
    out.append(f"\n### {k}. {titulo} — {m:.0f} % ({n} de {len(itens)} itens avaliados)\n")
    out.append("| # | Requisito | Nota | Gravidade | Evidência |\n| --- | --- | --- | --- | --- |")
    for i, (req, nota, grav, ev) in enumerate(itens, 1):
        out.append(f"| {k}.{i} | {req} | {'N/A' if nota is None else nota} | {grav or '—'} | {ev} |")
tab = ["| Dimensão | Peso | Seções | Pontuação | Contribuição |", "| --- | --- | --- | --- | --- |"]; total = 0; total2 = 0; w2 = 0
for nome, peso, secs in DIMENSOES:
    m, _ = media(secs); total += peso * m / 100
    tab.append(f"| {nome} | {peso} % | {', '.join(secs)} | {br(m, 0)} % | {br(peso * m / 100)} |")
    # variante: combate fora do escopo por design (só a seção 10 conta na dimensão)
    m2, _ = media(secs, skip=("9",)); total2 += peso * m2 / 100
tab.append(f"| **Total ponderado** | 100 % | | | **{br(total)} / 100** |")
graves = {}
for k, (_, itens) in SECOES.items():
    for (_, n, g, _) in itens:
        if n is not None and n <= 2 and g: graves[g] = graves.get(g, 0) + 1
json.dump({"secoes": resumo, "total": round(total, 1), "totalSemCombate": round(total2, 1), "defeitos": graves}, open(sys.argv[2] + "/pontuacao.json", "w"), ensure_ascii=False, indent=1)
open(sys.argv[2] + "/tabelas.md", "w").write("\n".join(out) + "\n")
open(sys.argv[2] + "/pontuacao.md", "w").write("\n".join(tab) + "\n")
print(json.dumps({"total": round(total, 1), "totalSemCombate": round(total2, 1), "defeitos": graves}, ensure_ascii=False))
for k, r in resumo.items(): print(k, r["titulo"], r["pct"])
