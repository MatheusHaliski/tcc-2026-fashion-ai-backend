"""Núcleo do teste ponta a ponta: chama a API real, observa no general_log do MySQL o que cada chamada leu e gravou
e detecta arquivos novos no storage de mídia."""
import json, os, re, subprocess, sys, time, uuid, urllib.request, urllib.error

BASE = 'http://localhost:8080'
SCR = os.environ.get('FAI_E2E_WORKDIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))
MEDIA = SCR + '/media'
PW = 'SenhaForte#2026'
NOISE_READ = {'pipeline_jobs'}          # poller de jobs lê a cada poucos segundos
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def sql(q):
    r = subprocess.run(['mysql', '-uroot', '-N', '-B', '-e', q], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return [l.split('\t') for l in r.stdout.strip().split('\n') if l]


def db_now():
    return sql('SELECT NOW(6)')[0][0]


TBL = re.compile(r'\b(?:from|join|into|update)\s+`?(\w+)`?', re.I)


SECRET = [(re.compile(r"\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}"), "$2a$…(hash bcrypt)"),
          (re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"), "eyJ…(JWT)"),
          (re.compile(r"(?<![0-9a-f-])[0-9a-f]{48,}(?![0-9a-f])"), "…(hash)")]


def redact(txt):
    for rx, rep in SECRET:
        txt = rx.sub(rep, txt)
    return txt


def db_activity(t0):
    rows = sql("SELECT argument FROM mysql.general_log WHERE event_time >= '%s' AND user_host LIKE 'fashionai%%' "
               "AND command_type IN ('Query','Execute')" % t0)
    reads, writes, wsql, rsql = set(), {}, [], []
    for (arg,) in rows:
        a = arg.strip().lower()
        if a.startswith('select'):
            ts = [t.lower() for t in TBL.findall(arg) if t.lower() != 'dual' and not t.lower().startswith('information_schema')]
            reads.update(ts)
            if len(rsql) < 3 and not set(ts) <= NOISE_READ:
                rsql.append(redact(arg.strip())[:420])
        elif a.startswith(('insert', 'update', 'delete', 'replace')):
            op = a.split()[0].upper()
            m = re.match(r'(?:insert\s+(?:ignore\s+)?into|replace\s+into|update|delete\s+from)\s+`?(\w+)`?', a)
            if m:
                writes.setdefault(m.group(1), set()).add(op)
                if len(wsql) < 6:
                    wsql.append(redact(arg.strip())[:8000])
        elif a.startswith('call'):
            writes.setdefault(a.split()[1].split('(')[0], set()).add('CALL')
    return reads - NOISE_READ, writes, wsql, rsql


def media_snapshot():
    out = {}
    for dp, _, fs in os.walk(MEDIA):
        for f in fs:
            p = os.path.join(dp, f)
            out[p] = os.path.getmtime(p)
    return out


def media_new(before):
    after = media_snapshot()
    return sorted(os.path.relpath(p, MEDIA) for p, m in after.items() if p not in before or before[p] != m)


def http(method, path, body=None, tok=None, raw_body=None, headers=None):
    h = {'Accept': 'application/json, image/png, */*'}
    if tok:
        h['Authorization'] = 'Bearer ' + tok
    data = None
    if raw_body is not None:
        data = raw_body
    elif body is not None:
        data = json.dumps(body).encode()
        h['Content-Type'] = 'application/json'
    if headers:
        h.update(headers)
    rq = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with opener.open(rq, timeout=120) as r:
            txt = r.read()
            ct = r.headers.get('Content-Type', '')
            return r.status, (json.loads(txt) if 'json' in ct and txt else (txt[:80] if txt else None)), dict(r.headers)
    except urllib.error.HTTPError as e:
        txt = e.read()
        try:
            return e.code, json.loads(txt), dict(e.headers)
        except Exception:
            return e.code, txt[:200], dict(e.headers)


def multipart_body(fields, files):
    bd = '----fai' + uuid.uuid4().hex
    parts = []
    for k, v in (fields or {}).items():
        parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    for name, (fname, content, ctype) in (files or {}).items():
        parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="{name}"; filename="{fname}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + content + b'\r\n')
    parts.append(f'--{bd}--\r\n'.encode())
    return b''.join(parts), {'Content-Type': f'multipart/form-data; boundary={bd}'}


_tokens = {}


def login(user):
    if user not in _tokens:
        s, b, _ = http('POST', '/api/auth/login', {'identifier': user if '@' in user else user + '@example.com', 'password': PW})
        assert s == 200, (user, s, b)
        _tokens[user] = b['accessToken']
    return _tokens[user]


class Ctx(dict):
    """Valores capturados durante o teste (ids, códigos, slugs)."""

    def fmt(self, s):
        return re.sub(r'\{(\w+)\}', lambda m: str(self[m.group(1)]) if m.group(1) in self else m.group(0), s)


RESULTS = []


def step(rf, ca, desc, method, path, body=None, who=None, expect=(200, 201, 202, 204), save=None, files=None, fields=None,
         ctx=None, ui=None, template=None, note=None):
    """Executa uma chamada e registra: status, tabelas lidas/gravadas e mídia nova."""
    p = ctx.fmt(path) if ctx is not None else path
    if isinstance(body, str):
        body = json.loads(ctx.fmt(body))
    elif callable(body):
        body = body(ctx)
    tok = login(who) if who else None
    t0 = db_now()
    m0 = media_snapshot()
    t = time.time()
    if files:
        raw, hdr = multipart_body(fields, files)
        s, b, _ = http(method, p, raw_body=raw, tok=tok, headers=hdr)
    else:
        s, b, _ = http(method, p, body, tok)
    ms = int((time.time() - t) * 1000)
    time.sleep(0.35)                   # eventos AFTER_COMMIT e efeitos colaterais
    reads, writes, wsql, rsql = db_activity(t0)
    new_media = media_new(m0)
    ok = s in expect
    err = None
    if not ok:
        err = (b.get('code') or b.get('message')) if isinstance(b, dict) else str(b)[:120]
    if ok and save and ctx is not None:
        try:
            save(ctx, b)
        except Exception as e:           # a captura falhou: registra, não derruba o teste
            err = f'captura: {e}'
    RESULTS.append(dict(rf=rf, ca=ca, desc=desc, method=method, template=template or path, path=p, who=who or 'anônimo',
                        status=s, ok=ok, ms=ms, reads=sorted(reads), writes={k: sorted(v) for k, v in writes.items()},
                        media=new_media[:5], error=err, ui=ui, note=note,
                        body_keys=sorted(b.keys())[:12] if isinstance(b, dict) else (len(b) if isinstance(b, list) else None),
                        req=req_view(body, files, fields), resp=resp_view(b), sql_writes=wsql, sql_reads=rsql))
    mark = 'ok ' if ok else 'ERR'
    wt = ','.join(sorted(writes)) or '-'
    print(f'{mark} {rf:<6} {ca:<6} {method:<6} {p[:70]:<70} {s} w[{wt[:60]}]' + (f' !! {err}' if err else ''), flush=True)
    return s, b


HIDE = {'password', 'confirmPassword', 'newPassword', 'currentPassword', 'accessToken', 'refreshToken', 'token'}


def _clean(o):
    if isinstance(o, dict):
        return {k: ('***' if k in HIDE else _clean(v)) for k, v in o.items()}
    if isinstance(o, list):
        return [_clean(x) for x in o[:8]]
    return o


def req_view(body, files, fields):
    if files:
        return {'multipart': {k: f'{v[0]} ({len(v[1])} bytes, {v[2]})' for k, v in files.items()}, **({'campos': fields} if fields else {})}
    return _clean(body) if body is not None else None


def resp_view(b):
    if isinstance(b, (dict, list)):
        return redact(json.dumps(_clean(b), ensure_ascii=False, default=str))[:1500]
    if isinstance(b, bytes):
        return f'<{len(b)} bytes binários>'
    return None if b is None else str(b)[:300]


def save_results(path):
    json.dump(RESULTS, open(path, 'w'), ensure_ascii=False, indent=1)
