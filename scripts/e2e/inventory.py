"""Inventário de todos os endpoints REST (fai-web) com a numeração de RF do Trello."""
import re, glob, os, json
WEB = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')) + '/fai-web/src/main/java/br/com/fashionai/web/controller'

def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    return re.sub(r'//[^\n]*', '', s)

def trello_rf(ctrl, verb, path, summary):
    s = summary or ''
    if ctrl == 'RoomController':
        return 'RF30' if path.endswith('/light') else 'RF27'
    if ctrl == 'MirrorController':
        return 'RF28'
    if ctrl == 'HighlightsController':
        if re.search(r'RF34', s): return 'RF29'
        return 'RF30'
    if ctrl == 'ChallengeController' or '/challenges/' in path:
        return 'RF32'
    if ctrl == 'DnaController':
        return 'RF13'
    if ctrl == 'ShowcaseController':
        if 'runway' in path: return 'RF33'
        if '/showcase/' in path or path.endswith('/stage') or path.endswith('/cover'):
            return 'RF34/RF35'
        return 'RF36'
    if ctrl in ('FlairController', 'FlairModesController'):
        return 'RF37'
    if ctrl == 'CouponController':
        return 'RF38'
    if ctrl == 'RoomCreatorController':
        return 'RF39'
    if ctrl == 'DiscoveryController' and path.startswith('/api/explorer'):
        return 'RF26'
    if ctrl == 'WardrobeController' and path.endswith('/flags'):
        return 'RF31'
    if ctrl == 'SealController' and ('/seals' in path and 'seal-' not in path or '/promotions' in path or 'issuer-metrics' in path):
        return 'RF25'
    m = re.search(r'\b(RN?F\d+)', s)
    if m:
        return m.group(1)
    return {'AuthController': 'RF2', 'AccountController': 'RF3', 'MeController': 'RF3', 'AdminController': 'RNF (admin)',
            'DashboardController': 'Dashboard gerencial', 'NotificationController': 'RNF10', 'CommentController': 'RF19',
            'SocialController': 'RF19', 'PreferencesController': 'RF23', 'BrandLogoController': 'RF24'}.get(ctrl, '—')

def inventory():
    out = []
    for f in sorted(glob.glob(WEB + '/*.java')):
        ctrl = os.path.basename(f)[:-5]
        src = strip_comments(open(f, encoding='utf-8').read())
        base = ''
        m = re.search(r'@RequestMapping\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]*)"', src[:src.find('class ')] if 'class ' in src else src)
        if m: base = m.group(1)
        # cada método anotado
        for mm in re.finditer(r'((?:@[\w.]+(?:\((?:[^()]|\([^()]*\))*\))?\s*)+)public\s+[\w<>\[\],.?\s]+?\s+(\w+)\s*\(((?:[^()]|\([^()]*\))*)\)', src):
            anns, name, params = mm.group(1), mm.group(2), mm.group(3)
            vm = re.search(r'@(?:org\.springframework\.web\.bind\.annotation\.)?(Get|Post|Put|Delete|Patch)Mapping(?:\(((?:[^()]|\([^()]*\))*)\))?', anns)
            if not vm: continue
            verb = vm.group(1).upper()
            args = vm.group(2) or ''
            pm = re.search(r'"([^"]*)"', args)
            path = base + (pm.group(1) if pm else '')
            sm = re.search(r'summary\s*=\s*"((?:[^"\\]|\\.)*)"', anns)
            summary = sm.group(1).replace('\\"', '"') if sm else ''
            body = re.search(r'@RequestBody(?:\([^)]*\))?\s+(?:final\s+)?([\w.<>]+)', params)
            multipart = '@RequestPart' in params or 'MultipartFile' in params
            qparams = re.findall(r'@RequestParam(?:\(([^)]*)\))?\s+(?:final\s+)?[\w.<>]+\s+(\w+)', params)
            out.append(dict(controller=ctrl, method=name, verb=verb, path=path, summary=summary,
                            rf=trello_rf(ctrl, verb, path, summary), body=body.group(1) if body else None, multipart=multipart,
                            query=[q[1] for q in qparams]))
    return out

if __name__ == '__main__':
    inv = inventory()
    json.dump(inv, open(os.path.join(os.path.dirname(__file__), 'inventory.json'), 'w'), ensure_ascii=False, indent=1)
    from collections import Counter
    print(len(inv), Counter(e['verb'] for e in inv))
    c = Counter(e['rf'] for e in inv)
    print(sorted(c.items(), key=lambda x: (len(x[0]), x[0])))
