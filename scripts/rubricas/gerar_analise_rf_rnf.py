"""Gera a avaliação RF/RNF em Markdown e CSVs versionáveis.

A nota mede maturidade da evidência disponível no repositório, não substitui a
avaliação da banca. Os CSVs substituem a edição do XLSX para que pull requests
permaneçam revisáveis e não carreguem diffs binários.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "rubricas"
REPORT = DOCS / "ANALISE_RF_RNF_E_BRAYAN.md"
RF_CSV = DOCS / "SCORES_RF.csv"
RNF_CSV = DOCS / "SCORES_RNF.csv"


@dataclass(frozen=True)
class Score:
    codigo: str
    requisito: str
    nota: float
    evidencia: str
    melhorar: str
    bryan: str


RF = [
    Score("RF1", "Cadastro de conta e perfis", 8.5, "11 passos/8 endpoints E2E; perfis Pessoal, Marca e Celebridade.", "Consolidar teste de confirmação de e-mail e aprovação institucional.", "Testar cadastro por perfil e anexar evidências ao card HU-RF1."),
    Score("RF2", "Autenticação e sessões", 9.0, "Login, refresh, sessões e auditoria cobertos por 5 endpoints.", "Adicionar testes de abuso, expiração e revogação concorrente.", "Criar testes de segurança de sessão e documentar os resultados."),
    Score("RF3", "Conta, privacidade, LGPD e notificações", 8.0, "22 passos/20 endpoints; consentimentos, exportação e exclusão.", "Executar teste formal de prazo de exclusão e portabilidade completa.", "Fazer checklist LGPD e QA das telas de consentimento."),
    Score("RF4", "Adicionar peça e buscar marca", 9.5, "24 passos/14 endpoints, pipeline de imagem e evidências visuais/banco.", "Medir precisão e latência com conjunto de imagens representativo.", "Montar massa de teste, registrar falsos positivos e abrir correções."),
    Score("RF5", "Criar look", 9.0, "11 passos/6 endpoints e compositor integrado ao acervo.", "Reforçar testes de combinações inválidas e concorrência de edição.", "Executar roteiro exploratório do builder e registrar bugs reproduzíveis."),
    Score("RF6", "Perfil Lookbook", 9.0, "26 passos/24 endpoints, closet e looks salvos.", "Adicionar orçamento de desempenho para coleções grandes.", "Testar paginação, filtros e estados vazios com grande volume."),
    Score("RF7", "Detalhe da peça", 8.5, "9 endpoints com leitura, estados e integração às telas.", "Cobrir autorização e consistência após exclusão/edição.", "Criar testes de dono versus visitante e evidências de 403/404."),
    Score("RF8", "Buscar e explorar feed", 8.5, "Feed funcional com 4 endpoints e filtros.", "Medir relevância, paginação e tempo de resposta.", "Definir casos de busca e medir precisão dos resultados."),
    Score("RF9", "Editar look e peças", 8.5, "Atualização persistida, auditoria e reindexação testadas.", "Cobrir conflito de versões e edição simultânea.", "Implementar/testar optimistic locking ou documentar a decisão."),
    Score("RF10", "Copilot e Look do Dia", 8.5, "13 endpoints e ciclo de feedback do Look do Dia.", "Avaliar qualidade das recomendações com métrica e amostra humana.", "Conduzir avaliação cega e publicar a planilha de resultados."),
    Score("RF11", "Background Studio", 9.0, "12 endpoints, persistência e arte de peças/looks.", "Adicionar regressão visual e limites de upload/renderização.", "Criar suíte de snapshots e checklist visual."),
    Score("RF12", "Minhas Fotos", 8.5, "9 passos/8 endpoints com tela e persistência.", "Cobrir retenção, exclusão e acessibilidade da galeria.", "Testar teclado/leitor de tela e ciclo de exclusão."),
    Score("RF13", "DNA de Estilo", 9.0, "14 endpoints, versões, IA e auditoria.", "Formalizar explicabilidade e estabilidade entre versões.", "Comparar resultados com amostra fixa e registrar divergências."),
    Score("RF14", "Feed de marcas", 8.0, "4 endpoints com perfis, seguidores e selos.", "Ampliar critérios de moderação e estados institucionais.", "Validar perfis pendentes/rejeitados e documentar o fluxo."),
    Score("RF15", "Editor Canvas 2D", 8.0, "3 endpoints e editor integrado.", "Adicionar testes de undo/redo, arquivos grandes e mobile.", "Assumir QA exploratório multiplataforma do editor."),
    Score("RF16", "Geração 3D de peças", 7.5, "Job assíncrono e consulta do resultado implementados.", "Provar provedor real, SLA, retry e qualidade do modelo 3D.", "Documentar falhas reais, tempos e critérios de aceite visual."),
    Score("RF17", "Perfil de outros usuários", 8.5, "11 passos/8 endpoints com privacidade e layouts.", "Expandir matriz de visibilidade e bloqueio.", "Testar todos os perfis e níveis de privacidade."),
    Score("RF18", "Provador virtual 2D", 8.5, "4 endpoints, tela e fallback implementados.", "Validar qualidade com diversidade corporal e de roupas.", "Organizar teste autorizado, anonimizado e com critérios objetivos."),
    Score("RF19", "Interações sociais", 8.5, "9 endpoints; reações, comentários, notificações e pontos.", "Cobrir abuso, rate limit, moderação e concorrência.", "Criar cenários antifraude e testes de moderação."),
    Score("RF20", "Vínculo com marca", 8.5, "Fluxo de selo/matcher persistido e integrado.", "Demonstrar revisão, recusa e rastreabilidade de ponta a ponta.", "Executar o fluxo como marca e anexar capturas ao Trello."),
    Score("RF21", "Vínculo com celebridade", 8.5, "6 endpoints e sugestões de selo integradas.", "Reforçar consentimento e direito de imagem.", "Auditar CAs de consentimento e testar revogação."),
    Score("RF22", "Feed de celebridades", 8.0, "3 endpoints e perfil institucional disponível.", "Ampliar moderação, busca e evidência visual.", "Preparar dados de demonstração e teste do perfil completo."),
    Score("RF23", "Preferências e internacionalização", 9.5, "Preferências persistidas; catálogos pt-BR/en/es e QA i18n.", "Completar teste de acessibilidade com público escolhido.", "Conduzir e registrar o teste com usuários."),
    Score("RF24", "Motor de IA e serviços externos", 8.0, "7 endpoints, logs de inferência e fallbacks locais.", "Validar integrações reais, custo, timeout e circuit breaker em produção.", "Criar relatório de chamadas reais e comportamento degradado."),
    Score("RF25", "Selos e promoções", 9.0, "13 passos/11 endpoints e catálogo de design.", "Cobrir fraude, expiração e autorização de campanhas.", "Testar matriz de papéis e casos de cupom inválido."),
    Score("RF26", "Explorador Global", 8.0, "3 endpoints e painel por país.", "Validar agregações, filtros combinados e desempenho.", "Conferir números do painel contra consultas SQL."),
    Score("RF27", "Meu Quarto 3D", 8.5, "16 endpoints e cena 3D integrada ao inventário.", "Concluir alternância Avatar/manequim e atalho ‘Usar em…’.", "Implementar ou testar as tarefas FE pendentes do HU-RF27."),
    Score("RF28", "Smart Mirror e Vista-me", 8.0, "14 passos/13 endpoints com estado persistido.", "Concluir ‘Usar em…’ e integração do Avatar 3D.", "Assumir o CA16, com teste E2E e evidência visual."),
    Score("RF29", "Inventory Score e destaques", 8.5, "9 passos/8 endpoints, snapshots e rankings.", "Validar fórmula, explicabilidade e recalculo em bordas.", "Criar casos de cálculo manual e comparar com a API."),
    Score("RF30", "FAI Points, níveis e loja", 9.0, "8 passos/7 endpoints, ledger idempotente e limites.", "Fortalecer antifraude e observabilidade econômica.", "Testar idempotência, tetos diários e reconciliação do saldo."),
    Score("RF31", "Estados do acervo", 9.0, "Flags persistidas e refletidas nas telas.", "Cobrir consistência em todas as entradas do acervo.", "Montar matriz tela × estado e executar regressão."),
    Score("RF32", "Desafios", 9.0, "23 passos/20 endpoints e múltiplos modos.", "Adicionar carga, desempate e antifraude.", "Criar testes de concorrência e fechamento de desafio."),
    Score("RF33", "Passarela 3D", 7.5, "Ranking e filtros cobertos; principal API concentrada em 1 endpoint.", "Ampliar E2E visual, acessibilidade e desempenho WebGL.", "Testar Top 100 por região/país e fallback sem WebGL."),
    Score("RF34", "Eras da celebridade", 8.0, "9 passos/8 endpoints e showcase institucional.", "Aumentar prova visual e governança editorial.", "Criar cenário completo de era, publicação e revisão."),
    Score("RF35", "Coleções da marca", 8.0, "6 endpoints e mini-loja/showcase.", "Cobrir estoque, ordenação e autorização editorial.", "Testar coleção ponta a ponta como marca e visitante."),
    Score("RF36", "Foto com manequim", 8.5, "8 passos/7 endpoints e integração com look 3D.", "Validar qualidade, consentimento e falhas de renderização.", "Organizar dataset autorizado e registrar taxa de sucesso."),
    Score("RF37", "FLAIR", 9.5, "67 passos/55 endpoints; modos, times, arena, moedas e pontos.", "Priorizar carga, antifraude e equilíbrio do jogo.", "Ser responsável pela bateria de regressão e economia do FLAIR."),
    Score("RF38", "Cupons Fashion AI", 8.5, "9 passos/6 endpoints e área de cupons.", "Cobrir expiração, uso duplo e consistência transacional.", "Criar testes concorrentes de resgate e casos negativos."),
    Score("RF39", "Criador e loja de guarda-roupa 3D", 9.0, "14 passos/8 endpoints, editor, loja e evidências visuais.", "Adicionar compatibilidade WebGL/mobile e autorização de criador.", "Testar perfis permitidos/proibidos e dispositivos modestos."),
    Score("RF40", "Meu Avatar 3D", 8.5, "Pipeline local, 45 testes e APIs com consentimento/textura privada.", "Concluir uso no Quarto/Espelho e validação com usuários autorizados.", "Assumir integração pendente e relatório de qualidade/privacidade."),
    Score("RF41", "FAI Points em jogos e criações", 8.5, "Ponte idempotente, regras em banco e testes de tetos.", "Exibir selo de pontos na Arena/Desafio e ampliar reconciliação.", "Implementar os selos pendentes e testar o ledger fim a fim."),
]

RNF = [
    Score("RNF1", "Controle de acesso por perfil", 9.0, "Guards no backend, menus/rotas por perfil e testes 403.", "Manter matriz RBAC versionada e testes negativos por endpoint.", "Criar a matriz papel × endpoint e automatizar casos proibidos."),
    Score("RNF2", "JWT e recuperação de sessão", 8.5, "Access/refresh tokens, sessões e revogação implementados.", "Testar rotação, replay e revogação sob concorrência.", "Produzir testes de segurança focados em tokens."),
    Score("RNF3", "Criptografia de dados sensíveis", 9.0, "Senha com hash e campos sensíveis com AES-GCM.", "Documentar gestão/rotação de chaves e threat model.", "Escrever runbook de rotação e verificar ausência de segredos em logs."),
    Score("RNF4", "Backup e recuperação", 4.0, "Persistência estruturada, mas sem evidência forte de restore testado.", "Criar backup automatizado, RPO/RTO e teste de restauração.", "Liderar exercício de restore e anexar tempos/evidências ao Trello."),
    Score("RNF5", "Auditoria e logging", 8.5, "audit_log, ai_inference_log e correlationId.", "Centralizar logs, alertas e política de retenção/mascaramento.", "Montar dashboard/consulta de auditoria e validar dados sensíveis."),
    Score("RNF6", "Privacidade e LGPD", 8.0, "Consentimentos, exportação, exclusão e proteção de biometria.", "Formalizar RIPD, bases legais, retenção e teste do titular.", "Executar checklist LGPD e registrar lacunas como cards."),
    Score("RNF7", "Desempenho e usabilidade", 7.5, "UI responsiva, estados de erro/loading e recursos acessíveis.", "Definir SLOs, testes de carga, Lighthouse e teste com público.", "Coletar métricas por jornada e abrir melhorias mensuráveis."),
    Score("RNF8", "Resiliência a APIs externas", 8.5, "Fallback local, retry/circuit breaker e jobs assíncronos.", "Realizar game day com indisponibilidade e provar alertas/recuperação.", "Desligar provedores em ambiente de teste e documentar o comportamento."),
]


def media(items: list[Score]) -> float:
    return sum(item.nota for item in items) / len(items)


def markdown() -> str:
    rf_score, rnf_score = media(RF), media(RNF)
    global_score = rf_score * 0.7 + rnf_score * 0.3
    out = [
        "# Avaliação profissional dos RFs/RNFs e plano de contribuição do Bryan",
        "",
        "> Data-base: 28/09/2026. Esta é uma avaliação de **maturidade das evidências no repositório**, não uma nota oficial da banca.",
        "",
        "## Resultado executivo",
        "",
        f"- **Score dos RFs:** {rf_score:.1f}/10 (peso de 70%).",
        f"- **Score dos RNFs:** {rnf_score:.1f}/10 (peso de 30%).",
        f"- **Score global ponderado:** **{global_score:.1f}/10**.",
        "- O `git shortlog -sne --all` desta fotografia não mostra autoria identificável como Bryan; isso deve ser confirmado com os e-mails/aliases usados por ele antes de concluir ausência de participação.",
        "- Escala: 0–2 inexistente; 3–4 inicial; 5–6 funcional com lacunas; 7–8 bom; 9 excelente e bem evidenciado; 10 comprovado em produção, com operação e métricas maduras.",
        "- Método: código + documentação + persistência + teste/E2E + evidência visual/operacional. A quantidade de endpoints, isoladamente, não aumenta a nota.",
        "",
        "## Avaliação por RF",
        "",
        "| RF | Requisito | Score | O que sustenta a nota | Próximo avanço | Como Bryan pode ajudar |",
        "|---|---|---:|---|---|---|",
    ]
    for i in RF:
        out.append(f"| {i.codigo} | {i.requisito} | **{i.nota:.1f}** | {i.evidencia} | {i.melhorar} | {i.bryan} |")
    out += [
        "", "## Avaliação por RNF", "",
        "| RNF | Requisito | Score | O que sustenta a nota | Próximo avanço | Como Bryan pode ajudar |",
        "|---|---|---:|---|---|---|",
    ]
    for i in RNF:
        out.append(f"| {i.codigo} | {i.requisito} | **{i.nota:.1f}** | {i.evidencia} | {i.melhorar} | {i.bryan} |")
    out += [
        "", "## Parecer de engenharia de software", "",
        "### O que está bom", "",
        "- **Cobertura funcional ampla e rastreável:** RF1–RF39 possuem inventário E2E por CA/endpoint; RF40–RF41 têm implementação e testes documentados.",
        "- **Arquitetura:** backend modular/hexagonal, separação entre domínio, aplicação, infraestrutura e web, além de integrações por portas/adaptadores.",
        "- **Persistência e auditabilidade:** Flyway, regras de integridade, ledger idempotente, audit log e log de inferência de IA.",
        "- **Experiência e resiliência:** estados de carregamento/erro/vazio, fallback de IA, internacionalização e alternativas quando WebGL/serviços externos falham.",
        "- **Profundidade técnica diferenciada:** 3D, visão computacional, FLAIR, rankings, economia de pontos, dashboards e múltiplos perfis.",
        "",
        "### O que deve melhorar", "",
        "1. **RNF4 é o maior risco:** falta prova reproduzível de backup/restore com RPO/RTO.",
        "2. **Qualidade não deve depender apenas do E2E:** aumentar testes unitários/de integração, especialmente regras de negócio, autorização e concorrência.",
        "3. **Observabilidade operacional:** transformar Actuator/logs em dashboards, alertas e SLOs comprovados.",
        "4. **Segurança e privacidade:** threat model, rotação de chaves, testes de token, RIPD/LGPD e retenção de dados.",
        "5. **Validação humana:** acessibilidade, usabilidade e qualidade de IA/3D com amostras autorizadas e métricas objetivas.",
        "6. **Rastreabilidade:** eliminar colisões de numeração entre Trello, Swagger e comentários; manter RF → HU → CA → código → teste → evidência.",
        "7. **Entrega:** CI/CD por ambientes e IaC ainda não têm o mesmo nível de maturidade do produto.",
        "",
        "## Recomendação de commits para Bryan", "",
        "O objetivo não é criar commits artificiais para alterar estatística. Bryan deve assumir entregas reais, pequenas, revisáveis e ligadas a cards/CAs.",
        "",
        "### Ordem recomendada (alto impacto e baixo risco)", "",
        "1. **RNF4 — backup e restore:** script, runbook, teste de restauração e evidência de RPO/RTO.",
        "2. **QA dos RF27/RF28/RF40/RF41:** concluir integrações pendentes e seus testes E2E.",
        "3. **Segurança:** matriz RBAC, testes negativos 401/403, rotação/replay de refresh token.",
        "4. **Acessibilidade/usabilidade:** teste com participantes, relatório e correções pequenas identificadas.",
        "5. **DevOps:** workflow de build/teste, publicação de JaCoCo e ambientes claramente separados.",
        "6. **Documentação de sprint/TDE:** objetivo, planejado × entregue, review, retrospectiva e links de PRs/evidências.",
        "",
        "### Padrão para os commits", "",
        "- Uma entrega coerente por commit; evitar commits gigantes ou apenas cosméticos.",
        "- Usar a conta pessoal do Bryan e configurar `user.name`/`user.email` com identidade verificável.",
        "- Mensagens sugeridas: `test(rnf1): cobrir matriz de autorização por perfil`, `docs(rnf4): registrar teste de restauração`, `feat(rf41): exibir pontos na arena`.",
        "- Cada PR deve citar card, RF/RNF, CA, teste executado e evidência; Matheus revisa e Bryan responde aos comentários.",
        "- Nunca reescrever autoria de trabalho alheio. Participação se demonstra por análise, implementação, teste, revisão e documentação próprios.",
        "",
        "## Trello", "",
        "O link de convite do board **TCC 2026 (Fashion AI) — Bryan,Matheus** foi fornecido em 28/09/2026. Por segurança, o token de convite não é reproduzido nem persistido no repositório.",
        "",
        "A tentativa de abrir o convite neste ambiente falhou antes de chegar ao Trello: o proxy de rede retornou `403 Forbidden`; o navegador de pesquisa também não estava autenticado. Além disso, um convite serve para uma pessoa entrar no board e **não substitui credenciais da API**. Por isso, nenhum card foi lido ou alterado e os scores continuam baseados nos artefatos versionados.",
        "",
        "Para concluir a conexão:",
        "1. **Conferência manual:** Matheus ou Bryan abre o convite em um navegador autenticado, aceita o acesso e envia a URL normal do board (sem `/invite/`).",
        "2. **Leitura automatizada:** configurar `TRELLO_API_KEY`, `TRELLO_TOKEN` e `TRELLO_BOARD_ID` como segredos do ambiente, com acesso somente ao board necessário e sem gravá-los no git.",
        "3. **Sincronização controlada:** primeiro comparar listas/cards/checklists em modo `--dry-run`; somente depois, com revisão humana, habilitar comentários ou atualização de checklists.",
        "",
        "O passo a passo de configuração e o verificador de acesso estão em `docs/rubricas/TRELLO_ACESSO.md` e `scripts/rubricas/verificar_trello.py`.",
        "",
        "Com acesso de leitura, a próxima versão da análise deve confrontar diretamente: RF/HU, CAs, responsável, sprint, status, checklist `[BE]/[DB]/[FE]/[INT]/[IA]/[QA]`, links de PR e evidências. Até isso ocorrer, o board **não pode ser declarado sincronizado**.",
        "",
        "## Fontes internas usadas", "",
        "- `markdowns/02-rf-reestruturados-e-criterios-aceite.md` — catálogo e matriz RF × RNF.",
        "- `docs/testes/TABELA_ENDPOINTS_POR_RF.md` — 452 passos e 368 endpoints de RF1–RF39.",
        "- `docs/novos-rf/README.md` — numeração oficial do Trello e mapa RF25–RF41.",
        "- `docs/novos-rf/RF40-RF41.md` — situação, testes e pendências dos dois RFs mais recentes.",
        "- `docs/rubricas/GUIA_RUBRICAS.md` — rubricas, riscos e evidências transversais.",
        "- `git shortlog -sne --all` — fotografia da autoria dos commits no repositório.",
        "",
    ]
    return "\n".join(out)


def write_csv(path: Path, items: list[Score]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.writer(output, delimiter=";", lineterminator="\n")
        writer.writerow(("Código", "Requisito", "Score / 10", "Evidência", "Pode melhorar", "Como Bryan pode ajudar"))
        for item in items:
            writer.writerow((item.codigo, item.requisito, f"{item.nota:.1f}", item.evidencia, item.melhorar, item.bryan))


def main() -> None:
    REPORT.write_text(markdown(), encoding="utf-8")
    write_csv(RF_CSV, RF)
    write_csv(RNF_CSV, RNF)
    print(f"RF={media(RF):.2f}; RNF={media(RNF):.2f}; global={media(RF)*0.7+media(RNF)*0.3:.2f}")


if __name__ == "__main__":
    main()
