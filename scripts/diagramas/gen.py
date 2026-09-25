"""Gera atividades, sequência, componentes e classes (PlantUML) dos RF25–RF39 a partir das specs e do código real."""
import os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from code_model import ENTITIES, ENUMS, TABLES, DEPS, KIND, class_block, enum_block, relations
from specs_a import SPECS as A
from specs_b import SPECS as B
SPECS = {**A, **B}
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'out')

ACT_STYLE = '''skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam roundcorner 18
skinparam ArrowColor #52606D
skinparam activity {
  BackgroundColor #F8F4FF
  BorderColor #B695F5
  FontColor #2D2438
  DiamondBackgroundColor #FFF5F8
  DiamondBorderColor #F08DB1
  StartColor #20A77A
  EndColor #4B5563
  BarColor #4B4B4B
}
skinparam swimlane {
  BorderColor #CBC6BE
  TitleFontColor #2D2438
}
skinparam note {
  BackgroundColor #FFFDEB
  BorderColor #D8CE78
  FontColor #554F24
}'''
SEQ_STYLE = '''skinparam backgroundColor #FFFFFF
skinparam sequence {
  ArrowColor #4A4852
  LifeLineBorderColor #CBC6BE
  ParticipantBackgroundColor #F4F2EF
  ParticipantBorderColor #4A4852
}
autonumber'''
CMP_STYLE = '''!pragma layout smetana
skinparam backgroundColor #FFFFFF
skinparam component {
  BackgroundColor #F4F2EF
  BorderColor #4A4852
  ArrowColor #4A4852
}
skinparam package {
  BorderColor #CBC6BE
}
skinparam database {
  BackgroundColor #EEF6FF
  BorderColor #4A4852
}
left to right direction'''
CLS_STYLE = '''!pragma layout smetana
skinparam backgroundColor #FFFFFF
skinparam class {
  BackgroundColor #F4F2EF
  BorderColor #4A4852
  ArrowColor #4A4852
  HeaderBackgroundColor #E4DEF0
}
skinparam packageStyle rectangle
hide empty methods'''

PORTS = {
    'AiEngine': ('Motor de IA transversal (RF24)\\nprovedores externos + fallback local', 'ai'),
    'MediaService': ('Storage de mídia\\n(local / S3, MediaStoragePort)', 'media'),
    'NotificationService': ('NotificationService\\n(RNF10)', 'notif'),
    'ApplicationEventPublisher': ('Eventos de domínio\\n(@TransactionalEventListener AFTER_COMMIT)', 'events'),
    'org.springframework.context.ApplicationEventPublisher': ('Eventos de domínio\\n(@TransactionalEventListener AFTER_COMMIT)', 'events'),
    'AnalyticsQueryPort': ('AnalyticsQueryPort\\n(MysqlAnalyticsAdapter · agregados)', 'analytics'),
    'SideEffectRunner': ('SideEffectRunner\\n(efeitos colaterais isolados)', 'side'),
}
SKIP = {'Guard', 'Audit', 'ObjectProvider', 'CurrentUser'}

def alias(s):
    return re.sub(r'\W', '_', s)

def is_service(t):
    return KIND.get(t) == 'app' and not t.endswith('Repository') and t not in SKIP and t not in PORTS

def components(rf, sp):
    lines = [f'@startuml {rf}_Componentes', f'title {sp["title"]}\\nDiagrama de componentes — gerado do código (controllers → serviços → repositórios/ports)', CMP_STYLE, '']
    lines.append('package "Frontend (Next.js · React Three Fiber)" {')
    for i, f in enumerate(sp['frontend']):
        lines.append(f'  component "{f}" as FE{i}')
    lines.append('}')
    ctrls = sp['controllers']
    primary, secondary, repos, ports = [], [], set(), set()
    for c in ctrls:
        for d in DEPS.get(c, []):
            if is_service(d) and d not in primary:
                primary.append(d)
    for p in primary:
        for d in DEPS.get(p, []):
            if d.endswith('Repository'):
                repos.add(d)
            elif d in PORTS:
                ports.add(d)
            elif is_service(d) and d not in primary and d not in secondary:
                secondary.append(d)
    lines.append('package "fai-web (REST)" {')
    for c in ctrls:
        lines.append(f'  [{c}] as {alias(c)}')
    lines.append('}')
    lines.append('package "fai-application (casos de uso)" {')
    for s in primary:
        lines.append(f'  [{s}] as {alias(s)}')
    for s in secondary:
        lines.append(f'  [{s}] as {alias(s)} #FAFAFA')
    lines.append('}')
    tables = []
    for r in sorted(repos):
        ent = r[:-len('Repository')]
        tables.append(TABLES.get(ent, ent))
    lines.append('package "fai-domain (repositórios JPA)" {')
    lines.append('  [' + '\\n'.join(sorted(repos)) + '] as REPOS')
    lines.append('}')
    lines.append('database "MySQL · fashionai_app\\n' + '\\n'.join('• ' + t for t in sorted(set(tables))) + '" as DB')
    seen_ports = {}
    for p in sorted(ports):
        label, key = PORTS[p]
        if key in seen_ports:
            continue
        seen_ports[key] = p
        shape = 'cloud' if key == 'ai' else 'database' if key in ('media', 'analytics') else 'component'
        if shape == 'component':
            lines.append(f'[{label}] as P_{key}')
        else:
            lines.append(f'{shape} "{label}" as P_{key}')
    lines.append('')
    for i in range(len(sp['frontend'])):
        for c in ctrls:
            lines.append(f'FE{i} --> {alias(c)} : HTTPS/JSON')
    for c in ctrls:
        for d in DEPS.get(c, []):
            if d in primary:
                lines.append(f'{alias(c)} --> {alias(d)}')
    for p in primary:
        for d in DEPS.get(p, []):
            if d in secondary or (d in primary and d != p):
                lines.append(f'{alias(p)} ..> {alias(d)}')
        if any(x.endswith('Repository') for x in DEPS.get(p, [])):
            lines.append(f'{alias(p)} --> REPOS')
        for d in DEPS.get(p, []):
            if d in PORTS:
                lines.append(f'{alias(p)} --> P_{PORTS[d][1]}')
    lines.append('REPOS --> DB : JPA/Flyway')
    lines.append('@enduml')
    # remove duplicate arrows
    out, seen = [], set()
    for l in lines:
        if '-->' in l or '..>' in l:
            if l in seen:
                continue
            seen.add(l)
        out.append(l)
    return '\n'.join(out)

def classes(rf, sp):
    names = [e for e in sp['entities'] if e in ENTITIES] + [e for e in sp['enums'] if e in ENUMS]
    lines = [f'@startuml {rf}_Classes', f'title {sp["title"]}\\nDiagrama de classes — entidades JPA reais (fai-domain) e enums', CLS_STYLE, '']
    lines.append('package "fai-domain · model" {')
    for e in sp['entities']:
        if e in ENTITIES:
            lines.append(class_block(e, max_fields=14 if e != 'User' else 10))
    lines.append('}')
    ens = [e for e in sp['enums'] if e in ENUMS]
    if ens:
        lines.append('package "fai-domain · enums" {')
        for e in ens:
            lines.append(enum_block(e))
        lines.append('}')
    for r in relations(names):
        lines.append(r)
    for e in sp['entities']:
        if e in TABLES:
            lines.append(f'note top of {e} : tabela {TABLES[e]}')
    lines.append('@enduml')
    return '\n'.join(lines)

def activity(rf, sp):
    return '\n'.join([f'@startuml {rf}_Atividades', f'title {sp["title"]}\\nDiagrama de atividades', ACT_STYLE, sp['activity'].strip(), '@enduml'])

def sequence(rf, sp):
    return '\n'.join([f'@startuml {rf}_Sequencia', f'title {sp["title"]}\\nDiagrama de sequência — endpoints reais', SEQ_STYLE, sp['sequence'].strip(), '@enduml'])

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    made = []
    for rf in sorted(SPECS, key=lambda x: int(x[2:])):
        sp = SPECS[rf]
        d = os.path.join(OUT, rf)
        os.makedirs(d, exist_ok=True)
        files = {'componentes': components(rf, sp), 'classes': classes(rf, sp)}
        if sp.get('activity'):
            files['atividades'] = activity(rf, sp)
        if sp.get('sequence'):
            files['sequencia'] = sequence(rf, sp)
        for kind, txt in files.items():
            p = os.path.join(d, f'{rf}-{kind}.puml')
            open(p, 'w', encoding='utf-8').write(txt + '\n')
            made.append(p)
    print('\n'.join(made))
