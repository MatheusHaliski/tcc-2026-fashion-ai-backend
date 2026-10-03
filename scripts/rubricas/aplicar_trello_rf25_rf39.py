"""Aplica o lote aprovado de normalização RF25–RF39 no Trello.

Por padrão apenas imprime o plano. A escrita exige ``--apply``. O script é
idempotente por nome de card/checklist/item e nunca imprime credenciais ou URLs
autenticadas.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from urllib.parse import urlencode
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/rubricas/TDE_SECAO_4_RF25_RF39.md"
API = "https://api.trello.com/1"
REQUIRED = ("TRELLO_API_KEY", "TRELLO_TOKEN", "TRELLO_BOARD_ID")

HU_TITLES = {
    33: 'HU-RF33 — COMO usuário autenticado, POSSO explorar a Passarela 3D e seus rankings com fallback 2D, PARA descobrir Looks do Dia públicos em qualquer dispositivo',
    34: 'HU-RF34 — COMO visitante ou celebridade autorizada, POSSO explorar e administrar Eras, PARA navegar por fases editoriais sem expor rascunhos',
    35: 'HU-RF35 — COMO visitante ou marca autorizada, POSSO explorar e administrar Coleções, PARA navegar por linhas editoriais e itens disponíveis',
    36: 'HU-RF36 — COMO dono de uma peça ou look, POSSO gerar uma foto com meu manequim mediante consentimento, PARA publicar uma representação controlada e recuperável',
    37: 'HU-RF37 — COMO usuário autenticado, POSSO jogar os modos do FLAIR com resultado e recompensa consistentes, PARA competir usando meu próprio acervo',
    38: 'HU-RF38 — COMO usuário ou perfil institucional, POSSO emitir, consultar, usar e administrar cupons, PARA resgatar benefícios sem duplicação',
    39: 'HU-RF39 — COMO marca ou celebridade autorizada, POSSO criar e vender guarda-roupas 3D, PARA personalizar a loja do quarto com itens persistentes',
}

EXTRA_CA = {
    33: [
        "RF33.CA13 — Dado que o Look do Dia referencia foto/perfil, quando a Passarela renderiza o autor, então reutiliza as regras canônicas de RF1/RF23 sem duplicar cadastro ou consentimento.",
    ],
    34: [
        "RF34.CA09 — Dado que uma era está em rascunho, quando um visitante consulta o perfil, então ela e seus itens não são retornados.",
    ],
    35: [
        "RF35.CA08 — Dado que uma coleção está em rascunho ou um item está indisponível, quando um visitante consulta a coleção, então o conteúdo não é oferecido como publicável/comprável.",
    ],
    36: [
        "RF36.CA09 — Dado que não há consentimento vigente, quando o usuário solicita a geração, então nenhum job ou artefato é criado e a interface explica como consentir.",
        "RF36.CA10 — Dado que a renderização falha, quando o usuário tenta novamente, então o mesmo pedido não duplica artefato nem cobrança e a falha anterior permanece auditável.",
    ],
    37: [
        "RF37.CA13 — Dado que o mesmo resultado de partida é reprocessado, quando a recompensa é lançada, então placar, coins, FAI Points e direitos promocionais permanecem únicos.",
    ],
    38: [
        "RF38.CA11 — Dado que duas requisições tentam emitir ou consumir o mesmo direito, quando concorrem, então apenas uma confirma e a outra recebe conflito de domínio.",
        "RF38.CA12 — Dado que o cupom atingiu a expiração, quando é emitido ou usado, então a operação é recusada de forma determinística.",
        "RF38.CA13 — Dado que um cupom foi emitido, quando a marca valida o código, então apenas consulta autenticidade e estado; quando confirma usar, então o consumo é definitivo e idempotente.",
        "RF38.CA14 — Dado que ocorre falha durante emissão ou uso, quando a transação reverte, então não resta direito reservado nem cupom parcialmente consumido.",
    ],
    39: [
        "RF39.CA13 — Dado que um perfil pessoal ou visitante tenta criar/editar item, quando chama a API ou abre a rota, então recebe bloqueio coerente e nenhum dado é persistido.",
        "RF39.CA14 — Dado que o aparelho não suporta a cena completa, quando abre o criador/loja, então recebe modo leve ou fallback com as mesmas ações essenciais.",
    ],
}

TASKS = {
    33: ["[FE] Rota da Passarela, rankings/filtros, lotes e fallback 2D", "[BE] Contrato de ranking e filtros com privacidade", "[QA] Top 100, filtros combinados e WebGL indisponível"],
    34: ["[DB/BE] Estado editorial e autorização de Eras", "[FE] Eras, Insights e My Stage com fallback", "[QA] Rascunho não vaza; celebridade/admin editam; visitante só lê"],
    35: ["[DB/BE] Estado editorial, estoque e autorização de Coleções", "[FE] Coleções/Insights e representação 2D/3D", "[QA] Ciclo marca → publicação → visitante e item indisponível"],
    36: ["[BE] Consentimento, estado do job e retry idempotente", "[FE] Falha recuperável, consentimento e fallback", "[QA] Sucesso/falha/retry/revogação sem dado pessoal real"],
    37: ["[BE] Invariantes comuns de partida e recompensa única", "[FE] Estados de resultado para famílias dos 15 modos", "[QA] Matriz modo × regra × recompensa e reprocessamento"],
    38: ["[DB] Restrições únicas e transação de emissão/uso", "[BE] Separar emitir, validar e usar; relógio testável", "[FE] Mensagens para válido, expirado, usado e conflito", "[QA] Concorrência, fronteira de expiração e rollback"],
    39: ["[BE] Matriz RBAC e persistência de autoria/compra", "[FE] Criador, loja e modo leve/fallback", "[QA] Perfis permitido/proibido, retirada após venda e dispositivo modesto"],
}


class Trello:
    def __init__(self, apply: bool):
        self.apply = apply
        self.auth = {"key": os.environ["TRELLO_API_KEY"], "token": os.environ["TRELLO_TOKEN"]}

    def call(self, method: str, path: str, **params):
        if method != "GET" and not self.apply:
            print(f"DRY-RUN {method} {path}")
            return {}
        encoded = urlencode({**params, **self.auth}, doseq=True)
        # O gateway do Trello recusa POST sem corpo, mesmo quando todos os
        # parâmetros estão na query string. Escritas seguem como form data e
        # GETs permanecem na query; credenciais nunca aparecem nas mensagens.
        if method == "GET":
            request = Request(f"{API}{path}?{encoded}", method=method)
        else:
            request = Request(
                f"{API}{path}",
                data=encoded.encode("utf-8"),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                method=method,
            )
        try:
            with urlopen(request, timeout=30) as response:
                raw = response.read()
                return json.loads(raw) if raw else {}
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace").strip()
            if error.code == 403 and detail == "Method forbidden":
                proxy_hint = " Há proxy HTTP(S) configurado neste ambiente." if (
                    os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
                ) else ""
                detail += (
                    ". O método HTTP foi bloqueado antes da mutação; libere POST/PUT/DELETE "
                    "para api.trello.com ou execute por uma rota sem proxy." + proxy_hint
                )
            raise RuntimeError(f"Trello recusou {method} {path}: HTTP {error.code} — {detail}") from None


def criteria(description: str, rf: int) -> list[str]:
    pattern = re.compile(rf"[•-]\s*\*\*CA(\d+)\*\*\s*(.+?)(?=\n[•-]\s*\*\*CA|\n\n|\Z)", re.S)
    return [f"RF{rf}.CA{int(number):02d} — {' '.join(text.split())}" for number, text in pattern.findall(description)]


def strip_ca_block(description: str) -> str:
    return re.sub(r"\n?📋 \*\*Critérios de aceite.*?(?=\n\n(?:🔌|🧠|📄|🔗)|\Z)", "", description, flags=re.S).strip()


def card_by_prefix(cards: list[dict], prefix: str) -> dict:
    found = [card for card in cards if card["name"].startswith(prefix)]
    if len(found) != 1:
        raise RuntimeError(f"Esperado um card com prefixo {prefix!r}; encontrados {len(found)}")
    return found[0]


def ensure_checklist(api: Trello, card: dict, name: str) -> dict:
    current = next((item for item in card.get("checklists", []) if item["name"] == name), None)
    if current:
        return current
    created = api.call("POST", f"/cards/{card['id']}/checklists", name=name)
    if not api.apply:
        return {"id": "dry", "name": name, "checkItems": []}
    card.setdefault("checklists", []).append(created)
    return created


def ensure_items(api: Trello, checklist: dict, names: list[str]) -> None:
    existing = {item["name"] for item in checklist.get("checkItems", [])}
    for name in names:
        if name not in existing:
            api.call("POST", f"/checklists/{checklist['id']}/checkItems", name=name, checked="false")


def bryan_bodies() -> dict[str, str]:
    text = SOURCE.read_text(encoding="utf-8")
    blocks = re.findall(r"### B\d+ — `([^`]+)`\n\n(.*?)(?=\n### B\d+|\n## 9\.)", text, re.S)
    bodies = {title: body.strip() for title, body in blocks}
    if len(bodies) != 5:
        raise RuntimeError(f"Esperados cinco cards para Bryan; encontrados {len(bodies)}")
    return bodies


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="executa as escritas aprovadas")
    args = parser.parse_args()
    missing = [name for name in REQUIRED if not os.environ.get(name)]
    if missing:
        raise SystemExit("Variáveis ausentes: " + ", ".join(missing))
    api = Trello(args.apply)
    board = os.environ["TRELLO_BOARD_ID"]
    cards = api.call("GET", f"/boards/{board}/cards", fields="name,desc,idList,idMembers,labels,dateLastActivity", checklists="all")
    lists = api.call("GET", f"/boards/{board}/lists", fields="name")
    labels = api.call("GET", f"/boards/{board}/labels", fields="name", limit=1000)
    members = api.call("GET", f"/boards/{board}/members", fields="fullName,username")
    product = next(item for item in lists if item["name"] == "Product Backlog")
    sprint4 = next(item for item in labels if item["name"] == "Sprint 04")
    bryan = next(item for item in members if item.get("username") == "bryanstrey1")

    # RF25: checklist canônica na HU; descrição do RF vira ponteiro.
    rf25, hu25 = card_by_prefix(cards, "RF25-"), card_by_prefix(cards, "HU-RF25")
    ca25 = criteria(rf25["desc"], 25)
    check = ensure_checklist(api, hu25, "Critérios de Aceite")
    ensure_items(api, check, ca25)
    title25 = "HU-RF25 — COMO marca ou celebridade autenticada, POSSO criar e gerenciar os selos do meu perfil, PARA vinculá-los a peças e looks elegíveis e oferecer promoções verificáveis"
    api.call("PUT", f"/cards/{hu25['id']}", name=title25, desc="Critérios funcionais canônicos na checklist abaixo. Dependências e contexto permanecem no RF25.")
    api.call("PUT", f"/cards/{rf25['id']}", desc=strip_ca_block(rf25["desc"]) + "\n\n📋 Critérios canônicos: HU-RF25, checklist Critérios de Aceite.")

    # RF26: CAs de usuário em checklist; decisão de arquitetura em tarefas.
    rf26, hu26 = card_by_prefix(cards, "RF26-"), card_by_prefix(cards, "HU-RF26")
    draft = re.findall(r"•\s*CA(\d+)\s+(.+?)(?=\n•\s*CA|\n\n|\Z)", hu26["desc"], re.S)
    ca26 = [f"RF26.CA{int(n):02d} — {' '.join(t.split())}" for n, t in draft[:3]]
    ensure_items(api, ensure_checklist(api, hu26, "Critérios de Aceite"), ca26)
    ensure_items(api, ensure_checklist(api, hu26, "Tarefas por área"), ["[DB/BE] Manter região herdada de User.country; não duplicar região em peça/esquema"])
    clean26 = re.sub(r"Critérios de aceite \(rascunho.*?(?=\n\n🔗)", "Critérios canônicos nas checklists abaixo.", hu26["desc"], flags=re.S).replace("&amp;", "&")
    api.call("PUT", f"/cards/{hu26['id']}", name=hu26["name"].replace("&amp;", "&"), desc=clean26)
    api.call("PUT", f"/cards/{rf26['id']}", name=rf26["name"].replace("&amp;", "&"), desc=rf26["desc"].replace("&amp;", "&"))

    # Remove somente duplicatas textuais dos cards RF27/RF28.
    for number, marker in ((27, "🆕 **CA12"), (28, "🆕 **CA16")):
        rf = card_by_prefix(cards, f"RF{number}-")
        desc = re.sub(rf"\n?{re.escape(marker)}.*?(?=\n\n)", "", rf["desc"], flags=re.S)
        api.call("PUT", f"/cards/{rf['id']}", desc=desc)

    # RF31.CA07 vira tarefa FE; só então o item antigo é removido.
    hu31 = card_by_prefix(cards, "HU-RF31")
    ca_list = next(item for item in hu31["checklists"] if item["name"] == "Critérios de Aceite")
    task_list = next(item for item in hu31["checklists"] if item["name"] == "Tarefas por área")
    ca07 = next((item for item in ca_list["checkItems"] if item["name"].startswith("RF31.CA07")), None)
    ensure_items(api, task_list, ["[FE] Aplicar especificação visual dos toggles: favorita compacta, estados exclusivos e rótulo sem aumentar o card"])
    if ca07:
        api.call("DELETE", f"/checklists/{ca_list['id']}/checkItems/{ca07['id']}")

    # HU33–HU39: copia os CAs existentes, acrescenta bordas e cria tarefas.
    for number in range(33, 40):
        rf = card_by_prefix(cards, f"RF{number}-")
        existing = next((card for card in cards if card["name"].startswith(f"HU-RF{number} ")), None)
        if existing:
            hu = existing
        else:
            hu = api.call("POST", "/cards", idList=product["id"], name=HU_TITLES[number],
                          desc=f"HU canônica do RF{number}. Dependências e especificação permanecem no card RF{number}.",
                          idLabels=sprint4["id"])
            if not api.apply:
                hu = {"id": f"dry-{number}", "name": HU_TITLES[number], "checklists": []}
        cas = criteria(rf["desc"], number) + EXTRA_CA.get(number, [])
        ensure_items(api, ensure_checklist(api, hu, "Critérios de Aceite"), cas)
        ensure_items(api, ensure_checklist(api, hu, "Tarefas por área"), TASKS[number])
        if api.apply:
            api.call("PUT", f"/cards/{rf['id']}", desc=strip_ca_block(rf["desc"]) + f"\n\n📋 Critérios canônicos: HU-RF{number}, checklist Critérios de Aceite.")

    # Cards funcionais aprovados e atribuídos a Bryan.
    for title, body in bryan_bodies().items():
        existing = next((card for card in cards if card["name"] == title), None)
        if existing:
            card = existing
        else:
            card = api.call("POST", "/cards", idList=product["id"], name=title, desc=body,
                            idLabels=sprint4["id"], idMembers=bryan["id"])
        if api.apply and bryan["id"] not in card.get("idMembers", []):
            api.call("POST", f"/cards/{card['id']}/idMembers", value=bryan["id"])

    print("APLICADO" if args.apply else "DRY-RUN concluído", "— lote RF25–RF39")
    if args.apply:
        after = api.call("GET", f"/boards/{board}/cards", fields="name,idList,idMembers,labels", checklists="all")
        for number in range(33, 40):
            assert any(card["name"].startswith(f"HU-RF{number} ") for card in after)
        for title in bryan_bodies():
            card = next(card for card in after if card["name"] == title)
            assert bryan["id"] in card.get("idMembers", [])
        print("Releitura validada: HU-RF33–RF39 e cinco cards atribuídos a Bryan.")


if __name__ == "__main__":
    main()
