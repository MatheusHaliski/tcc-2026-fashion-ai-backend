"""Diagrama de atividades por RF: a rota principal com as guardas que lançam erro, os efeitos nos dados e as
outras ações da tela."""
from __future__ import annotations

from gerar_consultas import kind_of_dep, repo_op, steps_for, summary_label, table_of_repo
from gerar_estilo import esc, header, human_code, wrap
from gerar_ranking import _is_principal, ranked_endpoints


# --------------------------------------------------------------------------------------------- atividades
def _effects(steps, svc):
    reads, writes, ais, evs, trans, others = [], [], [], [], [], []
    for st in steps:
        if st.kind == 'call':
            k = kind_of_dep(st.target)
            if k == 'repo':
                tbl, db = table_of_repo(st.target)
                op = repo_op(st.method)
                (writes if op != 'lê' else reads).append(tbl + (f' ({db})' if db != 'MySQL' else ''))
            elif k in ('port', 'service') and st.target != svc and st.target not in ('Audit', 'AuditService'):
                others.append(f'{st.target}.{st.method}')
        elif st.kind == 'ai':
            ais.append(st.target)
        elif st.kind == 'event':
            evs.append(st.target)
        elif st.kind == 'transition':
            trans.append(f'{st.field} → {st.value}')
    return [(lbl, list(dict.fromkeys(items))) for lbl, items in
            (('Lê', reads), ('Usa', others), ('IA', ais), ('Grava', writes), ('Estado', trans), ('Evento', evs)) if items]


def _guard_label(g):
    if g.code not in ('ERRO', 'NAO_ENCONTRADO', 'ACESSO_NEGADO'):
        return human_code(g.code)
    return esc(g.text, 40) or human_code(g.code)


def activity(sc, name, cited_text, max_side=5, max_guards=5):
    out = [header(name, sc.title, 'atividades')]
    eps = ranked_endpoints(sc, cited_text)
    gets = [e for e in eps if e.verb == 'GET'][:4]
    acts = [e for e in eps if e.verb != 'GET']
    if eps and eps[0].verb == 'GET' and _is_principal(sc, eps[0]):
        acts = [eps[0]] + acts
        gets = [g for g in gets if g is not eps[0]]
    if not acts:
        acts, gets = gets[:1] + [e for e in eps if e.verb == 'GET'][4:], gets[1:]
    pages = sc.pages[:3]
    out.append('|Pessoa usuária|')
    out.append('start')
    out.append(f':Abre {wrap(", ".join(pages) if pages else "a tela do RF")};')
    out.append('|Tela (Next.js)|')
    out.append((':Carrega os dados da tela\\n' + '\\n'.join(f'GET {esc(g.path, 60)}' for g in gets) + ';') if gets
               else ':Monta a tela;')
    if not acts:
        out.append('|Pessoa usuária|')
        out.append(':Consulta as informações;')
        out.append('stop')
        out.append('@enduml')
        return '\n'.join(out)
    main = acts[0]
    svc, meth, steps = steps_for(main)
    out.append('|Pessoa usuária|')
    out.append(f':{wrap(summary_label(main, 60), 36)};')
    out.append('|Tela (Next.js)|')
    out.append(f':{main.verb} {esc(main.path, 70)};')
    out.append('|API (Spring Boot)|')
    out.append(f':{main.controller}.{main.method}\\n→ {svc or "—"}.{meth or ""};')
    guards = [g for g in steps if g.kind == 'guard']
    for g in guards[:max_guards]:
        msg = wrap(g.text, 34) if g.text else ''
        out.append(f'if ({esc(_guard_label(g), 44).replace("(", "[").replace(")", "]")}?) then (sim)')
        out.append(f'  :{g.status} {g.code}' + (f'\\n«{msg}»' if msg else '') + '\\n→ a tela mostra o aviso;')
        out.append('  stop')
        out.append('endif')
    if len(guards) > max_guards:
        rest = ', '.join(sorted({g.code for g in guards[max_guards:]}))
        out.append(f'note right\n  e mais {len(guards) - max_guards} validações:\n  {wrap(rest, 50).replace(chr(92) + "n", chr(10) + "  ")}\nend note')
    out.append('|Dados e serviços|')
    eff = _effects(steps, svc)
    if not eff:
        out.append(':Monta a resposta;')
    for lbl, items in eff:
        shown = items[:6]
        more = f' (+{len(items) - 6})' if len(items) > 6 else ''
        out.append(f':{lbl}: ' + '\\n'.join(wrap(x, 46) for x in shown) + more + ';')
    out.append('|Tela (Next.js)|')
    out.append(':Atualiza a tela com a resposta;')
    side = acts[1:1 + max_side]
    if side:
        out.append('|Pessoa usuária|')
        out.append('if (Faz outra ação?) then (sim)')
        out.append('  switch (Qual?)')
        for e in side:
            sv, me, st = steps_for(e)
            eff = _effects(st, sv)
            gs = sorted({g.code for g in st if g.kind == 'guard'})
            lines = [f'{e.verb} {esc(e.path, 56)}', f'→ {sv}.{me}']
            if gs:
                lines.append('valida: ' + wrap(', '.join(gs[:4]) + (' …' if len(gs) > 4 else ''), 44))
            for lbl, items in eff[:3]:
                lines.append(f'{lbl.lower()}: ' + wrap(', '.join(items[:3]) + (' …' if len(items) > 3 else ''), 44))
            out.append(f'  case ({esc(summary_label(e, 34)).replace("(", "[").replace(")", "]")})')
            out.append('    :' + '\\n'.join(lines) + ';')
        out.append('  endswitch')
        if len(acts) > 1 + max_side:
            more = ', '.join(summary_label(e, 30) for e in acts[1 + max_side:1 + max_side + 6])
            out.append(f'  note right\n  Outras ações deste RF:\n  {wrap(more, 50).replace(chr(92) + "n", chr(10) + "  ")}\n  end note')
        out.append('  |Tela (Next.js)|')
        out.append('  :Atualiza a tela;')
        out.append('endif')
    out.append('|Pessoa usuária|')
    out.append('stop')
    out.append('@enduml')
    return '\n'.join(out)
