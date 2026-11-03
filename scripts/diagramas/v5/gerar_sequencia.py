"""Diagrama de sequência por RF: tela → controller → serviço → bancos, portas, IA e eventos, na ordem dos passos
do código."""
from __future__ import annotations

import modelo as M
from gerar_atividades import _guard_label
from gerar_consultas import kind_of_dep, page_of_endpoint, repo_op, sql_of, steps_for, summary_label, table_of_repo
from gerar_estilo import alias, esc, header
from gerar_ranking import ranked_endpoints


# --------------------------------------------------------------------------------------------- sequência
class Seq:
    def __init__(self):
        self.parts, self.lines, self.order = {}, [], []

    def part(self, key, decl):
        if key not in self.parts:
            self.parts[key] = decl
            self.order.append(key)
        return key

    def msg(self, line):
        if self.lines and self.lines[-1][0] == line:
            self.lines[-1][1] += 1
        else:
            self.lines.append([line, 1])

    def raw(self, line):
        self.lines.append([line, 0])

    def render(self):
        out = [self.parts[k] for k in self.order]
        for line, n in self.lines:
            if n > 1 and ':' in line:
                line = line + f' (×{n})'
            out.append(line)
        return out


def sequence(sc, name, cited_text, max_eps=2, max_msgs=28):
    out = [header(name, sc.title, 'sequência')]
    eps = [e for e in ranked_endpoints(sc, cited_text) if e.calls][:max_eps]
    q = Seq()
    q.part('U', 'actor "Pessoa usuária" as U')
    expanded = set()
    for idx, e in enumerate(eps):
        svc, meth, steps = steps_for(e)
        if idx > 0 and len(q.lines) > 34:
            break
        page = page_of_endpoint(e, sc)
        q.part('P', f'boundary "Tela {esc(page or "(Next.js)", 40)}" as P')
        C = q.part(alias(e.controller), f'control "{e.controller}" as {alias(e.controller)}')
        S = q.part(alias(svc), f'participant "{svc}" as {alias(svc)}') if svc else C
        q.raw(f'== {esc(summary_label(e, 70))} ==')
        q.msg(f'U -> P : {esc(summary_label(e, 50))}')
        q.msg(f'P -> {C} : {e.verb} {esc(e.path, 60)}')
        q.msg(f'{C} -> {S} : {meth}()')
        q.raw(f'activate {S}')
        count, i = 0, 0
        for i, st in enumerate(steps):
            if count >= max_msgs:
                q.raw(f'note over {S} : … e mais {len(steps) - i} passos no código')
                break
            if st.kind == 'guard':
                q.raw(f'alt {esc(_guard_label(st), 50)}')
                q.msg(f'{S} --> {C} : {st.status} {st.code}')
                q.msg(f'{C} --> P : {st.status} + mensagem')
                q.raw('end')
                count += 2
            elif st.kind == 'call':
                k = kind_of_dep(st.target)
                if k == 'repo':
                    tbl, db = table_of_repo(st.target)
                    D = q.part('DB_' + db, f'database "{db}" as DB_{db}')
                    q.msg(f'{S} -> {D} : {sql_of(repo_op(st.method))} {tbl}')
                    count += 1
                elif k == 'service' and st.target != svc:
                    X = q.part(alias(st.target), f'participant "{st.target}" as {alias(st.target)}')
                    q.msg(f'{S} -> {X} : {st.method}()')
                    count += 1
                    key = (st.target, st.method)
                    if key in expanded or st.target in ('Audit', 'AuditService'):
                        continue
                    expanded.add(key)
                    inner = []
                    if st.target in M.TYPES and M.TYPES[st.target].kind == 'class':
                        inner = [x for x in M.analyzer(st.target).steps(st.method)
                                 if x.kind == 'call' and kind_of_dep(x.target) == 'repo'][:4]
                    for s2 in inner:
                        tbl, db = table_of_repo(s2.target)
                        D = q.part('DB_' + db, f'database "{db}" as DB_{db}')
                        q.msg(f'{X} -> {D} : {sql_of(repo_op(s2.method))} {tbl}')
                        count += 1
                    if inner:
                        q.msg(f'{X} --> {S}')
                elif k == 'port':
                    impl = ', '.join(M.ADAPTERS.get(st.target, [])[:2])
                    X = q.part(alias(st.target), f'participant "{st.target}' + (f'\\n({impl})' if impl else '') + f'" as {alias(st.target)}')
                    q.msg(f'{S} -> {X} : {st.method}()')
                    count += 1
            elif st.kind == 'ai':
                q.part('AI', 'participant "AiEngine\\n(provedor de IA + reserva local)" as AI')
                q.msg(f'{S} -> AI : {st.target}')
                q.msg(f'AI --> {S} : resposta (ou reserva local)')
                count += 2
            elif st.kind == 'event':
                q.part('EV', 'queue "Eventos de domínio" as EV')
                q.msg(f'{S} ->> EV : {st.target}')
                count += 1
            elif st.kind == 'transition':
                q.msg(f'{S} -> {S} : {st.field} = {st.value}')
                count += 1
            elif st.kind == 'create':
                q.msg(f'{S} -> {S} : new {st.target}()')
                count += 1
        q.raw(f'deactivate {S}')
        q.msg(f'{S} --> {C} : resultado')
        q.msg(f'{C} --> P : {"201" if e.verb == "POST" else "200"} JSON')
        q.msg('P --> U : atualiza a tela')
    if not eps:
        q.part('P', 'boundary "Tela (Next.js)" as P')
        q.msg('U -> P : usa a tela')
        q.raw('note right of P : sem rota de API própria neste RF')
    out += q.render()
    out.append('@enduml')
    return '\n'.join(out)
