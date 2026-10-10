# Evidências · RF15 editor de imagem da peça e do look (10/10/2026)

Capturas do Next.js local (`/pieces/p1/photo` e `/schemes/s1/photo`), desktop 1280×900 e celular 390×844, com a
imagem padrão FAI da camiseta e a API simulada (Playwright). Nenhuma foto pessoal nem do catálogo foi usada.

| Arquivo | O que mostra |
|---|---|
| `01-ajustar-*` | barra superior e ferramenta Ajustar |
| `02-recortar-espelhar-*` | proporção 4:5, espelho ligado e o aviso de texto/logo |
| `03-recorte-da-peca-*` | recorte da peça com pincéis e suavizar borda |
| `04-revisao-*` | revisão com versões e restaurar |
| `05-look-camadas-*` | camadas do look, a selecionada com contorno |
| `06-look-revisao-*` | aba Revisão do look (a prévia nesta captura é uma imagem de marcação) |
| `07-look-previa-do-servidor` | prévia real do renderizador do card, gerada por `SchemeServiceTest` com `-Dfai.evidencias` |

Diagnóstico e limitações: [`docs/rf15-editor-canvas-2026-10-10.md`](../../rf15-editor-canvas-2026-10-10.md).
