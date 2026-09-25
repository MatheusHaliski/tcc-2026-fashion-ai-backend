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
        status="OK",
        evidencia="39 RFs do Trello (RF1–RF39) com endpoint e tela; 368 endpoints REST no inventário; teste ponta a ponta "
                  "com 452 passos cobrindo todos os endpoints (docs/testes/TABELA_ENDPOINTS_POR_RF.md/.xlsx: RF, CA, endpoint, "
                  "status, banco em que salvou, tela que exibe). Planilhas da etapa 12 (docs/planilhas/) servem de checklist RF a RF.",
        falta_codigo="—",
        falta_equipe="Levar aos professores a lista de RFs do escopo acordado e a tabela de endpoints por RF; confirmar se RF33–RF39 "
                     "(Passarela 3D, Eras, Coleções, Foto com manequim, FLAIR, Cupons, Criar guarda-roupa 3D) entram no escopo.",
    ),
    dict(
        criterio="Processo ágil documentado no TDE (sprints)",
        status="PENDENTE",
        evidencia="Board do Trello com RF1–RF39 (critérios de aceite nos cards); HUs e CAs em markdowns/; histórico de commits por RF.",
        falta_codigo="—",
        falta_equipe="Para cada sprint: objetivo, cards comprometidos x entregues, print do board no início e no fim, "
                     "review/retrospectiva curta, link dos commits/PRs da sprint. Preencher o modelo do TDE.",
    ),
    dict(
        criterio="Frontend bem acabado, mensagens informativas e resiliente a erros",
        status="OK",
        evidencia="Next.js com toasts de sucesso/erro (useToast), EmptyState, ErrorState com 'tentar de novo', Skeleton de "
                  "carregamento, mensagens de negócio vindas da API (409/422/429), aviso de fallback de IA (motor local) e status "
                  "por fonte no buscador de marcas; capturas em docs/novos-rf/telas-*/.",
        falta_codigo="—",
        falta_equipe="Na demo, provocar um erro de propósito (campo inválido, peça indisponível no look) e mostrar a mensagem.",
    ),
    dict(
        criterio="Backend RESTful comunicando via JSON",
        status="OK",
        evidencia="368 endpoints REST (fai-web/.../controller) com verbos e códigos HTTP (200/201/202/204/400/403/404/409/422/429), "
                  "GlobalExceptionHandler com JSON de erro (code, message, details, correlationId), springdoc-openapi + Swagger UI.",
        falta_codigo="—",
        falta_equipe="Mostrar o Swagger UI e uma chamada no DevTools (Network) com o JSON.",
    ),
    dict(
        criterio="Dados relevantes persistidos em banco",
        status="OK",
        evidencia="MySQL com Flyway V1–V21 (79 entidades JPA; campos sensíveis cifrados com AES-GCM); audit_log; ai_inference_log; "
                  "prova por endpoint do que foi gravado (general_log do MySQL) em docs/testes/; projeções Redis/Cassandra/OpenSearch e "
                  "mídia em S3 atrás de feature flags (docs/planilhas/Entidades_BD_por_RF_RNF.xlsx).",
        falta_codigo="—",
        falta_equipe="Levar o diagrama de classes v4 (docs/diagramas/fashionai-classes-v4.puml) e a planilha de entidades por RF.",
    ),
    dict(
        criterio="≥ 2 perfis de acesso validados no frontend E no backend",
        status="OK",
        evidencia="Perfis PESSOAL, MARCA e CELEBRIDADE + papel ADMIN; guard.requireAdmin/requireOwner no backend (403 ACESSO_NEGADO testado "
                  "no E2E, ex.: usuário comum no criador de guarda-roupa RF39 e no admin); menus e rotas por perfil no frontend "
                  "(aba Criar guarda-roupa 3D só para MARCA/CELEBRIDADE; /admin só para ADMIN); ResourceOwnerAuthorizationTest.",
        falta_codigo="—",
        falta_equipe="Na demo: logar como PESSOAL e tentar abrir /admin (bloqueado na tela e 403 na API); logar como ADMIN e abrir.",
    ),
    dict(
        criterio="Dashboard gerencial com informações, filtros e gráficos",
        status="OK",
        evidencia="/admin/dashboard e dashboard do emissor (marca/celebridade) com filtros período/país/tipo de perfil, gráficos e "
                  "widgets salvos por usuário; procedures sp_admin_kpis/sp_timeseries e views (V6); endpoints testados no E2E.",
        falta_codigo="—",
        falta_equipe="Preparar 2–3 perguntas gerenciais que o dashboard responde (ex.: 'em qual país a IA custa mais por usuário?').",
    ),
    dict(
        criterio="Git organizado (branches, commits) com participação de TODOS os alunos",
        status="RISCO",
        evidencia="Branch por frente e commits no padrão Conventional Commits com o RF no escopo. ATENÇÃO: `git shortlog -sn --all` "
                  "mostrava em 24/09 Matheus (82), Claude (42) e copilot (10); nenhum commit do Bryan.",
        falta_codigo="—",
        falta_equipe="Bryan precisa commitar com a própria conta (docs das sprints, testes, telas, revisões de PR). "
                     "Todo PR revisado/aprovado pelo outro integrante. Confirmar com os professores a política sobre commits "
                     "assistidos por IA (a co-autoria aparece no log).",
    ),
]

# prioridade: A = recomendado (maior retorno pelo esforço) | B = reserva | C = não recomendado
OPCIONAIS = [
    dict(criterio="Engenharia de requisitos (UML/BDD/jornadas) em ≥80% das sprints", area="Eng. software", valor=1.0,
         prioridade="A", meta="100%", status="OK",
         evidencia="Pacote de diagramas 13 (atividades, sequência, estados, classes e componentes de RF1–RF39; RF25–RF39 gerados do "
                   "código; RF4 v3 e RF5 v4 com o buscador de marcas); CAs por RF nos cards do Trello.",
         acao="Marcar em cada sprint do TDE qual diagrama modelou os cards daquela sprint."),
    dict(criterio="Processo de qualidade (plano de testes, revisão no git, reprovações de QA)", area="Eng. software", valor=1.0,
         prioridade="B", meta="60–100%", status="PARCIAL",
         evidencia="Teste ponta a ponta por CA (452 passos, 368 endpoints) com a tabela RF × CA × endpoint × banco × tela e até 5 "
                   "fotos de evidência por endpoint (docs/testes/); bugs achados e corrigidos registrados nos commits 'fix(...)'.",
         acao="Plano de testes por sprint a partir dos CAs; coluna 'QA' no Trello com cards reprovados; revisão obrigatória em PR."),
    dict(criterio="Prototipação no Figma + checklist de usabilidade + teste filmado", area="Eng. software", valor=1.5,
         prioridade="B", meta="60–100%", status="PARCIAL",
         evidencia="Anatomias dos cards (v17), anatomia do DNA (v4), telas capturadas por RF em docs/.",
         acao="Exportar telas para o Figma; aplicar checklist das 10 heurísticas de Nielsen; filmar 1 usuário usando o app (5 min)."),
    dict(criterio="Cobertura de testes do backend (JaCoCo)", area="Backend", valor=1.0,
         prioridade="B", meta="50% (0,6)", status="OK",
         evidencia="JaCoCo medido com o agente no backend durante o teste ponta a ponta (452 passos, 368 endpoints): 74,4% das linhas "
                   "e 47,9% dos ramos do backend; 75,2% das linhas do fai-application e 90,5% do fai-web (docs/testes/COBERTURA_E2E.md, "
                   "relatório HTML no pacote de evidências). Só com testes unitários a cobertura é baixa (3% no fai-application).",
         acao="Mostrar o relatório HTML e explicar como foi medido (agente JaCoCo + scripts/e2e/jacoco_report.jsh); "
              "se os professores exigirem cobertura só por testes unitários, escrever testes de serviço com H2/Testcontainers."),
    dict(criterio="Documentação: OpenAPI com sumário/descrição, payloads reais, README completo", area="Backend", valor=1.0,
         prioridade="A", meta="100%", status="OK",
         evidencia="springdoc-openapi com @Operation (RF/CA no sumário) em todos os endpoints; README; payloads reais de cada "
                   "endpoint nos cartões de evidência do teste ponta a ponta (docs/testes/).",
         acao="Mostrar o Swagger UI e um cartão de evidência (requisição → resposta → SQL)."),
    dict(criterio="Migrações profissionais (evidência em ≥50% das sprints)", area="Backend", valor=1.0,
         prioridade="A", meta="30% agora → 100%", status="PARCIAL",
         evidencia="Flyway V1–V21, uma migração por mudança (ex.: V20 loja/criador do guarda-roupa, V21 marca da peça pela busca web). "
                   "As migrações foram commitadas em 2 dias (23 e 24/09), o que só garante a faixa de 30%.",
         acao="A partir desta sprint, toda mudança de banco entra como V22, V23…, commitada na sprint em que foi feita; "
              "tabela 'migração × sprint' no TDE."),
    dict(criterio="SQL avançado: grouped queries, índices de regra de negócio, procedures", area="Backend", valor=1.5,
         prioridade="A", meta="100%", status="OK",
         evidencia="a) GROUP BY no MysqlAnalyticsAdapter (uso de IA, marcas, países, faixas de Hype/Inventory, funil de selos); "
                   "b) índices UNIQUE que impõem regras (username/e-mail únicos, seguir 1×, 1 Look do Dia por dia, 1 reação por alvo, "
                   "1 voto por entrada de desafio, ledger idempotente de FAI Points); c) procedures sp_admin_kpis, sp_timeseries, "
                   "sp_purge_notifications e views; EXPLAIN em docs/banco/EXPLAIN_DASHBOARD.md.",
         acao="Mostrar o EXPLAIN de uma consulta do dashboard usando o índice."),
    dict(criterio="NoSQL avançado (JSON Schema, índices/TTL, aggregation/sharding)", area="Backend", valor=1.5,
         prioridade="C", meta="30–60%", status="PARCIAL",
         evidencia="Cassandra (timeline_by_user e notifications_by_user com TTL de 90/30 dias) e Redis (contadores, rate limit) "
                   "atrás de feature flags; desligados no ambiente de teste.",
         acao="Só vale se sobrar tempo: subir Cassandra/Redis no docker-compose e mostrar a timeline particionada."),
    dict(criterio="Microsserviços", area="Backend", valor=1.5, prioridade="C", meta="—", status="NÃO SE APLICA",
         evidencia="Arquitetura é monólito modular hexagonal (decisão consciente).", acao="Não perseguir."),
    dict(criterio="Service Discovery + API Gateway", area="Backend", valor=1.0, prioridade="C", meta="—", status="NÃO SE APLICA",
         evidencia="—", acao="Não perseguir."),
    dict(criterio="Serviços cloud relevantes (≥4)", area="Backend", valor=1.5,
         prioridade="A", meta="100%", status="PARCIAL",
         evidencia="Adaptadores prontos: S3 (mídia), Claude/Gemini/FASHN/Meshy/Photoroom (IA), Resend (e-mail), Open-Meteo (clima), "
                   "Wikidata/GitHub (buscador de marcas); frontend na Vercel. Neste ambiente só o GitHub é alcançável (rede restrita) "
                   "e não há chaves de IA: tudo roda no fallback local.",
         acao="Deploy com as chaves reais; no TDE, justificar cada serviço pelo problema de negócio e mostrar 1 chamada real de cada."),
    dict(criterio="Padrões de projeto e arquitetura limpa (backend)", area="Backend", valor=1.0,
         prioridade="A", meta="100%", status="OK",
         evidencia="Hexagonal em módulos Maven (domain/application/infrastructure/web/bootstrap), ports & adapters, Strategy + Chain "
                   "of Responsibility no AiEngine (primário → alternativa → local) e no buscador de marcas (Wikidata → Simple Icons → IA), "
                   "Pipeline (LogoFilter, Flat Lay, Estúdio), Observer (eventos AFTER_COMMIT), Repository, Circuit Breaker/Retry, Facade.",
         acao="Escrever docs/arquitetura/PADROES.md com um trecho de código por padrão e o motivo."),
    dict(criterio="Cobertura de testes do frontend", area="Frontend", valor=1.0, prioridade="C", meta="20% (0,3)", status="PENDENTE",
         evidencia="Capturas automatizadas com Playwright (fluxos RF4/RF5/RF13/RF39), mas sem testes unitários de componentes.",
         acao="Opcional: Vitest nos componentes utilitários."),
    dict(criterio="Responsivo e customizável (temas, mobile, tela customizável salva)", area="Frontend", valor=1.5,
         prioridade="A", meta="100%", status="OK",
         evidencia="Temas claro/escuro/alto contraste (data-theme), cor do container e fundo da interface salvos em user_preferences, "
                   "widgets do dashboard salvos por usuário, Background Studio/skins de cards, layout mobile com menu recolhível.",
         acao="Na demo, trocar o tema e mostrar a tela no celular."),
    dict(criterio="Internacionalização (textos, formatos, dados e moeda)", area="Frontend", valor=1.5,
         prioridade="B", meta="60–100%", status="OK",
         evidencia="RF23: catálogos pt-BR/en/es completos no frontend (2 743 chaves, ICU) e no backend (2 000+ chaves, MessageFormat); "
                   "Accept-Language → Content-Language inclusive nos 401/403; textos gravados no banco como marcadores resolvidos no idioma de quem lê; "
                   "datas, números e moeda (BRL/USD/EUR) por Intl; pseudo-idioma de QA; scripts check/scan/qa no prebuild (docs/i18n/RF23_Internacionalizacao.md).",
         acao="Na demo, trocar o idioma no topo e mostrar um erro da API e uma notificação em inglês."),
    dict(criterio="Padrões de projeto e arquitetura limpa (frontend)", area="Frontend", valor=1.0,
         prioridade="B", meta="100%", status="PARCIAL",
         evidencia="Camadas lib/api (client), lib/hooks (useApi), components/ui, components/<área>; Provider de i18n e de tema.",
         acao="Documentar as camadas e o padrão Adapter da API em docs/arquitetura."),
    dict(criterio="Acessibilidade (público, estratégias, teste com o público)", area="Frontend", valor=1.5,
         prioridade="B", meta="60–100%", status="PARCIAL",
         evidencia="Nome da cor em texto em toda peça, tema de alto contraste, combobox do buscador de marcas navegável por teclado "
                   "(role=combobox/listbox), rótulos ARIA nos controles.",
         acao="Teste com 3 pessoas daltônicas e registrar."),
    dict(criterio="CI/CD por ambiente (dev, test, prod)", area="DevOps", valor=1.5,
         prioridade="B", meta="60–100%", status="PARCIAL",
         evidencia="Frontend com deploys automáticos Preview/Production na Vercel. Não há workflow do GitHub Actions no repositório.",
         acao="GitHub Actions: build + testes + JaCoCo em PR (test); deploy do backend em dev (branch) e prod (main)."),
    dict(criterio="Infraestrutura como código", area="DevOps", valor=1.0, prioridade="C", meta="30–60%", status="PARCIAL",
         evidencia="docker-compose.dev.yml com MySQL/Redis/Cassandra/OpenSearch/MinIO.", acao="Terraform só se sobrar tempo."),
    dict(criterio="Monitoramento e observabilidade", area="DevOps", valor=1.5,
         prioridade="B", meta="60%", status="PARCIAL",
         evidencia="Actuator com health/info/metrics/prometheus expostos, audit_log, ai_inference_log com custo/latência, "
                   "correlationId em todo erro, alertas no dashboard.",
         acao="Painel Grafana Cloud lendo /actuator/prometheus com 1 alerta (erro 5xx ou custo de IA)."),
    dict(criterio="Técnica/tecnologia livre (acordada até a 3ª sprint)", area="Livre", valor=1.5,
         prioridade="B", meta="100% se acordado", status="PARCIAL",
         evidencia="Pipelines de imagem e IA: flat lay e estúdio (RF4), filtro de nitidez de logos (RF4), provador 2D (RF18), "
                   "modelo 3D (RF16), quarto 3D e guarda-roupa 3D em WebGL (RF27/RF39), FLAIR (RF37).",
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
        "3. **Demo:** perfis (PESSOAL × MARCA × ADMIN), dashboard com filtros, e a tabela de endpoints por RF com as fotos de evidência (docs/testes/).",
        "4. **Toda sprint:** nova migração Flyway versionada na própria sprint (V22 em diante).",
        "5. **Antes da banca:** docs/arquitetura/PADROES.md, EXPLAIN de uma consulta indexada, deploy com chaves reais de IA e rede liberada.",
        "6. **Reserva:** GitHub Actions com o E2E e o JaCoCo, teste de acessibilidade, painel Grafana.",
        "",
        "## 4. RF25–RF39 (numeração do Trello) no escopo",
        "",
        "| RF | Requisito | Evidência |",
        "|---|---|---|",
        "| RF25 | Selos de marca/celebridade + promoções | docs/diagramas/RF25, E2E RF25 |",
        "| RF26 | Explorador Global | docs/diagramas/RF26, E2E RF26 |",
        "| RF27 | Meu Quarto 3D | docs/meu-quarto, docs/diagramas/RF27, E2E RF27 |",
        "| RF28 | Smart Mirror + Vista-me | docs/diagramas/RF28, E2E RF28 |",
        "| RF29 | FAI Inventory Score, destaques e rankings | docs/meu_guarda_roupa/02-inventory-score-calculo.md, E2E RF29 |",
        "| RF30 | FAI Points, níveis e loja do quarto | docs/diagramas/RF30, E2E RF30 |",
        "| RF31 | Estados do acervo | docs/diagramas/RF31, E2E RF31 |",
        "| RF32 | Desafios | docs/meu_guarda_roupa/03-desafios-e-games.md, E2E RF32 |",
        "| RF33 | Passarela 3D | docs/novos-rf/RF33-RF35.md, E2E RF33 |",
        "| RF34 | Eras da celebridade | docs/novos-rf/RF33-RF35.md, E2E RF34 |",
        "| RF35 | Coleções da marca | docs/novos-rf/RF33-RF35.md, E2E RF35 |",
        "| RF36 | Foto com meu manequim | docs/novos-rf/RF36-RF39.md, E2E RF36 |",
        "| RF37 | FLAIR | docs/novos-rf/RF36-RF39.md, E2E RF37 |",
        "| RF38 | Cupons Fashion AI | docs/novos-rf/RF36-RF39.md, E2E RF38 |",
        "| RF39 | Criar guarda-roupa 3D + loja | docs/novos-rf/RF39_Criar_Guarda_Roupa_3D.md, E2E RF39 |",
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
