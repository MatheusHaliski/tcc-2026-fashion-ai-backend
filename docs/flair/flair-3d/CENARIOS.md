# Cenários dos jogos FLAIR 3D: auditoria e revisão

Pedido da dona (15/11/2026): cenários coerentes e bem acabados. Este documento audita cada sala (o que não pertence ao
lugar, o que falta para o lugar se ler como ele mesmo), registra o que já foi refeito e o que fica para depois. O estado
de cada jogo fica em `ESTADO_DOS_JOGOS.md`; as câmeras, em `CAMERAS.md`; as pessoas de cena, em `BASE_NUCLEOS.md`.

## Como foi auditado

Cada sala foi fotografada no navegador (Playwright com swiftshader, câmera de três quartos afastada, 900×600) numa
página de laboratório que monta a cena do jogo com a modelo da casa. A auditoria olha a foto e a descrição da sala
(`lib/flair/nucleos/scene/salas/*.ts`). Nada de marca, logo ou rosto real: as placas trazem só o FashionAI.

O que vale para todas as salas:

- **Materiais.** Já são PBR (cor, rugosidade, metal, mapas procedurais de até 1024 px, `scene/materials.ts`); as formas
  usam caixas chanfradas (`chanfrada`) e o orçamento de 60 mil triângulos e 12 materiais é conferido por teste.
- **Sombras de contato.** O avatar e os móveis projetam sombra na luz principal; não há sombra de contato suave (AO)
  sob móveis encostados no piso. Fica como melhoria comum a todas as salas.
- **Pessoas.** Plateias, torcidas e adversários ainda são silhuetas sem rosto (pinos) em 14 jogos. O sistema de gente
  humana com níveis de detalhe já existe (`lib/flair/nucleos/gente`, usado no Fashion Sports) e é o caminho para eles.
- **Ateliê compartilhado.** Clube do Coração, Favorite Singer, Piloto Favorito e Super-Herói usam o mesmo ateliê
  (bancada de amostras, rolos de tecido, luminária, tablado) com um fundo próprio. É escolha do desenho (o jogo é criar
  a peça no ateliê), não um erro; o que falta é o fundo de cada um se ler como o lugar.
- **Modelos licenciados.** Nenhum GLB entrou nesta revisão. O caminho continua o manifesto
  (`public/flair/3d/assets/manifest.json`, `ASSETS_3D.md`): CC0 ou CC BY, crédito registrado, sem armas, sem marca.

## Sala a sala

| Nº | Sala | Não pertence | Falta para se ler como o lugar | Revisão |
| --- | --- | --- | --- | --- |
| 1 | Passarela (salão de desfile) | nada fora do lugar | fotógrafos no fim da passarela; arco de entrada do backstage; a primeira fila é de pinos | pendente |
| 2 | Dress Fighter (beco com ringue) | nada fora do lugar | grafite e cartazes na parede de tijolo; o adversário é um pino roxo | pendente |
| 3 | Dress the Star (tapete vermelho) | o tablado de madeira e a cortina de teatro dizem "palco", não "tapete" | parede de imprensa (painel com a marca repetida), cordões de isolamento, fotógrafos | pendente |
| 4 | Personagem de Filme (set) | o refletor de cinema à esquerda está grande demais para a distância e tapa o canto | monitor de vídeo, cabos no chão, cadeira do diretor à vista | pendente |
| 5 | Road to Glory (camarim) | nada fora do lugar | **penteadeira com produtos e cadeira de maquiagem** (sem elas a sala era um provador) | **feito**: penteadeira com gaveteiros, frascos, estojo e pincéis, e cadeira alta, diante do espelho de lâmpadas (visto em foto) |
| 6 | Fashion Detective (hall da gala) | nada fora do lugar | quadros e vitrines de acervo nas paredes; a refação do jogo (8 salas) traz salas novas (`FASHION_DETECTIVE_HISTORIA.md`) | pendente (com a refação) |
| 7 | Boutique 3D | nada fora do lugar | balcão do caixa à vista, prateleira de bolsas e sapatos; a cliente é um pino | pendente |
| 8 | Clube do Coração (ateliê e arquibancada) | o céu azul direto na parede do ateliê, sem a borda do estádio | grade e cobertura da arquibancada, placar, bandeiras do clube inventado | pendente |
| 9 | Favorite Singer (ateliê e palco) | nada fora do lugar | treliça de luz completa, caixas de retorno no palco, plateia | pendente |
| 10 | O Labirinto (corredor de espelhos) | nada fora do lugar | espelhos de verdade nas paredes (hoje são portas), sensação de corredor que continua | pendente (com `MUNDOS.md`) |
| 11 | Piloto Favorito (ateliê e box) | nada fora do lugar | **o carro e a porta do box** (o fundo se lia como uma oficina qualquer) | **feito**: carro de corrida estilizado sem marca e porta de enrolar com trilhos e caixa do rolo (visto em foto) |
| 12 | Around the World (rua de bairro) | nada fora do lugar | fachadas com mais de um andar; a rua acaba numa parede bege lisa | pendente (com `MUNDOS.md`) |
| 13 | Super-Herói (ateliê e terraço) | nada fora do lugar | caixa d'água e antenas no terraço, mais profundidade na cidade | pendente |
| 14 | Fashion Sports (quadra do preparo) | nada fora do lugar | os jogadores do preparo ainda são pinos (na partida já são humanos) | pendente |
| 14 | Fashion Sports (estádio da partida) | nada fora do lugar | — | feito na etapa das pessoas: torcida humana leve e jogadores humanos (`BASE_NUCLEOS.md`) |
| 15 | Batalha de Looks (palco duplo) | nada fora do lugar | plateia e jurados; a parede de cortina metálica precisa de luz de recorte | pendente |

## Onde está no código

- Peças novas desta revisão: `lib/flair/nucleos/scene/moveis/camarim-box.ts` (penteadeira, cadeira de camarim, carro de
  corrida, porta de enrolar).
- Salas revistas: `salas/road-to-glory.ts`, `salas/piloto-favorito.ts`.
- O orçamento de cada sala continua conferido por `lib/flair/nucleos/scene/scene.test.ts`.
