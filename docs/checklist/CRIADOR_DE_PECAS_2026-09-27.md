# Criador de peças (RF4) — marca, recorte padrão, critérios de aceite da foto e erro ao salvar

Entrega de 27/09/2026 para os quatro problemas apontados no criador de peças. Cada item traz a causa encontrada, o que
mudou e a evidência (arquivo, teste automatizado e captura da verificação no navegador com backend e MySQL reais).

## Resumo

| # | Problema | Causa | Correção |
|---|----------|-------|----------|
| 1 | Erro nas listas de estilo e ocasião ao salvar | O pré-preenchimento mandava estilo `casual` — que é **ocasião**, não estilo — para quase toda peça (`WardrobeService.defaultStyle`). O backend recusava ("Valor fora da taxonomia: casual") e, como não existe chip "casual" em Estilo, a pessoa não conseguia nem desmarcar o valor. Trocar de categoria também zerava as ocasiões. | Estilo padrão válido (`basic`); ocasião/estilo sugeridos pela IA filtrados pela taxonomia; formulário remove sozinho qualquer código fora da lista e mantém as ocasiões ainda permitidas ao trocar de categoria; campos marcados como obrigatórios e conferidos antes de ir ao servidor; backend normaliza espaços/maiúsculas/repetidos. |
| 2 | A IA não preenchia a marca | (a) O catálogo de IA registrava o Claude como `"anthropic"`, mas o adaptador se registra como `"claude"`: **nenhuma** capacidade chegava a chamar o Claude. (b) O parser da resposta lançava `NullPointerException` com `material`/`sexo` nulos (`List.of(...).contains(null)`), e a resposta inteira era tratada como falha → motor local, que não lê marca. (c) A IA recebia uma única foto reduzida a 768 px, onde etiqueta de gola e logo de peito somem. | Id do provedor corrigido; parser à prova de campos nulos; a marca é procurada em **quatro zonas** recortadas e ampliadas (512 px) da foto em alta resolução: **fundo da gola, peito esquerdo, peito direito e centro do peito** (zonas equivalentes em calça, calçado e acessório). O prompt numera cada imagem; a resposta diz em que zona a marca foi lida e o que foi lido. Sem IA, o detector local aponta em que zona está o logo e a tela pede para digitar/buscar o nome. |
| 3 | Imagens não saíam no padrão | O estúdio escolhia a proporção pela peça (9:16, 2:3, 4:5, 5:4), mas o card é quadrado com `object-fit: cover`: calça e vestido eram cortados. Além disso, bainha e cós retos eram "deduzidos" como corte e a peça ficava rente à borda. | Padrão único: **quadro quadrado 1:1** (o do card), peça inteira centralizada, margens iguais. O corte deduzido pela forma só vale para peça sem o dado da foto; a foto aceita (inteira) sai com margem em volta. |
| 4 | O pipeline não filtrava as fotos | A nota de qualidade era só informativa; nada era recusado (nem "não é roupa"). | **Critérios de aceite** antes de qualquer IA paga, e a foto fora deles é recusada (422 `FOTO_RECUSADA`) com a orientação de como refazer. |

## Fluxo novo do criador

1. A pessoa escolhe o **tipo** (parte de cima, parte de baixo, calçado, acessório). O botão "Enviar foto" só libera depois.
2. A foto passa pelos critérios locais (tabela abaixo) num passe **só local** — sem remove.bg/rembg e sem consumir a
   cota diária. Reprovou → a tela mostra "Foto recusada" e o que refazer; só a foto aceita segue para a padronização
   externa (paga) e para a IA.
3. O **subtipo** é detectado comparando a foto com as imagens de referência dos subtipos **daquele tipo**
   (`/public/assets_pecas`): similaridade de silhueta (Jaccard da grade 32×32 + proporção + perfis + solidez, com
   espelho) e, com IA, uma **folha de contato numerada** das referências enviada junto com a foto. A tela mostra
   "Subtipo detectado: … (N% de semelhança)" e os parecidos para trocar num clique.
4. A **marca** é procurada nas quatro zonas; a tela diz onde foi lida (ou onde há logo sem nome legível, ou que nada foi achado).
5. Com IA, entram mais três critérios: a foto é do tipo escolhido, a peça está inteira e de frente.
6. Trocar o tipo depois do envio — com a análise pronta, recusada **ou ainda em curso** — refaz a análise com a mesma
   foto. O pedido anterior é abortado e, se a resposta dele chegar mesmo assim, é ignorada (só vale o pedido mais
   recente); o rascunho da análise anterior sai do formulário.

## Critérios de aceite da foto (`PhotoAcceptance`)

| Critério | Regra | Limite |
|----------|-------|--------|
| `fundo` | a peça se separa do fundo (recorte confiável) | confiança ≥ 0,45 |
| `inteira` | nenhum lado da peça encosta na borda da foto (sem cortes) | 0 lados |
| `enquadramento` | a caixa da peça ocupa parte razoável da foto | ≥ 6% da foto |
| `resolucao` | lado menor da peça na foto original | ≥ 240 px |
| `peca_unica` | pedaços separados com ≥ 10% da área | 1 (parte de cima/baixo); 2 (calçado, acessório, peça única — pares) |
| `alinhamento` | peça reta: com eixo comprido o pipeline endireita até 25°; sem eixo comprido (camiseta), vale o eixo de simetria | < 25° / < 10° |
| `frontal` | câmera a 90°: roupa de frente é simétrica (maior simetria esquerda × direita girando −20°…20°) | ≥ 0,78 |
| `nitidez` | variância do laplaciano normalizada | ≥ 0,05 |
| `exposicao` | parte da peça sem detalhe (preto puro/branco estourado) — medida na peça, não no fundo | ≤ 50% |
| `formato` | com IA: a foto é do tipo escolhido (reprova com confiança ≥ 0,7); sem IA: parece alguma referência do tipo (≥ 0,55) e nenhuma outra categoria é ≥ 0,10 mais parecida | — |
| `inteira_ia`, `frontal_ia`, `peca_unica_ia` | o que a IA viu na foto (cortada, em ângulo/de lado/dobrada, várias peças). "Não é peça única" reprova em **qualquer** categoria: o par (tênis, brincos, luvas) já conta como uma peça, então é item diferente (duas bolsas, pés trocados, dois vestidos) | confiança ≥ 0,7 |
| `conteudo` | moderação: não é roupa / viola a política | — |

Calibração (fotos montadas com as artes de referência, `PhotoAcceptanceTest`): peça inteira de frente é aceita nas
quatro categorias; cortada na borda, minúscula, girada 16° (camiseta) ou 40° (calça), tremida e duas peças são
recusadas; câmera girada com o lado distante a 40% da altura do próximo é recusada. **Limite honesto:** ângulo leve
(lado distante com ~77% da altura) ainda passa na silhueta — quem pega é a avaliação da IA (`viewAngle`). E sem IA a
silhueta separa bem formas diferentes (calça × saia × regata), mas não subtipos quase iguais (camiseta × polo): aí
vale o palpite mais parecido, que a pessoa confere.

## Evidências

- Testes novos (backend): `PhotoAcceptanceTest` (11), `SubtypeAndBrandZonesTest` (5), `WardrobeAnalysisTest` (9, inclui
  a regressão "todo subtipo da taxonomia passa na validação do cadastro" e o parser com campos nulos),
  `WardrobeAnalyzeFlowTest` (3: análise inteira com IA simulada — 6 imagens na ordem certa, marca lida no peito esquerdo
  chegando ao formulário, recusa quando a IA diz que não é o tipo escolhido ou vê a peça cortada),
  `ProviderHelpersTest.catalogUsesTheIdsTheAdaptersRegisterWith`. Frontend: `lib/pieces/tags.test.ts` (5).
- Suíte completa do backend (`mvn install`) e do frontend (`vitest`, `tsc`, `i18n:check`, `i18n:scan`) verdes.
- Verificação no navegador (Playwright) com backend + MySQL 8 locais, sem chave de IA (motor local):
  `img/criador-pecas-2026-09-27/` — `01` tipo antes da foto (envio bloqueado), `02` foto recusada (pessoa com a camisa
  cortada), `03` foto aceita com subtipo e zona do logo, `04` dados com ocasião/estilo válidos, `05`–`06` revisar e
  salvar (201, estúdio quadrado), `07` sem foto: ocasião/estilo vazios apontados no campo sem ida ao servidor, `08` salvo
  depois de escolher (201).
- E2E da API (`scripts/e2e/suite_1.py`): a análise usa `fixtures/peca_camiseta.jpg` (peça inteira, fundo liso) com
  `category=upper_piece`, e há um passo que espera 422 para a foto de pessoa cortada.

## Revisão do PR #26 (27/09)

| Ponto | Correção | Evidência |
|-------|----------|-----------|
| Aceite rodava depois do flat-lay pago (remove.bg + cota) | `analyze` faz um passe local, aplica `PhotoAcceptance` e só então chama `FLAT_LAY_STANDARDIZER`, reaproveitando o passe local como fallback | `WardrobeAnalyzeFlowTest.fotoRecusadaNaoChegaAoFlatLayPagoNemAIa` (nenhuma chamada ao flat-lay nem à IA) |
| Várias peças vistas pela IA passavam em calçado/acessório/peça única | `aiPhotoChecks` reprova `singlePiece: false` confiante em todas as categorias, com mensagem própria | `PhotoAcceptanceTest.avaliacaoDaIaSoReprovaComConfiancaAlta` (5 categorias) |
| Troca de tipo com a análise em curso não refazia; resposta antiga sobrescrevia | sequência de pedidos + `AbortController`; o tipo vem sempre do mais recente | Playwright: 1ª análise (tipo errado) em voo → troca de tipo → 1º pedido `ERR_ABORTED`, tela e formulário ficam "Parte superior / Camiseta", sem recusa (`img/criador-pecas-2026-09-27/09-troca-de-tipo-no-meio.png`) |

## Observações

- A leitura do **nome** da marca exige a IA de visão (Gemini ou Claude com chave e consentimento de processamento de
  foto). Com o id do Claude corrigido, ele passa a ser a alternativa do Gemini na análise da peça — e também passa a
  ser chamado nas outras capacidades em que o catálogo já o listava (composição de looks, DNA…), quando
  `ANTHROPIC_API_KEY` estiver configurada.
- Fotos de estúdio antigas não são refeitas sozinhas; o estúdio da peça (`POST /api/pieces/{id}/studio`) ou de todas
  as peças (`POST /api/me/pieces/studio`) gera de novo no padrão quadrado.
- `scripts/i18n/scan.js` passou a ignorar `*.test.ts(x)`: o texto de um teste do avatar (`garment.test.ts`) fazia o
  `prebuild` falhar.
