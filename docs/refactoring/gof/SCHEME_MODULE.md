# Módulo de looks

## Facade

`SchemeService` concentra os pontos de entrada e mantém as anotações de transação e os tipos Java usados pelos controllers. O construtor existente monta os colaboradores do pacote `application.scheme`. Os colaboradores compartilham a transação aberta pelo serviço quando o fluxo exige uma. A sugestão de selos continua sendo chamada depois do salvamento.

- `SchemeAccess`, `SchemeQueries` e `SchemeHype` cuidam de acesso, consultas, montagem de respostas e leitura do HypeScore.
- `SchemeEditing` coordena criação e edição. `SchemeFormWriter` aplica os campos e sincroniza os itens. `SchemePublication` publica e registra o estado das peças.
- `SchemeLifecycle` executa ações de disponibilidade, arquivamento e remix. `SchemePhotos` processa e vincula fotos. `SchemeCards` coordena prévia, exportação e edição de camadas.

## Strategy

`SchemeComposition` prepara fotos, perfil e catálogo para o motor de IA. O `AiEngine` continua recebendo duas alternativas pelo contrato de `TextCall`: interpretar a resposta do provedor e compor localmente. As duas preservam a exclusão de combinações já exibidas. A estratégia local continua sendo acionada pelo motor segundo suas regras de disponibilidade e cota.

As regras puras de filtros, layout e parsing ficam no mesmo pacote e podem ser chamadas sem iniciar uma transação.
