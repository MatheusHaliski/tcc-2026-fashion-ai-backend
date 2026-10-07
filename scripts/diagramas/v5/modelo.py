"""Modelo do código do FashionAI para os diagramas v5.

Lê o código de verdade (Java com tree-sitter-java, TSX com expressões regulares simples) e monta:

- entidades JPA (campos, relações, tabela, banco), enums e constantes;
- repositórios (entidade e banco de cada um);
- controllers (rotas HTTP, resumo do @Operation, métodos de serviço chamados);
- serviços (dependências injetadas e, por método, os passos em ordem: guardas que lançam erro, chamadas a
  dependências, eventos, chamadas de IA, criações de entidade e mudanças de status);
- ports e adaptadores (quem implementa cada port);
- páginas do Next.js e as rotas da API que cada uma chama.

Nada aqui depende dos diagramas antigos: tudo vem das fontes.
"""
from __future__ import annotations

import glob
import os
import re
from dataclasses import dataclass, field

import tree_sitter_java as tsj
from tree_sitter import Language, Parser

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
JAVA = Language(tsj.language())
_parser = Parser(JAVA)

STATUS_FIELD = re.compile(r'(?i)^(status|state|stage|phase|\w+(Status|State|Stage|Phase))$')
MAPPINGS = {'GetMapping': 'GET', 'PostMapping': 'POST', 'PutMapping': 'PUT', 'PatchMapping': 'PATCH',
            'DeleteMapping': 'DELETE'}


@dataclass
class Field:
    name: str
    type: str
    annotations: dict
    init: str | None = None


@dataclass
class Method:
    name: str
    annotations: dict
    params: list
    returns: str
    node: object = None
    line: int = 0


@dataclass
class TypeInfo:
    name: str
    kind: str                      # class | interface | record | enum
    package: str
    file: str
    module: str                    # domain | application | web | infra-mysql | infra-cassandra | bootstrap
    annotations: dict
    superclass: str | None
    interfaces: list
    fields: list
    ctor: list                     # [(tipo, nome)]
    methods: list
    constants: list                # valores do enum
    static_strings: dict           # constantes String do tipo (NOME -> valor)
    outer: str | None = None
    const_args: dict = field(default_factory=dict)   # valor do enum -> argumentos do construtor (texto)
    static_ints: dict = field(default_factory=dict)  # constantes int do tipo (NOME -> valor)

    @property
    def fqn(self):
        return f'{self.package}.{self.name}'


# --------------------------------------------------------------------------------------------- leitura do Java
def _text(node, src):
    return src[node.start_byte:node.end_byte].decode('utf-8')


def _annotations(mods, src):
    out = {}
    if mods is None:
        return out
    for ch in mods.children:
        if ch.type in ('annotation', 'marker_annotation'):
            name_node = ch.child_by_field_name('name')
            name = _text(name_node, src).split('.')[-1]
            args = ch.child_by_field_name('arguments')
            out[name] = _text(args, src) if args is not None else ''
    return out


def _modifiers(node):
    for ch in node.children:
        if ch.type == 'modifiers':
            return ch
    return None


def _module_of(path):
    p = path.replace(ROOT + '/', '')
    if p.startswith('fai-domain'):
        return 'domain'
    if p.startswith('fai-application'):
        return 'application'
    if p.startswith('fai-web'):
        return 'web'
    if 'persistence-cassandra' in p:
        return 'infra-cassandra'
    if p.startswith('fai-infrastructure'):
        return 'infra-mysql'
    if p.startswith('fai-bootstrap'):
        return 'bootstrap'
    return 'other'


def _type_text(node, src):
    return re.sub(r'\s+', '', _text(node, src)) if node is not None else ''


def _collect_types(node, src, path, package, outer, acc):
    for ch in node.children:
        if ch.type in ('class_declaration', 'interface_declaration', 'record_declaration', 'enum_declaration'):
            acc.append(_read_type(ch, src, path, package, outer))
            body = ch.child_by_field_name('body')
            if body is not None:
                _collect_types(body, src, path, package, _text(ch.child_by_field_name('name'), src), acc)


def _read_type(node, src, path, package, outer):
    kind = node.type.replace('_declaration', '')
    name = _text(node.child_by_field_name('name'), src)
    mods = _modifiers(node)
    ann = _annotations(mods, src)
    sup = node.child_by_field_name('superclass')
    superclass = _type_text(sup, src).replace('extends', '') if sup is not None else None
    interfaces = []
    for ch in node.children:
        if ch.type in ('super_interfaces', 'extends_interfaces'):
            for t in ch.children:
                if t.type == 'type_list':
                    interfaces += [_type_text(x, src) for x in t.children if x.type != ',']
    fields, methods, ctor, consts, statics, cargs, sints = [], [], [], [], {}, {}, {}
    body = node.child_by_field_name('body')
    if kind == 'record':
        params = node.child_by_field_name('parameters')
        if params is not None:
            for p in params.children:
                if p.type == 'formal_parameter':
                    fields.append(Field(_text(p.child_by_field_name('name'), src),
                                        _type_text(p.child_by_field_name('type'), src), {}))
    if body is not None:
        for ch in body.children:
            if ch.type == 'enum_body_declarations':
                inner = ch.children
            else:
                inner = [ch]
            for m in inner:
                if m.type == 'enum_constant':
                    cname = _text(m.child_by_field_name('name'), src)
                    consts.append(cname)
                    a = m.child_by_field_name('arguments')
                    if a is not None:
                        cargs[cname] = _text(a, src)[1:-1]   # separado depois por enum_args()
                elif m.type == 'field_declaration':
                    fmods = _modifiers(m)
                    fann = _annotations(fmods, src)
                    ftype = _type_text(m.child_by_field_name('type'), src)
                    is_static = fmods is not None and 'static' in _text(fmods, src)
                    for d in m.children:
                        if d.type == 'variable_declarator':
                            fname = _text(d.child_by_field_name('name'), src)
                            v = d.child_by_field_name('value')
                            init = _text(v, src) if v is not None else None
                            if is_static:
                                if ftype == 'String' and init and init.startswith('"'):
                                    statics[fname] = init.strip('"')
                                elif ftype in ('int', 'long') and init and re.fullmatch(r'-?\d+', init.replace('_', '')):
                                    sints[fname] = int(init.replace('_', ''))
                                continue
                            fields.append(Field(fname, ftype, fann, init))
                elif m.type == 'constructor_declaration':
                    params = m.child_by_field_name('parameters')
                    ps = []
                    for p in params.children:
                        if p.type == 'formal_parameter':
                            ps.append((_type_text(p.child_by_field_name('type'), src),
                                       _text(p.child_by_field_name('name'), src)))
                    if len(ps) >= len(ctor):
                        ctor = ps
                elif m.type == 'method_declaration':
                    mmods = _modifiers(m)
                    params = m.child_by_field_name('parameters')
                    ps = []
                    for p in params.children:
                        if p.type in ('formal_parameter', 'spread_parameter'):
                            pn = p.child_by_field_name('name')
                            ps.append((_type_text(p.child_by_field_name('type'), src),
                                       _text(pn, src) if pn is not None else '',
                                       _annotations(_modifiers(p), src)))
                    methods.append(Method(_text(m.child_by_field_name('name'), src), _annotations(mmods, src), ps,
                                          _type_text(m.child_by_field_name('type'), src), m.child_by_field_name('body'),
                                          m.start_point[0] + 1))
    return TypeInfo(name, kind, package, path, _module_of(path), ann, superclass, interfaces, fields, ctor, methods,
                    consts, statics, outer, cargs, sints)


SOURCES = {}
ALL_TYPES = []   # inclui tipos aninhados de mesmo nome em arquivos diferentes (ex.: dois records Band)


def parse_java():
    types = {}
    for path in sorted(glob.glob(ROOT + '/fai-*/**/src/main/java/**/*.java', recursive=True)):
        src = open(path, 'rb').read()
        tree = _parser.parse(src)
        pkg = re.search(rb'^package\s+([\w.]+);', src, re.M)
        package = pkg.group(1).decode() if pkg else ''
        acc = []
        _collect_types(tree.root_node, src, path, package, None, acc)
        for t in acc:
            SOURCES[(t.name, t.file)] = src
            ALL_TYPES.append(t)
            # tipos aninhados com o mesmo nome em arquivos diferentes: o de nível superior vence
            if t.name in types and t.outer is not None:
                continue
            types[t.name] = t
    return types


TYPES = parse_java()


def src_of(t: TypeInfo):
    return SOURCES[(t.name, t.file)]


def by_module(*mods):
    return {n: t for n, t in TYPES.items() if t.module in mods}


# --------------------------------------------------------------------------------------------- domínio
ENTITIES = {n: t for n, t in TYPES.items()
            if t.module == 'domain' and t.kind == 'class' and ('Entity' in t.annotations or 'Table' in t.annotations
                                                               or 'MappedSuperclass' in t.annotations)}
CASSANDRA_ROWS = {n: t for n, t in TYPES.items()
                  if t.module == 'infra-cassandra' and 'Table' in t.annotations and t.kind in ('class', 'record')}
ENUMS = {n: t.constants for n, t in TYPES.items() if t.kind == 'enum' and t.constants}


def table_of(name):
    t = ENTITIES.get(name) or CASSANDRA_ROWS.get(name)
    if t is None:
        return None
    a = t.annotations.get('Table', '')
    m = re.search(r'"([^"]+)"', a)
    return m.group(1) if m else re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()


def entity_fields(name):
    t = ENTITIES.get(name)
    if t is None:
        return []
    out = []
    parent = t.superclass
    if parent and parent in ENTITIES:
        out += entity_fields(parent)
    for f in t.fields:
        rel = None
        if 'ManyToOne' in f.annotations:
            rel = 'many'
        elif 'OneToOne' in f.annotations:
            rel = 'one'
        elif 'OneToMany' in f.annotations or 'ManyToMany' in f.annotations:
            rel = 'list'
        out.append((f.name, f.type, rel, f.init))
    return out


def status_fields(name):
    """Campos de estado de uma entidade: (campo, tipo) quando o nome indica estado e o tipo é enum ou String."""
    out = []
    for fname, ftype, rel, init in entity_fields(name):
        if rel is None and STATUS_FIELD.match(fname) and (ftype in ENUMS or ftype == 'String'):
            out.append((fname, ftype, init))
    return out


def bool_fields(name):
    """Campos booleanos da entidade (ex.: Comment.active): (campo, valor inicial 'true'/'false')."""
    out = []
    for fname, ftype, rel, init in entity_fields(name):
        if rel is None and ftype in ('boolean', 'Boolean'):
            out.append((fname, (init or 'false').strip()))
    return out


# --------------------------------------------------------------------------------------------- repositórios
REPO_BASES = {'JpaRepository': 'MySQL', 'CrudRepository': 'MySQL', 'JpaSpecificationExecutor': 'MySQL',
              'CassandraRepository': 'Cassandra', 'ElasticsearchRepository': 'OpenSearch'}
REPOS = {}
for _n, _t in TYPES.items():
    if _t.kind != 'interface':
        continue
    for itf in _t.interfaces:
        base = re.sub(r'<.*', '', itf)
        if base in REPO_BASES:
            m = re.search(r'<(\w+)', itf)
            if m:
                REPOS[_n] = (m.group(1), REPO_BASES[base])
                break


# --------------------------------------------------------------------------------------------- ports e adaptadores
PORTS = {n: t for n, t in TYPES.items() if t.kind == 'interface' and t.module == 'application'
         and ('/ports/' in t.file or n.endswith('Port'))}
ADAPTERS = {}
for _n, _t in TYPES.items():
    if _t.kind != 'class' or _t.module not in ('infra-mysql', 'infra-cassandra', 'application', 'web', 'bootstrap'):
        continue
    for itf in _t.interfaces:
        base = re.sub(r'<.*', '', itf)
        if base in PORTS:
            ADAPTERS.setdefault(base, []).append(_n)


def store_of_adapter(name):
    """Onde um adaptador guarda ou busca os dados (pelo nome e pelo código)."""
    t = TYPES.get(name)
    s = (name + ' ' + (t.file if t else '')).lower()
    for key, label in (('cassandra', 'Cassandra'), ('opensearch', 'OpenSearch'), ('elastic', 'OpenSearch'),
                       ('redis', 'Redis'), ('s3', 'S3'), ('mysql', 'MySQL'), ('resend', 'Resend'), ('replicate', 'Replicate'),
                       ('anthropic', 'Anthropic'), ('claude', 'Anthropic'), ('openai', 'OpenAI'), ('gemini', 'Gemini'),
                       ('vision', 'Google Vision'), ('meshy', 'Meshy'), ('runpod', 'RunPod'), ('wikidata', 'Wikidata')):
        if key in s:
            return label
    return None


# --------------------------------------------------------------------------------------------- controllers
@dataclass(eq=False)
class Endpoint:
    controller: str
    method: str
    verb: str
    path: str
    summary: str
    calls: list            # [(ServiceType, metodo)]
    line: int


def _first_string(args):
    m = re.search(r'(?:value|path)\s*=\s*\{?\s*"([^"]*)"', args or '') or re.search(r'^\(\s*\{?\s*"([^"]*)"', args or '')
    return m.group(1) if m else ''


def _summary(args):
    m = re.search(r'summary\s*=\s*"((?:[^"\\]|\\.)*)"', args or '')
    if not m:
        return ''
    return m.group(1).replace('\\"', '"')


CONTROLLERS = {n: t for n, t in TYPES.items() if 'RestController' in t.annotations or 'Controller' in t.annotations}
ENDPOINTS = []


def _field_types(t: TypeInfo):
    out = {f.name: re.sub(r'<.*', '', f.type) for f in t.fields}
    for typ, name in t.ctor:
        out.setdefault(name, re.sub(r'<.*', '', typ))
    return out


for _n, _t in CONTROLLERS.items():
    base = _first_string(_t.annotations.get('RequestMapping', ''))
    tag = _t.annotations.get('Tag', '')
    ftypes = _field_types(_t)
    src = src_of(_t)
    for m in _t.methods:
        verb = None
        for a, v in MAPPINGS.items():
            if a in m.annotations:
                verb, sub = v, _first_string(m.annotations[a])
                break
        if verb is None and 'RequestMapping' in m.annotations:
            args = m.annotations['RequestMapping']
            vm = re.search(r'RequestMethod\.(\w+)', args)
            verb, sub = (vm.group(1) if vm else 'GET'), _first_string(args)
        if verb is None:
            continue
        calls = []
        if m.node is not None:
            body = _text(m.node, src)
            for fm in re.finditer(r'\b(\w+)\.(\w+)\s*\(', body):
                obj, meth = fm.group(1), fm.group(2)
                if obj in ftypes and (ftypes[obj] in TYPES):
                    calls.append((ftypes[obj], meth))
        path = ('/' + '/'.join(x for x in (base.strip('/'), sub.strip('/')) if x)) if (base or sub) else '/'
        ENDPOINTS.append(Endpoint(_n, m.name, verb, path, _summary(m.annotations.get('Operation', '')),
                                  list(dict.fromkeys(calls)), m.line))


def endpoint_regex(path):
    return re.compile('^' + re.sub(r'\\\{[^}]+\\\}', '[^/]+', re.escape(path)) + '$')


_EP_RX = [(endpoint_regex(e.path), e) for e in ENDPOINTS]


def _strip_templates(path):
    """Troca ${...} (com chaves aninhadas) por X quando é um segmento e remove quando é um sufixo de query."""
    out, i = [], 0
    while i < len(path):
        if path.startswith('${', i):
            depth, j = 0, i + 1
            while j < len(path):
                if path[j] == '{':
                    depth += 1
                elif path[j] == '}':
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            if out and out[-1] == '/':
                out.append('X')
            i = j + 1
            continue
        out.append(path[i])
        i += 1
    return ''.join(out)


def match_endpoint(verb, path):
    path = _strip_templates(path)
    path = re.sub(r'\?.*', '', path).rstrip('/') or '/'
    verbs = ('POST', 'PUT') if verb == 'UPLOAD' else (verb,)
    for v in verbs:
        for rx, e in _EP_RX:
            if e.verb == v and rx.match(path):
                return e
    return None


# --------------------------------------------------------------------------------------------- análise de métodos
@dataclass
class Step:
    kind: str           # guard | call | event | ai | create | transition | throw | branch
    text: str = ''
    target: str = ''    # tipo da dependência, evento, capacidade, entidade
    method: str = ''
    code: str = ''      # código de erro
    status: int = 0
    field: str = ''     # campo de estado (transições)
    value: str = ''     # novo valor
    enum: str = ''
    sources: tuple = ()
    cond: str = ''


def _load_messages():
    out = {}
    path = ROOT + '/fai-application/src/main/resources/i18n/messages.properties'
    if not os.path.exists(path):
        return out
    for line in open(path, encoding='utf-8'):
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            out[k.strip()] = v.strip()
    return out


MESSAGES = _load_messages()
_STATUS = {'badRequest': 400, 'notFound': 404, 'conflict': 409, 'unauthorized': 401, 'forbidden': 403, 'tooMany': 429,
           'unprocessable': 422}
_DEFAULT_CODE = {'notFound': 'NAO_ENCONTRADO', 'forbidden': 'ACESSO_NEGADO', 'unauthorized': 'NAO_AUTENTICADO',
                 'tooMany': 'MUITAS_TENTATIVAS'}


def _message(arg):
    """Texto pt-BR de um argumento de mensagem: Msg.t("chave", ...) ou literal."""
    if arg is None:
        return ''
    m = re.search(r'Msg\.[tk]\(\s*"([^"]+)"', arg)
    if m:
        txt = MESSAGES.get(m.group(1), '')
        return re.sub(r'\{\d+\}', '…', txt)
    m = re.match(r'\s*"((?:[^"\\]|\\.)*)"', arg)
    return m.group(1) if m else ''


def _split_args(args):
    """Separa os argumentos de topo de uma chamada (sem quebrar parênteses e strings)."""
    out, depth, cur, q = [], 0, '', None
    for ch in args:
        if q:
            cur += ch
            if ch == q and not cur.endswith('\\' + q):
                q = None
            continue
        if ch in '"\'':
            q = ch
            cur += ch
        elif ch in '([{<':
            depth += 1
            cur += ch
        elif ch in ')]}>':
            depth -= 1
            cur += ch
        elif ch == ',' and depth == 0:
            out.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def _error_of(text):
    """(código, status HTTP, mensagem pt-BR) do erro lançado num trecho."""
    m = re.search(r'ApiException\.(\w+)\s*\((.*)\)\s*;', text, re.S)
    if m and m.group(1) in _STATUS:
        kind, args = m.group(1), _split_args(m.group(2))
        if kind in _DEFAULT_CODE:
            msg = _message(args[0]) if args else ''
            if kind == 'notFound' and msg and not msg.endswith('.'):
                msg = msg + ' não encontrado(a)'
            return _DEFAULT_CODE[kind], _STATUS[kind], msg
        code = args[0].strip('"') if args else 'ERRO'
        return code, _STATUS[kind], _message(args[1]) if len(args) > 1 else ''
    m = re.search(r'new\s+ApiException\s*\((.*)\)\s*;', text, re.S)
    if m:
        args = _split_args(m.group(1))
        st = int(args[0]) if args and args[0].isdigit() else 500
        code = args[1].strip('"') if len(args) > 1 else 'ERRO'
        return code, st, _message(args[2]) if len(args) > 2 else ''
    if 'throw' in text:
        n = re.search(r'throw\s+new\s+(\w+)', text)
        return (n.group(1) if n else 'ERRO'), 500, ''
    return None


def _is_throw_branch(node):
    if node is None:
        return False
    if node.type == 'throw_statement':
        return True
    if node.type == 'block':
        stmts = [c for c in node.children if c.type not in ('{', '}', 'line_comment', 'block_comment')]
        return bool(stmts) and stmts[-1].type == 'throw_statement'
    return False


def _status_of_cond(cond, enum_names):
    """Valores de estado citados numa condição: (requeridos, excluídos)."""
    req, exc = set(), set()
    for m in re.finditer(r'(!=|==)\s*(\w+)\.([A-Z][A-Z0-9_]*)', cond):
        if m.group(2) in enum_names:
            (req if m.group(1) == '!=' else exc).add((m.group(2), m.group(3)))
    for m in re.finditer(r'(\w+)\.([A-Z][A-Z0-9_]*)\s*(!=|==)', cond):
        if m.group(1) in enum_names:
            (req if m.group(3) == '!=' else exc).add((m.group(1), m.group(2)))
    for m in re.finditer(r'(!)?\s*(\w+)\.([A-Z][A-Z0-9_]*)\.equals\(', cond):
        if m.group(2) in enum_names:
            (req if m.group(1) else exc).add((m.group(2), m.group(3)))
    for m in re.finditer(r'(!)?\s*"([A-Z][A-Z0-9_]*)"\.equals\(\s*\w+\.get\w*(Status|State|Stage|Phase)\(\)', cond):
        (req if m.group(1) else exc).add(('String', m.group(2)))
    return req, exc


class MethodAnalyzer:
    def __init__(self, t: TypeInfo):
        self.t = t
        self.src = src_of(t)
        self.ftypes = _field_types(t)
        self.local_methods = {}
        for m in t.methods:
            self.local_methods.setdefault(m.name, m)

    def steps(self, method_name, depth=0, seen=None):
        m = self.local_methods.get(method_name)
        if m is None or m.node is None:
            return []
        seen = set() if seen is None else seen
        if method_name in seen:
            return []
        seen = seen | {method_name}
        out = []
        self._walk(m.node, out, depth, seen, [])
        return out

    def _walk(self, node, out, depth, seen, guards):
        src = self.src
        t = node.type
        if t == 'if_statement':
            cond = _text(node.child_by_field_name('condition'), src)
            cons = node.child_by_field_name('consequence')
            alt = node.child_by_field_name('alternative')
            if _is_throw_branch(cons):
                err = _error_of(_text(cons, src)) or ('ERRO', 500, '')
                req, exc = _status_of_cond(cond, ENUMS)
                out.append(Step('guard', cond=cond.strip('() '), code=err[0], status=err[1], text=err[2],
                                sources=tuple(sorted(req)), value=';'.join(f'{a}.{b}' for a, b in sorted(exc))))
                guards.append((req, exc))
                if alt is not None:
                    self._walk(alt, out, depth, seen, guards)
                return
            self._walk(node.child_by_field_name('condition'), out, depth, seen, guards)
            inner = []
            self._walk(cons, inner, depth, seen, list(guards))
            if alt is not None:
                self._walk(alt, inner, depth, seen, list(guards))
            if inner:
                out.append(Step('branch', cond=cond.strip('() ')))
                out.extend(inner)
            return
        if t == 'throw_statement':
            err = _error_of(_text(node, src))
            if err:
                out.append(Step('throw', code=err[0], status=err[1], text=err[2]))
            return
        if t == 'method_invocation':
            obj = node.child_by_field_name('object')
            name = _text(node.child_by_field_name('name'), src)
            args_node = node.child_by_field_name('arguments')
            args = _text(args_node, src) if args_node is not None else ''
            # primeiro os argumentos (são avaliados antes da chamada)
            if obj is not None:
                self._walk(obj, out, depth, seen, guards)
            if args_node is not None:
                self._walk(args_node, out, depth, seen, guards)
            objtxt = _text(obj, src) if obj is not None else ''
            if name == 'publishEvent':
                ev = re.search(r'new\s+(?:\w+\.)*(\w+)\s*[(<]', args)
                out.append(Step('event', target=ev.group(1) if ev else 'evento'))
                return
            if re.match(r'set\w*(Status|State|Stage|Phase)$', name) or name in ('setStatus', 'setState'):
                fld = name[3].lower() + name[4:]
                val = args.strip('() ')
                em = re.match(r'(\w+)\.([A-Z][A-Z0-9_]*)$', val)
                if em and em.group(1) in ENUMS:
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld, value=em.group(2),
                                    enum=em.group(1), sources=self._sources(guards, em.group(1))))
                elif re.match(r'^"[A-Z][A-Z0-9_]*"$', val):
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld, value=val.strip('"'),
                                    enum='String', sources=self._sources(guards, 'String')))
                elif val in self.t.static_strings:
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld,
                                    value=self.t.static_strings[val], enum='String', sources=self._sources(guards, 'String')))
                return
            if re.match(r'set[A-Z]\w*$', name):
                fld = name[3].lower() + name[4:]
                val = args.strip('() ')
                em = re.match(r'(\w+)\.([A-Z][A-Z0-9_]*)$', val)
                if em and em.group(1) in ENUMS and fld in ENUM_FIELD_NAMES:
                    # qualquer campo enum (ex.: DailyLook.feedback = DailyLookFeedback.ADOREI)
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld, value=em.group(2),
                                    enum=em.group(1), sources=self._sources(guards, em.group(1))))
                    return
                if fld in ENUM_FIELD_NAMES and re.fullmatch(r'[a-z]\w*', val) and val not in ('null', 'true', 'false'):
                    # valor vindo de variável (ex.: dl.setFeedback(feedback)): qualquer valor do enum
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld, value='?' + val,
                                    enum='?enum'))
                    return
                if fld in PRESENCE_FIELD_NAMES and val:
                    # campo de artefato (URL, chave, data): vazio (null) ou preenchido
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld,
                                    value='null' if val == 'null' else 'set', enum='presence'))
                    return
            if re.match(r'set[A-Z]\w*$', name) and re.fullmatch(r'true|false|[a-z]\w*', args.strip('() ')):
                fld = name[3].lower() + name[4:]
                val = args.strip('() ')
                if fld in BOOL_FIELD_NAMES:
                    # literal: o novo valor; variável (ex.: setOptedIn(optedIn)): vale para os dois sentidos
                    out.append(Step('transition', target=self._owner_type(objtxt), field=fld,
                                    value=val if val in ('true', 'false') else '?' + val, enum='boolean'))
                    return
            if objtxt in self.ftypes:
                dep = self.ftypes[objtxt]
                if dep == 'AiEngine' or dep.endswith('AiEngine'):
                    cap = re.search(r'AiCapability\.([A-Z_]+)', args)
                    out.append(Step('ai', target=cap.group(1) if cap else 'IA', method=name))
                    return
                if dep in TYPES or dep in REPOS:
                    out.append(Step('call', target=dep, method=name, text=args[:80]))
                return
            if (obj is None or objtxt == 'this') and name in self.local_methods and depth < 3:
                out.extend(self.steps(name, depth + 1, seen))
            return
        if t == 'object_creation_expression':
            typ = _type_text(node.child_by_field_name('type'), src)
            base = re.sub(r'<.*', '', typ).split('.')[-1]
            args_node = node.child_by_field_name('arguments')
            if args_node is not None:
                self._walk(args_node, out, depth, seen, guards)
            if base in ENTITIES:
                out.append(Step('create', target=base))
            return
        for ch in node.children:
            self._walk(ch, out, depth, seen, guards)

    def _owner_type(self, objtxt):
        return objtxt

    @staticmethod
    def _sources(guards, enum):
        req, exc = set(), set()
        for r, e in guards:
            req |= {v for (en, v) in r if en == enum}
            exc |= {v for (en, v) in e if en == enum}
        if req:
            return tuple(sorted(req))
        if exc:
            return tuple('!' + v for v in sorted(exc))
        return ()


BOOL_FIELD_NAMES = {f for e in ENTITIES for f, _ in bool_fields(e)}
ENUM_FIELD_NAMES = {f for e in ENTITIES for f, t, r, _ in entity_fields(e) if r is None and t in ENUMS}
PRESENCE_FIELD = re.compile(r'^\w+(Url|Key|Path|Uri|At)$')
PRESENCE_FIELD_NAMES = {f for e in ENTITIES for f, t, r, _ in entity_fields(e)
                        if r is None and PRESENCE_FIELD.match(f) and f not in ('createdAt', 'updatedAt')}
SERVICES = {n: t for n, t in TYPES.items() if t.module == 'application' and t.kind == 'class'
            and ('Service' in t.annotations or 'Component' in t.annotations)}
_ANALYZERS = {}


def analyzer(type_name):
    if type_name not in _ANALYZERS:
        _ANALYZERS[type_name] = MethodAnalyzer(TYPES[type_name])
    return _ANALYZERS[type_name]


def deps_of(type_name):
    t = TYPES.get(type_name)
    if t is None:
        return []
    return [re.sub(r'<.*', '', typ) for typ, _ in t.ctor]


# --------------------------------------------------------------------------------------------- transições globais
def _entity_of_var(service: TypeInfo, method: Method, var):
    """Tipo da variável local (ou parâmetro) que recebe setStatus — procura a declaração no corpo do método."""
    src = src_of(service)
    body = _text(method.node, src) if method.node is not None else ''
    for p in method.params:
        if p[1] == var:
            return re.sub(r'<.*', '', p[0])
    m = re.search(r'\b([A-Z]\w+)(?:<[^>]*>)?\s+' + re.escape(var) + r'\s*[=:]', body)
    if m:
        return m.group(1)
    # parâmetro de lambda sobre o resultado de um repositório: comments.findById(id).ifPresent(c -> ...)
    m = re.search(r'\b(\w+)\.\w+\([^;{}]*?\)\s*\.(?:ifPresent|forEach)\(\s*' + re.escape(var) + r'\s*->', body)
    if m:
        rep = _field_types(service).get(m.group(1))
        if rep in REPOS:
            return REPOS[rep][0]
    ft = _field_types(service).get(var)
    return ft


def transitions():
    """Todas as mudanças de estado do código: (entidade, campo, enum, origem(s), destino, Servico.metodo)."""
    out = []
    for n, t in TYPES.items():
        if t.module not in ('application', 'web', 'domain') or t.kind not in ('class', 'record'):
            continue
        an = analyzer(n)
        for m in t.methods:
            if m.node is None:
                continue
            for s in an.steps(m.name):
                if s.kind != 'transition':
                    continue
                ent = None
                if t.module == 'domain' and n in ENTITIES and s.target in ('', 'this'):
                    ent = n
                else:
                    var = s.target.split('.')[-1] if s.target else ''
                    ent = _entity_of_var(t, m, var) if var else None
                    if ent not in ENTITIES and s.enum == 'boolean':
                        cands = [e for e in ENTITIES if any(f[0] == s.field for f in bool_fields(e))]
                        ent = cands[0] if len(cands) == 1 else ent
                    elif ent not in ENTITIES and s.enum == '?enum':
                        cands = [e for e in ENTITIES if any(f[0] == s.field and f[1] in ENUMS for f in entity_fields(e))]
                        ent = cands[0] if len(cands) == 1 else ent
                    elif ent not in ENTITIES and s.enum == 'presence':
                        cands = [e for e in ENTITIES if any(f[0] == s.field for f in entity_fields(e))]
                        ent = cands[0] if len(cands) == 1 else ent
                    elif ent not in ENTITIES:
                        # o objeto pode ser um getter encadeado; tenta achar a entidade pelo campo de estado
                        cands = [e for e in ENTITIES if any(f[0] == s.field for f in status_fields(e))
                                 and (s.enum == 'String' or any(f[1] == s.enum for f in status_fields(e)))]
                        ent = cands[0] if len(cands) == 1 else ent
                    if ent in ENTITIES and not any(f[0] == s.field for f in entity_fields(ent)):
                        ent = None
                enum = s.enum
                if ent in ENTITIES and enum == '?enum':
                    enum = next((f[1] for f in entity_fields(ent) if f[0] == s.field and f[1] in ENUMS), None)
                if ent in ENTITIES and enum:
                    out.append((ent, s.field, enum, s.sources, s.value, f'{n}.{m.name}'))
    return sorted(set(out))


TRANSITIONS = transitions()


# --------------------------------------------------------------------------------------------- estados derivados
def message_of(expr):
    """Texto pt-BR de uma expressão Msg.t/Msg.k("chave") ou literal."""
    return _message(expr)


def enum_args(enum, const):
    t = TYPES.get(enum)
    raw = t.const_args.get(const) if t else None
    return _split_args(raw) if raw else []


def enum_thresholds(enum):
    """Enum ordenado por limiar (ex.: FaiPointsService.Level, STUDIO(300, ...)): ({valor: (limiar, descrição)},
    variável comparada) quando o 1º argumento de cada valor é um número crescente."""
    t = TYPES.get(enum)
    if t is None or not t.const_args or len(t.const_args) < len(t.constants):
        return None
    out = {}
    for c in t.constants:
        a = enum_args(enum, c)
        num = a[0].replace('_', '') if a else ''
        if not re.fullmatch(r'-?\d+', num):
            return None
        desc = next((d for d in (_message(x) for x in a[1:]) if d), '')
        out[c] = (int(num), desc)
    vals = [v[0] for v in out.values()]
    if vals != sorted(vals) or len(set(vals)) != len(vals):
        return None
    pname = t.ctor[0][1] if t.ctor else 'threshold'
    m = re.search(r'(\w+)\s*>=\s*\w+\.' + re.escape(pname) + r'\b', src_of(t).decode('utf-8', 'replace'))
    return out, (m.group(1) if m else pname)


def score_bands():
    """Faixas declaradas como lista de records (int min, int max, …, String rótulo), como InventoryScoreService.BANDS:
    {classe dona: {'field', 'record', 'bands': [(min, max, rótulo)], 'var', 'eligible': (flag, contagem, CONST, n)}}."""
    out = {}
    for rt in ALL_TYPES:
        types = [f.type for f in rt.fields]
        if rt.kind != 'record' or len(types) < 3 or types[:2] != ['int', 'int'] or 'String' not in types[2:]:
            continue
        li = types.index('String', 2)
        owner = next((t for t in ALL_TYPES if t.name == rt.outer and t.file == rt.file), None)
        if owner is None:
            continue
        r = rt.name
        src = src_of(owner).decode('utf-8', 'replace')
        m = re.search(r'List<' + r + r'>\s+(\w+)\s*=\s*List\.of\(', src)
        if not m:
            continue
        end = src.find(';', m.end())
        body = src[m.end():end]
        bands = []
        for b in re.finditer(r'new\s+' + r + r'\(((?:[^()]|\([^()]*\))*)\)', body):
            a = _split_args(b.group(1))
            if len(a) == len(types) and re.fullmatch(r'\d+', a[0]) and re.fullmatch(r'\d+', a[1]):
                bands.append((int(a[0]), int(a[1]), _message(a[li]) or a[li]))
        if not bands:
            continue
        v = re.search(r'(\w+)\s*>=\s*\w+\.' + re.escape(rt.fields[0].name) + r'\(\)', src)
        el = None
        e = re.search(r'boolean\s+(\w+)\s*=\s*(\w+)\s*>=\s*([A-Z][A-Z0-9_]*)\s*;', src)
        if e and e.group(3) in owner.static_ints:
            el = (e.group(1), e.group(2), e.group(3), owner.static_ints[e.group(3)])
        out[owner.name] = {'field': m.group(1), 'record': r, 'bands': bands, 'var': v.group(1) if v else 'valor',
                           'eligible': el}
    return out


SCORE_BANDS = score_bands()


def level_up(enum):
    """Método que sobe de nível: declara dois valores do enum e compara after.ordinal() > before.ordinal().
    Devolve (classe, método, tipos de notificação, chamadas setX(..., after.name()))."""
    for t in ALL_TYPES:
        if t.module != 'application' or t.kind != 'class':
            continue
        src = src_of(t)
        for m in t.methods:
            if m.node is None:
                continue
            body = _text(m.node, src)
            if len(re.findall(r'\b' + re.escape(enum) + r'\s+\w+\s*=', body)) < 2:
                continue
            mm = re.search(r'(\w+)\.ordinal\(\)\s*>\s*(\w+)\.ordinal\(\)', body)
            if not mm:
                continue
            notif = list(dict.fromkeys(re.findall(r'NotificationType\.([A-Z_]+)', body)))
            sets = list(dict.fromkeys(re.findall(r'\.(set\w+)\([^;]*\b' + mm.group(1) + r'\.name\(\)', body)))
            return t.name, m.name, notif, sets
    return None


def _cond_text(node, src):
    c = _text(node, src).strip()
    while c.startswith('(') and c.endswith(')'):
        c = c[1:-1].strip()
    return re.sub(r'\s+', ' ', c)


def classifier(type_name, method_name):
    """Método que classifica algo em rótulos de texto: devolve [(condição, RÓTULO)] na ordem do código e se os
    rótulos são exclusivos (return "X") ou se acumulam (s.add("X")). Ex.: WardrobeCreatorService.availability,
    RoomService.statesOf."""
    t = TYPES.get(type_name)
    m = next((x for x in t.methods if x.name == method_name), None) if t else None
    if m is None or m.node is None:
        return None
    src = src_of(t)
    rules, kinds = [], set()
    lit = re.compile(r'^(?:return\s+|\w+\.add\(\s*)"([A-Z][A-Z0-9_]*)"')

    def labels_in(block):
        out = []
        for st in (block.children if block.type == 'block' else [block]):
            txt = _text(st, src).strip()
            mm = lit.match(txt)
            if mm:
                out.append(mm.group(1))
                kinds.add('return' if txt.startswith('return') else 'add')
        return out

    def walk(node, prefix=''):
        for ch in node.children:
            if ch.type == 'if_statement':
                cond = _cond_text(ch.child_by_field_name('condition'), src)
                for lb in labels_in(ch.child_by_field_name('consequence')):
                    rules.append((prefix + cond, lb))
                alt = ch.child_by_field_name('alternative')
                if alt is not None:
                    alt_node = alt.children[-1] if alt.type == 'else_clause' else alt
                    if alt_node.type == 'if_statement':
                        walk(type('N', (), {'children': [alt_node]})(), prefix='senão, ')
                    else:
                        for lb in labels_in(alt_node):
                            rules.append(('senão', lb))
            elif ch.type in ('return_statement', 'expression_statement'):
                for lb in labels_in(ch):
                    rules.append(('caso contrário', lb))
    walk(m.node)
    if len({r[1] for r in rules}) < 2:
        return None
    return rules, ('return' in kinds and 'add' not in kinds)


def threshold_flags(type_name):
    """Flags calculadas por limiar numa classe: boolean x = n >= CONST ou put("x", n >= CONST).
    Devolve [(flag, variável, CONST, valor, método)]."""
    t = TYPES.get(type_name)
    if t is None:
        return []
    src = src_of(t)
    out = []
    for m in t.methods:
        if m.node is None:
            continue
        body = _text(m.node, src)
        for mm in re.finditer(r'(?:boolean\s+(\w+)\s*=|put\(\s*"(\w+)"\s*,)\s*(\w+)\s*>=\s*([A-Z][A-Z0-9_]*)\b', body):
            const = mm.group(4)
            if const in t.static_ints:
                out.append((mm.group(1) or mm.group(2), mm.group(3), const, t.static_ints[const], m.name))
    return out


def method_containing(type_name, pattern):
    """Primeiro método do tipo cujo corpo casa com a expressão regular."""
    t = TYPES.get(type_name)
    if t is None:
        return None
    src = src_of(t)
    for m in t.methods:
        if m.node is not None and re.search(pattern, _text(m.node, src)):
            return m.name
    return None


# --------------------------------------------------------------------------------------------- frontend
FRONT_API = re.compile(r'\bapi\.(get|post|put|patch|delete|upload|blobUrl)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\(\s*([`"\'])(/[^`"\']*)\2')


def route_of(page_path):
    rel = page_path.replace(ROOT + '/app', '')
    parts = [p for p in rel.split('/')[:-1] if p and not (p.startswith('(') and p.endswith(')'))]
    return '/' + '/'.join(parts)


def _resolve_import(spec, from_file):
    if spec.startswith('@/'):
        base = ROOT + '/' + spec[2:]
    elif spec.startswith('.'):
        base = os.path.normpath(os.path.join(os.path.dirname(from_file), spec))
    else:
        return None
    for ext in ('.tsx', '.ts', '/index.tsx', '/index.ts'):
        if os.path.exists(base + ext):
            return base + ext
    return None


def _imports(path):
    src = open(path, encoding='utf-8').read()
    out = []
    for m in re.finditer(r'from\s+["\']([^"\']+)["\']', src):
        r = _resolve_import(m.group(1), path)
        if r and ('/components/' in r or '/app/' in r):
            out.append(r)
    return out


def api_calls_of(path):
    src = open(path, encoding='utf-8').read()
    out = []
    for m in FRONT_API.finditer(src):
        verb = {'get': 'GET', 'post': 'POST', 'put': 'PUT', 'patch': 'PATCH', 'delete': 'DELETE', 'upload': 'UPLOAD',
                'blobUrl': 'GET'}[m.group(1)]
        out.append((verb, m.group(3)))
    return out


PAGES = {}
for _p in sorted(glob.glob(ROOT + '/app/**/page.tsx', recursive=True)):
    files, frontier = [_p], [_p]
    for _ in range(2):
        nxt = []
        for f in frontier:
            for imp in _imports(f):
                if imp not in files:
                    files.append(imp)
                    nxt.append(imp)
        frontier = nxt
    calls = []
    for f in files:
        for verb, path in api_calls_of(f):
            e = match_endpoint(verb, path)
            calls.append((verb, path, e, f.replace(ROOT + '/', '')))
    PAGES[route_of(_p)] = dict(file=_p.replace(ROOT + '/', ''), files=[f.replace(ROOT + '/', '') for f in files],
                               calls=calls)

BFF_ROUTES = sorted(route_of(p).replace('/route', '') for p in glob.glob(ROOT + '/app/**/route.ts', recursive=True))


if __name__ == '__main__':
    print('tipos', len(TYPES), 'entidades', len(ENTITIES), 'linhas cassandra', len(CASSANDRA_ROWS), 'enums', len(ENUMS))
    print('repositórios', len(REPOS), 'ports', len(PORTS), 'com adaptador', len(ADAPTERS))
    print('controllers', len(CONTROLLERS), 'endpoints', len(ENDPOINTS), 'serviços', len(SERVICES))
    print('transições', len(TRANSITIONS), 'páginas', len(PAGES),
          'chamadas de API nas páginas', sum(len(p['calls']) for p in PAGES.values()),
          'sem endpoint', sum(1 for p in PAGES.values() for c in p['calls'] if c[2] is None))
