"""Estados que o código deriva sem setStatus: níveis por limiar, faixas, classificadores e flags por limiar."""
from __future__ import annotations

import re

import modelo as M
from gerar_citacao import _cited, _rf_prefix, _up
from gerar_consultas import callers_of
from gerar_estilo import alias, esc, header, wrap
from gerar_flags import _flag_region, _flag_targets


# --------------------------------------------------------------------------------------------- estados derivados


def threshold_states(sc, name, text):
    """Enum com limiar numérico (ex.: FaiPointsService.Level, STUDIO(300, ...)): um estado por valor, setas na ordem
    dos limiares e o método que sobe de nível."""
    best = None
    for en in M.ENUMS:
        th = M.enum_thresholds(en)
        if not th:
            continue
        hits = sum(1 for v in M.ENUMS[en] if _cited(v, text))
        if hits >= 2:
            score = hits + (5 if _cited(en, text) else 0)
            if best is None or score > best[0]:
                best = (score, en, th)
    if best is None:
        return None
    _, en, (vals, var) = best
    t = M.TYPES[en]
    full = f'{t.outer}.{en}' if t.outer else en
    up = M.level_up(en)
    out = [header(name, _rf_prefix(sc) + f'{full}: níveis por limiar de {var}', 'máquina de estados',
                  f'enum {full} · {len(vals)} níveis · ' + (f'sobe em {up[0]}.{up[1]}()' if up else 'calculado'))]
    comp = f'N_{alias(en)}'
    out.append(f'state "{full} ({var})" as {comp} {{')
    for v, (n, desc) in vals.items():
        num = f'{n:,}'.replace(',', '.')
        out.append(f'  state "{v}\\n{var} ≥ {num}" as {alias(v)}')
        if desc:
            out.append(f'  {alias(v)} : {wrap(desc, 38)}')
    out.append('}')
    names = list(vals)
    out.append(f'[*] --> {alias(names[0])} : {var} = 0')
    for a, b in zip(names, names[1:]):
        lab = (f'{up[1]}()\\n' if up else '') + f'{var} ≥ {vals[b][0]:,}'.replace(',', '.')
        out.append(f'{alias(a)} --> {alias(b)} : {lab}')
    if up:
        cls, meth, notif, sets = up
        eff = []
        if sets:
            eff.append('grava o nível novo (' + ', '.join(f'{x}()' for x in sets) + ')')
        if notif:
            eff.append('notifica ' + ', '.join(notif))
        out.append(f'note right of {comp}\n  {cls}.{meth}() calcula o nível antes e depois do crédito\n'
                   f'  e só age quando after.ordinal() > before.ordinal():\n  ' + '\n  '.join(eff or ['—'])
                   + '\n  Não há caminho no código que desça de nível.\nend note')
    # o que conta para a variável comparada (ex.: FaiPointsLedgerEntry.countsLifetime)
    cnt = [(e, f) for e in M.ENTITIES for f, _ in M.bool_fields(e) if var.lower() in f.lower()]
    for e, f in cnt[:1]:
        trs = [x for x in M.TRANSITIONS if x[0] == e and x[1] == f]
        yes = sorted({x[5].split('.', 1)[1] + '()' for x in trs if x[4] == 'true'})
        no = sorted({x[5].split('.', 1)[1] + '()' for x in trs if x[4] == 'false'})
        if yes or no:
            out.append(f'note bottom of {comp}\n  {var} soma só os lançamentos com {e}.{f} = true\n'
                       + (f'  conta: {esc(", ".join(yes), 70)}\n' if yes else '')
                       + (f'  não conta: {esc(", ".join(no), 70)}\n' if no else '') + 'end note')
    out.append('@enduml')
    return '\n'.join(out)


def bands_states(sc, name, text):
    """Faixas declaradas no código (record (min, max, rótulo) numa lista, ex.: InventoryScoreService.BANDS), com a
    elegibilidade (boolean eligible = n >= MIN_PIECES) e, se o time citou, os booleanos das entidades envolvidas."""
    up_text = ' ' + _up(text) + ' '
    best = None
    for owner, b in M.SCORE_BANDS.items():
        hits = sum(1 for _, _, lb in b['bands'] if f' {_up(lb)} ' in up_text)
        score = hits + (10 if _cited(owner, text) else 0)
        if (hits >= 3 or (hits >= 2 and _cited(owner, text))) and (best is None or score > best[0]):
            best = (score, owner, b)
    if best is None:
        return None
    _, owner, b = best
    var = b['var']
    calc = M.method_containing(owner, r'boolean\s+\w+\s*=\s*\w+\s*>=') or M.method_containing(owner, b['field'])
    eps = _callers_deep(owner, calc) if calc else []
    out = [header(name, _rf_prefix(sc) + f'{owner}: elegibilidade e faixas de {var}', 'máquina de estados',
                  f'{owner}.{b["field"]} · {len(b["bands"])} faixas' + (f' · calculado em {calc}()' if calc else ''))]
    el = b['eligible']
    inner_prefix = ''
    if el:
        flag, cnt, const, n = el
        out.append(f'state "Inelegível\\n{flag} = false ({cnt} < {n})" as INELEGIVEL')
        out.append(f'state "Elegível — {flag} = true ({cnt} ≥ {const} = {n})" as ELEGIVEL {{')
        inner_prefix = '  '
    else:
        out.append(f'state "{owner}.{b["field"]}" as ELEGIVEL {{')
        inner_prefix = '  '
    keys = []
    for i, (lo, hi, lb) in enumerate(b['bands']):
        k = f'F{i}'
        keys.append(k)
        out.append(f'{inner_prefix}state "{esc(lb, 30)}\\n{var} {lo}–{hi}" as {k}')
    out.append(f'{inner_prefix}[*] --> {keys[0]}')
    for i in range(1, len(keys)):
        out.append(f'{inner_prefix}{keys[i - 1]} --> {keys[i]} : {var} ≥ {b["bands"][i][0]}')
    out.append('}')
    trig = (f'{calc}()' if calc else 'recálculo') + (f'\\n{eps[0].verb} {esc(eps[0].path, 40)}' if eps else '')
    if el:
        flag, cnt, const, n = el
        out.append(f'[*] --> INELEGIVEL')
        out.append(f'INELEGIVEL --> ELEGIVEL : {trig}\\n{cnt} ≥ {n}')
        out.append(f'ELEGIVEL --> INELEGIVEL : {calc + "()" if calc else "recálculo"}\\n{cnt} < {n}')
    out.append(f'note right of ELEGIVEL\n  A cada cálculo a faixa é a que contém o {var}\n  (sobe ou desce com o recálculo);'
               f'\n  as setas mostram a ordem crescente.\nend note')
    # booleanos citados das entidades envolvidas (ex.: RankingOptIn.optedIn, opt-in dos rankings)
    for _, e, f, init, p in _flag_targets(text)[:2]:
        if not p:
            out += _flag_region(e, f, init, f'B_{alias(e)}_{alias(f)}')
    out.append('@enduml')
    return '\n'.join(out)


def _callers_deep(svc, meth):
    """Rotas que chamam o método direto ou por um método público do mesmo serviço."""
    eps = list(callers_of(svc, meth))
    t = M.TYPES.get(svc)
    if t is not None and not eps:
        src = M.src_of(t)
        for m in t.methods:
            if m.node is not None and m.name != meth and re.search(r'\b' + re.escape(meth) + r'\(', M._text(m.node, src)):
                eps += callers_of(svc, m.name)
    return list(dict.fromkeys(eps))


def classifier_states(sc, name, text):
    """Estado calculado por um método classificador (ex.: WardrobeCreatorService.availability → EM_BREVE, ESGOTADO…;
    RoomService.statesOf → ESQUECIDA, FAVORITA…), quando o diagrama do time cita o método ou ao menos 3 rótulos."""
    best = None
    for svc, t in M.TYPES.items():
        if t.module != 'application' or t.kind != 'class':
            continue
        svc_c = _cited(svc, text)
        for m in t.methods:
            named = _cited(f'{svc}.{m.name}', sc.title or '')
            if not (named or svc_c):
                continue
            cl = M.classifier(svc, m.name)
            if not cl:
                continue
            hits = sum(1 for lb in {r[1] for r in cl[0]} if _cited(lb, text))
            if not (named or (svc_c and hits >= 3)):
                continue
            score = hits + 10 * named
            if best is None or score > best[0]:
                best = (score, svc, m.name, cl)
    if best is None:
        return None
    _, svc, meth, (rules, exclusive) = best
    eps = _callers_deep(svc, meth)
    out = [header(name, _rf_prefix(sc) + f'{svc}.{meth}(): estado calculado', 'máquina de estados',
                  ('rótulo único: vale a primeira regra verdadeira' if exclusive else 'marcadores acumuláveis')
                  + f' · {len(rules)} regras no código')]
    comp = f'C_{alias(meth)}'
    out.append(f'state "{svc}.{meth}()" as {comp} {{')
    out.append(f'  state {comp}_avaliar <<choice>>')
    labels = list(dict.fromkeys(r[1] for r in rules))
    for lb in labels:
        out.append(f'  state "{lb}" as {comp}_{alias(lb)}')
    out.append('}')
    trig = 'cada leitura' + (f'\\n{eps[0].verb} {esc(eps[0].path, 40)}' if eps else '')
    out.append(f'[*] --> {comp}_avaliar : {trig}')
    for i, (cond, lb) in enumerate(rules, 1):
        c = cond if cond in ('caso contrário', 'senão') else wrap(cond, 40)
        out.append(f'{comp}_avaliar --> {comp}_{alias(lb)} : [{i}] {c}')
    note = ('O estado não é gravado: é recalculado a cada leitura.\n  Vale a primeira regra verdadeira, na ordem do código.'
            if exclusive else 'Os marcadores não são gravados nem exclusivos:\n  cada regra verdadeira acrescenta o seu.')
    out.append(f'note right of {comp}\n  {note}\nend note')
    out.append('@enduml')
    return '\n'.join(out)


def threshold_flag_states(sc, name, text, strict=False):
    """Flag calculada por limiar numa classe citada (ex.: ExplorerService.globalPanel: sufficient = total >= MIN_DATA).
    strict: só quando o título do diagrama nomeia Classe.método."""
    for svc, t in M.TYPES.items():
        if t.module != 'application' or not _cited(svc, text):
            continue
        for flag, var, const, n, meth in M.threshold_flags(svc):
            if not _cited(flag, text) or (strict and not _cited(f'{svc}.{meth}', sc.title or '')):
                continue
            eps = _callers_deep(svc, meth)
            out = [header(name, _rf_prefix(sc) + f'{svc}.{meth}(): {flag} por limiar', 'máquina de estados',
                          f'{flag} = {var} ≥ {const} ({n}) · recalculado a cada chamada')]
            comp = f'T_{alias(flag)}'
            out.append(f'state "{svc}.{meth}() — {flag}" as {comp} {{')
            out.append(f'  state "{flag} = false\\n{var} < {n}" as {comp}_F')
            out.append(f'  state "{flag} = true\\n{var} ≥ {n} ({const})" as {comp}_T')
            out.append('}')
            trig = f'{meth}()' + (f'\\n{eps[0].verb} {esc(eps[0].path, 40)}' if eps else '')
            out.append(f'[*] --> {comp}_F : {trig}')
            out.append(f'{comp}_F --> {comp}_T : {var} chega a {n}')
            out.append(f'{comp}_T --> {comp}_F : {var} cai abaixo de {n}')
            out.append(f'note right of {comp}\n  Não é gravado: {meth}() recalcula a cada chamada\n  (por isso pode voltar a false).\nend note')
            out.append('@enduml')
            return '\n'.join(out)
    return None


DERIVED_STATES = (bands_states, threshold_states, classifier_states,
                  lambda sc, n, t: threshold_flag_states(sc, n, t, strict=True))
