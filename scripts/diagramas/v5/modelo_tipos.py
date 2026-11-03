"""Registros do modelo Java: campo, método e tipo (classe, interface, record ou enum)."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Field:
    name: str
    type: str
    annotations: dict
    init: str | None = None


@dataclass
class Method:
    name: str
    annotations: dict
    params: list
    returns: str
    node: object = None
    line: int = 0


@dataclass
class TypeInfo:
    name: str
    kind: str                      # class | interface | record | enum
    package: str
    file: str
    module: str                    # domain | application | web | infra-mysql | infra-cassandra | bootstrap
    annotations: dict
    superclass: str | None
    interfaces: list
    fields: list
    ctor: list                     # [(tipo, nome)]
    methods: list
    constants: list                # valores do enum
    static_strings: dict           # constantes String do tipo (NOME -> valor)
    outer: str | None = None
    const_args: dict = field(default_factory=dict)   # valor do enum -> argumentos do construtor (texto)
    static_ints: dict = field(default_factory=dict)  # constantes int do tipo (NOME -> valor)

    @property
    def fqn(self):
        return f'{self.package}.{self.name}'
