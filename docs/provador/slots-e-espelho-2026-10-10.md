# Provador: linhas dos slots sem legenda miúda · Espelho conectado ao Meu Quarto e ao Provador (10/10/2026)

## Linha do slot em "Provando agora" (`components/try-on/fitting-items.tsx`)

Antes: "Prévia 2D disponível; modelo 3D da peça ainda não gerado" em legenda miúda, "Ver em loja" e "Já tenho esta
peça" como links sublinhados pequenos, lugar vazio com uma frase apagada. Agora **nenhum texto pequeno e solto** na
linha: tudo em corpo normal **com ícone**, ou **dentro de um botão**.

| Elemento | Agora |
|---|---|
| Marca, origem (Loja / Meu guarda-roupa), nome · cor | corpo normal, logo da marca a 20 px |
| Estado da peça no 3D (`GarmentState`) | ícone + selo (Prova 3D aprovada / Prévia estimada / Carregando / Sem 3D / Erro) + motivo em corpo normal; limitações da subcategoria também com ícone |
| Modelo 3D (`Model3dRow`, RF16 via `useModel3d`) | ícone + texto do estado e **barra de progresso** (`role=progressbar`: porcentagem só quando o provedor informa — `progressReal`; na fila/gerando sem número a barra anda sozinha; pronto = 100 %; não gerado = 0 %) + botão **Gerar modelo 3D** / **Gerar novamente o 3D** (pronto ou falhou). Peça da loja ainda fora do guarda-roupa: **Guardar a peça e gerar o 3D** (guarda por referência e, com o id da peça, pede o job sozinho). Enquanto o job anda só a barra aparece |
| Prévia 2D | botão **Ver prévia 2D no espelho**: abre um diálogo com o `MirrorStage` em modo 2D (o mesmo avatar de frente e parado, com o look inteiro do provador) e o atalho para a aba Espelho |
| Loja / guarda-roupa | **Ver em {domínio}** (link-botão com ícone), **Já tenho esta peça** / **No seu guarda-roupa**, **Revisar peça e modelo 3D** |
| Remover | botão com ícone (nome acessível "Remover {peça} de {lugar}") |
| Lugar vazio | "Lugar vazio" com ícone + **Escolher nas lojas** (vai à aba Lojas com a categoria do lugar) e **Escolher no guarda-roupa** |

## Aba Espelho (`components/mirror/mirror-controls.tsx`)

- **Partes do look** no mesmo formato do provador: nome do lugar, miniatura, nome em corpo normal, **estado do asset** com
  o vocabulário do Meu Quarto (`assetStateOf`: Modelo 3D · Molde 3D (aproximação) · Só na prévia 2D · Foto em
  processamento), o endereço no quarto e o botão **Provar no provador** (`/try-on?provar=w.<id>`); lugar vazio com ícone.
- **Vista-me** ganha a frase de conexão com ícones: o look vestido aqui é o mesmo do espelho do Meu Quarto e da prévia 2D
  do Provador — um estado só (o do servidor), mudou num lugar, mudou nos três.
- Rodapé: **Ver no Meu Quarto** e **Provador** (fora do modo embutido no quarto, que já está lá).

## Evidências (API simulada, Chromium headless)

`docs/evidencias/provador-slots-2026-10-10/`: `01-slots-desktop|mobile` (3D falhou: barra vazia + "Gerar novamente o
3D"; peça da loja: "Guardar a peça e gerar o 3D"), `02-slots-gerando-*` (após o clique: "Gerando o modelo 3D… 42 %" com
a barra, sem botão), `03-previa-2d-*` (diálogo da prévia 2D), `espelho-partes-desktop|mobile` (aba Espelho). Nas capturas
não há nenhum `.type-caption` dentro das linhas dos slots (contado no script).

## Testes

`components/try-on/fitting-items.test.tsx` (prévia 2D é botão; loja/guarda-roupa/remover são botões ou links com ícone e
nenhuma legenda miúda; barra de progresso + Gerar novamente → `POST /api/pieces/{id}/model3d`; peça da loja guarda e
gera; lugar vazio com as duas ações), `components/catalog/fitting-room.test.tsx` (fluxos existentes continuam),
`components/mirror/mirror-controls.test.tsx` (estado do asset e link para o provador).
