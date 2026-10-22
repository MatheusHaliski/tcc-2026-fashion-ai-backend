# Camisas, moletons, jaquetas e casacos: identidade visual

Estas capturas registram o estado anterior à correção da junção de UVs no ombro e da espessura da gola. A análise e as novas capturas de camisa/casaco estão em [correções integradas](../../correcoes/2026-10-21-catalogo-ia-hype-provador/README.md).

O material continua vindo da fotografia da peça/variante selecionada. Nome da marca não determina automaticamente cor, estampa ou logo.

## Correções

- Camisas, suéteres, moletons, jaquetas e casacos passam a usar amostras independentes para as duas metades do tecido estimado, quando os landmarks da foto isolada permitem identificar a região superior. Um lado listrado não deve transformar o lado liso em outra estampa.
- Cada punho recebe a cor de seu próprio lado da foto. Antes, `cuffLeft ?? cuffRight` fornecia uma única cor aos dois acabamentos. Agora a faixa geométrica carrega o sinal do lado do molde; esse sinal associa corretamente o punho ao lado correspondente da imagem frontal, sem confundir lado anatômico com lado da fotografia.
- O renderizador informa o tipo de molde ao gerador da textura. Sem landmarks suficientes, a textura mantém o fallback anterior.
- Logos, botões, bolsos e costuras visíveis continuam na foto frontal. A proteção existente impede a sobreposição de sete botões ou de uma carcela sintética sobre a fotografia própria da peça.
- A separação por perna das peças inferiores e a exclusão de arte externa no forro da saia-short continuam ativas.

## Validação

47 testes focados aprovados em sete arquivos, incluindo leitura de cor por metade para cinco tipos de molde, cores distintas dos punhos, associação geométrica de lado, preservação da carcela fotografada, cobertura superior/inferior e isolamento da pele. Build de produção Next.js/TypeScript aprovado.

O teste local de navegador utiliza seis famílias: camisa, suéter, moletom sem capuz, moletom com capuz, jaqueta e casaco. As fotografias sintéticas têm lado listrado, lado verde liso, uma identificação exclusiva no peito e punhos magenta/dourado. Verifica-se o material efetivamente ligado à malha, não apenas a miniatura: RGB `[25,120,60]` no painel liso, presença do logo na foto frontal, ausência dele no painel de repetição e cores `#e61e46`/`#f0be14` nos respectivos punhos. Relatório e capturas acompanham este documento.

## Limites

A trama/cor das mangas, laterais e costas é uma extrapolação da foto, não uma reconstrução de todos os recortes do produto. Logos exclusivos das mangas, costas e interior precisam de vistas adicionais ou UVs próprios; não são copiados do peito. A leitura dos punhos continua baseada nas bordas de uma foto plana isolada e não é um detector semântico universal de acabamentos. Peças fotografadas em poses ou sobreposições ambíguas podem usar o fallback.

As capturas mostram limites de junção de gola e projeção. Este laboratório local, com API simulada, corpo de referência e fotos sintéticas, não certifica todos os SKUs/marcas de produção nem realismo fotográfico. Não houve inferência GPU, alteração do banco de produção ou teste em aparelho móvel físico neste lote.
