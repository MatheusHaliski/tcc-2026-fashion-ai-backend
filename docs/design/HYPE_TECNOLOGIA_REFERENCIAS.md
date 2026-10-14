# Pesquisa: Hype tecnológico sobre a fotografia

A busca genérica por moda produz lojas sem exemplos técnicos. O script `research_hype_photo_technology.py` agora exige termos de técnica visual; a execução via RSS não encontrou referências elegíveis. Uma busca web complementar encontrou as fontes abaixo. Nenhuma arte comercial foi importada para a interface.

| Fonte | Técnica de interesse | Uso no FashionAI |
|---|---|---|
| [Snap: Segmentation Trails](https://developers.snap.com/lens-studio/features/ar-tracking/body/segmentation/segmentation-trails) | Separar roupa/corpo para efeitos atrás e dentro da máscara | Base para tratamento restrito à roupa; não confundir contorno do quadro com máscara real |
| [FabricTryon](https://style3d.github.io/fabric_tryon/) | Retratar material preservando geometria e iluminação | Direção de pesquisa; alterar material real exige processamento, não só CSS |
| [MIT: Fablur](https://www-prod.media.mit.edu/projects/fablur/overview/) | Projeção alinhada à superfície do tecido | Scanner e projeção discreta com textura preservada |
| [MakeFashion: Lumen Couture](https://www.makefashion.ca/projects/lumen-couture-projection-mapped-dress/) | Vestido com projeção e sincronização | Fibras de luz e holografia editorial |
| [Lightform](https://arxiv.org/abs/2001.00521) | Efeitos procedurais alinhados a superfícies | Reutilizar máscara com shaders parametrizados |
| [Fashionpedia](https://vision.cornell.edu/se3/wp-content/uploads/2020/07/2004.12276.pdf) | Máscaras e atributos de roupas | Diferenciar região da roupa de corpo/fundo |
| [FabricDiffusion](https://arxiv.org/abs/2410.01801) | Transferência de textura para roupas 3D | Pesquisa futura para preservação de textura e coerência com o modelo |
| [ARMANI](https://arxiv.org/abs/2208.05621) | Alinhamento entre partes de roupas e texto | Interpretação de estilos por região; não inventar medidas físicas |
| [Normals: Apparel](https://normalfutu.re/lab/aprv1_0-future-fashion/) | Moda digital e AR | Composição técnica com identidade de moda |
| [Holocloth](https://github.com/dmitrykurash/holocloth) | Shader iridescente e tecido digital | Direção de cromo/holografia; código externo não incorporado |

## 40 perfis iniciais implementados

Oito tratamentos — scanner, contorno do quadro, malha digital, holografia, fibras, prisma, partículas e luz de passarela — em cinco direções: grafite, cromo, rosé, violeta e champanhe. Eles variam composição, paleta, espaçamento, direção e período.

Esses 40 são efeitos de apresentação da foto. **Ainda não segmentam semanticamente o tecido nem executam 40 algoritmos de melhoria de imagem.** O score permanece real; não são inventados atributos de tecido, região ou fibra. As referências de segmentação acima orientam a próxima etapa do efeito restrito à máscara da roupa.
