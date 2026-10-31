"""Catraca de linhas por arquivo: arquivos novos respeitam o limite, arquivos acima dele nunca crescem.

Regras (ver docs/refactoring/LINE_RULES.md):
- código de produção: no máximo 250 linhas físicas; testes: no máximo 400;
- arquivo que já passava do limite em 2026-10-31 fica congelado no tamanho registrado em line_baseline.json e só
  pode diminuir; ao diminuir, ``--update`` baixa o teto (nunca aumenta);
- exceção nova exige entrada manual no baseline com ``reason`` revisada em PR.

Uso: ``python -m scripts.refactoring.line_ratchet`` (checa) ou ``--update`` (aperta o baseline).
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

LIMITS = {'production': 250, 'test': 400}
CODE = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.java', '.py', '.kt', '.css', '.scss', '.sh', '.groovy'}
EXCLUDED_PARTS = {'node_modules', '.git', '.next', 'target', 'dist', 'build', 'coverage', 'vendor', 'vendored',
                  'third_party', '.venv', 'venv', '__pycache__', 'work', '.tooling', '.claude'}
EXEMPT_PREFIXES = ('docs/',)
TEST_RE = re.compile(r'(^|/)(src/test|tests?|test-utils|__tests__)/|\.(test|spec)\.[cm]?[jt]sx?$|(^|/)test_[^/]+\.py$|_test\.py$')
BASELINE = Path(__file__).with_name('line_baseline.json')


def kind(path: str) -> str:
    return 'test' if TEST_RE.search(path) else 'production'


def governed(path: str) -> bool:
    p = Path(path)
    return (p.suffix in CODE and not set(p.parts) & EXCLUDED_PARTS
            and not path.startswith(EXEMPT_PREFIXES) and '/migration/' not in path)


def count_lines(file: Path) -> int:
    with file.open('rb') as fh:
        return sum(1 for _ in fh)


def list_files(root: Path) -> list[str]:
    out = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=root)
    return sorted({p for p in out.decode().split('\0') if p and governed(p) and (root / p).is_file()})


def measure(root: Path) -> dict[str, int]:
    return {p: count_lines(root / p) for p in list_files(root)}


def load(path: Path = BASELINE) -> dict[str, dict]:
    return json.loads(path.read_text(encoding='utf-8'))['files'] if path.exists() else {}


def check(sizes: dict[str, int], baseline: dict[str, dict]) -> tuple[list[str], list[str]]:
    """Devolve (violações, entradas do baseline que podem ser apertadas)."""
    violations, stale = [], []
    for path, lines in sorted(sizes.items()):
        limit = LIMITS[kind(path)]
        frozen = baseline.get(path)
        if frozen is None and lines > limit:
            violations.append(f'{path}: {lines} linhas > limite {limit} ({kind(path)}); divida por responsabilidade')
        elif frozen is not None and lines > frozen['max']:
            violations.append(f'{path}: cresceu para {lines} linhas (teto congelado {frozen["max"]}); '
                              'extraia antes de acrescentar')
    for path, frozen in sorted(baseline.items()):
        lines = sizes.get(path)
        if lines is None or lines < frozen['max']:
            stale.append(f'{path}: teto {frozen["max"]} -> {lines if lines is not None else "removido"}')
    return violations, stale


def tightened(sizes: dict[str, int], baseline: dict[str, dict]) -> dict[str, dict]:
    out = {}
    for path, frozen in baseline.items():
        lines = sizes.get(path)
        if lines is not None and lines > LIMITS[kind(path)]:
            out[path] = {**frozen, 'max': min(frozen['max'], lines)}
    return dict(sorted(out.items()))


def save(files: dict[str, dict], path: Path = BASELINE) -> None:
    doc = {'limits': LIMITS, 'rule': 'docs/refactoring/LINE_RULES.md', 'files': files}
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def main(argv=None) -> int:
    import argparse
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--update', action='store_true', help='baixa tetos e remove arquivos já dentro do limite')
    parser.add_argument('--strict', action='store_true', help='falha também quando o baseline pode ser apertado')
    args = parser.parse_args(argv)
    root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel']).decode().strip())
    sizes, baseline = measure(root), load()
    violations, stale = check(sizes, baseline)
    if args.update:
        save(tightened(sizes, baseline))
        print(f'baseline apertado: {len(stale)} entradas atualizadas')
        stale = []
    for line in violations:
        print('VIOLAÇÃO', line)
    for line in stale:
        print('APERTAR', line, '(rode: python -m scripts.refactoring.line_ratchet --update)')
    print(f'{len(sizes)} arquivos governados; {len(baseline)} congelados; {len(violations)} violações')
    return 1 if violations or (args.strict and stale) else 0


if __name__ == '__main__':
    raise SystemExit(main())
