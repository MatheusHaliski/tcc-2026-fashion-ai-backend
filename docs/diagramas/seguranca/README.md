# Diagramas — segurança e bancos endurecidos

Fonte PlantUML (`*.puml`, estilo comum em `_estilo.iuml`) e PNG gerado ao lado. Regerar:
`java -jar plantuml.jar -tpng -charset UTF-8 docs/diagramas/seguranca/*.puml` (layout smetana: não precisa de Graphviz).

| Tipo | Diagrama | O que mostra |
|---|---|---|
| Atividades | `SEG-atividades-acesso.puml` | do navegador à API: CSP com nonce, dev gate (builtin/Cloudflare), BFF, filtros da API |
| Sequência | `SEG-sequencia-sessao-bff.puml` | login, renovação do token de API após 403, refresh com Web Lock, logout offline |
| Sequência | `BANCOS-sequencia-inicio-endurecido.puml` | início de um banco no Railway: hash do script, TLS, papéis, rotação |
| Componentes | `SEG-componentes-v5.puml` | v5 da visão de componentes com as camadas de segurança, da borda aos bancos |
| Máquina de estados | `SEG-maquinadeestados-acesso.puml` | gate + token de API + sessão no app |
| Máquina de estados | `SEG-maquinadeestados-conta.puml` | `AccountStatus` (inclui exclusão LGPD por anonimização) e `account_origin` |
| Classes | `SEG-classes.puml` | gate, cliente da API, filtros, `AiBudget`, mídia com dono, criptografia de campo |

O pipeline de dados demo (base implementada; seed/reset planejados) está em [`../dados-demo/`](../dados-demo/).
