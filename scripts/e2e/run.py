import os
import sys, time, json, importlib
from harness import Ctx, save_results, RESULTS
C = Ctx(run=time.strftime('%m%d%H%M'))
blocks = sys.argv[1].split(',') if len(sys.argv) > 1 else ['suite_1']
state = os.path.join(os.environ.get('FAI_E2E_WORKDIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')), 'ctx.json')
if len(sys.argv) > 2 and sys.argv[2] == 'resume':
    C.update(json.load(open(state)))
    from harness import http, _tokens, PW
    for u in (C.get('U'),):
        s, b, _ = http('POST', '/api/auth/login', {'identifier': u, 'password': PW})
        _tokens[u] = b['accessToken']
try:
    for b in blocks:
        importlib.import_module(b).run(C)
finally:
    json.dump(C, open(state, 'w'), ensure_ascii=False, indent=1, default=str)
json.dump(C, open(state, 'w'), ensure_ascii=False, indent=1, default=str)
out = os.path.join(os.environ.get('FAI_E2E_WORKDIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')), f'results_{"_".join(blocks)}.json')
save_results(out)
print('TOTAL', len(RESULTS), 'OK', sum(r['ok'] for r in RESULTS), 'FALHAS', sum(not r['ok'] for r in RESULTS))
