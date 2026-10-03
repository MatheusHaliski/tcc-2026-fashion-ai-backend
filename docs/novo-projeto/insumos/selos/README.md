# Selos vetoriais — catálogo de referência dos selects de estética

Estes SVGs são a referência visual de cada opção dos `select` do editor "Cadastrar novo selo"
(Artefato #11, RF20.CA24) e abrem direto no Illustrator (`File > Open`), com tudo editável:
papel perfurado em compound path, moldura, padrão da borda em clipping mask, painel, centro,
tipografia e medalhão de denominação. Nada usa `<filter>` — só gradientes, opacidade e traços —
para nada virar bitmap na importação.

| Pasta | Série | O que referencia no editor |
|---|---|---|
| `fashion-ai/` | 6 variações do emblema Fashion AI (oficial, noturno, creme, rede total, vestível, monograma) | opções de **Centro**: emblema · camisa 3D · sacola FAI |
| `materiais/` | 12 materiais da malha de pontos: plástico, metal, madeira, vidro, mármore, tecido, couro, cerâmica, neon, concreto, ouro martelado, holográfico | opções de **Material** — para Selo Premium só `vidro` e `holo` (RF21.CA20) |
| `marcas-e-icones/` | 10 selos de estudo (marcas streetwear e ícones) com borda temática + camisa 3D | opções de **Moldura**: hachura, listras, chevron, xadrez, losango, pérolas, raios, ondas, estrelas |
| `marcas-em-material/` | 5 cruzamentos marca × material (Nike/plástico, Adidas/cerâmica, Puma/metal, New Balance/tecido, Jordan/couro) | prova de que moldura, material e centro são eixos independentes |

**Identidade sem logotipo.** Nenhum SVG reproduz logotipo registrado nem retrato: as marcas
aparecem por paleta, cidade, ano e motivo abstrato (regra 2 do documento 04, §A.4). Para uso
comercial a licença continua necessária; para estudo e banca, o conjunto é seguro.

**Gerador.** `scripts/selos/gen.py`, `gen_fai.py` e `gen_mat.py` (Python 3, sem dependências)
regeneram tudo com seeds determinísticas:

```bash
cd scripts/selos && python3 gen.py && python3 gen_fai.py && python3 gen_mat.py
```

Cada script escreve os SVGs individuais e uma folha (`folha-*.svg`) na própria pasta; copie para
cá as pastas `svg*/`. Para acrescentar um material, adicione uma entrada em `MATERIALS`
(`gen_mat.py`) com o estilo de nó, de linha e de textura — o `select` do editor lê o mesmo `id`.
