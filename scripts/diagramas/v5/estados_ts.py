"""Estados que o frontend deriva sem useState com literais — lidos do TypeScript.

- classificador: função citada no título que devolve um rótulo por regra (ex.: resolveEnvironment → neutral, brand,
  multibrand);
- pipeline: função que encadeia as funções que o diagrama do time cita (ex.: dress() da roupa no avatar:
  garmentGeometry → relaxGarment → foldGarment …), um estado por etapa, na ordem das chamadas;
- elemento de mídia: componente com <video>/<audio> (ex.: ArtVideo), estados pelas operações no elemento
  (src, play, pause, removeAttribute("src")) e pelo aviso de bloqueio passado por prop.
"""
from __future__ import annotations

import os
import re

import tsmodelo as T
from gerar import alias, esc, header, wrap


def _cited(word, text):
    return bool(word) and re.search(r'(?<![\w])' + re.escape(word) + r'(?![\w])', text) is not None


def _rf_prefix(title):
    rf = re.match(r'^(RF\d+[^—]*)—', title or '')
    return rf.group(1).strip() + ' — ' if rf else ''


def _func(name):
    rel = T.FUNCS.get(name)
    if rel is None:
        for r, m in T.MODULES.items():
            if name in m.funcs:
                rel = r
                break
    if rel is None:
        return None, None
    return T.MODULES[rel], T.MODULES[rel].funcs.get(name)


def _balanced(s, i):
    """Índice logo após o parêntese que fecha o que abre em s[i]."""
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '(':
            depth += 1
        elif s[j] == ')':
            depth -= 1
            if depth == 0:
                return j + 1
    return len(s)


# --------------------------------------------------------------------------------------------- classificador
def _returns(body):
    """[(condição, rótulo)] dos returns de um rótulo: return "x" / return { kind: "x" } / kind: c ? "a" : "b"."""
    out = []
    for m in re.finditer(r'\bif\s*\(', body):
        end = _balanced(body, m.end() - 1)
        cond = body[m.end():end - 1].strip()
        rest = body[end:end + 300]
        r = re.match(r'\s*\{?\s*return\s*(?:\{\s*\w+\s*:\s*)?"([\w-]+)"', rest)
        if r:
            out.append((cond, r.group(1)))
    for r in re.finditer(r'return\s*\{\s*(\w+)\s*:\s*([^?,{}]+?)\s*\?\s*"([\w-]+)"\s*:\s*"([\w-]+)"', body):
        out.append((r.group(2).strip(), r.group(3)))
        out.append(('senão', r.group(4)))
    return out


def classifier_states(title, name, text):
    for fname in re.findall(r'[A-Za-z_]\w+', title or ''):
        mod, f = _func(fname)
        if f is None or f.node is None:
            continue
        body = T._t(f.node, mod.src)
        rules = _returns(body)
        if len({r[1] for r in rules}) < 2:
            continue
        hits = sum(1 for lb in {r[1] for r in rules} if _cited(lb, text))
        if hits < 2:
            continue
        out = [header(name, _rf_prefix(title) + f'{fname}(): estado calculado', 'máquina de estados',
                      f'{mod.path} · vale a primeira regra verdadeira')]
        comp = f'C_{alias(fname)}'
        out.append(f'state "{fname}()" as {comp} {{')
        out.append(f'  state {comp}_avaliar <<choice>>')
        for lb in dict.fromkeys(r[1] for r in rules):
            out.append(f'  state "{lb}" as {comp}_{alias(lb)}')
        out.append('}')
        callers = [r for r in T.importers_of(mod.path) if re.search(r'\b' + fname + r'\(', T.MODULES[r].src.decode('utf-8', 'replace'))]
        out.append(f'[*] --> {comp}_avaliar : a cada mudança das peças vestidas' if 'items' in body[:200]
                   else f'[*] --> {comp}_avaliar : cada chamada')
        for i, (cond, lb) in enumerate(rules, 1):
            out.append(f'{comp}_avaliar --> {comp}_{alias(lb)} : [{i}] {wrap(cond, 40) if cond != "senão" else cond}')
        # parâmetros cujo tipo é uma união nomeada (ex.: mode: EnvironmentMode = "auto" | "neutral" | { pinned })
        sig = mod.src.decode('utf-8', 'replace')
        sm = re.search(r'function\s+' + fname + r'\s*\(([^)]*)\)', sig)
        notes = []
        if sm:
            for pn, pt in re.findall(r'(\w+)\s*:\s*(\w+)(?:\s*=\s*[^,]+)?', sm.group(1)):
                tm = re.search(r'type\s+' + pt + r'\s*=\s*([^;]+);', sig)
                if tm and '|' in tm.group(1):
                    notes.append(f'{pn}: {esc(tm.group(1), 70)}')
        if callers:
            notes.append('chamado por: ' + ', '.join(os.path.basename(c) for c in callers[:4]))
        notes.append('Não é gravado: recalculado a cada chamada.')
        out.append(f'note right of {comp}\n  ' + '\n  '.join(notes) + '\nend note')
        out.append('@enduml')
        return '\n'.join(out)
    return None


# --------------------------------------------------------------------------------------------- pipeline
def _calls(mod, node, enclosing=None, out=None):
    """Chamadas a funções (identificadores) na ordem de avaliação — argumentos antes da própria chamada — como
    (nome, chamada que a contém nos argumentos, texto dos argumentos)."""
    out = [] if out is None else out
    if node.type == 'call_expression':
        fn = node.child_by_field_name('function')
        a = node.child_by_field_name('arguments')
        name = T._t(fn, mod.src) if fn is not None and fn.type == 'identifier' else None
        if a is not None:
            _calls(mod, a, name or enclosing, out)
        if name:
            out.append((name, enclosing, T._t(a, mod.src) if a is not None else ''))
        elif fn is not None:
            _calls(mod, fn, enclosing, out)
        return out
    for c in node.children:
        _calls(mod, c, enclosing, out)
    return out


def _team_word(func, text):
    """Nome que o time deu à etapa: a palavra com inicial maiúscula logo antes do nome da função no diagrama."""
    m = re.search(r'([A-ZÀ-Ý][\wÀ-ÿ]+)\s+' + re.escape(func) + r'\b', text)
    return m.group(1) if m and m.group(1) not in T.FUNCS else None


def pipeline_states(title, name, text):
    """Etapas de uma peça num pipeline: a função que mais encadeia as funções citadas; cada chamada que recebe o
    resultado da primeira etapa (ex.: gg = garmentGeometry(...) → relaxGarment(gg), foldGarment(gg), …) é uma etapa."""
    cited = {f for f in T.FUNCS if _cited(f, text)}
    best = None
    for rel, mod in T.MODULES.items():
        for fn, f in mod.funcs.items():
            if f.node is None:
                continue
            calls = _calls(mod, f.node)
            hit = {c[0] for c in calls if c[0] in cited}
            if len(hit) >= 3 and (best is None or len(hit) > best[0]):
                best = (len(hit), rel, fn, calls)
    if best is None:
        return None
    _, rel, fn, calls = best
    mod = T.MODULES[rel]
    body = T._t(mod.funcs[fn].node, mod.src)
    known = lambda c: c in mod.imports and mod.imports[c][0] in T.MODULES  # noqa: E731
    # funções citadas que o módulo chama antes, em outra função (ex.: kindOf em outfitOf): primeira etapa
    pre = []
    for ofn, of in mod.funcs.items():
        if ofn != fn and of.node is not None and of.line < mod.funcs[fn].line:
            pre += [(c[0], ofn) for c in _calls(mod, of.node) if c[0] in cited and (c[0], ofn) not in pre]
    pre_names = {p[0] for p in pre}
    seq = [c for c in calls if known(c[0]) and c[0] not in pre_names]
    seen, uniq = set(), []
    for c in seq:
        if c[0] not in seen:
            seen.add(c[0])
            uniq.append(c)
    # a variável que guarda o resultado da primeira função citada (ex.: const gg = garmentGeometry(...))
    var = None
    for c in uniq:
        if c[0] in cited:
            m = re.search(r'(?:const|let)\s+(\w+)\s*=\s*' + re.escape(c[0]) + r'\(', body)
            if m:
                var = m.group(1)
                break
    heads = [c[0] for c in uniq if c[0] in cited or (var and re.search(r'\b' + var + r'\b', c[2]))]
    stages = [[p, [], [ofn]] for p, ofn in pre]
    prep, cur, pending = [], None, {}
    for c in uniq:
        if c[0] in heads:
            cur = [c[0], pending.pop(c[0], []), []]
            stages.append(cur)
        elif c[1] in heads and c[1] not in [st[0] for st in stages]:
            pending.setdefault(c[1], []).append(c[0])   # argumento de uma etapa que ainda vem: fica com ela
        elif cur is None:
            prep.append(c[0])
        else:
            cur[1].append(c[0])
    if prep:
        first = len(pre)
        stages.insert(first, ['preparação', prep, []])
    out = [header(name, _rf_prefix(title) + f'{fn}(): etapas de uma peça', 'máquina de estados',
                  f'{rel} · {len(uniq) + len(pre)} funções chamadas em ordem · etapas = chamadas que recebem '
                  + (f'"{var}"' if var else 'o resultado anterior'))]
    keys = []
    for i, (head, helpers, where) in enumerate(stages):
        k = f'E{i}_{alias(head)}'
        keys.append(k)
        if head == 'preparação':
            out.append(f'state "preparação" as {k}')
        else:
            word = _team_word(head, text)
            label = (word + '\\n' if word else '') + f'{head}()' + (f' em {where[0]}()' if where else '')
            out.append(f'state "{label}" as {k}')
        if helpers:
            out.append(f'{k} : {wrap(", ".join(x + "()" for x in helpers), 46)}')
        if head != 'preparação':
            origin = os.path.basename(mod.imports[head][0]) if head in mod.imports else os.path.basename(rel)
            out.append(f'{k} : <size:9>{esc(origin, 40)}</size>')
    out.append(f'[*] --> {keys[0]}')
    for a_, b_ in zip(keys, keys[1:]):
        out.append(f'{a_} --> {b_}')
    out.append(f'{keys[-1]} --> [*]')
    out.append(f'note right of {keys[0]}\n  Ordem das chamadas em {fn}() ({os.path.basename(rel)}).\n'
               + (f'  Cada etapa é uma chamada que recebe "{var}"\n  (a geometria da peça); as outras funções\n  aparecem dentro da etapa em que são chamadas.\n' if var else '')
               + '  Nomes em destaque: os que o time deu às etapas.\nend note')
    out.append('@enduml')
    return '\n'.join(out)


# --------------------------------------------------------------------------------------------- elemento de mídia
def _handler_of(body, pos):
    """Nome da função (const x = … =>) ou observador (const x = new IntersectionObserver) que contém a posição."""
    best = None
    for m in re.finditer(r'const\s+(\w+)\s*=\s*(?:new\s+IntersectionObserver\(|(?:\([^)]*\)|\w+)\s*=>)', body):
        if m.start() < pos and (best is None or m.start() > best[0]):
            # o fim do bloco: primeira linha que fecha com "};" ou "});" depois do início, aproximação por indentação
            line_start = body.rfind('\n', 0, m.start()) + 1
            indent = m.start() - line_start
            end = re.search(r'\n {0,%d}\S' % indent, body[m.end():])
            stop = m.end() + end.start() if end else len(body)
            if pos < stop or body[m.start():pos].count('\n') == 0:
                best = (m.start(), m.group(1))
    if best is None and re.search(r'return\s*\(\)\s*=>', body[:pos]):
        return 'desmontagem'
    return best[1] if best else None


def media_states(title, name, text):
    for fname in re.findall(r'[A-Z]\w+', title or ''):
        mod, f = _func(fname)
        if f is None or f.node is None:
            continue
        body = T._t(f.node, mod.src)
        rm = re.search(r'(\w+)\s*=\s*useRef<HTML(?:Video|Audio)Element>', body)
        if not rm:
            continue
        el = re.search(r'const\s+(\w+)\s*=\s*' + rm.group(1) + r'\.current', body)
        v = el.group(1) if el else rm.group(1) + '.current'
        ops = []
        for m in re.finditer(re.escape(v) + r'\.(src\s*=|play\(\)|pause\(\)|removeAttribute\("src"\))', body):
            ops.append((m.start(), m.group(1).split('(')[0].replace(' ', '').rstrip('=') or 'src'))
        stuck = re.search(r'(\w+)\s*\?\:\s*\((\w+)\s*:\s*boolean\)\s*=>\s*void', mod.src.decode('utf-8', 'replace'))
        mark = re.search(r'const\s+(\w+)\s*=\s*\(\w+\s*:\s*boolean\)\s*=>', body)
        if mark:
            for m in re.finditer(r'\b' + mark.group(1) + r'\((true|false)\)', body):
                ops.append((m.start(), 'stuck-' + m.group(1)))
        for m in re.finditer(r'\.current\?\.\((true|false)\)', body):
            ops.append((m.start(), 'stuck-' + m.group(1)))
        if len({o[1] for o in ops}) < 3:
            continue
        ops.sort()
        events = {}
        for m in re.finditer(r'addEventListener\("(\w+)",\s*(\w+)', body):
            events.setdefault(m.group(2), []).append(m.group(1))
        prop = stuck.group(1) if stuck else 'aviso'
        desc = {'SemFonte': 'sem src: só o pôster', 'Carregado': f'{v}.src definido', 'Tocando': f'{v}.play() aceito',
                'Pausado': f'{v}.pause(), arquivo mantido', 'Travado': f'{prop}(true): play() recusado'}
        out = [header(name, _rf_prefix(title) + f'{fname}: estados do elemento de vídeo', 'máquina de estados',
                      f'{mod.path} · operações em {v} (src, play, pause, removeAttribute) e {prop}(true|false)')]
        out.append('state "SemFonte" as M_SemFonte')
        out.append(f'M_SemFonte : {desc["SemFonte"]}')
        out.append(f'state "Com arquivo ({v}.src)" as M_Com {{')
        for st in ('Carregado', 'Tocando', 'Pausado', 'Travado'):
            out.append(f'  state "{st}" as M_{st}')
            out.append(f'  M_{st} : {desc[st]}')
        out.append('}')
        out.append('[*] --> M_SemFonte : montagem')
        # quem chama cada função de tratamento (ex.: tryPlay chamada por seenIO, nearIO, onVisible, retry)
        callers = {}
        for m in re.finditer(r'\b(\w+)\(\)', body):
            h = _handler_of(body, m.start())
            if h and h != m.group(1) and m.group(1) in re.findall(r'const\s+(\w+)\s*=', body):
                callers.setdefault(m.group(1), []).append(h)

        def trig(h, pos):
            line_start = body.rfind('\n', 0, pos) + 1
            seg = body[line_start:pos]
            cm = list(re.finditer(r'\bif\s*\(', seg))
            cond = ''
            if cm:
                i = line_start + cm[-1].end() - 1
                cond = body[i + 1:_balanced(body, i) - 1].strip()
            if not h:
                return f'[{wrap(cond, 36)}]' if cond else 'montagem'
            via = [x for x in dict.fromkeys(events.get(h, []) + callers.get(h, [])) if x != h]
            lbl = f'{h}()' + (f'\\n({wrap(", ".join(via), 36)})' if via else '')
            return lbl + (f'\\n[{wrap(cond, 36)}]' if cond and h not in ('desmontagem',) else '')
        seen = set()

        def arrow(a, b, lbl):
            if (a, b, lbl) not in seen:
                seen.add((a, b, lbl))
                out.append(f'M_{a} --> M_{b} : {lbl}')
        for pos, op in ops:
            h = _handler_of(body, pos)
            line = body[body.rfind('\n', 0, pos) + 1: body.find('\n', pos)]
            near = 'removeAttribute("src")' in line
            if op == 'src':
                arrow('SemFonte', 'Carregado', trig(h, pos))
            elif op == 'play':
                for a in ('Carregado', 'Pausado'):
                    arrow(a, 'Tocando', trig(h, pos) + '\\npromessa resolvida')
            elif op == 'pause' and not near:
                arrow('Tocando', 'Pausado', trig(h, pos))
            elif op == 'removeAttribute':
                lbl = 'desmontagem\\nou troca de arquivo' if h == 'desmontagem' else trig(h, pos)
                arrow('Com', 'SemFonte', lbl)
            elif op == 'stuck-true':
                for a in ('Carregado', 'Pausado'):
                    arrow(a, 'Travado', 'play() recusado\\n(NotAllowedError)' if 'NotAllowedError' in body else 'play() recusado')
            elif op == 'stuck-false' and h != 'desmontagem':
                arrow('Travado', 'Tocando', 'play() aceito depois de um gesto\\n' + prop + '(false)')
        retry = re.findall(r'document\.addEventListener\("(\w+)",\s*retry', body)
        if retry:
            out.append(f'note right of M_Travado\n  Fica armada uma nova tentativa no primeiro\n  {" ou ".join(dict.fromkeys(retry))} da pessoa.\n'
                       f'  {prop}(true) troca o vídeo pelo plano B do card.\nend note')
        out.append('M_SemFonte --> [*] : desmontagem')
        out.append('@enduml')
        return '\n'.join(out)
    return None


TS_DERIVED = (media_states, classifier_states, pipeline_states)
