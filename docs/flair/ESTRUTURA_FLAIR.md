# A estrutura dos jogos FLAIR

Todo jogo do FashionAI se chama FLAIR. Há três segmentos, definidos pela dona do projeto em 08/11/2026.

| Segmento | O que é | Documentos |
| --- | --- | --- |
| **FLAIR Card Building Challenge** | Elencos de cartas ligadas por linhas que acendem quando duas cartas têm marca, subcategoria, categoria, estilo, cor ou ocasião em comum, como o SBC do FIFA 21. Recompensas: itens do FashionAI, cupons de marca, itens promocionais e uma arte exclusiva numerada. | `cbc/FLAIR_CBC.md`, `cbc/CINCO_ELENCOS.md` |
| **FLAIR 3D** | As modalidades 3D em que a roupa decide: A Passarela, Dress Fighter, Dress the Star, Personagem de Filme, Fashion Detective, Boutique 3D, Grupo Ateliê 3D (Clube do Coração, My Favorite Singer, Meu Piloto Favorito e Meu Super-Herói Favorito), O Labirinto, Around the World, Fashion Sports e Batalha de Looks. | `flair-3d/JOGOS.md`, `flair-3d/OBJETIVOS_POR_JOGO.md` |
| **FLAIR 3D MAKE UP** | O Road to Glory: vestimenta, maquiagem e cabelo no estilo do DREST, com temporadas e níveis que desbloqueiam recursos e itens promocionais. A diferença para o DREST é a câmera 3D do provador. | `flair-3d-make-up/PLANO.md`, `flair-3d-make-up/ESTUDO_DREST.md`, `flair-3d-make-up/IMPLEMENTACAO.md` |

Fora do FashionAI: o Roubo ao Afterparty e o Met Gala Heist saíram da lista e ficam para o futuro jogo de PlayStation
Glass Empire, que está fora do escopo do app.

## Rotas e API de cada segmento

Inventário completo, com chamadores, testes e veredito: `ENDPOINTS_FLAIR.md` (15/11/2026).

| Segmento | Telas | API |
| --- | --- | --- |
| FLAIR Card Building Challenge | `/flair/desafios`, `/flair/desafios/[slug]`, `/flair/elencos`, `/flair/elencos/[elenco]` | `/api/flair/challenges/...`, `/api/flair/elencos/...` |
| FLAIR 3D | `/flair/3d`, `/flair/3d/[nucleo]`; na Central FLAIR, o modo "FLAIR 3D" | `/api/flair/3d/...` (`Flair3dNucleoController`) |
| FLAIR 3D MAKE UP | `/flair/make-up`, `/flair/make-up/[brief]` | `/api/flair/make-up/...` |

Só `/flair/3d` se chama FLAIR 3D. Os cinco capítulos do desenho anterior (Espelho Partido, Prova com a Estrela, Rooftop
ao Pôr do Sol, Cinco Clientes e Chefe: Vellard, em `/flair/jogos` sobre `/api/flair/games/...`) ficam no app como
**Cidade de Vidro**, fora dos três segmentos e fora da Central, porque o capítulo da Suíte de Vidro é o único lugar que
mostra o quarto em 3D e os capítulos são a única fonte das recompensas deles (`ENDPOINTS_FLAIR.md` §1.1). Os modos
clássicos (`/flair/partidas`) e a coleção (`/flair/cartas`, `/decks`, `/lojas`, `/carteira`, `/missoes`) continuam na
Central.
