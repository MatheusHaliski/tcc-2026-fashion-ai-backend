# Referências não resolvidas e órfãos candidatos

518 imports sem associação inequívoca nesta fotografia. Consultar `unresolved-imports.csv`; isso inclui wildcards/nested types e não representa 518 erros de compilação. `HTTP_CONTRACTS.csv` tem 1567 consumidores/candidatos não certificados. `UNRESOLVED_EXPRESSION` preserva chamadas dinâmicas sem inventar URLs.

Não declarar entidades, rotas ou services órfãos apenas por falta de import/consumidor direto. Podem existir JPA, DI, agendamentos, callbacks, serialização, eventos ou clientes externos. Autorização, rate limit e routers globais exigem leitura específica. Itens sem decisão humana permanecem PENDING no arquivo de cobertura.
