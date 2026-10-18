# VTON / Vertex AI — evidências e pendências

## Verificação local

- 32 testes em `services/anatomical_vton/tests`: passaram.
- 8 testes em `services/digital_twin/tests`: passaram.
- Compilação sintática dos módulos Python: passou.
- Testes GPU de verdade: não executados; não há CUDA/pesos neste runtime.
- Build Docker: não executado; socket local indisponível para este usuário.

Os testes cobrem TPS rígido/elástico, alinhamento frontal, oclusão, inversão de
pixels do espelho, fila/cache/leases, retries, autenticação da API privada,
contratos Vertex, tamanho de payload, prontidão, concorrência única, confidencialidade
de erros, integridade de artefatos e rejeição de caminhos externos.

Os testes de servidor usam um double marcado `TEST_ONLY`. Os arquivos `.pt` dos
testes são bytes declarados não executáveis; só exercitam validação de hashes e
staging, não são distribuídos como modelos nem passam por carregamento CUDA.

## Infraestrutura informada pelo usuário

- Projeto: `project-14023673-32d6-4bf2-8b7` / número `796635131232`.
- Região: São Paulo, `southamerica-east1`.
- Faturamento: `billingEnabled=True` informado pelo Cloud Shell.
- Vertex API: habilitada no Cloud Shell.
- Endpoint roupa: `481863169896087552`.
- Endpoint corpo: `5093549188323475456`.
- Modelos registrados: listagem vazia no último resultado fornecido.
- Cota regional de T4 para serving: `effectiveLimit=1`, `defaultLimit=1`.

Esses fatos foram fornecidos pelo usuário. A sessão do agente não tem ADC nem
identidade Google Cloud e não consultou o projeto autenticadamente. Cota não
comprova consumo atual, estoque físico de GPU ou liberação de todos os recursos
na conta em avaliação.

## Próxima condição necessária

Um bundle treinado compatível com `vertex_runtime/MODEL_BUNDLE.md`. O repositório
implementa o protocolo e os algoritmos geométricos; não inclui redes treinadas para
todos os seams/categorias nem os pesos licenciados de FLAME/SMPL-X. Sem esses
artefatos, ativar uma GPU não resolve o processamento anatômico.

O plano limita a implantação a uma réplica T4 compartilhada pelos dois tipos de
inferência. Nenhuma GPU foi provisionada pela sessão do agente. A publicação no
Vertex e a prova no aplicativo com fotos reais permanecem pendentes.
