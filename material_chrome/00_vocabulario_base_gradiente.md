# Vocabulário-base — Gradiente "Prata/Platina"

Reutilizado por todos os outros arquivos desta pasta. Sempre que um prompt disser "aplique o gradiente-base", refere-se a esta estrutura.

## Prompt-base (copiar/colar como fundação de qualquer elemento)

> Simule uma superfície de alumínio escovado sob luz difusa de estúdio — nunca um espelho polido. O brilho é largo e suave, não um reflexo pontual.
>
> **Estrutura em 4 paradas**, ao longo do eixo do gradiente:
> 1. *Highlight* — quase branco-azulado, no topo/borda de luz.
> 2. *Midtone* — cinza-claro neutro, ocupa a maior parte da área.
> 3. *Banda de sombra* — cinza-média mais fria, cria a sensação de "vinco" ou canal usinado.
> 4. *Highlight secundário* — mais fraco, perto da borda oposta, simula luz refletida de baixo.
>
> **Direção:**
> - 135° (diagonal, canto superior-esquerdo → inferior-direito) em superfícies grandes (containers, modais).
> - 180° (vertical, topo → base) em barras compridas e finas (topbar, sidebar) — como se a luz caísse de cima.
>
> **Textura:** leve ruído/grão (2–4% de opacidade) sobreposto ao gradiente. Sem esse grão o resultado parece holograma/plástico, não metal.
>
> **Borda:** 1px interna, no tom mais claro do highlight, 60–80% de opacidade, **só no lado voltado para a luz** (nunca contornando a peça inteira).
>
> **Sombra externa:** suave, cinza-fria, nunca preta pura, deslocada para baixo — simula o objeto "pousado" sobre a superfície de fundo, não flutuando.

## Variante de tema

**Modo claro** — highlight quase-branco levemente azulado, midtone cinza-claro neutro, sombra cinza-média fria. Sem preto puro em nenhuma parada.

**Modo escuro** — mesmo perfil de luz, midtone escurecido para cinza-grafite, highlight reduzido em intensidade (não vira branco puro, para não competir com o conteúdo). O metal deve parecer "opaco e nobre", não "aceso".

## O que este vocabulário NÃO é

- Não é um espelho cromado brilhante (reflexo nítido de ambiente) — isso lembra objeto 3D genérico, não acabamento de produto.
- Não é holográfico/iridescente (arco-íris de cor) — isso pertence ao skin de card "Trading" (RF11), não ao chrome do app.
- Não é dourado/quente — a paleta é fria (prata/platina) em toda a casca da interface.
