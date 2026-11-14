# FLAIR 3D: objetos 3D prontos das salas (GLB)

A dona autorizou baixar só o necessário para cada jogo. Estes são os objetos que entraram, de onde vieram e o que ficou
de fora. Os arquivos ficam em `public/flair/3d/assets/` e o `manifest.json` da mesma pasta diz em qual jogo cada um
serve. A sala troca o móvel procedural pelo objeto quando ele está no manifesto (`lib/flair/nucleos/scene/assets.ts`,
`components/flair/nucleos/scene/glb-prop.tsx`); se o arquivo falhar, o móvel procedural continua lá.

## Objetos no repositório

Todos têm licença Creative Commons Atribuição 4.0 (CC BY 4.0): o uso comercial é permitido desde que o autor seja
creditado. **Este quadro é o crédito e precisa aparecer também numa tela de créditos do app antes do lançamento.**

| Arquivo | Título original | Autor | Fonte | Licença | Triângulos | Tamanho | Jogo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `poltrona.glb` | old_leather_armchair | VoGAn | [Sketchfab](https://sketchfab.com/3d-models/none-ae47fb3d061045569f1089aaabd840ca) | CC BY 4.0 | 1928 | 2794 KB | BOUTIQUE_3D |
| `vaso-alto.glb` | Potted Plant | dgeraci | [Sketchfab](https://sketchfab.com/3d-models/none-988c4f83f9984c8d8f7b7418ce03efe7) | CC BY 4.0 | 2342 | 737 KB | FASHION_DETECTIVE |
| `bola.glb` | Soccer Ball Low-Poly PBR | MaX3Dd | [Sketchfab](https://sketchfab.com/3d-models/none-1f5fb2dd91af49c99b9f8751c1291489) | CC BY 4.0 | 1440 | 1012 KB | FASHION_SPORTS |
| `refletor.glb` | Spotlight | DemonSammy | [Sketchfab](https://sketchfab.com/3d-models/none-67db45ff5c554097872f6eb5ec1ae5fa) | CC BY 4.0 | 2556 | 143 KB | PERSONAGEM_FILME |
| `banco-rua.glb` | Park Bench | Bora Özakaltun | [Sketchfab](https://sketchfab.com/3d-models/none-7a0c2a659e2441b6b568a9d2acf8419e) | CC BY 4.0 | 2272 | 253 KB | AROUND_THE_WORLD |

## O que foi conferido e o que não foi

- Conferido: cada arquivo abre como GLB, tem menos de 3 mil triângulos, e foi visto numa folha de contato renderizada
  (forma, textura e tema adequados a 13 anos ou mais).
- **Não conferido: o objeto dentro da sala.** A escala é ajustada pela altura do móvel procedural, mas a direção para
  onde a poltrona, o banco e o refletor ficam virados não foi vista na cena. Se algum ficar de costas, o ajuste é o
  campo `giro` do móvel na descrição da sala.

## O que ficou de fora

| Objeto procurado | Motivo |
| --- | --- |
| Cadeira da plateia | o que veio foi uma cadeira de escritório, fora do tema |
| Arara de roupas | o que veio foi um cabideiro de pé, não uma arara |
| Caixote | o que veio tinha tema militar |
| Poste de rua | o que veio foi um poste de fiação |
| Câmera no tripé | modelo sem textura |
| Lustre | o modelo é bom, mas é pendurado no teto e a sala apoia o objeto no piso; entra quando a sala tiver ponto de teto |
| Manequim | o modelo é bom (busto de loja), mas nenhuma sala tem móvel "manequim" ainda |
| Trave e pilha de pneus | nada adequado com licença aberta e poucos triângulos |

Esses continuam com o móvel procedural.

## Fontes

- **Sketchfab** (API com a credencial salva no ambiente): busca só por modelos baixáveis com licença CC BY e até 12 mil
  triângulos.
- **Poly Pizza:** a busca funciona, mas o servidor de arquivos responde com um desafio contra robôs e o download foi
  barrado. Não contornei o bloqueio. Para usar o acervo dele (CC0, estilo mais uniforme), o caminho é baixar os arquivos
  à mão no navegador e colocá-los na pasta com uma linha no manifesto.
- Nenhum modelo foi gerado por IA paga. Nenhum objeto é arma, armadura ou kit médico.
