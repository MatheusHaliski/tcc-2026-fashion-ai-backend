# Prompt negativo e avisos técnicos de geração

## Prompt negativo comum aos 7 presets

```
avoid faces, avoid people, avoid clutter, avoid chaotic scenery, avoid fantasy character focus, avoid unreadable typography collisions, avoid rendering small legible UI text or numbers, avoid literal price tags with readable digits, avoid stock photo watermark
```

**Composição:** as seis primeiras cláusulas (`avoid faces` … `avoid unreadable typography collisions`) são o `baseNegative` já usado em todo o pipeline de Arte com IA do projeto (`ArtworkStudioService.ts`, `buildArtworkPrompt()`). As três últimas (`avoid rendering small legible UI text or numbers`, `avoid literal price tags with readable digits`, `avoid stock photo watermark`) são acréscimos específicos de thumbnail de preset — sempre **anexadas**, nunca substituindo o base.

`avoid clutter` e `avoid fantasy character focus` importam especialmente para os presets **Trading** e **FAI Max** — os dois mais densos visualmente da lista; sem essas cláusulas, os resultados tendem a composições poluídas ou com foco de "personagem" em vez do look de moda.

## Aviso operacional — orientação da imagem gerada

O fragmento de formato (`mockup canvas 220x566`) é **só texto de prompt** — não define sozinho a dimensão real entregue pelo provedor de geração de imagem. Provedores de IA de imagem tipicamente não oferecem uma proporção tão estreita/alta quanto 0,39:1 como tamanho nativo. Antes de rodar a geração:

1. **Configure explicitamente o parâmetro de tamanho/orientação do provedor para retrato** (o retrato suportado mais próximo, ex. ≈0,67:1) — sem isso, o padrão comum de muitos provedores é paisagem, o que produz uma imagem na orientação errada e nenhum recorte recupera a composição alta e estreita pretendida.
2. **Após gerar em retrato**, aplique um recorte central para aproximar a proporção final 0,39:1 (220:566) — nenhum tamanho padrão de API chega exatamente a essa proporção.
3. Alternativamente, trate a geração destas 7 thumbnails como uma etapa manual/externa ao pipeline automático padrão, e documente-a como tal no novo repositório.

## Variante "peça" vs. "esquema"

Todos os 7 prompts finais desta pasta usam o contexto **Esquema** (look completo, múltiplas peças). Para gerar a variante de **peça avulsa** (item único), troque em qualquer um deles:

- Remover: `full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context`
- Adicionar: `single garment product framing, one clothing item centered as hero subject, isolated product-shot styling`

O restante do prompt (estilo do skin, formato, blocos fixos, negativo) permanece idêntico.
