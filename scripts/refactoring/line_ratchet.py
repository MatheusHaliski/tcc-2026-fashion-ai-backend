"""Catraca de linhas por arquivo: cada categoria tem um limite máximo; arquivos acima dele nunca crescem.

Regras (ver docs/refactoring/LINE_RULES.md):
- limite máximo por categoria de arquivo (``CATEGORY_LIMITS``), p.ex. hook 150, controller 200, service 250,
  teste 400;
- arquivo que já passava do limite fica congelado no tamanho registrado em line_baseline.json e só pode diminuir;
  ao diminuir, ``--update`` baixa o teto (nunca aumenta);
- exceção nova exige entrada manual no baseline com ``reason`` revisada em PR.

Uso: ``python -m scripts.refactoring.line_ratchet`` (checa), ``--update`` (aperta o baseline) ou ``--limits``
(imprime a tabela de limites).
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

# Limite máximo de linhas físicas por categoria (ordem = ordem da tabela em LINE_RULES.md).
CATEGORY_LIMITS = {
    'teste': 400,                 # testes, fixtures e kits de teste
    'hook': 150,                  # hooks React use-*.ts(x)
    'route-handler': 150,         # route.ts (BFF/API do Next) e middleware.ts
    'pagina': 250,                # page/layout/loading/error/not-found/template do App Router
    'componente': 250,            # componentes React .tsx/.jsx
    'lib-ts': 250,                # módulos TS/JS de lib/, components/ sem JSX, app/
    'java-controller': 200,       # controllers Spring (fai-web)
    'java-repositorio': 120,      # interfaces Spring Data *Repository
    'java-dto': 120,              # DTOs/records de request/response
    'java-entidade': 250,         # entidades/embeddables JPA (fai-domain/model)
    'java-service': 250,          # *Service
    'java-adapter': 250,          # adapters de infraestrutura (fai-infrastructure)
    'java-outro': 250,            # políticas, regras, utilitários, configuração Java
    'python': 250,                # scripts, pipelines e serviços Python
    'script-js': 250,             # scripts Node em scripts/
    'css': 250,                   # folhas de estilo
    'outro': 250,                 # shell, Kotlin, Groovy
}
LIMITS = {'production': 250, 'test': CATEGORY_LIMITS['teste']}   # compatibilidade: teto geral por tipo
CODE = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.java', '.py', '.kt', '.css', '.scss', '.sh', '.groovy'}
EXCLUDED_PARTS = {'node_modules', '.git', '.next', 'target', 'dist', 'build', 'coverage', 'vendor', 'vendored',
                  'third_party', '.venv', 'venv', '__pycache__', 'work', '.tooling', '.claude'}
EXEMPT_PREFIXES = ('docs/',)
TEST_RE = re.compile(r'(^|/)(src/test|tests?|test-utils|__tests__)/|\.(test|spec)\.[cm]?[jt]sx?$|(^|/)test_[^/]+\.py$|_test\.py$')
PAGE_FILES = {'page', 'layout', 'loading', 'error', 'not-found', 'global-error', 'template', 'default'}
HOOK_RE = re.compile(r'^use(-[\w-]+|[A-Z]\w*)$')
JS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}
BASELINE = Path(__file__).with_name('line_baseline.json')


def kind(path: str) -> str:
    return 'test' if TEST_RE.search(path) else 'production'


def category(path: str) -> str:
    if kind(path) == 'test':
        return 'teste'
    p = Path(path)
    stem, suffix = p.name.split('.')[0], p.suffix
    if suffix in ('.css', '.scss'):
        return 'css'
    if suffix == '.py':
        return 'python'
    if suffix == '.java':
        return _java_category(path, p.name)
    if suffix in JS:
        return _js_category(path, stem, suffix)
    return 'outro'


def _java_category(path: str, name: str) -> str:
    if name.endswith('Controller.java') or '/controller/' in path:
        return 'java-controller'
    if name.endswith('Repository.java') and '/repository/' in path:
        return 'java-repositorio'
    if '/dto/' in path or name.endswith(('Dto.java', 'Request.java', 'Response.java')):
        return 'java-dto'
    if path.startswith('fai-domain/') and '/model/' in path:
        return 'java-entidade'
    if name.endswith('Service.java'):
        return 'java-service'
    if path.startswith('fai-infrastructure/'):
        return 'java-adapter'
    return 'java-outro'


def _js_category(path: str, stem: str, suffix: str) -> str:
    if path.startswith('scripts/'):
        return 'script-js'
    if path.startswith('app/') and stem in PAGE_FILES:
        return 'pagina'
    if (path.startswith('app/') and stem == 'route') or path == 'middleware.ts':
        return 'route-handler'
    if HOOK_RE.match(stem):
        return 'hook'
    return 'componente' if suffix in ('.tsx', '.jsx') else 'lib-ts'


def limit(path: str) -> int:
    return CATEGORY_LIMITS[category(path)]


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
        cap, frozen = limit(path), baseline.get(path)
        if frozen is None and lines > cap:
            violations.append(f'{path}: {lines} linhas > limite {cap} ({category(path)}); '
                              'refatore criando arquivos auxiliares')
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
        if lines is not None and lines > limit(path):
            out[path] = {**frozen, 'max': min(frozen['max'], lines)}
    return dict(sorted(out.items()))


def save(files: dict[str, dict], path: Path = BASELINE) -> None:
    doc = {'limits': CATEGORY_LIMITS, 'rule': 'docs/refactoring/LINE_RULES.md', 'files': files}
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def main(argv=None) -> int:
    import argparse
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--update', action='store_true', help='baixa tetos e remove arquivos já dentro do limite')
    parser.add_argument('--strict', action='store_true', help='falha também quando o baseline pode ser apertado')
    parser.add_argument('--limits', action='store_true', help='imprime o limite máximo de cada categoria')
    args = parser.parse_args(argv)
    if args.limits:
        for name, cap in CATEGORY_LIMITS.items():
            print(f'{name:18} {cap}')
        return 0
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
