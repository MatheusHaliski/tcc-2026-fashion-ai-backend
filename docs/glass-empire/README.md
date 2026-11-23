# Glass Empire — documento de design do jogo

Glass Empire é o jogo de ação, aventura e RPG do universo FashionAI, planejado para console e **fora do escopo do
app** (ver `../ESTRUTURA_FLAIR.md`). O tema é a combinação de moda e tecnologia. Este diretório é a primeira versão do
documento de design: tudo aqui é **proposta** para a dona do projeto aprovar, trocar ou cortar.

## Índice

| Documento | Conteúdo |
| --- | --- |
| [01-historias.md](01-historias.md) | Cinco opções de história, com introdução, conflito, clímax e desfecho |
| [02-fases.md](02-fases.md) | As dez fases, o mapa do mundo e como cada cenário se liga ao seguinte |
| [fases/](fases/) | Um arquivo por fase: cenário, mapa de áreas, conexões, esconderijos, zonas de combate e chefe |
| [03-elenco-e-inimigos.md](03-elenco-e-inimigos.md) | Por história: personagens reais da moda e inimigos únicos (chefes, polícia, bandidos) |
| [04-roda-de-recursos.md](04-roda-de-recursos.md) | Roda de recursos: armas, munição, mobilidade e kits de vida |
| [05-vestimentas.md](05-vestimentas.md) | Vestimentas em formato de card: mecânica, superpoder, recurso único e onde são obrigatórias |
| [cutscenes/](cutscenes/) | Roteiros das cutscenes de abertura e das cenas curtas de cada história |
| [06-mundo-de-vitrea.md](06-mundo-de-vitrea.md) | A cidade sob Sterling Vale: lacres, classes de licença, leis e vida diária |
| [07-categorias-de-vestimenta.md](07-categorias-de-vestimenta.md) | Seis categorias de vestimenta, subcategorias, posição, material e química |
| [08-personagens-e-trajes.md](08-personagens-e-trajes.md) | Personagens fictícios, chefes e inimigos, cada um com traje próprio |
| [09-objetos-lojas-e-itens.md](09-objetos-lojas-e-itens.md) | Objetos do cenário, lojas, itens característicos e animações dos kits |
| [10-identidade-do-jogo.md](10-identidade-do-jogo.md) | Assinaturas do jogo, dose dos efeitos, som e mistura de inimigos por fase |

## Conceito

Vítrea é a capital do Império de Vidro, uma cidade-estado costeira onde toda fachada é uma vitrine inteligente: ela
anuncia, mede e registra o que cada pessoa veste. Quem controla o vidro controla a moda, e quem controla a moda
controla a cidade. A pessoa que joga é alguém do ofício (costureira, alfaiate, restauradora) que atravessa a cidade e o
interior para descobrir de onde vem o poder do Império e voltar para quebrá-lo.

## Pilares

1. **A roupa é a ferramenta.** Cada vestimenta é um card, como no FashionAI, e muda o que o personagem consegue fazer:
   escalar vidro, passar por um baile sem ser notado, sobreviver ao calor da tinturaria.
2. **Mundo aberto por fase, como em Uncharted.** Cada fase é um distrito amplo, com rotas alternativas, segredos e
   missões secundárias, mas com começo e saída definidos. Não há mapa único contínuo.
3. **Três jeitos de resolver.** Furtividade, combate e travessia. Toda zona de combate tem uma rota furtiva e uma rota
   alta.
4. **RPG de ofício.** Experiência, três ramos de habilidade (Corte, Trama e Passarela), fabricação na bancada e química
   entre as peças vestidas.
5. **Moda real como memória.** Estilistas, fotógrafos e editoras reais aparecem como aliados e mentores. Todo inimigo é
   fictício.

## Estrutura de uma fase

Cada fase segue a mesma ordem, o que ajuda produção e ritmo:

1. **Chegada**: ligação física com a fase anterior, sem corte de lugar.
2. **Distrito aberto**: áreas livres com lojas, missões secundárias, colecionáveis e pelo menos um refúgio.
3. **Gargalo de travessia**: trecho de escalada, corda ou veículo que exige uma vestimenta ou um item de mobilidade.
4. **Zonas de combate**: de três a cinco arenas, sempre com rota furtiva.
5. **Chefe da fase**: arena própria e luta em três etapas.
6. **Saída**: o caminho que leva ao cenário seguinte.

## Progressão

| Eixo | Como cresce |
| --- | --- |
| Nível do personagem | Experiência por objetivos, segredos e chefes; do nível 1 ao 30 |
| Ramo Corte | Corpo a corpo, aparar, finalizações |
| Ramo Trama | Fabricação, munição especial, invasão de vitrines e drones |
| Ramo Passarela | Mobilidade, furtividade, disfarce e presença |
| Vestimentas | Cards bronze, prata, ouro e especial, melhorados na bancada |
| Moeda | **Fios**, ganhos em missões e vendidos por comerciantes do Bairro dos Retalhos |

## Dificuldade

| Modo | Munição e kits | Desgaste das vestimentas | Vagas de vestimenta na roda |
| --- | --- | --- | --- |
| Alinhavo (fácil) | Fartos | Não há | 4 |
| Costura (normal) | Padrão | Lento | 3 |
| Alta-costura (difícil) | Escassos | Normal, exige reparo na bancada | 3 |
| Peça única (extremo) | Raros | Rápido, e a morte volta ao último refúgio | 2 |

## Marcas e pessoas reais

O repositório já registra a regra em `../JOGOS.md`: nome e logo de marca e imagem de pessoa real precisam de licença
antes de ir a público. O elenco real deste documento serve ao trabalho acadêmico. Para lançamento, cada aparição
precisa de autorização da pessoa ou do espólio, e o documento de elenco traz um substituto fictício para cada caso.
