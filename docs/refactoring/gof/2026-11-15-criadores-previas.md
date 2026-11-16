# Prévias e seleção nos criadores

O criador de looks separa a apresentação dos slots, a grade paginada de peças e a prévia em modal; o estado e as regras de seleção continuam no construtor. O criador de peças separa a apresentação da prévia e reaproveita o diálogo no formulário e no editor de arte.

**GoF: NENHUM.** A extração organiza responsabilidades de interface sem exigir uma hierarquia ou um padrão de projeto adicional.

Na refatoração do look, `scheme-builder.tsx` passou de 272 para 240 linhas. Os testes de caracterização do fluxo manual, da IA e da edição passaram antes e depois; os novos testes cobrem abertura e fechamento do modal e seleção entre páginas. Os testes dos criadores de peça e look somam 31 casos aprovados.

No card de look, selos, menu e layouts de peça foram separados em componentes próprios; `scheme-card.tsx` passou de 333 para menos de 250 linhas. Os 78 testes de caracterização dos cards passaram antes da extração. A aba Info reúne os detalhes da peça e os itens do look ampliado, e a janela compacta do look cresce para acomodar o Hype. A revisão não solicita mais a imagem PNG separada.
