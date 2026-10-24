# Segundo lote: silhuetas de calças e saias

## Alterações

As variações declaradas `BOOTCUT`, `FLARE`, `WIDE_LEG`, `TAPERED` e `RELAXED` passam a ter ajustes próprios de perna. Bootcut e flare começam a abrir abaixo do joelho; wide leg abre mais acima e mantém coluna ampla; tapered acompanha uma coluna mais estreita; relaxed ganha folga moderada. As saias `PENCIL`, `STRAIGHT` e `A_LINE` diferenciam a abertura da barra.

O catálogo mantém prioridade: `variation` explícita vence a inferência pelo nome. Sem esse campo, palavras explícitas como “bootcut”, “afunilada”, “saia lápis” e “evasê” podem identificar a silhueta. Nenhuma regra escolhe um corte por marca. Comprimento, altura do cós e atributos de material continuam no pipeline anterior.

O estágio de relaxamento da perna também precisou respeitar a abertura declarada: apenas alterar o molde inicial não garantia uma diferença na malha final, pois o anel usado para a coluna dominava o resultado.

## Evidências

- 47 testes focados aprovados em seis arquivos; TypeScript e build Next.js de produção aprovados.
- Medições em dois corpos de referência: abertura final da barra distinta para reta/tapered/bootcut/flare/wide leg, saia evasê mais ampla que lápis, posições finitas e malha do corpo inalterada. Arquivos `bottomwear-FEMININO.json` e `bottomwear-MASCULINO.json`; unidades das larguras em metros no espaço local, não medidas comerciais.
- Chromium em 1440 × 1000: seis renderizações (`STRAIGHT`, `BOOTCUT`, `FLARE`, `TAPERED`, `PENCIL`, `A_LINE`) usando fotos locais, sem erros JavaScript. Capturas e auditoria acompanham este documento. A variação é aplicada pelo laboratório para comparar o mesmo asset, não pela edição de um produto de produção.
- O caminho de seleção imediata e a troca de cores/fotos do PR anterior continuam cobertos pelos testes de `HumanOutfit` e dos adaptadores do provador.

## Limites

Este lote melhora silhuetas paramétricas. Não reconstrói moldes industriais, bolsos, costuras ou física de tecidos de cada SKU; não certifica encaixe anatômico perfeito nem poses móveis. Fotos são projetadas sobre a geometria estimada e podem deformar detalhes ao mudar a silhueta. Permanecem irregularidades visuais em acabamentos e regiões de junção, visíveis nas capturas. Não houve alteração do banco de produção, inferência GPU, nem validação em dispositivo móvel físico. Outras categorias e variações continuam exigindo lotes próprios de revisão.
