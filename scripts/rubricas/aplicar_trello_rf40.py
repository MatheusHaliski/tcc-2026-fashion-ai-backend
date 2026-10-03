"""Aplica no Trello o lote RF40 (Avatar 3D) de 29/09/2026: critérios de aceite novos e cards do plano.

Mesmo contrato de ``aplicar_trello_rf25_rf39.py``: sem ``--apply`` só imprime o plano; é idempotente (compara pelo
texto do critério e pelo título do card, não pelo número); nunca imprime chave, token ou URL autenticada; não
atribui responsáveis nem labels (decisão da equipe). Especificação revisável:
``docs/rubricas/TRELLO_RF40_LOTE_PROPOSTO.md``.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from aplicar_trello_rf25_rf39 import REQUIRED, Trello, ensure_checklist, ensure_items  # noqa: E402

HU_TITLE = ("HU-RF40 — COMO usuário autenticado, POSSO gerar meu Avatar 3D a partir de uma foto, com corpo base, "
            "cabelo e roupa fiéis a mim, PARA usá-lo no provador, no quarto e na passarela")

# Critérios novos (texto sem número: o número é o próximo livre do RF40 no board).
NEW_CA = [
    "Dado uma foto com um rosto, quando o avatar é gerado, então o corpo base (feminino/masculino) é estimado no próprio aparelho; com certeza abaixo de 70% vale o sexo do cadastro; a pessoa troca em \"Corpo base\" e a escolha fica salva no modelo.",
    "Dado que a foto mostra cabelo — inclusive loiro claro, cabelo da cor do fundo ou rosto pequeno na foto —, quando o avatar é gerado, então o avatar nunca sai careca; careca só quando o alto da cabeça mostra couro cabeludo liso.",
    "Dado que a foto não permite decidir se há cabelo (escura, cortada, borrada), quando o avatar é gerado, então recebe cabelo suposto pelo corpo base, aviso \"cabelo estimado\" e os ajustes de corte e tom.",
    "Dado o cabelo medido na foto, quando o avatar é exibido, então o volume (rente, normal, volumoso, muito volumoso) é aplicado ao cabelo 3D e mostrado junto do ajuste \"Volume do cabelo\" (100% = o medido).",
    "Dado o avatar criado, quando a pessoa escolhe um corte (raspado, curto, topete, joãozinho, chanel, médio, longo), então só o corte muda — cor, tom e textura continuam os medidos ou os escolhidos.",
    "Dado um avatar sem franja, quando é exibido de frente, então a linha do cabelo deixa a testa visível (5–6 cm acima da sobrancelha) e, nos cortes curtos, contorna a orelha.",
]

TASKS = [
    "[QA] Conjunto de teste de cabelo (≥ 60 fotos com consentimento/licença) e bloqueio de \"falso careca\" no CI",
    "[FE] Cabelo longo por cima da roupa (não some sob a camiseta)",
    "[FE] Cabelo por fios: guias + fios + mechas, sombreamento de fio e níveis de detalhe",
    "[FE/ARTE] Biblioteca de 24–30 penteados, escolha automática e ajuste à silhueta medida",
]

# Cards funcionais do plano (docs/avatar3d/plano-cabelo-realista-e-acabamentos.md), sem responsável.
CARDS = {
    "[RF40][QA] Nunca careca por engano: conjunto de teste e bloqueio no CI":
        "Contexto: o avatar saía careca quando a foto tinha cabelo (rosto pequeno, loiro claro, cabelo da cor do fundo). As causas foram corrigidas; falta a garantia contínua.\n\n"
        "Escopo: ≥ 60 fotos com consentimento ou licença, balanceadas (tom de pele, cor/tipo/comprimento de cabelo, carecas e raspados reais, coberturas); variantes sintéticas; rótulos; teste que falha o CI com qualquer falso careca.\n\n"
        "Critérios de aceite: 0 falsos carecas; ≤ 5% de cabelo em quem é careca; relatório por grupo.\n\nPlano: seção A2.",
    "[RF40][FE] Cabelo realista por fios (nível EA FC)":
        "Contexto: a casca deslocada lê como capacete; realismo de fio exige outra representação.\n\n"
        "Escopo: guias (150–400) + fios interpolados (8–60 mil conforme o aparelho) + mechas; sombreamento de fio (dois brilhos em faixa), cor por melanina, raiz escura, fios soltos, transparência sem serrilhado; níveis de detalhe automáticos; casca atual como reserva.\n\n"
        "Critérios de aceite: IoU da silhueta ≥ 0,80; ΔE2000 ≤ 8; painel humano ≥ 4/5; tempo de GPU do cabelo ≤ 3 ms no celular intermediário.\n\nPlano: seção A3.",
    "[RF40][FE/ARTE] Biblioteca de penteados ajustada à foto":
        "Escopo: 24–30 penteados com guias (Blender), escolha automática por comprimento/volume/textura/franja/risca, deformação para a silhueta e o alto medidos, colisão com corpo e roupa; lista de cortes passa a listar os penteados.\n\n"
        "Critérios de aceite: comprimento correto ≥ 90%; volume com no máximo uma classe de erro; sem cabelo atravessando roupa/ombro.\n\nPlano: seção A3.2.",
    "[RF36][FE/BE] Especificação de construção da peça (gola, mangas, barra, costuras)":
        "Escopo: esquema validado no app e no backend; extração por visão computacional na foto de estúdio + IA de visão com saída estruturada + confirmação opcional no formulário (Mais detalhes).\n\n"
        "Critérios de aceite: tipo de gola/punho/barra correto em 100% do conjunto de peças de teste; larguras ±3 mm.\n\nPlano: seção B3.",
    "[RF36][FE] Gola, mangas, barra e costuras construídas em 3D":
        "Escopo: linha do decote por pontos anatômicos; gola por varredura orientada pela superfície (careca, V, polo, colarinho, capuz, gola alta); barra dobrada ou punho de ribana nas mangas; recorte limpo da borda do tecido (fim do serrilhado); pespontos; materiais (ribana, jersey, sarja, jeans).\n\n"
        "Critérios de aceite: sem aba nas costas nem \"V\" largo no peito; borda sem serrilhado; cor das faixas ΔE2000 ≤ 5.\n\nPlano: seção B4.",
    "[RF36][FE/QA] Painéis de molde, foto das costas e relatório de fidelidade":
        "Escopo: UV por painéis (frente, costas, mangas, gola) com encaixe por pontos-chave; foto opcional das costas; render na pose da foto e comparação automática (IoU, larguras, cores, posição do logo) anexada ao PR.\n\n"
        "Critérios de aceite: IoU da peça ≥ 0,90; logo ≤ 1 cm; estampa sem esticar nas laterais.\n\nPlano: seções B5–B6.",
}


def card_by_prefix(cards: list[dict], prefix: str) -> dict | None:
    found = [card for card in cards if card["name"].startswith(prefix)]
    if len(found) > 1:
        raise RuntimeError(f"Mais de um card com prefixo {prefix!r}: {len(found)}")
    return found[0] if found else None


def next_ca(rf: dict | None, hu: dict | None) -> int:
    """Próximo número livre de CA do RF40 (descrição do RF e checklists da HU)."""
    nums = [int(n) for n in re.findall(r"CA(\d+)", (rf or {}).get("desc", ""))]
    for checklist in (hu or {}).get("checklists", []):
        nums += [int(n) for item in checklist.get("checkItems", []) for n in re.findall(r"^RF40\.CA(\d+)", item["name"])]
    return (max(nums) if nums else 0) + 1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="executa as escritas aprovadas")
    args = parser.parse_args()
    missing = [name for name in REQUIRED if not os.environ.get(name)]
    if missing:
        raise SystemExit("Variáveis ausentes: " + ", ".join(missing))
    api = Trello(args.apply)
    board = os.environ["TRELLO_BOARD_ID"]
    cards = api.call("GET", f"/boards/{board}/cards", fields="name,desc,idList", checklists="all")
    lists = api.call("GET", f"/boards/{board}/lists", fields="name")
    product = next(item for item in lists if item["name"] == "Product Backlog")

    rf = card_by_prefix(cards, "RF40-")
    if rf is None:
        print("Aviso: card RF40 não encontrado; os critérios vão só para a HU (o RF não é inventado).")
    hu = card_by_prefix(cards, "HU-RF40")
    if hu is None:
        desc = "HU canônica do RF40 (Avatar 3D). Plano: docs/avatar3d/plano-cabelo-realista-e-acabamentos.md."
        hu = api.call("POST", "/cards", idList=product["id"], name=HU_TITLE, desc=desc)
        if not api.apply:
            hu = {"id": "dry-hu40", "name": HU_TITLE, "checklists": []}

    # critérios: idempotente pelo texto (o número é só o próximo livre)
    ca_list = ensure_checklist(api, hu, "Critérios de Aceite")
    have = {item["name"].split(" — ", 1)[-1] for item in ca_list.get("checkItems", [])}
    n = next_ca(rf, hu)
    todo = []
    for text in NEW_CA:
        if text not in have:
            todo.append(f"RF40.CA{n:02d} — {text}"); n += 1
    ensure_items(api, ca_list, todo)
    ensure_items(api, ensure_checklist(api, hu, "Tarefas por área"), TASKS)

    for title, body in CARDS.items():
        if not any(card["name"] == title for card in cards):
            api.call("POST", "/cards", idList=product["id"], name=title, desc=body)

    print("APLICADO" if args.apply else "DRY-RUN concluído", f"— lote RF40: {len(todo)} CA, {len(TASKS)} tarefas, {len(CARDS)} cards")
    if args.apply:
        after = api.call("GET", f"/boards/{board}/cards", fields="name", checklists="all")
        for title in CARDS:
            assert any(card["name"] == title for card in after), title
        print("Releitura validada: HU-RF40 e cards do plano presentes.")


if __name__ == "__main__":
    main()
