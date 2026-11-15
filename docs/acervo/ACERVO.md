# ACERVO — o guarda-roupa como um espaço navegável

Primeira versão funcional. Rota `/acervo`, no menu Guarda-roupa. Tudo aqui é privado da dona das peças: nada vai para o
feed, e a API só responde a quem é dona (o que é de outra pessoa responde "não encontrado").

## 1. O conceito, nas palavras da dona

> ACERVO — seu guarda-roupa como um espaço navegável.
>
> O conceito combina marcenaria realista, interface em marfim e grafite e destaques em verde elétrico. Duas views
> conectadas permitem organizar o inventário e explorar o móvel.
>
> **1. Central do acervo.** O diretório lateral organiza ambientes → armários → cabideiros, prateleiras e gavetas. Ao
> selecionar um compartimento, aparecem suas peças; ao clicar no mapa do closet, a segunda view abre naquele local.
> Cada peça reúne foto, tamanho, medidas, cor, marca, preço, conservação e localização. O painel financeiro mostra o
> valor total e o subtotal da seleção. Acervo comprado e lista de desejos ficam separados, com indicação de preços
> estimados.
>
> **2. Meu espaço.** Uma composição em perspectiva, dentro de uma interface 2D, apresenta móveis e roupas renderizados
> a partir de modelos GLB 3D. O usuário configura dimensões, quantidade de armários e gavetas, materiais, cores, portas
> e puxadores. Clicar numa gaveta abre seu conteúdo; selecionar uma peça revela sua ficha. Arrastar uma peça entre
> compartimentos atualiza sua localização. Dois modos de criação: **Meu espaço** reproduz o guarda-roupa físico, com
> medidas e organização reais; **Dream Space** permite imaginar módulos suspensos, superfícies translúcidas,
> iluminação integrada e um closet expansível, com orçamento das peças desejadas.
>
> **Ideias para diferenciar a experiência:** Raio-X do closet, Busca espacial, Gaveta expandida, Modo arrumação, Mapa
> de uso, Looks vinculados e Simulação de compra.
>
> A imagem é uma proposta visual; os valores são ilustrativos. As interações e os modelos GLB ainda precisam ser
> implementados.

A imagem de referência não está no repositório. Nenhum número dela foi copiado: tudo o que a tela mostra vem dos dados
da pessoa.

## 2. Modelo de dados (migration `V102__acervo.sql`)

| Tabela | O que guarda |
|---|---|
| `acervo_ambientes` | Ambiente da casa (closet, quarto): nome e ordem. |
| `acervo_moveis` | Armário ou módulo de um ambiente, com a configuração: modo (`MEU_ESPACO` ou `DREAM_SPACE`), largura, altura e profundidade em cm, material, cor, porta, puxador e acabamento do puxador. |
| `acervo_compartimentos` | Cabideiro, prateleira ou gaveta de um móvel, com nome e ordem. |
| `acervo_pecas` | Uma linha por peça do guarda-roupa: o compartimento onde ela está (vazio = "sem lugar") e as medidas que a dona anotou (largura, comprimento e uma nota). |
| `acervo_desejos` | Lista de desejos: nome, categoria, cor, tamanho, marca, preço estimado, moeda e o compartimento onde a peça entraria na simulação de compra. Não tem ligação com as peças compradas. |

Regras que o banco garante: cada peça tem no máximo um lugar (`UNIQUE piece_id`); apagar um compartimento não apaga
peça nem desejo (`ON DELETE SET NULL`); apagar a peça ou a conta leva junto o que é dela. A quantidade de gavetas,
prateleiras e cabideiros de um móvel é a quantidade de compartimentos de cada tipo (não há contador separado).

A migration não foi rodada num banco neste ambiente. Ela é conferida por `MigrationV102AcervoTest` (colunas que as
entidades mapeiam e chaves estrangeiras) e por `MigrationVersionsTest` (número de versão sem repetição).

Código: entidades em `fai-domain/.../model/acervo`, repositórios em `fai-domain/.../repository/acervo`, serviços em
`fai-application/.../acervo`, controllers `AcervoController` e `AcervoPecasController` em `fai-web`.

## 3. API (`/api/me/acervo`, só para a dona)

| Rota | O que faz |
|---|---|
| `GET /api/me/acervo` | Árvore inteira (ambientes → móveis → compartimentos, com contagem de peças), a ficha de cada peça e quantas estão sem lugar. |
| `POST /ambientes`, `PUT /ambientes/{id}`, `DELETE /ambientes/{id}`, `PUT /ambientes/ordem` | Criar, renomear, apagar e reordenar ambientes. |
| `POST /ambientes/{id}/moveis`, `PUT /moveis/{id}`, `DELETE /moveis/{id}`, `PUT /ambientes/{id}/moveis/ordem` | Criar, configurar (nome, medidas, material, cor, porta, puxador, quantidades), apagar e reordenar móveis. |
| `POST /moveis/{id}/compartimentos`, `PUT /compartimentos/{id}`, `DELETE /compartimentos/{id}`, `PUT /moveis/{id}/compartimentos/ordem` | Criar, renomear, apagar e reordenar compartimentos. |
| `POST /pecas/mover` | Move uma ou várias peças para um compartimento (ou para "sem lugar"). Se alguma peça não é da pessoa, nada é movido. |
| `PUT /pecas/{id}/medidas` | Anota as medidas da peça. |
| `POST /arrumacao/previa` | Modo arrumação: devolve a proposta (lugar atual, lugar proposto e o motivo) **sem gravar**. |
| `POST /arrumacao/confirmar` | Grava os movimentos que a pessoa confirmou. |
| `GET /financeiro?pecas=id,id` | Valor do acervo, por grupo, subtotal da seleção, lista de desejos (marcada como estimada), peças sem preço e custo por uso. |
| `GET /busca?q=` | Busca espacial: peças que batem com o texto e os compartimentos onde estão. |
| `GET /uso?dias=` | Mapa de uso: peças esquecidas, nunca usadas e sem look, por compartimento. |
| `GET /pecas/{id}/looks` | Looks da pessoa que usam a peça e onde está cada item. |
| `GET/POST /desejos`, `PUT/DELETE /desejos/{id}` | Lista de desejos. |

Regras de negócio que valem a pena saber:

- **Financeiro.** Só entra na soma a peça com preço. Peça sem preço é contada à parte e a tela diz quantas são. Os
  totais saem na moeda mais usada nas peças; preço em outra moeda não é convertido, só contado. O custo por uso é o
  preço das peças já usadas dividido pelas vezes em que foram usadas, e só aparece quando há uso registrado. Não há
  comparação com "média estimada": o app não tem esse dado.
- **Busca.** Cada palavra precisa bater com o nome, a marca, a categoria, o tipo, a cor ou o tamanho. Tipo, categoria e
  cor são comparados pelos nomes da taxonomia em português, inglês e espanhol, sem acento e sem a terminação
  ("branca" = "branco"). Palavra de até três letras ou número só vale como tamanho.
- **Arrumação.** O tipo de compartimento vem do tipo da peça (pendurar, dobrar, guardar em gaveta). Entre os
  compartimentos desse tipo ganha o que já tem mais peças iguais e, no empate, o mais vazio. Só entram móveis do modo
  "Meu espaço". A confirmação recebe os movimentos de volta e valida cada um de novo.
- **Em uso.** Peça usada nos últimos 30 dias (data do último uso que o app já guarda).
- **Limites.** 12 ambientes, 12 móveis por ambiente, 8 compartimentos de cada tipo por móvel, 200 desejos.

## 4. As duas views

### 4.1 Central do acervo

- Diretório lateral: "Todas as peças", "Sem lugar", depois Meu espaço e Dream Space → ambientes → móveis →
  compartimentos, com contagem. No celular o diretório abre por um botão.
- Filtros Todas, Favoritas e Em uso; ordenação; grade ou lista.
- Cartão da peça: foto, nome, preço, estrela da favorita e o botão que marca a peça para o subtotal. A peça marcada
  ganha um número, e o mesmo número aparece no compartimento dela no mapa e na cena.
- Mapa do closet: esquema de frente dos móveis. Clicar num compartimento abre "Meu espaço" naquele lugar.
- Painel financeiro: valor do acervo, grupos (Roupas, Calçados, Acessórios, Outros), subtotal da seleção, lista de
  desejos com o selo "Estimado", custo por uso (quando existe) e "Completar meu closet", que leva à lista de desejos.
- Abas "Acervo comprado" e "Lista de desejos", sempre separadas.
- Primeiro acesso: um botão cria o primeiro ambiente e o primeiro armário; depois a lista "Sem lugar" mostra as peças
  que já estavam no guarda-roupa.

### 4.2 Meu espaço

- Cena 3D (react-three-fiber) com os móveis lado a lado, feitos de geometria procedural a partir da configuração:
  carcaça, divisória, prateleiras, cabideiro, gavetas, portas, puxadores e luz embutida; materiais de madeira (com
  veio), laca, vidro e metal. As peças aparecem como formas coloridas: penduradas, dobradas em pilhas ou em fileiras
  na gaveta.
- Barra da cena: Frontal, Perspectiva, Abrir gavetas e Raio-X.
- Painel de configuração: medidas, quantidade de cabideiros, prateleiras e gavetas, material, cor, porta, puxador e
  acabamento. Cada mudança é gravada e a cena se refaz.
- Clicar num compartimento abre o conteúdo dele ampliado (a "gaveta expandida"); a gaveta escolhida sai do móvel.
- Mover peça: arrastar e soltar (do cartão, da gaveta expandida ou da bandeja "sem lugar" para um compartimento da
  cena, do mapa ou do diretório; e segurar uma peça dentro da cena 3D e soltar em outro compartimento) **ou** o menu
  "Mover para…" da ficha, que funciona por teclado e toque. Os dois caminhos gravam pela API.
- Modos: "Meu espaço" (medidas reais) e "Dream Space" (módulos suspensos, vidro, luz fria embutida, aro de luz no chão,
  botão "Adicionar módulo" e o orçamento estimado dos desejos).
- Sem WebGL (ou se a cena falhar): esquema 2D com as mesmas interações.
- "Reduzir movimento": gaveta e câmera mudam direto, sem animação.

### 4.3 O que é diferente da imagem de referência

A imagem mostra um render fotográfico. Aqui os móveis são procedurais: caixas e cilindros com textura desenhada. A
composição segue a imagem (dois módulos em nogueira, vãos abertos, destaque em verde, gaveta à frente), mas não há
bolsas, caixas, sapatos modelados, tecido com dobras nem a luz quente de fotografia. As roupas são blocos coloridos pela
cor da peça, não fotos nem modelos. O cartão "Dream Space — Conceito" da imagem é uma ilustração; aqui o Dream Space é
a própria cena no outro modo. O sino e o perfil no topo são os do app. O chip de comparação do custo por uso não existe.

## 5. Diferenciais

| Diferencial | Situação | Como funciona |
|---|---|---|
| Raio-X | feito | Botão na barra da cena: as portas e as frentes das gavetas ficam quase transparentes (3D) ou as portas somem do esquema (2D). Sem porta e sem gaveta nos móveis da cena, o botão não aparece. |
| Busca espacial | feito | A caixa de busca acende os compartimentos no diretório, no mapa e na cena, e lista as peças achadas. |
| Gaveta expandida | feito | O compartimento escolhido abre num painel ampliado à frente do móvel; no 3D a gaveta também sai do móvel. |
| Modo arrumação | feito | "Arrumar" mostra lugar atual e proposto lado a lado; dá para tirar itens; só a confirmação grava. A proposta é por regra simples (não é IA). |
| Simulação de compra | feito | Um desejo com lugar escolhido entra como peça-fantasma no compartimento e o painel mostra gasto estimado e acervo depois da compra. Nada é gravado. |
| Mapa de uso | parcial | Marca peças paradas (sem uso há mais de 180 dias ou nunca usadas) e os compartimentos que as guardam. A API já diz quais peças não estão em nenhum look, mas a tela ainda não mostra "combinações pouco exploradas". |
| Looks vinculados | feito | A ficha lista os looks que usam a peça e onde está cada item; o lugar é um atalho para "Meu espaço". |

Pendente desta versão: girar a câmera livremente; fotos das peças dentro da cena 3D; reordenar pelo arrasto no
diretório (a API de ordem existe, a tela ainda não usa); criar módulo Dream Space pelo menu do diretório (hoje é pelo
botão "Adicionar módulo"); medição de fluidez em máquina com placa de vídeo.

## 6. Modelos GLB

Não existe nenhum GLB de marcenaria nem de roupa para o ACERVO, e nada finge que existe. O código já tem o encaixe:
`lib/acervo/cena/assets.ts` lê `public/acervo/3d/manifest.json` (o mesmo formato dos objetos das salas do FLAIR 3D) e
`components/acervo/espaco/glb-encaixe.tsx` troca a forma procedural pelo GLB quando o manifesto traz um arquivo para o
encaixe. Encaixes aceitos hoje: `roupa-pendurada`, `roupa-dobrada` e `calcado`. Os de puxador (`puxador-barra`,
`puxador-botao`, `puxador-cava`) estão declarados, mas o móvel ainda desenha o puxador procedural direto; ligar esse
encaixe e criar encaixes para carcaça, porta e gaveta fica para quando os modelos existirem.

O que falta produzir: roupas (pendurada, dobrada, calçado, bolsa), puxadores, e os móveis em si se a ideia for trocar
a marcenaria procedural inteira.

## 7. Passaporte, Editor 3D e Tamanhos dentro do ACERVO

A ficha da peça tem quatro abas: Ficha, Passaporte, Editor 3D e Tamanhos. O ACERVO **não duplica** essas três
funcionalidades: elas já existiam no app e a ficha as reusa.

- **Passaporte** mostra o passaporte digital da peça (`DigitalPassportSheet`, `GET /api/pieces/{id}/digital-passport`)
  e leva à página inteira e à declaração de composição e cuidados.
- **Editor 3D** mostra a situação do modelo (`GET /api/pieces/{id}/customization`) e abre o editor da peça
  (`/pieces/{id}/editor-3d`).
- **Tamanhos** mostra os tamanhos da peça com disponibilidade, medidas e representação 3D (mesmos dados do passaporte).
  Escolher um tamanho aqui é consulta; a escolha que fica salva é a do provador.

Procedência usada pelo app: `VERIFIED` (verificado), `SOURCE_DECLARED` (declarado pela fonte), `OWNER_DECLARED`
(declarado pelo proprietário), `ESTIMATED` (estimado) e `NOT_INFORMED` (não informado).

Nada foi alterado no código do provador.

### 7.1 Passaporte digital da peça

| # | Critério | Situação | Teste |
|---|---|---|---|
| 1 | Abrir o passaporte a partir da peça | atendido | `peca-ficha-abas.test.tsx` (aba Passaporte) |
| 2 | Dados da peça com identificador estável | atendido | `DigitalPassportServiceTest.sheetHasStableIdentifierProvenanceAndNotInformedMarkers`; `peca-ficha-abas.test.tsx` |
| 3 | Campo sem dado aparece como "Não informado" | atendido | os dois acima; `digital-passport.test.tsx` |
| 4 | Estimativas identificadas, inclusive tamanhos e medidas vindos do 3D | atendido | `DigitalPassportServiceTest.sizesDistinguish…`; `peca-ficha-abas.test.tsx` (rótulos "estimado" e "Aproximação visual") |
| 5 | Acesso ao endereço da fonte original | atendido | `digital-passport.test.tsx`; `peca-ficha-abas.test.tsx` |
| 6 | Ver o modelo 3D quando disponível e autorizado | parcial | `peca-ficha-abas.test.tsx` confere o botão "Ver modelo 3D" e que ele abre o visualizador; o modelo desenhado não foi conferido em teste nem em tela (não há GLB de peça neste ambiente) |
| 7 | Modelo em quarentena não aparece como aprovado para o provador | atendido | `DigitalPassportServiceTest` (primeiro e terceiro testes); `peca-ficha-abas.test.tsx` |
| 8 | Alteração autorizada aparece no passaporte e muda a data | atendido | `DigitalPassportServiceTest.ownerDeclarationsUpdateTheSheetAndViewersSeeOnlyWhatVisibilityAllows` |
| 9 | Quem não pode editar só consulta o que tem acesso | atendido | o mesmo teste (visitante vê menos; sem acesso, 404) |

### 7.2 Editor 3D da peça

| # | Critério | Situação | Teste |
|---|---|---|---|
| 1 | Carrega o modelo ou mostra mensagem clara na falha | atendido | `piece-editor.test.tsx` (dois testes); `peca-ficha-abas.test.tsx` (peça sem modelo) |
| 2 | Frente, costas e laterais pelos controles de câmera | atendido | `piece-editor-toolbar.test.tsx` (lista de vistas); a vista desenhada não foi conferida em tela |
| 3 | Controles correspondem ao que o modelo suporta | atendido | `piece-editor-toolbar.test.tsx` |
| 4 | Cor e material aparecem na visualização durante a edição | parcial | o painel e o viewport são os do Atelier (`scene-inspector.test.tsx`, `lib/atelier3d/document.test.ts`); não há teste nem conferência em tela com o GLB de uma peça |
| 5 | Posição, rotação e escala não mudam o arquivo original | atendido | `PieceCustomizationServiceTest.onlyTheOwnerSavesAndTheOriginalModelAndPassportDataStayUntouched` |
| 6 | Desfazer e refazer na sessão | atendido | `lib/atelier3d/history.test.ts`; `piece-editor.test.tsx` (botões) |
| 7 | Restaurar com confirmação quando há alterações | atendido | `piece-editor.test.tsx` |
| 8 | Salvar cria ou atualiza a personalização ligada à peça | atendido | `PieceCustomizationServiceTest` (primeiro teste); `piece-editor.test.tsx` |
| 9 | Reabrir recupera o que foi salvo | atendido | `PieceCustomizationServiceTest` (primeiro teste, trecho `reopened`) |
| 10 | Sem autorização não altera personalização alheia nem o original | atendido | `PieceCustomizationServiceTest` (403 para outra pessoa; visitante só visualiza) |
| 11 | Escala é ajuste visual, não medida nem tamanho | atendido | `PieceCustomizationServiceTest`; `piece-editor.test.tsx`; `peca-ficha-abas.test.tsx` (selo "Ajuste visual") |
| 12 | Modelo bloqueado ou em quarentena não vira asset aprovado | parcial | `PieceCustomizationServiceTest.quarantinedAssetsAreNeverPresentedAsApproved…` e `peca-ficha-abas.test.tsx`: o modelo em quarentena nunca aparece como aprovado e modelo com falha não é editável. Porém o modelo em quarentena continua podendo ser personalizado pela dona (com o aviso); se a regra for bloquear a edição, falta mudar `PieceCustomizationService` |

### 7.3 Seleção e representação do tamanho

| # | Critério | Situação | Teste |
|---|---|---|---|
| 1 | Ver os tamanhos disponíveis da peça | atendido | `peca-ficha-abas.test.tsx` (aba Tamanhos) |
| 2 | Tamanho indisponível não pode ser escolhido | atendido | `peca-ficha-abas.test.tsx`; `size-picker.test.tsx` |
| 3 | No provador, o tamanho com 3D atualiza a peça e indica o tamanho | parcial | `size-picker.test.tsx` cobre a escolha e a indicação; a peça mudando no avatar do provador não foi conferida aqui |
| 4 | Tamanho sem 3D: avisa e não troca por outro | atendido | `peca-ficha-abas.test.tsx`; `size-picker.test.tsx` |
| 5 | Medidas com valor, unidade e origem | atendido | `DigitalPassportServiceTest.sizesDistinguish…`; `peca-ficha-abas.test.tsx` |
| 6 | Diferencia medida oficial, outro método e estimada | parcial | medida oficial tem rótulo e teste (`digital-passport.test.tsx`, `peca-ficha-abas.test.tsx`, serviço); "outro método" tem rótulo, mas nenhum teste com esse caso; medida estimada não existe como valor: o que é estimado é a variação visual, sempre rotulada |
| 7 | Variação por escala identificada como aproximação | atendido | `peca-ficha-abas.test.tsx`; `size-picker.test.tsx` |
| 8 | Escolher tamanho não altera as medidas do avatar | atendido | `DigitalPassportServiceTest` (`avatarMeasurementsChanged = false`); textos em `peca-ficha-abas.test.tsx` e `size-picker.test.tsx` |
| 9 | Tamanho salvo com a composição do provador e recuperado | parcial | `size-picker.test.tsx` ("keeps saved sizes…") cobre a recuperação; salvar e reabrir a composição inteira no provador não foi conferido aqui |
| 10 | Opção salva que ficou indisponível: avisa e pede nova escolha | atendido | `size-picker.test.tsx` (`validateSavedSizes`) |
| 11 | Não afirma caimento | atendido | `DigitalPassportServiceTest` (`fitClaim = NONE`); `peca-ficha-abas.test.tsx` |
| 12 | Variantes P/M/G/GG dos GLBs do lote ditas como aproximação relativa | atendido | `DigitalPassportServiceTest` (`RELATIVE_VISUAL_APPROXIMATION`); `peca-ficha-abas.test.tsx` (texto da limitação) |

## 8. Visual, acessibilidade e idiomas

- Cores só desta área (`.acv`, em `app/(site)/_styles/40-acervo-base.css`): marfim, grafite, verde elétrico e tons de
  madeira, com versões para tema escuro e alto contraste. A cena 3D é uma sala iluminada e não muda com o tema.
- O layout segue a largura da área do ACERVO (não a da janela): três colunas a partir de 880 px, uma coluna abaixo.
- Tudo é alcançável por teclado; botões têm nome; estados usam `aria-pressed`, `aria-current` e `role="status"`.
- Textos em pt-BR, en e es com as mesmas chaves, todas com o prefixo `acervo.` (mais `nav.acervo`). Mensagens de erro
  do servidor também nos três idiomas (`acervo.*` em `messages*.properties`).
- Preços no formato da moeda do idioma, com duas casas.

## 9. Como testar

```
npx vitest run lib/acervo components/acervo components/piece3d components/passport
/opt/maven/bin/mvn -o -q -Djacoco.skip=true -pl fai-application,fai-infrastructure/persistence-mysql,fai-web -am test \
  -Dtest='Acervo*Test,Migration*Test' -Dsurefire.failIfNoSpecifiedTests=false
npx tsc --noEmit && node scripts/i18n/check.js --fail && node scripts/i18n/scan.js --fail && npm run lint:styles
python -m scripts.refactoring.line_ratchet
```

Para ver na tela com o app e o banco locais: aplicar a V102 (o Flyway aplica ao subir a API local), abrir `/acervo`,
criar o primeiro armário, guardar peças pela lista "Sem lugar" e abrir "Meu espaço".

### O que foi conferido e como

- **Por teste automático:** serviços e controllers do ACERVO, a migration (texto do SQL), as libs, as duas views no
  jsdom (com o esquema 2D) e a cena 3D no renderizador de teste (partes do móvel, peças, Raio-X, gaveta aberta).
- **Visto renderizado:** as duas views em 1440×900 e 390×844, a gaveta expandida, a vista frontal com busca, o Dream
  Space com peça-fantasma e as abas da ficha, num navegador sem placa de vídeo (renderização por software), com o Next
  local numa porta própria e a API simulada por interceptação. Não foi usado banco nem a API de verdade.
- **Não conferido:** a API rodando contra um MySQL; arrastar e soltar com mouse de verdade dentro da cena 3D; temas
  escuro e alto contraste em tela; fluidez do 3D ("não medida": o ambiente não tem placa de vídeo).

Padrão GoF: nenhum. A estrutura é serviço + regras puras + projeções, como o resto do app; não houve problema que
pedisse um padrão.
