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

## Objetos gerados pelo motor Blender do projeto

Desde 25/11/2026 os objetos que faltavam são **modelados por código no Blender**, sem API de terceiros e sem IA paga
(`scripts/blender3d`). Cada receita é uma função Python que monta o objeto com as formas do núcleo (`core.py`: caixa
chanfrada, cilindro, sólido torneado, anel, haste entre dois pontos) e materiais PBR; o comando exporta o `.glb` e
escreve a linha do manifesto com `license: "Própria"` e `source: "scripts/blender3d/receitas"`.

```bash
pip install bpy                                   # ou use o Blender instalado
python -m scripts.blender3d.build                 # gera todos em public/flair/3d/assets e atualiza o manifest.json
python -m scripts.blender3d.build --so trave      # só um
python -m scripts.blender3d.build --listar
python -m scripts.blender3d.preview --pasta /tmp/previas   # folha de contato renderizada (Cycles na CPU)
```

| Arquivo | Substitui o móvel | Triângulos |
| --- | --- | --- |
| `cadeira.glb` | `cadeira` | 872 |
| `cadeira-diretor.glb` | `cadeiraDiretor` | 808 |
| `cadeira-de-camarim.glb` | `cadeiraDeCamarim` | 1504 |
| `penteadeira.glb` | `penteadeira` | 2084 |
| `luminaria.glb` | `luminaria` | 720 |
| `camera-tripe.glb` | `cameraTripe` | 1916 |
| `canhao-luz.glb` | `canhaoLuz` | 1996 |
| `poste.glb` | `poste` | 1220 |
| `caixote.glb` | `caixote` | 1948 |
| `tambor.glb` | `tambor` | 1296 |
| `pilha-de-pneus-2/3/4.glb` | `pilhaDePneus` (um arquivo por altura da pilha) | 1488 / 2232 / 2976 |
| `trave.glb` | `trave` | 616 |
| `skate.glb` | `skate` | 1344 |

Regras do motor:

- Origem no piso, centrado; a frente do objeto é `-Y` no Blender (vira `+Z` no glTF, a frente dos móveis das salas).
- Teto de 3 mil triângulos por objeto (o mesmo do teste do manifesto); acima disso o comando recusa.
- A sala ajusta a escala pela altura do móvel procedural, então a receita só precisa acertar as proporções.
- **As cores são fixas no arquivo.** O móvel procedural usava a paleta da sala (ex.: penteadeira magenta no Road to
  Glory); o objeto gerado tem a cor da receita. Para variar por sala, crie outra receita com outro slug e aponte-a no
  móvel com `comGlb(...)`.
- Receita apagada ou renomeada: o próximo `build` completo tira o `.glb` e a linha órfã do manifesto.
- Para conferir um objeto dentro da sala: `/lab/salas?jogo=PERSONAGEM_FILME` (só em desenvolvimento).

Conferido: a folha de contato dos 15 arquivos e a sala `PERSONAGEM_FILME` no navegador (câmera no tripé e cadeira de
diretor no lugar, na escala e apoiadas no piso). **Não conferido: as demais salas**, uma a uma.

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
