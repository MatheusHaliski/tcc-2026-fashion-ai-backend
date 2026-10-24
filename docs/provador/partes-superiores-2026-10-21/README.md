# Parte de cima: cobertura das 19 subcategorias

## Perfis e diferenças

`lib/avatar3d/human/upperwear.ts` registra um perfil explícito para cada uma das 18 subcategorias ativas e para `crop_top`, legado. O teste compara a lista com a taxonomia oficial para detectar futuras lacunas.

| Grupo | Subcategorias | Ajustes do molde |
| --- | --- | --- |
| Camisetas e camisas | t_shirt, shirt, blouse, polo_shirt | Caimento, manga, comprimento, carcela; blusa sem botões por padrão; polo com carcela curta. |
| Sem mangas e curtas | tank_top, top, crop_top, bodysuit | Comprimento e cobertura próprios; body por baixo de calças/saias, sem substituir a roupa inferior. |
| Malha e moletom | sweater, sweatshirt, hoodie | Folga e comprimento, acabamento de ribana consistente entre deformação, dobras e faixas. |
| Sobreposições leves | cardigan, vest, blazer | Abertura frontal estimada quando aplicável, camiseta interna visível e colete sem mangas. |
| Casacos | jacket, coat, parka, windbreaker | Folga e camadas específicas; comprimento próprio da parka; coat cropped perde a extensão longa. |
| Quimono | kimono | Abertura frontal, manga mais ampla e curta, e afastamento dos braços considerando a largura da manga. |

Foram adicionados ajustes paramétricos para variações como BOXY, BABY_TEE, OVERSHIRT, TUNIC, PEPLUM, BOLERO, RUGBY, BANDEAU, CORSET, SPORTS_BRA, BRALETTE, BUSTIER, PUFFER, BOMBER, VARSITY, MOTO, TRUCKER, TRENCH, OPEN_FRONT e BELTED, dentro das famílias correspondentes. Atributos explícitos de manga, comprimento, decote e fechamento são aplicados depois desses padrões. Não há corte por marca.

## Correções na construção e nas camadas

- O vão frontal é aplicado à cobertura da peça, à barra contínua e à máscara que oculta a roupa interna. Não basta abrir a foto ou esconder um botão.
- Cardigã/quimono/blazer abertos não ocultam a camiseta no centro. Uma declaração explícita de fechamento fecha a abertura estimada.
- Um body é montado na camada interna. A roupa inferior passa a ocultar também sua barra contínua, que anteriormente podia aparecer por cima do jeans.
- Carcelas sintéticas respeitam fechamento e abertura. Fotografias verificadas continuam preservando seus próprios botões e acabamentos.
- A versão do molde foi atualizada para `fai-mould-skinwrap-v4`, invalidando diagnósticos associados à versão anterior.

## Validação e evidências

- 69 testes focados aprovados em nove arquivos; TypeScript e build Next.js aprovados, incluindo validação de traduções.
- Specs das 122 variações oficiais passam por validação estrutural; isso **não** comprova uma geometria única ou completa para cada variação decorativa.
- As 19 famílias geram geometria finita e visível nos corpos de referência feminino e masculino, sem modificar a pele. Testes verificam a amplitude da manga do quimono, a camiseta interna visível, a abertura até a barra e o body oculto pela calça.
- Chromium com 19 referências locais: peça vestida e foto projetada em todas, sem erros JavaScript. As três aberturas frontais foram revalidadas depois da correção da barra, e o body depois da correção de camada. Auditoria consolidada e capturas acompanham este documento.
- A tabela `cobertura.csv` e os relatórios por corpo registram o escopo exato.

## Limites

São famílias paramétricas estimadas, não moldes industriais de cada SKU. Capuz com volume próprio, recorte inferior completo do body, faixa do quimono, pregas, ossaturas de corset, recortes cut-out e lapelas físicas não foram reconstruídos neste lote. Detalhes de muitos desses estilos dependem da fotografia projetada. O app informa as limitações específicas de hoodie, body e quimono em PT/EN/ES.

As capturas ainda mostram limitações de acabamento, junção de gola e projeção da foto, principalmente em peças complexas. Não comprovam realismo fotográfico, encaixe perfeito, simulação física ou fidelidade de todas as marcas. O laboratório usa canvas fixo; não é validação em aparelho móvel físico. Não houve alteração do catálogo de produção nem execução GPU de IA.
