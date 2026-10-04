# RF18 — Provador virtual de lojas (refeito com a Busca Catalogada do RF47)

> 04/10/2026 · Substitui o provador que repetia o Espelho (RF28). Código: `app/(site)/(app)/try-on/page.tsx`,
> `components/three/fitting-room-scene.tsx`, `lib/tryon/fitting-room.ts` (motor de ambiente, testado em
> `lib/tryon/fitting-room.test.ts`), `components/catalog/fitting-room.test.tsx`.

## 1. Por que mudou

O Espelho (RF28) monta looks com o que a pessoa **já tem**. O provador antigo fazia a mesma coisa com as peças do
guarda-roupa. Agora o Provador prova o que a pessoa **ainda não tem**: peças de várias marcas e lojas do catálogo
(RF47) ao mesmo tempo, no próprio Avatar 3D, sem ir a uma loja física. As peças do guarda-roupa continuam disponíveis,
mas para **combinar** com as das lojas ("este tênis combina com o meu jeans?").

## 2. O que a pessoa faz

1. **Lojas em destaque** — cartões das marcas do catálogo (`GET /api/catalog/stores`). Tocar numa loja abre a vitrine
   dela (a busca do RF47 em modo navegação: só a marca já lista produtos).
2. **O que provar** — filtro por tipo (parte superior, inferior, calçados, acessórios, peça única) e busca por nome.
3. **Provar** — a peça veste no lugar dela (parte de cima, de baixo, calçado, acessório); a peça inteira cobre a parte
   de baixo. Peças de marcas diferentes ficam no corpo ao mesmo tempo.
4. **Provando agora** — cada lugar mostra marca, origem (Loja / Meu guarda-roupa), cor, **trocar a cor** (variantes do
   produto), **Ver em <loja oficial>** e **Já tenho esta peça** (entra no guarda-roupa por referência ao catálogo, via
   `POST /api/pieces/from-catalog`).
5. **Meu guarda-roupa** — as peças da pessoa por lugar, para combinar com as das lojas. Guarda-roupa vazio não bloqueia
   mais o provador.
6. **Provas salvas** — salvar a combinação atual (até 8, neste navegador) e provar de novo depois.
7. **Tirar foto** (PNG do palco), **Copiar link da prova** (`/try-on?provar=c.<produto>.<variante>,w.<peça>`, reabre a
   mesma prova), **Limpar**.

## 3. Ambiente 3D dinâmico por marca

O provador é uma loja 3D desenhada no navegador (texturas em canvas, sem baixar cenários):

| Elemento | O que muda com a marca |
|---|---|
| Faixa da marca (acima da cabeça) | logo do catálogo, ou o nome escrito quando a marca não tem logo |
| Letreiro iluminado | nome da marca na cor de destaque (mais forte no modo Noite) |
| Paredes | cor e padrão do tema (quadra, listras, xadrez, denim, grade, chevron, liso) |
| Piso | estilo da loja (quadra, tábuas, concreto, mármore, galeria polida, ateliê) |
| Palco do avatar, faixa de luz no teto, rodapé | cor de destaque |
| Cenografia | cortina de provador, espelho de corpo inteiro, arara com cabides e banco nas cores do tema |
| Painéis laterais | as **outras** marcas vestidas (provador multimarca, até 3) |

**Motor de ambiente** (`resolveEnvironment`): a marca da **última peça escolhida** é o destaque; as demais marcas
vestidas viram painéis laterais. A pessoa pode **fixar** uma marca (o ambiente fica nela enquanto continua provando) ou
deixar o provador **neutro** (ambiente FashionAI). Trocar de marca anima as cores e o painel entra com escala suave;
"reduzir movimento" troca na hora.

**Temas**: as 10 marcas semeadas têm tema escolhido à mão (cores e estilo de ambiente inspirados na loja física — não
reproduzem identidade visual; o logo só entra pela URL que o catálogo guarda). Qualquer outra marca ganha um tema
derivado do nome, estável (a mesma marca sempre gera o mesmo provador).

**Luz**: Loja (spots quentes), Dia (clara e fria) e Noite (baixa, com letreiro e anel brilhando). **Vistas**: frente,
3/4, perfil e costas, além de girar e aproximar com o mouse/toque.

## 4. Regras

- A roupa no corpo é a **prévia projetada** no molde do avatar: mostra o visual e a combinação, **não** é prova de
  caimento nem de tamanho — a tela diz isso.
- Zonas do corpo sem peça recebem a peça padrão do FashionAI (o avatar nunca fica sem roupa).
- Só produtos do catálogo com origem rastreável (RF47); "Ver na loja" abre o domínio oficial registrado no produto.
- A prova fica na sessão do navegador; provas salvas ficam no navegador; nada vai para o servidor até "Já tenho esta
  peça".

## 5. Limitações conhecidas

- O molde 3D de calçado ainda é justo ao pé (efeito "meia"); o de roupas segue o corpo, sem simulação de tecido.
- Os produtos do seed não têm foto oficial: a peça é vestida na **cor** da variante. Com foto oficial (e CORS liberado
  pelo domínio), a foto é projetada no molde.
- A imagem 2D gerada no servidor (`POST /api/try-on/renders`) saiu da tela nesta versão; a rota continua no backend.
