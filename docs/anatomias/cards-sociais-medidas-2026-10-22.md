# Cards sociais: medidas e hierarquia da área de informações

Data: 22/10/2026. Escopo: cards de peça e look em busca, feed e perfil, incluindo Publicações. O card ampliado mantém a lista completa de peças e a composição de detalhe.

## Dimensões aplicadas

As medidas são **largura × altura × raio**, em pixels CSS, com zoom normal. A largura máxima externa do post é **470 px**; em telas menores, ocupa a coluna disponível. A fotografia usa proporção **4:3**, liberando altura para a metade inferior. Não há escala aplicada ao card para simular redução.

`U` é a largura útil da área inferior **depois** da moldura artística e do padding interno. As quatro informações principais formam duas colunas com intervalo de 12 px: `C = (U − 12) / 2`. Isso preserva a moldura de cada layout sem impor uma largura de desktop ao celular.

| Item | Largura × altura × raio | Tipografia e comportamento |
| --- | --- | --- |
| Nome da peça / título do look | `U × mínimo 24 × 0` | 18 px, entrelinha 1,3; até duas linhas no resumo; nome completo no detalhe |
| **Marca** | `C × mínimo 76 × 12` | Rótulo 12 px, valor **16 px**; logo 20 × 20; mantém o nome real da marca |
| **Cor** | `C × mínimo 76 × 12` | Valor **16 px**; amostra de cor 18 × 18, raio 9; nome junto à cor |
| **Ocasião** | `C × mínimo 76 × 12` | Valor **16 px**; quebra de linha, sem reduzir fonte |
| **Estilo** | `C × mínimo 76 × 12` | Valor **16 px**; quebra de linha, sem reduzir fonte |
| **Cada selo oficial/Hype** | `44 × 44 × 22` | Até três medalhões separados por 6 px; contagem `+N` para os demais; sem sobreposição |
| **Score global Hype dentro de Info** | `mínimo 48 × mínimo 28 × 8` | Número **16 px** em negrito; preserva indisponível, carregando e desatualizado |
| **Cada aba Info / Hype** | `(U − 8) / 2 × mínimo 44 × 10` | Texto 14 px; raio externo do grupo 12; conteúdo quebra linha quando score/tendência exigirem |
| Categoria/subcategoria | `C × mínimo 56 × 10` | Rótulo 12 px, valor **16 px**, dentro de Info |
| Material | `C × mínimo 56 × 10` | Rótulo 12 px, valor **16 px**, quando informado |
| Tamanho | `C × mínimo 56 × 10` | Rótulo 12 px, valor **16 px**, quando informado |
| Quantidade de peças / estação do look | `C × mínimo 56 × 10` | Rótulo 12 px, valor **16 px**, quando aplicável |
| **Atributo numérico Hype** | Largura definida pelo layout abaixo; `mínimo 56 × 12` | Número **22 px**, sigla 12 px; nome completo no texto acessível/title |
| Preço da peça à venda / total do look | Largura disponível na linha × mínimo 24 × 0 | **16 px**; conserva preço ausente em vez de inventar valor |
| Tipo do look / descrição | `U × altura do texto × 0` | 14 px; descrição curta no resumo e completa no detalhe |

Os raios se referem às caixas dos elementos; texto puro não ganha uma borda decorativa. As alturas são mínimas: duas ocasiões longas, marcas compostas e traduções podem aumentar o bloco. O tamanho do texto permanece constante.

### Exemplo medido no navegador

Na peça com moldura Atelier, o post externo de 470 px deixou `U = 396 px`: **Marca, Cor, Ocasião e Estilo mediram 192 × 76 px, raio 12 px**. Na viewport de 390 px, o post mediu 340 px e `U = 266 px`: **127 px de largura por bloco**, com altura mínima 76 px e crescimento conforme o texto (85,375 px no exemplo com marca longa). Outras molduras descontam seus próprios paddings; a fórmula é a regra, não o valor fixo 192.

## Preservação dos oito layouts Hype

As medidas não substituem o estilo escolhido:

- Horizontal: cada atributo tem largura 54 px, altura mínima 56 px e raio 12 px; a faixa permite rolagem horizontal, sem encolher os números.
- Vertical e ranking LED: uma coluna usa toda a largura da matriz; cada linha tem altura mínima 56 px e raio 12 px.
- Duas colunas: duas células por linha, intervalo de 4 px, altura mínima 56 px e raio 12 px.
- Score global: conserva o destaque global próprio do preset.
- Maior/menor e texto opinativo: preservam a hierarquia do preset e o espaço necessário para contexto/histórico.
- Três atributos-chave: três colunas, altura mínima 56 px e crescimento para a explicação. Não oculta o motivo de seleção.

O card não recebe altura fixa nem corte na área de informações. Um preset vertical com oito/nove métricas é naturalmente mais alto do que o preset de score global. O resumo não repete a lista inteira das roupas do look; ela continua disponível ao abrir o detalhe. Marca, cor, ocasião e estilo permanecem visíveis quando a aba Hype está selecionada.

## Dados e selos

- Dados vêm da peça/look e do resumo Hype existente; ausência aparece como `—`, sem converter para zero.
- O campo `PieceView.seals` contém atributos da roupa e **não** comprova medalhões oficiais. As listas agora consultam `GET /api/pieces/seals?ids=...`, em lotes de até 60 IDs.
- O cache de selos é local à lista e ao visitante/usuário atual, reutiliza os IDs já carregados, atualiza após 60 segundos enquanto visível e descarta o escopo anterior ao trocar de conta. Não concede novas licenças.
- Selos de looks continuam vindo de `sealBadges`; selos Hype continuam derivados do resumo do servidor.
- Hover de transformação não foi reintroduzido. Controles mantêm foco e navegação por teclado.

## Validação e limites

As capturas e medidas ficam em [evidências dos cards](../correcoes/2026-10-22-cards-sociais/README.md). A verificação abre as páginas e componentes reais com respostas de autenticação, catálogo, perfil, Hype e selos simuladas. Isso valida apresentação e encaminhamento dos dados, **não** comprova a existência de selos nem a disponibilidade do banco de produção.

Para conferir manualmente: abrir `/feed`, `/search` nas abas Peças/Looks e `/u/[username]` em Peças/Looks/Publicações; testar desktop e celular; alternar Info/Hype; conferir títulos longos, ausência de dados, selos e tema escuro; abrir o card ampliado e confirmar a lista completa. Comparar a geometria antes/depois de passar o mouse.

O plano das três novas funcionalidades é uma entrega documental separada: [tamanho, Atelier e passaporte](../plans/2026-10-22-tamanho-atelie-passaporte.md). Esses novos módulos não foram implementados nesta alteração.
