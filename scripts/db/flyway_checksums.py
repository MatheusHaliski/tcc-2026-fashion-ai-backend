"""Trava (lock) dos checksums das migrations Flyway já publicadas no main.

O Flyway grava o checksum de cada migration aplicada e recusa subir a API se o arquivo mudar depois ("Migration
checksum mismatch"). Este script calcula o mesmo checksum do Flyway (CRC32 linha a linha, sem quebras de linha, sem
BOM, UTF-8) e reescreve o lock lido pelo AppliedMigrationChecksumsTest.

    python3 scripts/db/flyway_checksums.py          # reescreve o lock com todas as migrations SQL atuais
    python3 scripts/db/flyway_checksums.py --check  # só confere (sai com 1 se alguma travada mudou)

Rode sem --check depois de mesclar migrations novas no main. Nunca edite uma migration travada: crie a próxima versão.
"""
import argparse
import re
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / 'fai-infrastructure/persistence-mysql/src/main/resources/db/migration'
LOCK = ROOT / 'fai-infrastructure/persistence-mysql/src/test/resources/flyway/applied-checksums.properties'
NAME = re.compile(r'^V([0-9_.]+)__.+\.sql$')


def flyway_checksum(data: bytes) -> int:
    text = data.decode('utf-8')
    if text.startswith('﻿'):
        text = text[1:]
    # BufferedReader.readLine: separa em \r\n, \r ou \n e não devolve a linha vazia depois da última quebra.
    lines = re.split(r'\r\n|\r|\n', text)
    if lines and lines[-1] == '':
        lines.pop()
    crc = 0
    for line in lines:
        crc = zlib.crc32(line.encode('utf-8'), crc)
    return crc - 2**32 if crc >= 2**31 else crc


def current() -> dict:
    return {path.name: flyway_checksum(path.read_bytes()) for path in sorted(MIGRATIONS.glob('V*__*.sql')) if NAME.match(path.name)}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    sums = current()
    if args.check:
        locked = dict(line.split('=', 1) for line in LOCK.read_text().splitlines() if line and not line.startswith('#'))
        changed = [name for name, value in locked.items() if name in sums and str(sums[name]) != value]
        missing = [name for name in locked if name not in sums]
        for name in changed:
            print(f'ALTERADA: {name} (travada {locked[name]}, atual {sums[name]})')
        for name in missing:
            print(f'REMOVIDA: {name}')
        sys.exit(1 if changed or missing else 0)
    header = ['# Checksums Flyway das migrations já publicadas (scripts/db/flyway_checksums.py).',
              '# Uma migration aplicada em produção não pode mudar: o Flyway recusa subir a API. Crie a próxima versão.']
    LOCK.write_text('\n'.join(header + [f'{name}={value}' for name, value in sums.items()]) + '\n')
    print(f'{len(sums)} migrations travadas em {LOCK.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
