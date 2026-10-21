# Seleção imediata no provador e carregamento de fotos

## Causas e correções

- `HumanOutfit` mantinha o look anterior até terminar todas as fotografias novas. Se a foto de uma peça falhasse, removia a peça selecionada e vestia uma padrão. Agora o molde da seleção aparece imediatamente na cor cadastrada, quando disponível. A fotografia isolada entra ao terminar; falha de foto mantém o molde e informa a limitação. Falha de geometria continua protegida pela cobertura padrão.
- Trocar cor/modelagem mantendo ID e URL não refazia as malhas. A identidade visual e os atributos agora invalidam a construção também nesse caso.
- Fotos de peças independentes eram confirmadas em lote. Cada uma agora atualiza individualmente, com cache limitado para reutilizar o isolamento. Fotografias remotas continuam passando pelo isolamento seguro; referências locais são reconhecidas pela URL exata. A origem alternativa também é tentada quando o isolamento da primeira falha.
- O cache de texturas retinha falhas indefinidamente. Elas agora são removidas e requisições travadas terminam após 15 segundos por URL; uma textura que chega depois é descartada. Isso limita espera de transporte, não a duração da segmentação/IA.
- A fila de enquadramento enviava quatro solicitações ao backend com capacidade de duas, gerando 429 e esgotando tentativas. Agora usa duas, mantém deduplicação e reaproveita metadados de enquadramento por origem. O cache persistido contém apenas campos de imagem, expira em 24 horas e é invalidado em nova tentativa. Não substitui cor, variantes ou atributos atuais por uma cópia antiga do produto.
- Erro de imagem com enquadramento obrigatório agora oferece nova tentativa. A foto original sem enquadramento seguro continua protegida. URLs externas indisponíveis ainda podem falhar e precisam de correção na origem.
- Total frame reutiliza dimensões já medidas ao remontar. Na prévia do criador, Tecido também preenche o quadro com a imagem padrão; Total frame volta ao enquadramento inteiro.

## Verificação

- 63 testes focados aprovados em nove arquivos, cobrindo seleção com foto pendente, falha, troca de variante com a mesma URL, conservação da cor, camisas, jaquetas, shorts, saias, vestidos, tênis, isolamento de pessoas, fila/cache/retry e editor de arte.
- TypeScript e build de produção Next.js aprovados. O build precisou de cache Turbopack novo após falhas de abertura de porta do sandbox.
- Chromium: cargo visível no avatar enquanto sua foto estava deliberadamente retida; depois do carregamento, fotografia projetada com `photoWeight > 0.5`. Sem ação de Espelho. Repetido em janelas de 1440 e 390 pixels, sem erros JavaScript. O laboratório usa canvas de dimensões fixas; isso não certifica a ergonomia mobile do provador.
- Auditoria de `/pieces/new`, `/try-on` e `/search` em três larguras: nove cenários sem overflow, erros JavaScript ou violações detectadas. API sintética de leitura; não comprova integração com produção. Resultados em `interface.json`.

A captura usa avatar e peças de referência locais FAI. Bolsos, botões e cores vêm da fotografia; não são malhas de marcas aprovadas ou costuras reconstruídas fisicamente. A geometria continua estimada. Não houve inferência GPU nem alteração do catálogo de produção nesta validação.
