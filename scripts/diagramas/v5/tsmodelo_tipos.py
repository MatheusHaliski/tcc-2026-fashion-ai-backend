"""Registros do modelo do frontend: função, tipo, módulo e passo."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TsFunc:
    name: str
    module: str
    exported: bool
    kind: str               # function | component | method
    node: object = None
    line: int = 0


@dataclass
class TsType:
    name: str
    module: str
    kind: str               # interface | type | union | class
    props: list = field(default_factory=list)     # [(nome, tipo)]
    values: list = field(default_factory=list)    # literais da união


@dataclass
class TsModule:
    path: str               # relativo à raiz
    imports: dict           # identificador local -> (módulo relativo ou pacote, nome importado)
    funcs: dict
    types: dict
    src: bytes = b''
    states: dict = field(default_factory=dict)    # setter -> (variável, tipo/literais iniciais)


@dataclass
class TsStep:
    kind: str               # call | api | guard | set
    target: str = ''        # módulo da função chamada / rota
    name: str = ''          # função chamada / setter
    value: str = ''
    cond: str = ''
    verb: str = ''
