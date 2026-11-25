# Estudo: um GLB base por subcategoria, completado com camadas

Proposta da dona (25/11/2026): criar com o motor Blender um modelo base por subcategoria e completá-lo depois com cor,
zíper, botão, bordado, traçado, barra, cós, gola, capuz e logos. Este estudo olha o que existe hoje, o que cada tipo de
detalhe exige e recomenda como fazer.

## 1. De onde vem o 3D das peças hoje

| Origem | Onde aparece | Forma | Problema |
|---|---|---|---|
| Meshy (paga, foto → malha) | provador, editor da peça | a da foto | custo por peça; malha rasa e sem partes; deixada de lado em 24/11 |
| Relevo local (`ReliefModelGenerator`) | editor 3D da peça, Acervo | a silhueta da foto inflada | com a foto opaca virava um bloco com a foto (corrigido em 25/11: recorte antes, `SEM_RECORTE` sem ele) |
| Modelos do Atelier (`lib/atelier3d/garment-template.ts`) | "Criar peça" no editor do Atelier | 3 tornos: camiseta, saia, calça | volumes de conceito, sem medida, sem detalhe: as peças "quadradas" do Atelier |
| Motor Blender (`services/garment_blender`) | provador (lab) | a peça construída pela ficha, em medidas reais | ainda não ligado ao Atelier nem ao Acervo |

O motor já é, na prática, "uma base por subcategoria + parâmetros": a ficha diz o tipo, o tamanho, o tecido, a gola, o
fechamento e os bolsos, e a malha sai em 1,5 s de CPU, custo zero (`piloto-e-decisoes.md`). Hoje cobre 14 de 14
subcategorias de baixo e 5 de 19 de cima.

## 2. Cada detalhe: camada em tempo real ou geometria

O ponto que decide tudo: **o detalhe muda a forma da malha ou só a aparência?**

| Detalhe | Muda a malha? | Como fazer | Por quê |
|---|---|---|---|
| Cor, tecido (algodão, lã, denim…) | não | **camada**: material trocado no navegador (cor + mapas do tecido) | o motor já separa os materiais por nome (`corpo`, `ribana`, `cos`, `linha`…) |
| Logo, bordado único, traçado único, estampa | não (só a superfície) | **camada**: decalque numa região da peça (peito esquerdo, costas, manga, perna) | precisa de um mapa UV por regiões, estável na subcategoria (hoje o UV é métrico e repetido — ver §4) |
| Cor do zíper, do botão, da linha | não | **camada**: material da ferragem | materiais `dentes`, `botao`, `linha` já existem |
| Botões, ilhoses, rebites, puxador | pouco (peças soltas) | **camada**: peças instanciadas em âncoras da base | a base marca onde (âncoras); a ferragem acompanha o tecido no provador pelo vértice mais próximo |
| Zíper, vista de botões (frente aberta) | **sim**: a frente se divide em dois painéis com vista dobrada | **variante gerada pelo motor** | não dá para "colar" um zíper num tubo fechado: a abertura é da construção |
| Gola, capuz, colarinho | **sim**: muda o decote e acrescenta casca | variante gerada | idem |
| Barra (ribana, dobrada, curta/longa), cós, comprimento, manga curta/longa | **sim** | variante gerada | idem |
| Bolsos chapados, pregas, joelho duplo | sim, mas local | variante gerada (ou peça encaixada numa âncora, na fase 3) | o motor já os faz em ~0,1 s |

Conclusão: **a proposta funciona se a "base" for a construção (o que o motor gera) e as camadas forem só aparência e
ferragens.** Tentar acrescentar zíper, gola, capuz ou barra por cima de um GLB pronto obrigaria a reimplementar no
navegador o que o motor já faz no Blender, com resultado pior (a malha não teria a abertura, a dobra nem a costura).

## 3. Arquitetura recomendada: base + variantes + camadas

1. **Base por subcategoria** (33: 19 de cima, 14 de baixo): a ficha padrão de cada subcategoria, na grade de tamanhos,
   gerada pelo motor com material neutro. É o "molde" do Atelier e o ponto de partida de qualquer peça nova — substitui os
   3 tornos de `garment-template.ts` e serve de forma no Acervo para peça sem foto.
2. **Variantes de construção**: a ficha da peça (gola, fechamento, capuz, bolsos, comprimento, caimento) gera o GLB no
   motor, guardado no bucket pelo hash da ficha. Mesmo motor, mesma ficha → mesmo arquivo; trocar a gola no editor é pedir
   outra variante (1,5 s), não editar a malha.
3. **Camadas no navegador** (editor do Atelier, editor da peça, provador): cor e tecido por material, decalques por
   região e ferragens por âncora — gravadas no documento da personalização (`SceneDocument`), sem tocar no GLB, como hoje.

## 4. O que a base precisa trazer (contrato do GLB)

- **UV por regiões** num segundo canal (`TEXCOORD_1`): frente, costas, manga d/e, gola, perna d/e, cada uma num retângulo
  fixo do atlas. O canal atual (`TEXCOORD_0`) fica métrico (5 cm por repetição) para o tecido; o decalque usa o canal 1.
  Assim o logo no "peito esquerdo" cai no mesmo lugar em qualquer tamanho.
- **Âncoras** como nós vazios do glTF com nome e direção: `ancora_logo_peito`, `ancora_botao_1..n`, `ancora_ziper_topo`,
  `ancora_bolso_*`, `ancora_etiqueta_costas`. O motor já sabe essas posições (são as que ele usa para construir).
- **Materiais nomeados por papel** (já existe): `corpo`, `ribana`, `cos`, `cadarco`, `dentes`, `botao`, `furo`, `linha`.
- **Manifesto** (`modelo.fit.json`) com `ficha` (o hash e a ficha usada), `regioes` e `ancoras`, além do que já tem
  (`medidaReal`, `tamanhoGerado`, `pontoAlto`, rótulos de parte em `COLOR_0`).

## 5. Custos e limites

- Geração: 1,5 s por GLB sem prévia; 33 bases × 6 tamanhos ≈ 5 min de CPU. Variante por peça: sob demanda, cacheada.
- Arquivo: 0,4–1,5 MB por GLB (texturas JPEG 512 px). As camadas não aumentam o GLB.
- Provador: o encaixe atual (`glb-garment`) já aceita as peças do motor; decalque no canal 1 acompanha a malha vestida
  (a textura vai com o vértice). Ferragem por âncora precisa herdar os pesos de pele do vértice mais próximo (a fazer).
- Medidas oficiais e passaporte: a camada nunca muda medida (como já diz `Customization.affectsOfficialMeasurements`).
- O motor roda em Python com Blender 4.2; no Railway seria um serviço/worker à parte (não está implantado). Até lá, as
  bases podem ser geradas aqui e publicadas no bucket.

## 6. Fases propostas

1. **Bases de cima e de baixo** (em andamento): uma ficha por subcategoria; baixo pronto (14/14, 25/11), cima 5/19.
2. **Contrato da base**: UV de regiões (`TEXCOORD_1`), âncoras e manifesto estendido; teste que confere região e âncora
   em toda subcategoria.
3. **Atelier usa as bases**: "Criar peça" escolhe a subcategoria (não mais 3 tornos) e carrega a base; cor e tecido
   pelo material (já suportado), logo/bordado como decalque por região, botão/zíper como cor da ferragem.
4. **Variantes sob demanda**: endpoint que recebe a ficha, gera no motor e devolve o GLB (cache por hash). Depende de
   implantar o motor como worker.
5. **Acervo e editor da peça**: peça sem foto usa a base da subcategoria na cor dela (hoje é a silhueta da categoria).
