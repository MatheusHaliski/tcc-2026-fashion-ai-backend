# Cobertura do backend medida pelo teste ponta a ponta

O backend rodou com o agente do JaCoCo 0.8.12 (`-javaagent:org.jacoco.agent-0.8.12-runtime.jar`) durante a suíte de 452 passos (`scripts/e2e`). O relatório foi gerado com as APIs `org.jacoco.core`/`org.jacoco.report` (`scripts/e2e/jacoco_report.jsh`) sobre as classes de `target/classes` de cada módulo.

**Total: 17559 de 23591 linhas (74.4%) e 7078 de 14766 ramos (47.9%).**

| Módulo | Linhas | % linhas | Ramos | % ramos | Métodos | Classes |
|---|---|---|---|---|---|---|
| fai-domain | 468/575 | 81.4% | 30/90 | 33.3% | 97/116 | 78/92 |
| fai-application | 16052/21338 | 75.2% | 6910/14028 | 49.3% | 2593/3413 | 259/283 |
| fai-web | 752/831 | 90.5% | 58/130 | 44.6% | 532/561 | 131/131 |
| fai-infrastructure (MySQL) | 76/85 | 89.4% | 6/16 | 37.5% | 32/34 | 4/4 |
| fai-infrastructure (plataforma) | 140/248 | 56.5% | 48/154 | 31.2% | 54/77 | 16/18 |
| fai-infrastructure (IA) | 68/378 | 18.0% | 26/284 | 9.2% | 31/83 | 11/16 |
| fai-infrastructure (Redis, desligado aqui) | 0/29 | 0.0% | 0/18 | 0.0% | 0/19 | 0/4 |
| fai-infrastructure (Cassandra, desligado aqui) | 0/30 | 0.0% | 0/8 | 0.0% | 0/7 | 0/1 |
| fai-infrastructure (OpenSearch, desligado aqui) | 0/43 | 0.0% | 0/24 | 0.0% | 0/8 | 0/1 |
| fai-infrastructure (S3, desligado aqui) | 0/31 | 0.0% | 0/14 | 0.0% | 0/8 | 0/1 |
| fai-bootstrap | 3/3 | 100.0% | 0/0 | 0.0% | 2/2 | 1/1 |

Observações:

- Os adaptadores de Redis, Cassandra, OpenSearch e S3 ficam em 0% porque estão desligados neste ambiente (feature flags); o caminho de fallback (MySQL e disco local) é o que foi exercitado.
- `fai-infrastructure (IA)` fica baixo porque não há chave de IA: os clientes HTTP dos provedores não são chamados; o motor local sim.
- Só com os testes unitários (`mvn test`), o relatório do JaCoCo por módulo dá 3% no fai-application e 13% no fai-web. A diferença vem do teste ponta a ponta, que passa por todos os 368 endpoints.
- O relatório HTML completo (por pacote, classe e linha) vai no pacote de evidências (`cobertura-e2e/html/index.html`).
