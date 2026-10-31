"""Interpreter for a bounded read-only audit query: lines comparisons, band, and/or, parentheses."""
from dataclasses import dataclass
import re


@dataclass(frozen=True)
class MatchAll:
    def matches(self, record):
        return True


@dataclass(frozen=True)
class Comparison:
    field: str
    operator: str
    value: object

    def matches(self, record):
        actual = getattr(record, self.field)
        return {'=': lambda: actual == self.value, '==': lambda: actual == self.value,
                '!=': lambda: actual != self.value, '>': lambda: actual > self.value,
                '>=': lambda: actual >= self.value, '<': lambda: actual < self.value,
                '<=': lambda: actual <= self.value}[self.operator]()


@dataclass(frozen=True)
class BooleanExpression:
    left: object
    operator: str
    right: object

    def matches(self, record):
        if self.operator == 'and':
            return self.left.matches(record) and self.right.matches(record)
        return self.left.matches(record) or self.right.matches(record)


class QueryParser:
    def __init__(self, text):
        if len(text) > 512:
            raise ValueError('Audit query exceeds 512 characters')
        self.tokens = []
        offset = 0
        for match in re.finditer(r'>=|<=|==|!=|[()><=]|[A-Za-z_]\w*|\d+', text):
            if text[offset:match.start()].strip():
                raise ValueError('Invalid audit query token')
            self.tokens.append(match.group()); offset = match.end()
        if text[offset:].strip():
            raise ValueError('Invalid audit query token')
        self.index = 0

    def take(self):
        if self.index >= len(self.tokens):
            raise ValueError('Incomplete audit query')
        value = self.tokens[self.index]; self.index += 1
        return value

    def expression(self, operator='or'):
        left = self.expression('and') if operator == 'or' else self.term()
        while self.index < len(self.tokens) and self.tokens[self.index] == operator:
            self.take()
            right = self.expression('and') if operator == 'or' else self.term()
            left = BooleanExpression(left, operator, right)
        return left

    def term(self):
        field = self.take()
        if field == '(':
            value = self.expression()
            if self.take() != ')':
                raise ValueError('Missing closing parenthesis')
            return value
        operator, raw = self.take(), self.take()
        if field == 'lines' and raw.isdecimal() and operator in {'=','==','!=','>','>=','<','<='}:
            return Comparison(field, operator, int(raw))
        if field == 'band' and operator in {'=','==','!='} and re.fullmatch('[A-Z_]+', raw):
            return Comparison(field, operator, raw)
        raise ValueError('Expected lines comparison or band equality')

    def parse(self):
        if not self.tokens:
            return MatchAll()
        result = self.expression()
        if self.index != len(self.tokens):
            raise ValueError('Unexpected trailing audit query token')
        return result
