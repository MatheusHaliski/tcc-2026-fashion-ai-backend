"""Physical-line triage from the supplied prompts; never an automatic split order."""

TARGETS = {
    'simple_component': (40, 150),
    'complex_component': (100, 250),
    'custom_hook': (40, 150),
    'utility': (20, 120),
    'next_page': (None, 250),
}


def size_band(lines: int) -> str:
    if lines > 1000:
        return 'CRITICAL'
    if lines > 600:
        return 'HIGH'
    if lines > 400:
        return 'PRIORITY'
    if lines > 250:
        return 'REVIEW'
    return 'WITHIN_GENERAL_TARGET'


def review_action(path: str, lines: int) -> str:
    if '/migration/' in path:
        return 'IMMUTABLE_APPLIED_MIGRATION_REVIEW_ONLY'
    if lines > 250:
        return 'REVIEW_COHESION_AND_RECORD_REFACTOR_OR_EXCEPTION'
    return 'REVIEW_BY_RESPONSIBILITY_NOT_SIZE_ALONE'


def report(root, output):
    from collections import Counter
    from pathlib import Path
    from scripts.refactoring.inventory_gof import EXCLUDED, SOURCE, git, require_present_sources, write_csv

    paths = sorted(p for p in git(root, 'ls-files', '-z').split('\0')
                   if p and Path(p).suffix in SOURCE and not set(Path(p).parts) & EXCLUDED)
    require_present_sources(root, paths)
    rows = []
    for path in paths:
        lines = len((root/path).read_text(encoding='utf-8', errors='replace').splitlines())
        rows.append({'path': path, 'physical_lines': lines, 'band': size_band(lines),
                     'action': review_action(path, lines)})
    output.parent.mkdir(parents=True, exist_ok=True)
    write_csv(output, sorted(rows, key=lambda r: (-r['physical_lines'], r['path'])),
              ['path', 'physical_lines', 'band', 'action'])
    return dict(sorted(Counter(row['band'] for row in rows).items()))


if __name__ == '__main__':
    import argparse
    import json
    from pathlib import Path
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps({'mode': 'triage_not_approval', 'bands': report(Path.cwd(), args.output)}, sort_keys=True))
