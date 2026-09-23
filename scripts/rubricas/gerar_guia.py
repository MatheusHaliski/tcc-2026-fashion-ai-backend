"""Gera docs/rubricas/GUIA_RUBRICAS.md e docs/rubricas/GUIA_RUBRICAS.xlsx a partir de uma única fonte."""
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "rubricas"

# status: OK = evidência já existe | PARCIAL = existe base, falta concluir | PENDENTE = ainda não iniciado
# dono: CODIGO = entregue no repositório (Claude/bloco) | EQUIPE = só a equipe pode produzir
OBRIGATORIOS = [
    dict(
        criterio="≥ 80% do escopo acordado com os professores",
        status="PARCIAL",
        evidencia="Serviços de aplicação para RF1–RF36 e RNF1–RNF12 em fai-application/.../service; "
                  "entidades e migrações V1–V6; docs/novo-projeto/tabela-*.md.",
        falta_codigo="Bloco 8 (API REST de todos os serviços) e bloco 11 (frontend com todas as telas).",
        falta_equipe="Levar aos professores a lista de RFs do escopo acordado e marcar, RF a RF, onde está a tela e o endpoint "
                     "(a planilha de IA/entidades do bloco 12 serve de checklist).",
    ),
    dict(
        criterio="Processo ágil documentado no TDE (sprints)",
        status="PENDENTE",
        evidencia="Board do Trello com HUs/RFs; HUs e critérios de aceite em markdowns/HU*.md e "
                  "markdowns/02-rf-reestruturados-e-criterios-aceite.md.",
        falta_codigo="—",
        falta_equipe="Para cada sprint: objetivo, cards comprometidos x entregues, print do board no início e no fim, "
                     "review/retrospectiva curta, link dos commits/PRs da sprint. Preencher o modelo do TDE.",
    ),
    dict(
        criterio="Frontend bem acabado, mensagens informativas e resiliente a erros",
        status="PENDENTE",
        evidencia="Backend já devolve erros de negócio com código e mensagem (ApiException, ex.: 409 PECA_INDISPONIVEL, "
                  "429 cota de IA, 422 validação); tipografia oficial (lib/design/typography.css) e 77 ícones FAI.",
        falta_codigo="Bloco 11: toasts de sucesso/erro, estados vazios, skeletons de carregamento, error boundary por página, "
                     "retry em falha de rede, mensagens de fallback de IA.",
        falta_equipe="Na demo, provocar um erro de propósito (ex.: sem internet, campo inválido) e mostrar a mensagem.",
    ),
    dict(
        criterio="Backend RESTful comunicando via JSON",
        status="PARCIAL",
        evidencia="Casos de uso prontos e compilando; DTOs/records em JSON; módulo fai-web.",
        falta_codigo="Bloco 8: controllers REST (substantivos no plural, verbos HTTP, 201/204/404/409/422), "
                     "GlobalExceptionHandler com application/problem+json, OpenAPI.",
        falta_equipe="Mostrar o Swagger UI e uma chamada no DevTools (Network) com o JSON.",
    ),
    dict(
        criterio="Dados relevantes persistidos em banco",
        status="OK",
        evidencia="MySQL via Flyway V1–V6 (JPA, UUID CHAR(36), campos sensíveis cifrados com AES-GCM); "
                  "auditoria em audit_log; log de inferência de IA; Cassandra (timeline) e Redis (contadores/cache).",
        falta_codigo="Bloco 10: subir a aplicação contra o MySQL e validar ponta a ponta.",
        falta_equipe="Levar o diagrama ER (docs/novo-projeto/tabela-entidades-rf-bancos.md + markdowns/uml-casos-er-classes.md).",
    ),
    dict(
        criterio="≥ 2 perfis de acesso validados no frontend E no backend",
        status="PARCIAL",
        evidencia="Perfis PESSOAL, MARCA e CELEBRIDADE (ProfileType) + papel USER/ADMIN (User.role); "
                  "guard.requireAdmin em AdminService/ChallengeService/BackgroundStudioService; "
                  "dashboard de emissor só para MARCA/CELEBRIDADE; ResourceOwnerAuthorizationTest.",
        falta_codigo="Bloco 8: @PreAuthorize/filtros por papel e 403 JSON. Bloco 11: guarda de rota e menus ocultos por perfil.",
        falta_equipe="Na demo: logar como PESSOAL e tentar abrir /admin (bloqueado na tela e 403 na API); logar como ADMIN e abrir.",
    ),
    dict(
        criterio="Dashboard gerencial com informações, filtros e gráficos",
        status="PARCIAL",
        evidencia="DashboardService (admin e emissor), filtros período/país/tipo de perfil, alertas, layout de widgets salvo "
                  "por usuário; V6 com procedures sp_admin_kpis/sp_timeseries, views vw_country_insights/vw_brand_usage e índices.",
        falta_codigo="Bloco 8 (endpoint /api/admin/dashboard) e bloco 11 (gráficos de linha/barra/pizza/mapa).",
        falta_equipe="Preparar 2–3 perguntas gerenciais que o dashboard responde (ex.: 'em qual país a IA custa mais por usuário?').",
    ),
    dict(
        criterio="Git organizado (branches, commits) com participação de TODOS os alunos",
        status="RISCO",
        evidencia="Branches por feature e PRs (#8, #12); commits no padrão Conventional Commits (feat/fix/chore com RF no escopo). "
                  "ATENÇÃO: `git shortlog -sn --all` neste repositório mostra commits só de Matheus + bots; nenhum do Bryan.",
        falta_codigo="—",
        falta_equipe="Bryan precisa commitar com a própria conta (docs das sprints, testes, telas, revisões de PR). "
                     "Todo PR revisado/aprovado pelo outro integrante. Apresentar também o histórico do repositório "
                     "SAI-TCC-2026. Confirmar com os professores a política sobre commits assistidos por IA (co-autoria aparece no log).",
    ),
]

# prioridade: A = recomendado (maior retorno pelo esforço) | B = reserva | C = não recomendado
OPCIONAIS = [
    dict(criterio="Engenharia de requisitos (UML/BDD/jornadas) em ≥80% das sprints", area="Eng. software", valor=1.0,
         prioridade="A", meta="100%", status="PARCIAL",
         evidencia="HU01–HU20 com critérios de aceite, casos de uso e ER (markdowns/uml-*.md), diagramas de atividade "
                   "(markdowns/05-diagramas-atividade.md, RF33_Vista-me_Atividades.puml), diagramas de sequência dos pipelines RF4/RF18.",
         acao="Marcar em cada sprint do TDE qual HU/diagrama modelou os cards daquela sprint."),
    dict(criterio="Processo de qualidade (plano de testes, revisão no git, reprovações de QA)", area="Eng. software", valor=1.0,
         prioridade="B", meta="60–100%", status="PENDENTE",
         evidencia="Critérios de aceite por RF (CA01..) já servem de casos de teste.",
         acao="Plano de testes por sprint a partir dos CAs; coluna 'QA' no Trello com cards reprovados; revisão obrigatória em PR."),
    dict(criterio="Prototipação no Figma + checklist de usabilidade + teste filmado", area="Eng. software", valor=1.5,
         prioridade="B", meta="60–100%", status="PARCIAL",
         evidencia="Anatomias dos cards (docs/anatomias), pranchas de telas (markdowns/04-telas-artefatos-e-pranchas.md).",
         acao="Exportar telas para o Figma; aplicar checklist das 10 heurísticas de Nielsen; filmar 1 usuário usando o app (5 min)."),
    dict(criterio="Cobertura de testes do backend (JaCoCo)", area="Backend", valor=1.0,
         prioridade="B", meta="50% (0,6)", status="PENDENTE",
         evidencia="Serviços puros e testáveis (Hype, Inventory Score, RoomAddress, faixas de clima, cursor de busca).",
         acao="Bloco 10: JaCoCo no pom + testes unitários das regras de cálculo; relatório HTML como evidência."),
    dict(criterio="Documentação: OpenAPI com sumário/descrição, payloads reais, README completo", area="Backend", valor=1.0,
         prioridade="A", meta="100%", status="PENDENTE",
         evidencia="—",
         acao="Bloco 8: springdoc-openapi com @Operation/@ExampleObject por endpoint; README.md (o que é, como subir, como rodar)."),
    dict(criterio="Migrações profissionais (evidência em ≥50% das sprints)", area="Backend", valor=1.0,
         prioridade="A", meta="30% agora → 100%", status="PARCIAL",
         evidencia="Flyway V1–V6 (baseline, RFs completos, seed de marcas, critérios, Meu Guarda-Roupa, dashboard). "
                   "Hoje todas as migrações têm a mesma data de commit, o que só garante a faixa de 30%.",
         acao="A partir desta sprint, toda mudança de banco entra como V7, V8…, commitada na sprint em que foi feita; "
              "tabela 'migração × sprint' no TDE."),
    dict(criterio="SQL avançado: grouped queries, índices de regra de negócio, procedures", area="Backend", valor=1.5,
         prioridade="A", meta="100%", status="OK",
         evidencia="a) GROUP BY no MysqlAnalyticsAdapter (uso de IA, marcas, países, faixas de Hype/Inventory, funil de selos); "
                   "b) índices UNIQUE que impõem regras (username/e-mail únicos, seguir 1×, 1 Look do Dia por dia, 1 reação por alvo, 1 voto por entrada de desafio, ledger idempotente de FAI Points) "
                   "+ índices de V6; c) procedures sp_admin_kpis, sp_timeseries, sp_purge_notifications e views.",
         acao="Mostrar o EXPLAIN de uma consulta do dashboard usando o índice."),
    dict(criterio="NoSQL avançado (JSON Schema, índices/TTL, aggregation/sharding)", area="Backend", valor=1.5,
         prioridade="C", meta="30–60%", status="PARCIAL",
         evidencia="Cassandra (timeline particionada por usuário) e Redis com TTL (cache, rate limit).",
         acao="Só vale se sobrar tempo: TTL explícito nas tabelas do Cassandra + validação de schema do payload."),
    dict(criterio="Microsserviços", area="Backend", valor=1.5, prioridade="C", meta="—", status="NÃO SE APLICA",
         evidencia="Arquitetura é monólito modular hexagonal (decisão consciente).", acao="Não perseguir."),
    dict(criterio="Service Discovery + API Gateway", area="Backend", valor=1.0, prioridade="C", meta="—", status="NÃO SE APLICA",
         evidencia="—", acao="Não perseguir."),
    dict(criterio="Serviços cloud relevantes (≥4)", area="Backend", valor=1.5,
         prioridade="A", meta="100%", status="PARCIAL",
         evidencia="Hospedagem Vercel; storage S3/Vercel Blob (fotos e cards); IA generativa (Claude, Gemini, FASHN, Meshy); "
                   "e-mail transacional Resend; login federado Google; MySQL gerenciado.",
         acao="Bloco 9 (adaptadores) + deploy; no TDE, justificar cada serviço pelo problema de negócio."),
    dict(criterio="Padrões de projeto e arquitetura limpa (backend)", area="Backend", valor=1.0,
         prioridade="A", meta="100%", status="OK",
         evidencia="Hexagonal em módulos Maven (domain/application/infrastructure/web/bootstrap), ports & adapters, "
                   "Strategy + Chain of Responsibility no AiEngine (provedor principal → fallback → local), Observer (DomainEvents), "
                   "Repository, Circuit Breaker/Retry (resilience4j), Facade (DashboardService).",
         acao="Escrever docs/arquitetura/PADROES.md com um trecho de código por padrão e o motivo."),
    dict(criterio="Cobertura de testes do frontend", area="Frontend", valor=1.0, prioridade="C", meta="20% (0,3)", status="PENDENTE",
         evidencia="—", acao="Opcional: Vitest nos componentes utilitários."),
    dict(criterio="Responsivo e customizável (temas, mobile, tela customizável salva)", area="Frontend", valor=1.5,
         prioridade="A", meta="100%", status="PARCIAL",
         evidencia="Layout de widgets do dashboard salvo por usuário (user_preferences.dashboard_layout_json); "
                   "Background Studio/skins de cards; tokens de tipografia.",
         acao="Bloco 11: temas claro/escuro/alto contraste, breakpoints mobile, arrastar/ocultar widgets com salvamento."),
    dict(criterio="Internacionalização (textos, formatos, dados e moeda)", area="Frontend", valor=1.5,
         prioridade="B", meta="60–100%", status="PENDENTE",
         evidencia="Locale do usuário já existe nas preferências.",
         acao="Bloco 11: PT-BR/EN/ES com arquivos de mensagens; Intl.DateTimeFormat/NumberFormat; preços com moeda da loja."),
    dict(criterio="Padrões de projeto e arquitetura limpa (frontend)", area="Frontend", valor=1.0,
         prioridade="B", meta="100%", status="PENDENTE",
         evidencia="—", acao="Bloco 11: camadas api/ (client), hooks/, components/, features/; Adapter para a API; Provider para tema/i18n."),
    dict(criterio="Acessibilidade (público, estratégias, teste com o público)", area="Frontend", valor=1.5,
         prioridade="B", meta="60–100%", status="PENDENTE",
         evidencia="—",
         acao="Público sugerido: pessoas com daltonismo (moda depende de cor). Estratégias: nome da cor em texto em toda peça, "
              "alto contraste, foco visível/teclado, alt text gerado. Teste com 3 pessoas e registrar."),
    dict(criterio="CI/CD por ambiente (dev, test, prod)", area="DevOps", valor=1.5,
         prioridade="B", meta="60–100%", status="PARCIAL",
         evidencia="Frontend já com deploys automáticos Preview/Production na Vercel e variáveis por ambiente.",
         acao="GitHub Actions: build + testes + JaCoCo em PR (test); deploy do backend em dev (branch) e prod (main)."),
    dict(criterio="Infraestrutura como código", area="DevOps", valor=1.0, prioridade="C", meta="30–60%", status="PENDENTE",
         evidencia="—", acao="docker-compose.dev.yml (bloco 9) conta como parcial; Terraform só se sobrar tempo."),
    dict(criterio="Monitoramento e observabilidade", area="DevOps", valor=1.5,
         prioridade="B", meta="60%", status="PARCIAL",
         evidencia="Actuator (health/metrics), audit_log, ai_inference_log com custo/latência, alertas no dashboard.",
         acao="Expor /actuator/prometheus e um painel Grafana Cloud com 1 alerta (erro 5xx ou custo de IA)."),
    dict(criterio="Técnica/tecnologia livre (acordada até a 3ª sprint)", area="Livre", valor=1.5,
         prioridade="B", meta="100% se acordado", status="PARCIAL",
         evidencia="Pipelines de IA generativa: flat lay (RF4), provador virtual 2D (RF18), modelo 3D (Meshy), mosaico RF11.",
         acao="Confirmar com os professores se essa tecnologia foi registrada até a 3ª sprint."),
]

STATUS_EMOJI = {"OK": "✅", "PARCIAL": "🟡", "PENDENTE": "⬜", "RISCO": "🔴", "NÃO SE APLICA": "—"}


def pontos_previstos(item):
    meta = item["meta"]
    if meta.startswith("100%"):
        return item["valor"]
    if "→ 100%" in meta:
        return item["valor"]
    if meta.startswith("60"):
        return round(item["valor"] * 0.6, 2)
    if meta.startswith("50"):
        return round(item["valor"] * 0.6, 2)
    if meta.startswith("30") or meta.startswith("20"):
        return round(item["valor"] * 0.3, 2)
    return 0.0


def markdown():
    linhas = [
        "# Guia das rubricas do TCC — Fashion AI",
        "",
        "Gerado por `scripts/rubricas/gerar_guia.py` a partir de `docs/rubricas/QUARTA_TCC_Rubricas.csv`. "
        "A planilha equivalente está em `docs/rubricas/GUIA_RUBRICAS.xlsx`.",
        "",
        "Legenda: ✅ evidência pronta · 🟡 parcial · ⬜ pendente · 🔴 risco de reprovação.",
        "",
        "## 1. Critérios obrigatórios (2,5 pontos — todos ou nenhum)",
        "",
        "Se qualquer um faltar, o trabalho não pode ser entregue.",
        "",
        "| # | Critério | Status | Evidência no repositório | Falta no código | Falta a equipe fazer |",
        "|---|---|---|---|---|---|",
    ]
    for i, o in enumerate(OBRIGATORIOS, 1):
        linhas.append(f"| {i} | {o['criterio']} | {STATUS_EMOJI[o['status']]} {o['status']} | {o['evidencia']} | "
                      f"{o['falta_codigo']} | {o['falta_equipe']} |")

    recomendados = [o for o in OPCIONAIS if o["prioridade"] == "A"]
    reserva = [o for o in OPCIONAIS if o["prioridade"] == "B"]
    total_a = sum(pontos_previstos(o) for o in recomendados)
    total_b = sum(pontos_previstos(o) for o in reserva)
    linhas += [
        "",
        "## 2. Critérios opcionais",
        "",
        f"**Recomendados (prioridade A):** {len(recomendados)} critérios, ~{total_a:.1f} pontos previstos. "
        "Aproveitam o que já existe no backend e no plano do frontend.",
        f"**Reserva (prioridade B):** {len(reserva)} critérios, ~{total_b:.1f} pontos previstos. Servem de margem caso algum A seja "
        "avaliado abaixo do esperado.",
        "**Não recomendados (C):** exigiriam mudar a arquitetura ou têm pouco retorno.",
        "",
        "Confirmem com os professores o teto da nota e quais critérios subjetivos (prototipação, acessibilidade, livre) "
        "serão anotados na planilha da equipe.",
        "",
        "| Prior. | Critério | Área | Valor | Meta | Pontos previstos | Status | Evidência | Ação |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for o in sorted(OPCIONAIS, key=lambda x: (x["prioridade"], -x["valor"])):
        linhas.append(f"| {o['prioridade']} | {o['criterio']} | {o['area']} | {o['valor']:.1f} | {o['meta']} | "
                      f"{pontos_previstos(o):.2f} | {STATUS_EMOJI[o['status']]} {o['status']} | {o['evidencia']} | {o['acao']} |")

    linhas += [
        "",
        "## 3. Roteiro da equipe (em ordem)",
        "",
        "1. **Hoje:** Bryan começa a commitar com a própria conta (obrigatório nº 8). Toda PR passa a ter revisão do outro integrante.",
        "2. **Sprint atual:** preencher o TDE de todas as sprints já feitas (obrigatório nº 2) usando o histórico do Trello.",
        "3. **Após os blocos 8–11:** gravar a demo dos perfis (PESSOAL × ADMIN) e do dashboard com filtros (obrigatórios nº 6 e 7).",
        "4. **Toda sprint:** nova migração Flyway versionada na própria sprint (opcional de migrações).",
        "5. **Antes da banca:** README, Swagger com exemplos, docs/arquitetura/PADROES.md, EXPLAIN de uma consulta indexada.",
        "6. **Reserva:** teste de acessibilidade com 3 pessoas daltônicas, pipeline do GitHub Actions, painel Grafana.",
        "",
    ]
    return "\n".join(linhas)


def planilha(caminho):
    wb = Workbook()
    cab = Font(bold=True, color="FFFFFF")
    fundo = PatternFill("solid", fgColor="1F1F1F")
    cores = {"OK": "C6EFCE", "PARCIAL": "FFEB9C", "PENDENTE": "EDEDED", "RISCO": "FFC7CE", "NÃO SE APLICA": "FFFFFF"}

    def formatar(ws, larguras):
        for i, w in enumerate(larguras, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
        for c in ws[1]:
            c.font, c.fill = cab, fundo
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.freeze_panes = "A2"

    ws = wb.active
    ws.title = "Obrigatórios"
    ws.append(["#", "Critério", "Status", "Evidência no repositório", "Falta no código", "Falta a equipe fazer", "Entregue?"])
    for i, o in enumerate(OBRIGATORIOS, 1):
        ws.append([i, o["criterio"], o["status"], o["evidencia"], o["falta_codigo"], o["falta_equipe"], "Não"])
        ws.cell(row=i + 1, column=3).fill = PatternFill("solid", fgColor=cores[o["status"]])
    formatar(ws, [4, 38, 12, 60, 45, 55, 11])

    ws = wb.create_sheet("Opcionais")
    ws.append(["Prioridade", "Critério", "Área", "Valor", "Meta", "Pontos previstos", "Status", "Evidência", "Ação"])
    ordenados = sorted(OPCIONAIS, key=lambda x: (x["prioridade"], -x["valor"]))
    for r, o in enumerate(ordenados, 2):
        ws.append([o["prioridade"], o["criterio"], o["area"], o["valor"], o["meta"], pontos_previstos(o),
                   o["status"], o["evidencia"], o["acao"]])
        ws.cell(row=r, column=7).fill = PatternFill("solid", fgColor=cores[o["status"]])
    fim = len(ordenados) + 1
    ws.append([])
    ws.append(["", "Total previsto — prioridade A", "", "", "", f'=SUMIF(A2:A{fim},"A",F2:F{fim})'])
    ws.append(["", "Total previsto — prioridade B", "", "", "", f'=SUMIF(A2:A{fim},"B",F2:F{fim})'])
    ws.append(["", "Obrigatórios (se todos entregues)", "", "", "", 2.5])
    ws.append(["", "Nota prevista (A + obrigatórios)", "", "", "", f"=F{fim + 2}+F{fim + 4}"])
    for row in ws.iter_rows(min_row=fim + 2, max_row=fim + 5):
        row[1].font = Font(bold=True)
    formatar(ws, [10, 45, 14, 7, 16, 10, 14, 60, 55])
    wb.save(caminho)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "GUIA_RUBRICAS.md").write_text(markdown(), encoding="utf-8")
    planilha(OUT / "GUIA_RUBRICAS.xlsx")
    print("ok")
