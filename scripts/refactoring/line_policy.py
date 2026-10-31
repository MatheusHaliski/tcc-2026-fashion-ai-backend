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


def report(root, output, query=''):
    from pathlib import Path
    from scripts.refactoring.inventory_gof import EXCLUDED, SOURCE, git, require_present_sources, write_csv
    from scripts.refactoring.gof.facade import AuditFacade

    paths = sorted(p for p in git(root, 'ls-files', '-z').split('\0')
                   if p and Path(p).suffix in SOURCE and not set(Path(p).parts) & EXCLUDED)
    require_present_sources(root, paths)
    return AuditFacade.local(write_csv, size_band, review_action).report(root, paths, output, query)


if __name__ == '__main__':
    import argparse
    import json
    from pathlib import Path
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--query', default='', help='Optional filtered triage, e.g. lines > 1000; default includes every source')
    args = parser.parse_args()
    print(json.dumps({'mode': 'filtered_triage_not_approval' if args.query else 'triage_not_approval',
                      'bands': report(Path.cwd(), args.output, args.query)}, sort_keys=True))
