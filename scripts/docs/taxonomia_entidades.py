#!/usr/bin/env python3
"""
Taxonomia de entidades do FashionAI, gerada do código (nada digitado à mão além do agrupamento por área):

  - entidades JPA de fai-domain/.../domain/model (tabela, base auditável/versionada, campos, relações, enums);
  - enums de domínio (valores);
  - listas da taxonomia de peça/esquema (fai-application/.../taxonomy/Taxonomy.java);
  - entidades embutidas em JSON (desenho e política do selo, configuração de estúdio do esquema).

Escreve docs/taxonomia/taxonomia-de-entidades.md e docs/taxonomia/taxonomia-de-entidades.puml.
Uso: python3 scripts/docs/taxonomia_entidades.py
"""
import datetime
import glob
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODEL = os.path.join(ROOT, "fai-domain", "src", "main", "java", "br", "com", "fashionai", "domain", "model")
TAXONOMY = os.path.join(ROOT, "fai-application", "src", "main", "java", "br", "com", "fashionai", "application", "taxonomy", "Taxonomy.java")
OUT = os.path.join(ROOT, "docs", "taxonomia")

# Agrupamento por área de negócio (a única parte manual; uma entidade nova sem área aparece em "Sem área" e o teste
# de completude abaixo acusa).
AREAS = [
    ("Identidade, conta e privacidade", "RF1–RF3, RF23, RNF2/RNF6",
     ["User", "UserPreferences", "UserConsent", "VerificationCode", "RefreshToken", "DataExportRequest"]),
    ("Perfis emissores (marca e celebridade)", "RF1.CA06–CA10, RF14, RF20–RF22",
     ["BrandProfile", "CelebrityProfile"]),
    ("Guarda-roupa e peças", "RF4, RF6, RF7, RF9, RF28, RF29, RF31, RF45",
     ["WardrobeItem", "PieceImage", "PieceUsageDiaryEntry", "WardrobeAvailabilityChange", "CaptureSession",
      "CaptureRequest", "QualityScore", "AiReviewItem", "GarmentLandmark", "GarmentEmbedding", "ItemEmbedding",
      "BrandPrediction"]),
    ("Marcas e catálogo global", "RF4, RF47",
     ["Brand", "BrandAlias", "BrandLogo", "CatalogSource", "CatalogProduct", "CatalogProductAlias", "CatalogVariant",
      "CatalogImage", "CatalogIngestionRun", "KbBrandSignature", "KbProductLine", "KbProductModel"]),
    ("Esquemas (looks), DNA e planejamento", "RF5–RF7, RF11, RF13, RF28 (Vista-me), HU18–HU20",
     ["Scheme", "SchemeItem", "SchemeGrouping", "DnaScheme", "DnaSchemeItem", "StyleDna", "StyleDnaVersion",
      "DailyLook", "HypeScoreMetric", "WeekPlan", "WeekPlanDay", "AcervoGroup", "HypeGroup", "MirrorState"]),
    ("Selos, promoções e cupons", "RF20, RF21, RF25, RF38",
     ["Seal", "SealBond", "Promotion", "PromotionRedemption", "CouponRight"]),
    ("Social e notificações", "RF8, RF12, RF19, RNF10",
     ["Follow", "Comment", "Reaction", "Share", "SavedItem", "Notification", "Photo"]),
    ("Gamificação (FAI Points, desafios, rankings)", "RF29, RF30, RF32, RF41",
     ["FaiPointsLedgerEntry", "FaiPointsRule", "ChallengeTemplate", "ChallengeInstance", "ChallengeParticipant",
      "ChallengeEvent", "ChallengeNote", "ChallengeVote", "UserAchievement", "RankingOptIn", "RankingPosition",
      "InventoryScoreSnapshot"]),
    ("FLAIR (jogo de cartas)", "RF37",
     ["FlairProfile", "FlairCoinEntry", "FlairCombination", "FlairMatch", "FlairMatchEntry", "FlairModeState",
      "FlairRedemption", "FlairTeam", "FlairTeamMember", "FlairTerritory", "FlairTrophy"]),
    ("Quarto 3D e avatar", "RF27, RF30, RF39, RF40",
     ["RoomCatalogItem", "RoomInventoryItem", "RoomLayout", "RoomStorageEntry", "UserAvatar3d", "AvatarIdentityVersion"]),
    ("IA, visão computacional e pipelines", "RF4, RF11, RF16, RF18, RF24, RF45",
     ["AiInferenceLog", "ModelInference", "ModelRegistryEntry", "DatasetSource", "TrainingCandidate", "PipelineJob",
      "ProcessingJobLog", "RenderJobLog", "MetricSnapshot", "AssetPreset"]),
    ("HypeScore v2 (sinais, recortes e marcos)", "RF26, RF53",
     ["HypeSignalDaily", "HypeScoreCurrent", "HypeScoreSnapshot", "HypeMilestone"]),
    ("FashionAI Lens", "RF54",
     ["LensScan", "LensDetection", "LensFeedback"]),
    ("Moderação, auditoria e operação", "RN11, RNF4, RNF5",
     ["ModerationQueueItem", "AuditLog", "BackupRecord"]),
]
BASES = {"AuditableEntity", "VersionedAuditableEntity"}
REL = re.compile(r"@(ManyToOne|OneToOne|OneToMany|ManyToMany)")


def parse_entity(path):
    s = open(path, encoding="utf-8").read()
    name = os.path.basename(path)[:-5]
    table = re.search(r'@Table\(\s*(?:name\s*=\s*)?"([^"]+)"', s) or re.search(r'name\s*=\s*"([^"]+)"', s.split("public class")[0])
    ext = re.search(r"public (?:abstract )?class \w+(?: extends (\w+))?", s)
    doc = re.search(r"/\*\*(.*?)\*/\s*(?:@[\w.]+(?:\((?:[^()]|\([^()]*\))*\))?\s*)*public (?:abstract )?class", s, re.S)
    summary = re.sub(r"\s+", " ", re.sub(r"\n\s*\*\s?", " ", doc.group(1))).strip() if doc else ""
    summary = re.sub(r"\{@(?:link|code) ([^}]+)\}", r"\1", summary)
    fields, rels, enums = [], [], []
    body = s[s.find("{", ext.end()) + 1:] if ext else s
    pending = []
    for line in body.splitlines():
        t = line.strip()
        if t.startswith("@"):
            pending.append(t)
            continue
        m = re.match(r"(?:private|protected) (?!static)([\w<>, ?]+?) (\w+)(?: = [^;]+)?;", t)
        if m:
            typ, fname = m.group(1), m.group(2)
            ann = " ".join(pending)
            rm = REL.search(ann)
            if rm:
                rels.append((fname, rm.group(1), re.sub(r"[^\w]", "", typ.split("<")[-1])))
            if "@Enumerated" in ann:
                enums.append((fname, typ))
            fields.append((fname, typ))
        if t and not t.startswith("@"):
            pending = []
    return {"name": name, "table": table.group(1) if table else None, "base": ext.group(1) if ext else None,
            "summary": summary, "fields": fields, "rels": rels, "enums": enums}


def parse_enums():
    out = {}
    for f in sorted(glob.glob(os.path.join(MODEL, "enums", "*.java"))):
        s = re.sub(r"/\*.*?\*/|//[^\n]*", "", open(f, encoding="utf-8").read(), flags=re.S)   # sem Javadoc ({@link …})
        m = re.search(r"\benum\s+\w+[^{]*\{", s)
        body = s[m.end():] if m else ""
        body = body.split(";")[0]
        vals = [v.strip().split("(")[0] for v in body.split(",") if re.match(r"\s*[A-Z][A-Z0-9_]*", v)]
        out[os.path.basename(f)[:-5]] = [re.sub(r"[^A-Z0-9_]", "", v) for v in vals if v]
    return out


def parse_taxonomy():
    s = open(TAXONOMY, encoding="utf-8").read()
    lists = {}
    for name in ["OCCASIONS", "STYLES", "MATERIALS", "SEXES", "SIZES", "MARKET_SEASONS", "MARKET_GENDERS"]:
        m = re.search(name + r" = List\.of\((.*?)\);", s, re.S)
        lists[name] = re.findall(r'"([^"]+)"', m.group(1)) if m else []
    subs = {k: re.findall(r'"([^"]+)"', v) for k, v in re.findall(r'SUBCATEGORIES\.put\("(\w+)", List\.of\((.*?)\)\);', s, re.S)}
    colors = re.findall(r'\{"([^"]+)", "(\w+)", "(#[0-9A-Fa-f]{6})"\}', s)
    wear = {k: re.findall(r'"([^"]+)"', v) for k, v in re.findall(r'WEARSTYLE_GROUPS\.put\("(\w+)", List\.of\((.*?)\)\);', s, re.S)}
    return lists, subs, colors, wear


def md_table(rows, head):
    out = ["| " + " | ".join(head) + " |", "|" + "|".join(["---"] * len(head)) + "|"]
    out += ["| " + " | ".join(str(c).replace("|", "\\|") for c in r) + " |" for r in rows]
    return "\n".join(out)


def main():
    # só classes JPA (@Entity) e as bases @MappedSuperclass; interfaces do modelo (ex.: ReviewableProfile) ficam de fora
    java = [p for p in sorted(glob.glob(os.path.join(MODEL, "*.java")))
            if re.search(r"^@(Entity|MappedSuperclass)\b", open(p, encoding="utf-8").read(), re.M)]
    ents = {e["name"]: e for e in (parse_entity(p) for p in java)}
    concrete = {n: e for n, e in ents.items() if n not in BASES}
    placed = {n for _, _, ns in AREAS for n in ns}
    missing = sorted(set(concrete) - placed)
    unknown = sorted(placed - set(concrete))
    enums = parse_enums()
    lists, subs, colors, wear = parse_taxonomy()
    n_rel = sum(len(e["rels"]) for e in concrete.values())
    n_fields = sum(len(e["fields"]) for e in concrete.values())
    today = datetime.date.today().isoformat()

    L = []
    L.append("# Taxonomia de entidades do FashionAI")
    L.append("")
    L.append(f"> Gerado por `scripts/docs/taxonomia_entidades.py` a partir do código em {today}. As contagens são calculadas; "
             "o único conteúdo manual é o agrupamento por área. Para atualizar, rode o script de novo.")
    L.append("")
    L.append("Numeração de RF = a do **Trello** (código RF32→RF27, RF33 do espelho→RF28, RF34→RF29, RF35→RF30, RF36→RF32, "
             "RF4 da captura V29→RF45; tabela em [`docs/novos-rf/README.md`](../novos-rf/README.md)). Visão complementar, "
             "por contexto delimitado, com migração de origem e enum de ciclo de vida de cada entidade: "
             "[`docs/entidades/TAXONOMIA_ENTIDADES.md`](../entidades/TAXONOMIA_ENTIDADES.md). Esta aqui traz contagens, "
             "campos, relações JPA, enums com valores e as entidades embutidas em JSON.")
    L.append("")
    L.append("## Resumo")
    L.append("")
    L.append(md_table([
        ["Entidades persistidas (JPA, MySQL)", len(concrete)],
        ["Áreas de negócio", len(AREAS)],
        ["Campos (somados)", n_fields],
        ["Relações JPA (ManyToOne/OneToOne/…)", n_rel],
        ["Enums de domínio", len(enums)],
        ["Categorias de peça · subcategorias", f"{len(subs)} · {sum(len(v) for v in subs.values())}"],
        ["Cores · famílias", f"{len(colors)} · {len(set(c[0] for c in colors))}"],
        ["Ocasiões · estilos", f"{len(lists['OCCASIONS'])} · {len(lists['STYLES'])}"],
        ["Entidades sem área (devem ser 0)", len(missing)],
    ], ["Medida", "Valor"]))
    L.append("")
    L.append("Bases abstratas: `AuditableEntity` (id UUID, criado/atualizado em/por — RNF5) e `VersionedAuditableEntity` "
             "(+ `@Version`, concorrência otimista para agregados mutáveis). Mapa visual: `taxonomia-de-entidades.puml/.png`.")
    L.append("")
    L.append("## Áreas e entidades")
    for title, rfs, names in AREAS:
        L.append("")
        L.append(f"### {title}  ·  {rfs}  ·  {len(names)} entidades")
        L.append("")
        rows = []
        for n in names:
            e = concrete.get(n)
            if not e:
                continue
            base = "versionada" if e["base"] == "VersionedAuditableEntity" else "auditável" if e["base"] == "AuditableEntity" else (e["base"] or "—")
            rel = ", ".join(f"{f} → {t}" for f, _, t in e["rels"]) or "—"
            summ = e["summary"][:220] + ("…" if len(e["summary"]) > 220 else "")
            rows.append([f"**{n}**", f"`{e['table'] or '—'}`", base, len(e["fields"]), rel, summ or "—"])
        L.append(md_table(rows, ["Entidade", "Tabela", "Base", "Campos", "Relações", "Papel (Javadoc)"]))
    if missing:
        L.append("")
        L.append("### Sem área")
        L.append("")
        L.append(", ".join(missing))
    L.append("")
    L.append("## Campos por entidade")
    L.append("")
    L.append("Lista completa dos campos de cada entidade (além de `id`, datas e autoria herdados da base).")
    for title, _, names in AREAS:
        L.append("")
        L.append(f"<details><summary><b>{title}</b></summary>")
        L.append("")
        for n in names:
            e = concrete.get(n)
            if not e:
                continue
            enum_set = {f for f, _ in e["enums"]}
            rel_set = {f for f, _, _ in e["rels"]}
            parts = []
            for f, t in e["fields"]:
                mark = " ⟶" if f in rel_set else " ◆" if f in enum_set else ""
                parts.append(f"`{f}`: {t}{mark}")
            L.append(f"- **{n}** — " + "; ".join(parts))
        L.append("")
        L.append("</details>")
    L.append("")
    L.append("Legenda: ⟶ relação com outra entidade · ◆ enum.")
    L.append("")
    L.append("## Entidades embutidas em JSON")
    L.append("")
    L.append("Estruturas que vivem dentro de colunas JSON (validadas no backend, renderizadas no frontend):")
    L.append("")
    L.append(md_table([
        ["SealDesign", "`seals.background_config_json.design`", "SealDesigns.normalize",
         "kind (CIRCULAR · FOLHA · FASHIONAI), mode (GENERATED · UPLOAD · TEMPLATE), template, label/caption, texts "
         "(series, subtitle, style, year, emblem), core (mode ELEMENT · IMAGE · TEXT, imageUrl, text, textColor, zoom), "
         "border/field/center/element, uploadUrl"],
        ["SealPolicy", "`seals.background_config_json.policy`", "SealPolicies.normalize",
         "match (ALL · ANY), rules[≤ 6] (quantifier AT_LEAST · ALL · NONE, count, color, brand, category, subcategory), "
         "occasions[≤ 4], styles[≤ 4]"],
        ["Configuração de estúdio do esquema", "`schemes.studio_config_json`", "BackgroundStudioService",
         "aura {variantId, format IMAGEM_UNICA · MOSAICO}, materialId, gradient/gradientPresetId, seasonalPresetId, "
         "aiArt/uploadUrl, container, layoutAnatomy, skin — ver docs/anatomia/anatomia-de-esquemas.md"],
        ["Snapshot da peça no esquema", "`scheme_items.snapshot_json`", "SchemeService",
         "cópia dos campos da peça no momento do look (remix e histórico não quebram se a peça mudar)"],
    ], ["Estrutura", "Onde fica", "Validação", "Campos"]))
    L.append("")
    L.append("## Taxonomia de peça e esquema (listas controladas)")
    L.append("")
    L.append(md_table([[k, len(v), ", ".join(v)] for k, v in subs.items()], ["Categoria", "Nº", "Subcategorias"]))
    L.append("")
    fam = {}
    for f, cid, hx in colors:
        fam.setdefault(f, []).append(f"{cid} `{hx}`")
    L.append(md_table([[f, len(v), ", ".join(v)] for f, v in fam.items()], ["Família de cor", "Nº", "Cores (id `hex`)"]))
    L.append("")
    L.append(md_table([[k.replace("_", " ").lower(), len(v), ", ".join(v)] for k, v in lists.items()], ["Lista", "Nº", "Valores"]))
    L.append("")
    L.append(md_table([[k, ", ".join(v)] for k, v in wear.items()], ["Wearstyle", "Ocasiões agrupadas"]))
    L.append("")
    L.append("## Enums de domínio")
    L.append("")
    L.append(md_table([[k, len(v), ", ".join(v)] for k, v in enums.items()], ["Enum", "Nº", "Valores"]))
    L.append("")
    if unknown:
        L.append(f"> Atenção: nomes no agrupamento sem entidade no código: {', '.join(unknown)}")
    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, "taxonomia-de-entidades.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")

    # mapa PlantUML: pacotes por área, entidades e relações JPA
    P = ["@startuml Taxonomia_Entidades", "!pragma layout smetana",
         f"title Taxonomia de entidades do FashionAI — {len(concrete)} entidades em {len(AREAS)} áreas (relações JPA)",
         "skinparam backgroundColor #FFFFFF", "skinparam shadowing false", "hide empty members", "hide circle",
         "skinparam class {", "  BackgroundColor #F8F4FF", "  BorderColor #B695F5", "  FontColor #2D2438", "  ArrowColor #8792A2", "}",
         "skinparam package {", "  BorderColor #CBC6BE", "  FontColor #2D2438", "}", "left to right direction"]
    for title, _, names in AREAS:
        P.append(f'package "{title}" {{')
        for n in names:
            if n in concrete:
                P.append(f'  class {n} <<{concrete[n]["table"] or "—"}>>')
        P.append("}")
    seen = set()
    to_user = sum(1 for e in concrete.values() for _, _, t in e["rels"] if t == "User")
    P.append(f'note as N\n  Relações com **User** (dono/autor) omitidas: {to_user}.\n  Setas: ManyToOne/OneToOne (→), coleções (o–).\nend note')
    for n, e in concrete.items():
        for f, kind, t in e["rels"]:
            if t == "User":
                continue
            if t in concrete and (n, t, f) not in seen:
                seen.add((n, t, f))
                arrow = "-->" if kind in ("ManyToOne", "OneToOne") else "o--"
                P.append(f"{n} {arrow} {t}")
    P.append("@enduml")
    open(os.path.join(OUT, "taxonomia-de-entidades.puml"), "w", encoding="utf-8").write("\n".join(P) + "\n")
    print(f"{len(concrete)} entidades, {n_rel} relações, {len(enums)} enums; sem área: {missing}; desconhecidas: {unknown}")


if __name__ == "__main__":
    main()
