# Lote R91 — card compacto em camadas e design de borda no criador

Data: 13/11/2026. Branch: `claude/admiring-pasteur-nh2yl8`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Padrão GoF |
|---|---|---|---|
| `components/background-studio.tsx` (congelado) | 346 | 337 | NENHUM — reexporta as abas e ganha a aba Borda |
| `components/piece-art-editor.tsx` (congelado) | 263 | 254 | NENHUM — delega o segmento Container e a aba Borda |

Arquivos novos:

| Arquivo novo | Linhas | Responsabilidade | Padrão |
|---|---|---|---|
| `components/art-segments.tsx` | 17 | abas da Arte de fundo (Cor · Aura · Layout · Container · Borda) | NENHUM (componente de apresentação) |
| `components/piece-container-panel.tsx` | 24 | segmento Container do editor da peça (cor, sólido/vidro, fundo da foto) | NENHUM (extração de subcomponente) |
| `components/card-border-designer.tsx` | ~70 | aba Borda: Padrão, cor sólida, degradê e efeito da linha | NENHUM |
| `app/(site)/_styles/29-card-compacto-camadas.css` | ~140 | tamanho único do card social e as duas janelas de dados | NENHUM |

`lib/card-border.ts` separa o par automático (`autoBorderPair`) da tinta final (`borderPaint`), com a borda padrão nomeada
(`DEFAULT_BORDER`). Não foi aplicado Strategy aos três modos de borda: são três ramos de uma expressão pura, sem
estado nem variação por contexto; uma hierarquia de classes só acrescentaria indireção.

## Contrato preservado

- Mesmo formato gravado em `background.border` (`mode`, `color`, `from`, `to`, `effect`), já validado no backend por
  `StudioArtworkRules`. Sem escolha, nada é gravado e vale a borda padrão.
- Os imports existentes de `ArtSegments`/`ArtSegment` a partir de `background-studio` continuam funcionando (reexport).
- Cards ampliados (modal/detalhe) não mudam de layout: a nova janela de identidade usa `display: contents` ali.
