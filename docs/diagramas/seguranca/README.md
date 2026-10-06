# Diagramas — segurança, integridade e operação (transversal)

Fonte PlantUML (`*.puml`, estilo comum em `_estilo.iuml`) e PNG gerado ao lado. Regerar:
`java -jar plantuml.jar -Playout=smetana -charset UTF-8 -tpng docs/diagramas/seguranca/*.puml`.

Esta pasta absorveu a antiga `RF49/` (numeração do repositório, sem cartão próprio no Trello). Login, bloqueio por
tentativas e sessão ficam no [RF2](../RF2/); conta e `AccountStatus` no [RF1](../RF1/); o pipeline de dados demo em
[`../dados-demo/`](../dados-demo/).

| Tipo | Diagrama | O que mostra |
|---|---|---|
| Atividades | `SEG-atividades-acesso.puml` | do navegador à API: CSP com nonce, gate (Google + PIN ou Cloudflare Access), BFF e a cadeia de filtros da API |
| Atividades | `SEG-atividades-integridade.puml` | Flyway V34 (política de ON DELETE, FK por FK, órfão adia só aquela FK) e V35 (`account_origin`) |
| Sequência | `SEG-sequencia-sessao-bff.puml` | login pelo BFF, token do gate vencido, refresh entre abas, logout com a API fora do ar |
| Sequência | `SEG-sequencia-entrega-continua.puml` | CI (API, front, gitleaks) → branch de deploy → imagem → Flyway → healthcheck |
| Sequência | `BANCOS-sequencia-inicio-endurecido.puml` | início de um banco no Railway: hash do script, TLS, papéis, rotação |
| Componentes | `SEG-componentes-v5.puml` | camadas de defesa da borda aos bancos, dados demo isolados e entrega contínua |
| Componentes | `BANCOS-componentes-menor-privilegio.puml` | `infra/railway`: usuários de menor privilégio, TLS e quem conecta em cada banco |
| Classes | `SEG-classes.puml` | gate, cliente da API, filtros e configuração de segurança |
| Classes | `SEG-classes-protecao-dados.puml` | mídia com dono, `restricted/`, `AiBudget`, criptografia de campo e backup |
| Classes | `SEG-classes-integridade.puml` | V34 (`POLICY`, `Fk`), V35 (`AccountOrigin`, `CatalogOrigin`), verificação e `MigrationVersionsTest` |
| Máquina de estados | `SEG-maquinadeestados-acesso.puml` | gate + token de API + sessão no app |
| Máquina de estados | `SEG-maquinadeestados-conta.puml` | origem da conta (`account_origin`) e como a linha sai do banco (anonimização × reset demo) |

Itens marcados `<<planejado>>`: `DemoDataService`, `/api/admin/demo` e o seed/reset demo.
