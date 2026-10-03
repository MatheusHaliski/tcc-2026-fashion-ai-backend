"""Confere, sem alterar cards, se as credenciais do Trello acessam o board."""
from __future__ import annotations

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

REQUIRED = ("TRELLO_API_KEY", "TRELLO_TOKEN", "TRELLO_BOARD_ID")


def main() -> int:
    missing = [name for name in REQUIRED if not os.environ.get(name)]
    if missing:
        print("Variáveis ausentes: " + ", ".join(missing), file=sys.stderr)
        print("Configure-as no ambiente ou carregue um .env local; não faça commit dos valores.", file=sys.stderr)
        return 2

    board_id = os.environ["TRELLO_BOARD_ID"]
    query = urlencode({
        "key": os.environ["TRELLO_API_KEY"],
        "token": os.environ["TRELLO_TOKEN"],
        "fields": "name,url,closed",
    })
    url = f"https://api.trello.com/1/boards/{board_id}?{query}"
    try:
        with urlopen(url, timeout=20) as response:
            board = json.load(response)
    except HTTPError as error:
        print(f"Trello respondeu HTTP {error.code}; confira board, chave, token e permissões.", file=sys.stderr)
        return 1
    except URLError as error:
        print(f"Não foi possível alcançar o Trello: {error.reason}", file=sys.stderr)
        return 1

    print(f"Acesso somente leitura confirmado: {board['name']}")
    print(f"Board: {board['url']} · fechado={board['closed']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
