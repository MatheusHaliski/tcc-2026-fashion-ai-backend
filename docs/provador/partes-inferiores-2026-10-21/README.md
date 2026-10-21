# Parte de baixo: revisão das 14 subcategorias

`lib/avatar3d/human/lowerwear.ts` define os perfis das 12 subcategorias ativas e das duas legadas (`bermuda_shorts`, `denim_shorts`). O teste compara as chaves com a taxonomia oficial e valida os parâmetros das 110 variações cadastradas. Essa cobertura estrutural não certifica 110 moldes diferentes.

| Grupo | Ajustes |
| --- | --- |
| Jeans, alfaiataria, casual e chino | Folga, cós, comprimento e coluna da perna específicos; palazzo e cigarette aproveitam as regras de silhueta. |
| Cargo | Construção cargo preservada, incluindo aliases antigos; variação com punho respeita a barra afunilada. |
| Jogger e moletom | Punho é parte do molde e do relaxamento. Moletom reto, amplo, flare ou palazzo deixa de ser forçado ao mesmo afunilamento. |
| Leggings | Ajuste próximo ao corpo; flare abre abaixo do joelho. Compression altera apenas a folga visual, sem simular pressão física. |
| Pantacourt | Comprimento e amplitude próprios; projeção da foto usa a referência inferior correta. |
| Shorts, bermuda e shorts jeans | Comprimentos distintos, biker mais ajustado, cargo e A-line quando declarados. Bermuda também usa referência inferior na projeção. |
| Saia | Volume próprio; circle e slip distinguem abertura e folga. |
| Saia-short | Shorts internos estimados construídos na mesma malha, com folga para a saia. O forro recebe tecido aproximado, nunca a fotografia da parte externa. |

Atributos explícitos de comprimento e altura da cintura prevalecem sobre os padrões. O contrato passa a relatar o comprimento ajustado de bermudas, pantacourts e saias. A versão do molde é `fai-mould-skinwrap-v5`, invalidando diagnósticos de versões anteriores. O aviso de forro estimado foi atualizado em PT/EN/ES.

## Verificação

- 74 testes focados aprovados em dez arquivos: cobertura da taxonomia, regras, geometria final nos corpos feminino e masculino, camadas, isolamento da pele e seleção. O contrato foi revalidado após o último ajuste de metadados.
- Build de produção Next.js aprovado, incluindo TypeScript, estilos e verificações de tradução.
- Chromium: as 14 referências locais aparecem vestidas e com fotografia projetada, sem erros JavaScript; resultado em `lowerwear-browser.json`. Capturas representativas foram inspecionadas visualmente.
- Os relatórios por corpo registram geometria finita, largura real da barra com e sem punho, e vértices do forro. O teste verifica que a foto externa não é projetada nesses vértices.

## Limites

São moldes paramétricos estimados por família, não moldes industriais por marca/SKU. Pregas, gancho rebaixado de harem, recortes barrel/horseshoe, costuras, bolsos, zíperes e comportamento físico de cada tecido não têm reconstrução completa neste lote; muitos detalhes dependem da foto frontal. Cor e textura nas costas e no forro continuam aproximadas.

As capturas mostram limitações de junção e projeção; não comprovam encaixe perfeito nem realismo fotográfico. O laboratório usa referências locais e canvas fixo, com API simulada. Não houve validação de todos os produtos de produção, em aparelho móvel físico, nem inferência GPU de IA nesta revisão.
