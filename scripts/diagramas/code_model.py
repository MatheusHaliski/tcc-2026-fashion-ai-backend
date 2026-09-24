"""Extrai entidades JPA, enums e o grafo de injeção (controllers → serviços → repositórios/ports) do código real."""
import re, os, glob
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DOM = ROOT + '/fai-domain/src/main/java/br/com/fashionai/domain'
APP = ROOT + '/fai-application/src/main/java/br/com/fashionai/application'
WEB = ROOT + '/fai-web/src/main/java/br/com/fashionai/web/controller'

def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    return re.sub(r'//[^\n]*', '', s)

ENTITIES, ENUMS, TABLES = {}, {}, {}
for f in glob.glob(DOM + '/model/*.java'):
    name = os.path.basename(f)[:-5]
    src = open(f, encoding='utf-8').read()
    t = re.search(r'@Table\(name\s*=\s*"([^"]+)"', src)
    if t: TABLES[name] = t.group(1)
    ext = re.search(r'class\s+\w+\s+extends\s+(\w+)', src)
    body = strip_comments(src)
    fields = []
    for m in re.finditer(r'((?:@\w+(?:\([^)]*\))?\s*)*)private\s+(?:final\s+)?([\w<>,\s\.]+?)\s+(\w+)\s*(?:=[^;]*)?;', body):
        ann, typ, fname = m.group(1), re.sub(r'\s+', '', m.group(2)), m.group(3)
        if fname in ('serialVersionUID',): continue
        rel = 'many' if '@ManyToOne' in ann else 'one' if '@OneToOne' in ann else 'list' if '@OneToMany' in ann or '@ManyToMany' in ann else None
        fields.append((fname, typ, rel))
    ENTITIES[name] = dict(fields=fields, parent=ext.group(1) if ext else None)
for f in glob.glob(DOM + '/model/enums/*.java'):
    name = os.path.basename(f)[:-5]
    src = strip_comments(open(f, encoding='utf-8').read())
    m = re.search(r'enum\s+\w+\s*\{(.*?)(;|\})', src, re.S)
    vals = [re.sub(r'\(.*', '', v).strip() for v in (m.group(1) if m else '').split(',')]
    ENUMS[name] = [v for v in vals if re.match(r'^[A-Z][A-Z0-9_]*$', v)]

def java_files():
    for base in (APP, WEB):
        for f in glob.glob(base + '/**/*.java', recursive=True):
            yield f

DEPS, KIND = {}, {}
for f in java_files():
    name = os.path.basename(f)[:-5]
    src = strip_comments(open(f, encoding='utf-8').read())
    m = re.search(r'public\s+' + name + r'\s*\(([^)]*)\)', src, re.S)
    params = []
    if m:
        for p in m.group(1).split(','):
            p = re.sub(r'@\w+(\([^)]*\))?', '', p).strip()
            if not p: continue
            typ = re.sub(r'<.*', '', p.split()[0]) if p.split() else ''
            params.append(typ)
    DEPS[name] = params
    KIND[name] = 'controller' if '/web/controller/' in f else 'app'

def field_line(fname, typ):
    short = typ.replace('java.util.', '').replace('java.time.', '')
    return f'  +{fname}: {short}'

def class_block(name, max_fields=16):
    e = ENTITIES[name]
    lines = [f'class {name} {{']
    fs = [x for x in e['fields'] if x[0] not in ('createdBy', 'lastModifiedBy', 'version')]
    for fname, typ, rel in fs[:max_fields]:
        lines.append(field_line(fname, typ))
    if len(fs) > max_fields:
        lines.append(f'  .. +{len(fs) - max_fields} campos ..')
    lines.append('}')
    return '\n'.join(lines)

def relations(names):
    out = []
    for n in [x for x in names if x in ENTITIES]:
        for fname, typ, rel in ENTITIES[n]['fields']:
            base = re.sub(r'^(List|Set)<(\w+)>$', r'\2', typ)
            if base in names and base != n and rel:
                arrow = '"*" --> "1"' if rel == 'many' else '"1" --> "1"' if rel == 'one' else '"1" --> "*"'
                out.append(f'{n} {arrow} {base} : {fname}')
            elif fname.endswith('Id') and fname != 'id' and rel is None and typ == 'UUID':
                target = fname[:-2][0].upper() + fname[:-2][1:]
                alias = {'CreatorUser': 'User', 'IssuerUser': 'User', 'PartnerBrandUser': 'User', 'MaisonBrandUser': 'User', 'Owner': 'User', 'Actor': 'User', 'TeamA': 'FlairTeam', 'TeamB': 'FlairTeam', 'Winner': 'User'}.get(target, target)
                if alias in names and alias != n:
                    out.append(f'{n} ..> {alias} : {fname}')
        for fname, typ, rel in ENTITIES[n]['fields']:
            if typ in ENUMS and typ in names:
                out.append(f'{n} --> {typ}')
    return sorted(set(out))

def enum_block(name):
    vals = ENUMS[name]
    return 'enum ' + name + ' {\n' + '\n'.join('  ' + v for v in vals[:14]) + ('\n  ..' if len(vals) > 14 else '') + '\n}'
