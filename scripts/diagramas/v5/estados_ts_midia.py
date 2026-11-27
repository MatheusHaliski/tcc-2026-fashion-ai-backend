"""Estados de um elemento de vídeo/áudio de um componente (ex.: ArtVideo): src, play, pause e o aviso de bloqueio."""
from __future__ import annotations

import re

import tsmodelo as T
from estados_ts_apoio import _balanced, _func, _rf_prefix
from gerar_estilo import header, wrap


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
