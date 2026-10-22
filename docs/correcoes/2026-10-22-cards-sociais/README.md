# Cards de peça e look: apresentação e medidas

Data: 22/10/2026. [Especificação completa de medidas](../../anatomias/cards-sociais-medidas-2026-10-22.md). [Plano das três funcionalidades](../../plans/2026-10-22-tamanho-atelie-passaporte.md).

## Mudança verificada

- Posts com largura externa máxima de 470 px; foto 4:3; conteúdo inferior cresce sem cortar valores.
- Marca, cor, ocasião e estilo em blocos permanentes de duas colunas: fonte 16 px, altura mínima 76 px, raio 12 px.
- Selos oficiais/Hype de 44 px, separados; sem inventar medalhão a partir de tag de sustentabilidade.
- Info/Hype com alvo mínimo de 44 px; score global 16 px dentro de Info. Atributos Hype com números 22 px e tinta do container, inclusive valores altos.
- Publicações do perfil usa o mesmo resumo social para looks. Lista inteira de roupas e composições de detalhe continuam no card ampliado.

## Verificação no navegador

[Relatório de geometria](browser-measurements.json): 12 cenários de rota/viewport mais 8 layouts Hype e 1 alternância Info/tema escuro. Viewports: **1440 × 1000** e **390 × 1000**, zoom normal.

Rotas reais abertas: `/feed`, `/search?tab=PECAS`, `/search?tab=LOOKS`, `/u/ana?tab=closet`, `/u/ana?tab=looks`, `/u/ana?tab=publications`. As medições verificaram largura máxima, fotografia 4:3, quatro blocos de metadados, fonte 16 px, selos 44 px, abas com pelo menos 44 px, ausência de overflow horizontal e ausência de transformação ao passar o mouse. Os números Hype disponíveis usam a tinta legível do card.

**Limite da evidência:** CSS, componentes e navegação locais são reais; autenticação, catálogo, perfil, Hype e selos foram simulados pelo navegador. Os nomes/valores das capturas são exemplos de teste. Não houve validação do banco de produção, concessão de selos, compra ou nova execução GPU. Acessar uma página real com API simulada não prova integração com os dados reais.

Capturas individuais ocultam apenas a barra fixa de navegação durante a captura, para ela não cobrir o cabeçalho do card ao capturar um elemento mais alto que o viewport. Isso não altera dimensões ou conteúdo do card. O tema escuro da página preserva o fundo claro escolhido na skin do card.

| Captura | Conteúdo |
| --- | --- |
| [Peça, desktop](piece-desktop.png) | Foto menor, quatro informações permanentes e Hype em duas colunas |
| [Peça, celular](piece-mobile.png) | Mesma fonte, quebra de linha e abas sem transbordar |
| [Look em Publicações](look-publications-mobile.png) | Resumo social com selo, marca, cor, ocasião e estilo |
| [Aba Info, celular](piece-info-mobile.png) | Categoria, material e tamanho sem duplicar os quatro blocos principais |
| [Tema escuro](piece-dark-mobile.png) | Contraste de texto e geometria mantidos |

## Checagens de código

- Build completo: `npm run build` passou no checkout final, incluindo Stylelint, design, i18n e TypeScript. O sandbox inicial impedia a porta local usada pelo Turbopack; a execução com acesso de rede do ambiente concluiu normalmente.
- Regressões focadas de cards, selos, lotes, troca de usuário e listas: **80 testes passaram em 8 arquivos**.
- A suíte completa foi executada durante a implementação. Duas expectativas antigas de posição de estilo/selo foram corrigidas; dois casos novos de Publicações detectaram o uso de `compact`, removido e revalidado nos sete testes do arquivo. A rodada final e os checks remotos constam no PR; não tratar as execuções anteriores à correção como verdes.

Para reproduzir sem o backend, usar os fixtures de `test-utils/fixtures.ts` e interceptar as respostas das rotas documentadas. Para validar produção, repetir os mesmos caminhos com uma conta e peças que possuam selos aprovados reais; conferir também conteúdo privado/anônimo. Nenhum segredo ou sessão de produção é necessário para as capturas anexadas.
