"""Diagramas consolidados v4 (RF25–RF39): classes por área e componentes da arquitetura."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from code_model import ENTITIES, ENUMS, TABLES, DEPS, class_block, enum_block, relations
from gen import SPECS, CLS_STYLE, CMP_STYLE, PORTS, alias, is_service
OUT = sys.argv[1]
AREAS = [
    ('Selos, promoções e cupons (RF25, RF38)', ['Seal', 'SealBond', 'Promotion', 'PromotionRedemption', 'CouponRight', 'Notification']),
    ('Meu Guarda-Roupa (RF27–RF32)', ['RoomLayout', 'RoomStorageEntry', 'MirrorState', 'InventoryScoreSnapshot', 'RankingOptIn', 'RankingPosition', 'UserAchievement', 'FaiPointsLedgerEntry', 'FaiPointsRule', 'WardrobeAvailabilityChange', 'PieceUsageDiaryEntry', 'ChallengeTemplate', 'ChallengeInstance', 'ChallengeParticipant', 'ChallengeEvent', 'ChallengeNote', 'ChallengeVote']),
    ('Loja do quarto e criador (RF30, RF39)', ['RoomCatalogItem', 'RoomInventoryItem']),
    ('Vitrine: passarela, eras, coleções e manequim (RF33–RF36)', ['DailyLook', 'SchemeGrouping', 'UserPreferences']),
    ('FLAIR (RF37)', ['FlairProfile', 'FlairCoinEntry', 'FlairMatch', 'FlairMatchEntry', 'FlairTeam', 'FlairTeamMember', 'FlairCombination', 'FlairRedemption', 'FlairModeState', 'FlairTerritory', 'FlairTrophy']),
    ('Núcleo (RF1–RF24)', ['User', 'BrandProfile', 'CelebrityProfile', 'WardrobeItem', 'Scheme', 'SchemeItem', 'Follow']),
    ('HypeScore v2 (RF49)', ['HypeSignalDaily', 'HypeScoreCurrent', 'HypeScoreSnapshot']),
]
# Atenção (RF49, 2026-10): docs/diagramas/fashionai-*-v4.puml foram completados à mão depois da última geração —
# enums, @Embeddable HypeDimensions, repositórios e notas do HypeScore v2, HypeController e o pacote hype nos
# componentes, e dois rótulos de aresta removidos (FlairTeam→User, SealBond→Scheme) que derrubavam o Smetana.
# Rodar este script de novo sobrescreve esses acréscimos: reaplique-os (ver git log dos .puml).
names = [e for _, es in AREAS for e in es if e in ENTITIES]
L = ['@startuml FashionAI_Classes_v4', 'title Fashion AI — Diagrama de Classes v4 (RF25–RF39)\\nEntidades JPA reais do fai-domain, agrupadas por área — gerado do código', CLS_STYLE, '']
for title, es in AREAS:
    L.append(f'package "{title}" {{')
    for e in es:
        if e in ENTITIES:
            L.append(class_block(e, max_fields=6))
    L.append('}')
for r in relations(names):
    L.append(r)
L.append('@enduml')
open(os.path.join(OUT, 'fashionai-classes-v4.puml'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')

ctrls = []
for rf in sorted(SPECS, key=lambda x: int(x[2:])):
    for c in SPECS[rf]['controllers']:
        if c not in ctrls:
            ctrls.append(c)
svcs = []
for c in ctrls:
    for d in DEPS.get(c, []):
        if is_service(d) and d not in svcs:
            svcs.append(d)
rfs_of = {}
for rf, sp in SPECS.items():
    for c in sp['controllers']:
        rfs_of.setdefault(c, []).append(rf)
C = ['@startuml FashionAI_Componentes_v4', 'title Fashion AI — Diagrama de Componentes v4 (RF25–RF39)\\nControllers → serviços de aplicação → adaptadores de infraestrutura — gerado do código', CMP_STYLE, '']
C.append('package "Frontend (Next.js 15 · React Three Fiber)" {\n  component "App Fashion AI (web/mobile)" as FE\n}')
C.append('package "fai-web (REST · Spring Boot)" {')
for c in ctrls:
    C.append(f'  component "{c}\\n({", ".join(sorted(rfs_of[c], key=lambda x: int(x[2:])))})" as {alias(c)}')
C.append('}')
C.append('package "fai-application (casos de uso)" {')
for s in svcs:
    C.append(f'  [{s}] as {alias(s)}')
C.append('  [FlairEngine + FlairLooks\\n(atributos de carta e de look)] as FlairCore')
C.append('  [WorldRegions\\n(país → região)] as WR')
C.append('}')
C.append('package "fai-infrastructure (adaptadores + fallbacks)" {')
C.append('  database "MySQL 8 · Flyway V1–V20\\n(persistence-mysql)" as DB')
C.append('  database "Storage de mídia\\n(storage-s3 · fallback disco local)" as MS')
C.append('  cloud "Motor de IA (ai-providers)\\nprovedores externos · fallback local" as AI')
C.append('  database "Redis (cache-redis)\\ncontadores, rate limit, cache\\nfallback em memória" as RD')
C.append('  database "OpenSearch (índice de busca)\\nCassandra (projeções de timeline)\\nopcionais · fallback no-op" as OS')
C.append('}')
for c in ctrls:
    C.append(f'FE --> {alias(c)} : HTTPS/JSON')
    for d in DEPS.get(c, []):
        if d in svcs:
            C.append(f'{alias(c)} --> {alias(d)}')
for s in svcs:
    deps = DEPS.get(s, [])
    if any(x.endswith('Repository') for x in deps):
        C.append(f'{alias(s)} --> DB')
    if 'MediaService' in deps:
        C.append(f'{alias(s)} --> MS')
    if 'AiEngine' in deps:
        C.append(f'{alias(s)} --> AI')
    if 'AnalyticsQueryPort' in deps:
        C.append(f'{alias(s)} --> DB : AnalyticsQueryPort')
    for d in deps:
        if d in svcs and d != s:
            C.append(f'{alias(s)} ..> {alias(d)}')
if 'FlairModesService' in svcs:
    C.append('FlairModesService ..> FlairCore')
if 'ShowcaseService' in svcs:
    C.append('ShowcaseService ..> WR')
C.append('@enduml')
seen, out = set(), []
for l in C:
    if ('-->' in l or '..>' in l) and l in seen:
        continue
    seen.add(l)
    out.append(l)
open(os.path.join(OUT, 'fashionai-componentes-v4.puml'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('ok', len(names), len(ctrls), len(svcs))
