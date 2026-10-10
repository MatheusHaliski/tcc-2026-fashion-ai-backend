"""Matriz de vestir do provador 3D (PROVADOR-3D) a partir dos JSON de métricas (antes × depois).
Uso: python3 -I scripts/tryon/matrix-report.py <antes.json> <depois.json> <saida.md>
Linha: ID do acervo → molde → corpo → pose → resultado → defeito → correção → evidência."""
import json, sys
A, D, OUT = sys.argv[1:4]
a = {(r['pieceId'], r['body'], r['pose']): r['report'] for r in json.load(open(A))}
d = json.load(open(D))
TOL = {'exibicao': 0.03, 'bracos': 0.015, 'caminhada': 0.035, 'agachamento': 0.06}
EVID = {'01_parte_superior_01_camiseta_referencia': 'vestir/camiseta-jeans', '02_parte_inferior_01_jeans': 'vestir/camiseta-jeans', '03_calcados_01_tenis_casual': 'vestir/camiseta-jeans',
        '01_parte_superior_02_shirt_camisa': 'vestir/camisa-chino', '02_parte_inferior_05_calca_chino': 'vestir/camisa-chino', '03_calcados_09_oxford': 'vestir/camisa-chino',
        '05_corpo_inteiro_01_vestido': 'vestir/vestido-bota', '03_calcados_11_bota_cano_curto': 'vestir/vestido-bota',
        '01_parte_superior_14_jacket_jaqueta': 'vestir/jaqueta-shorts', '02_parte_inferior_13_shorts': 'vestir/jaqueta-shorts', '03_calcados_02_tenis_corrida': 'vestir/jaqueta-shorts',
        '01_parte_superior_10_hoodie_moletom_com_capuz': 'vestir/moletom-saia', '02_parte_inferior_12_saia': 'vestir/moletom-saia'}
LIMITS = {'sandals': 'sandália como sapato fechado', 'heels': 'salto sem salto modelado', 'matching_set': 'conjunto como peça única', 'overalls': 'jardineira sem peitilho',
          'kimono': 'quimono sem manga ampla', 'skort': 'saia-short como saia'}
SUB = {}
for line in open('lib/tryon/acervo.ts', encoding='utf-8'):
    if line.strip().startswith('A("'):
        parts = [p.strip().strip('"') for p in line.strip()[2:].split(',')]
        SUB[parts[0]] = parts[2]
rows = []
for r in d:
    pid, body, pose, rep = r['pieceId'], r['body'], r['pose'], r['report']
    if r['kind'] == 'shoes':   # o molde do pé não é desenhado: o tênis/sapato é a forma modelada (shoes.ts)
        res, defect = 'forma do calçado (molde do pé oculto)', '—'
    else:
        pen = rep['penetration']; ok = pen <= TOL[pose]
        res = ('ok' if ok else 'acima da tolerância') + f" · penetração {pen*100:.1f}%"
        where = ', '.join(f"{k} {v*100:.1f}%" for k, v in rep.get('penetrationBy', {}).items())
        defect = '—' if ok else f"interseção ({where})"
    corr = []
    if pose == 'exibicao':
        b = a.get((pid, body, pose))
        s = rep.get('silhouette', {})
        if 'hemToKnee' in s: corr.append(f"barra/joelho {b['silhouette'].get('hemToKnee',{}).get('garment','–') if b else '–'}→{s['hemToKnee']['garment']}")
        if 'waistToBust' in s: corr.append(f"cintura/busto {b['silhouette'].get('waistToBust',{}).get('garment','–') if b else '–'}→{s['waistToBust']['garment']} (corpo {s['waistToBust']['body']})")
        for reg in ('coxa', 'joelho', 'panturrilha'):
            if reg in rep['ease'] and b and reg in b['ease']: corr.append(f"folga {reg} {b['ease'][reg]['meanCm']}→{rep['ease'][reg]['meanCm']} cm")
    lim = LIMITS.get(SUB.get(pid, ''), '')
    rows.append(f"| `{pid}` | {r['kind']} | {body} | {pose} | {res} | {defect}{' · limitação: ' + lim if lim else ''} | {'; '.join(corr) or '—'} | {EVID.get(pid, 'métricas JSON')} |")
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('# Matriz de vestir — acervo × corpos × poses (2026-10-10)\n\n')
    f.write('Gerada por `scripts/tryon/matrix-report.py` a partir de `metricas/vestir-antes-2026-10-10.json` e `metricas/vestir-depois-2026-10-10.json` '
            '(harness `lib/avatar3d/human/fit-matrix.ts`, o mesmo caminho de montagem do provador). Asset: molde estimado (casca do corpo + foto da frente) — '
            'nenhuma peça tem malha de vestimenta aprovada. Tamanho: o do corpo (sem grade de tamanhos). Cenário: corpo isolado (métrica); '
            'as capturas em loja estão em `img/2026-10-10/vestir/`. Tolerâncias de penetração por pose: exibição 3%, braços 1,5%, caminhada 3,5%, agachamento 6% (§8 da auditoria).\n\n')
    f.write('| ID do acervo | molde | corpo | pose | resultado | defeito | correção (antes→depois) | evidência |\n|---|---|---|---|---|---|---|---|\n')
    f.write('\n'.join(rows) + '\n')
print(len(rows), 'linhas')
