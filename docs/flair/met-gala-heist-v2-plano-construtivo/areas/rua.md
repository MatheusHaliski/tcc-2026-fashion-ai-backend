# Rua: avenida, fachada e cidade

**Zonas do blueprint:** Z01 (fachada e tapete vermelho) · **Salas da planta:** `rua`

**Dimensões:** x −30 a 30, z 24,5 a 50,5; calçada em y −1,6 e pista em −1,75; escadaria de 12 degraus até as portas (z 24,5 a 31)

**Arquivos da área:** `components/heist/scene/exterior.tsx`, `exterior-street.tsx`, `exterior-city.tsx`, `exterior-facade.tsx`, `exterior-vehicles.tsx`, `exterior-fx.tsx`, `exterior-textures.ts`, `exterior-materials.ts`, `exterior-geometry.ts`, `sky.tsx`; laboratório `/lab/heist-rua`

## Como está hoje

Avenida noturna com a fachada neoclássica, escadaria com tapete, arquibancada de fotógrafos e imprensa, fila, limusines, caminhão do bufê, viatura, grades dos fãs e a barraca do revendedor. A cidade ao fundo é rala e a calçada é limpa demais: parece cenário de estúdio.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Calçada em placas de granito cinza (60 × 60 cm) com juntas, desgaste e manchas; meio-fio de granito com sarjeta; asfalto molhado com faixa de pedestre gasta, tampas de bueiro e de inspeção, remendos; sujeira de cidade: chicletes, manchas de óleo, folhas, poças rasas com reflexo, **panfletos espalhados** (shows, festas, a própria gala, sem marcas reais) e **bitucas de cigarro** concentradas perto das lixeiras, do ponto de ônibus e da fila |
| Paredes | Fachada do museu (já existe) com mais relevo: almofadas de pedra, frisos, placas de bronze com o nome do museu, iluminação de destaque; **a quadra inteira com prédios vizinhos**: térreos com **vitrines de loja** (moda, joalheria, café, farmácia, banca — nomes fictícios), toldos, portas de enrolar, letreiros de neon e luminosos; andares de cima com janelas de tipos diferentes, varandas, aparelhos de ar-condicionado, persianas, algumas acesas |
| Teto | Céu noturno com nuvens iluminadas pela cidade, holofotes da gala; **skyline ao fundo** com prédios altos em camadas (perto, meio, longe), janelas acesas em padrão irregular, antenas, luzes de aviso vermelhas |
| Portas | Portas de bronze do museu (folha dupla com almofadas e puxadores); portas das lojas (vidro com caixilho, porta de enrolar meio aberta); portão da doca |
| Luz | Postes de rua com luminária real (vapor de sódio e LED), luz das vitrines saindo para a calçada, letreiros de neon, faróis e lanternas dos carros, flashes dos fotógrafos |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Banco escultural de pedra e vasos monumentais | Marcam a entrada do museu e seguram a fila | banco 2,4 × 0,6 × 0,45 m; vaso Ø 0,9 × 1,2 m | baixa | PLANEJADO |
| Totens e cordões de veludo | Organizam a chegada e o tapete | totem Ø 0,3 × 1,0 m; cordão a 0,9 m | baixa (já existe como rope) | PLANEJADO |
| Painel fotográfico (step-and-repeat) com armação | Onde as celebridades posam | 3,0 × 2,4 m, armação de alumínio com sapatas | alta | PLANEJADO |
| Balcão do manobrista | Chaves dos carros, guarda-chuvas | 1,2 × 0,6 × 1,1 m | baixa | PLANEJADO |
| Ponto de ônibus com abrigo e banca de jornal | Vida da cidade fora da gala; esconderijo visual | abrigo 4 × 1,5 × 2,6 m; banca 2,5 × 1,5 × 2,4 m | alta | PLANEJADO |
| Lixeiras, parquímetros, hidrante, placas e semáforos | Mobiliário urbano que dá escala | lixeira Ø 0,45 × 0,9 m | baixa | PLANEJADO |

### Objetos de cena

Sacos de lixo, copos descartáveis, garrafas, panfletos no chão e colados em postes, bitucas, cartazes lambe-lambe, grades de árvore, bicicletas presas a postes, cones, barreiras de imprensa, cabos de TV, holofotes no chão.

### Pessoas

Fãs atrás das grades, fotógrafos, imprensa, fila com convite, recepcionistas, motoristas, manobristas, seguranças da rua, a celebridade posando.

### Regras de jogo

A calçada e a escadaria continuam com a mesma altura e colisão (`floorY`); a fila, o portão do tapete, a barraca do revendedor e os carros da fuga ficam onde estão. Mobiliário urbano novo com colisão entra como `fixture` na seção da rua de `baseProps()` e passa no teste de proteção.

### Vistas de aceite

Geral da avenida ao nível dos olhos; fachada com a cidade atrás; detalhe da calçada a 1 m (panfletos, bitucas, juntas); vitrines de loja de perto; vista alta (drone) mostrando a quadra e o skyline.

## Estudo da área

_Preenchido pelo agente da área: referências de uso real, por que cada móvel faz sentido, materiais e medidas._

## Implementado

_Preenchido pelo agente da área: cada item com arquivo e função, captura e estado._
