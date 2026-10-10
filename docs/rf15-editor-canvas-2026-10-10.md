# RF15 · Editor de imagem da peça e do look (10/10/2026)

> Especificação: [`docs/novos-rf/RF15_Editor_Fotografia_Pecas.md`](novos-rf/RF15_Editor_Fotografia_Pecas.md) ·
> Evidências: [`docs/evidencias/rf15-editor-2026-10-10/`](evidencias/rf15-editor-2026-10-10/)

O pedido era um editor no estilo do app Fotos da Apple, aberto por "Editar imagem" na peça e no look, com barra
superior (Cancelar, Desfazer, Refazer, Comparar, Salvar), ferramentas Ajustar, Recortar, Recorte da peça,
Apresentação e Revisão, regras de fidelidade, edição não destrutiva e diferença clara entre peça e look.

## 1. Diagnóstico: pedido × antes × agora

| Pedido | Antes (06/10) | Agora | Onde |
|---|---|---|---|
| Entrada "Editar imagem" | peça: diálogo com "Ajustar manual"; look: não havia | peça: igual; look: botão "Editar imagem" no card ampliado do dono | `expanded-card.tsx`, `/schemes/[id]/photo` |
| Barra superior | passos em lista, sem barra | Cancelar (pede confirmação se houver mudança), Desfazer, Refazer, Comparar (segurar ou alternar no teclado), Salvar; no celular, Cancelar e Salvar ficam na mesma linha | `piece-photo-editor.tsx`, `look-composition-editor.tsx`, `globals.css` |
| Ajustar: luz, cor, detalhe | exposição, realces, sombras, contraste, saturação, balanço de branco, nitidez | igual, agrupado em Luz, Cor, Níveis, Detalhe, Filtros | `PhotoRecipeRenderer.tone/whiteBalance/sharpen` |
| Curvas/níveis "se reais" | não havia | **níveis** reais (ponto preto, ponto branco, gama) com tabela de 256 entradas; curvas livres não foram feitas | `PhotoRecipe.Levels`, `PhotoRecipeRenderer.levels` |
| Filtros | quente, frio, P&B, vintage na apresentação | iguais, só na versão de apresentação | `RecipePolicy` |
| Recortar: livre e proporções | quadro 4:5 fixo | Livre, 4:5, 1:1, 3:4, 16:9 na apresentação; a foto da peça continua 4:5 | `lib/photo-edit/recipe.ts` |
| Rotação, endireitar | giro 90° e ±15° | iguais; setas movem o quadro, + e − mudam o tamanho | `piece-photo-editor.tsx` |
| Espelhar com alerta de texto/logo | não havia | espelhar com aviso; na foto da peça o servidor recusa se achar texto ou logo (OCR local); na apresentação entra com aviso | `RecipePolicy` (ESPELHAR_INVERTE_TEXTO_OU_LOGO), `PhotoEditService.hasTextOrLogo` |
| Recorte da peça: máscara, pincéis, bordas, transparência | recorte local, pincel devolver/apagar, fundos | igual + **suavizar borda** (0 a 24 px) e aviso **recorte incerto** quando a confiança do recorte fica abaixo de 0,45 | `PhotoRecipeRenderer.background/featherAlpha`, `PhotoEditService.renderMeasured` |
| Apresentação (fundo) | branco, cinza neutro, transparente, sombra rotulada | iguais | `PhotoRecipeRenderer.background` |
| Revisão: comparar, redefinir, restaurar | prévia do servidor, versões | igual, na aba Revisão | `PiecePhotoEditor` |
| Não destrutivo | receita reeditável e versões | igual; espelhar e níveis entram na mesma receita | `PhotoRecipe` |
| Look: camadas | não havia | cada peça é uma camada com posição, escala, rotação, opacidade e ordem; arrastar, teclado, "para frente/para trás", "posição padrão" | `look-composition-editor.tsx` |
| Look: gravar | — | `PUT /api/schemes/{id}/layout` grava só a composição; as peças não mudam | `SchemeService.updateLayout` |
| Look: prévia fiel | — | `POST /api/schemes/{id}/layout/preview` devolve o PNG do mesmo renderizador do card | `SchemeService.layoutPreview`, `SchemeCardRenderer` |

## 2. Regras de fidelidade aplicadas

- Foto da peça (canônica): níveis limitados (preto até 0,1, branco a partir de 0,9, gama entre 0,8 e 1,25); espelhar
  só sem texto nem logo; filtros só na apresentação.
- Recorte: o editor nunca reconstrói o que a foto não mostra; com recorte incerto a prévia avisa e pede conferência.
- Look: a composição muda só posição, escala, rotação, opacidade e ordem. Cor e filtro por camada ficam de fora de
  propósito, para a peça no look continuar igual à peça do guarda-roupa.

## 3. Testes

| Camada | Arquivo | O que prova |
|---|---|---|
| Java | `PhotoRecipeTest` | espelhar, níveis e borda suavizada; recusa de espelho com texto/logo na canônica |
| Java | `PhotoEditServiceTest` | aviso de recorte incerto na prévia; espelho com texto na peça |
| Java | `SchemeServiceTest.composicaoDoLookGravaPosicaoEscalaEOrdemSemMexerNasPecas` | grava a composição, recusa valores fora da faixa, gera o PNG da prévia |
| Vitest | `piece-photo-editor.test.tsx` | barra, ferramentas, recorte por proporção, teclado, cancelar com mudanças |
| Vitest | `look-composition-editor.test.tsx` | camadas a partir do look, teclado e gravação |

## 4. Evidências

Capturas no Next.js local, desktop 1280×900 e celular 390×844, com a imagem padrão FAI da camiseta e respostas da API
simuladas: `01` Ajustar, `02` Recortar com espelho e aviso, `03` Recorte da peça, `04` Revisão, `05` camadas do look,
`06` Revisão do look. Nas capturas `06` a prévia do look é uma imagem de marcação. A prévia real gerada pelo
servidor está em `07-look-previa-do-servidor.webp`: duas peças de teste sem foto, uma girada −8°, ampliada 1,2× e com
opacidade 0,9, desenhadas na ordem gravada.

## 5. Limitações

- Curvas livres não foram implementadas; o ajuste tonal avançado é por níveis.
- Gestos de pinça e rotação com dois dedos não existem; no celular o quadro e as camadas se movem com um dedo e com
  os controles deslizantes.
- A recusa de espelho com texto/logo foi validada com imagens sintéticas; em fotos reais depende da leitura do OCR
  local.
- As camadas do look não têm cor nem filtro próprios, por decisão de fidelidade.
- Fotos de 12 MP no celular não foram medidas nesta entrega.
