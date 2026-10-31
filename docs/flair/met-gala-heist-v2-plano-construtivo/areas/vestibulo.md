# Vestíbulo e escadaria (e as portas do prédio)

**Zonas do blueprint:** Z02 (vestíbulo e credenciamento), Z03 (corredores nobres), Z14 (escadas e passagens) · **Salas da planta:** `vestibulo` + todas as portas internas

**Dimensões:** x −8 a 8, z 14,5 a 24 (16 × 9,5 m), pé-direito 6,5 m

**Arquivos da área:** `components/heist/scene/areas/vestibulo.ts`, `components/heist/scene/interior-doors.ts` (portas de todas as salas)

## Como está hoje

Tapete vermelho, viga do detector, lustre, letreiros, cartazes, credenciamento, chapelaria e vasos. Piso xadrez sem bordas nem embutidos; paredes de pedra lisas; nenhuma escadaria.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Granito polido (preto absoluto e branco) com faixa de borda, rosácea central embutida e soleiras de mármore; o tapete vermelho com debrum e varões de latão nos pontos de dobra |
| Paredes | Pedra calcária em blocos com junta fina, pilastras com capitel, nichos com estátua ou vaso, lambri de mármore até 1,1 m, cimalha, sanca, placas de bronze |
| Teto | Caixotões profundos com rosáceas e filete dourado, medalhão central de onde desce o lustre de cristal |
| Portas | Todas as portas internas do prédio (dono: esta área): folhas duplas de 4 m do salão com almofadas entalhadas e puxadores de latão; portas de serviço de aço com chapa de chute e barra antipânico; porta acolchoada do lounge; porta preta do palco com estêncil; porta blindada da Sala das Joias com volante e trancas; batentes e guarnições com perfil, dobradiças visíveis, molas aéreas, LEDs das fechaduras |
| Luz | Lustre de cristal central, arandelas de parede em pares, luz rasante nos nichos, a luz da rua entrando pela porta |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Escadaria monumental (dois lances curvos até uma galeria sobre a porta do salão) | A subida cerimonial que o blueprint pede (Z14); camarote para olhar a chegada | degrau 17 × 30 cm, largura 1,8 m, corrimão a 0,9 m | alta nos lances | PLANEJADO |
| Balcão curvo de credenciamento Nocturne com gavetas e leitor | Recepção dos convites e pulseiras | 3,0 × 0,7 × 1,1 m | baixa (já existe como desk) | PLANEJADO |
| Banco escultural Silhouette com estofamento | Espera de quem chega | 2,0 × 0,6 × 0,45 m | baixa | PLANEJADO |
| Guarda-volumes com cabides e nichos numerados | Chapelaria (onde a joia guardada fica) | 4,0 × 0,6 × 2,2 m | baixa (já existe como coatcheck) | PLANEJADO |
| Mesa floral com arranjo exclusivo do evento | Peça central de quem entra | Ø 1,4 m, arranjo até 2,2 m | baixa | PLANEJADO |
| Painel de indicação dos pavimentos e totem acessível | Orientação (Z14) | 0,6 × 0,1 × 1,8 m | baixa | PLANEJADO |

### Objetos de cena

Livro de presença, leitores de QR, pulseiras em bandejas, porta-guarda-chuvas, cabideiro, extintor discreto em nicho, placas de bronze, cordões e totens, bandeja de taças de boas-vindas.

### Pessoas

Recepcionistas, equipe de credenciamento, convidados chegando e conversando, segurança no detector.

### Regras de jogo

O detector e a porta do salão (z 14), a porta lateral da doca (x −8, z 20 a 22,5), a chapelaria e o balcão continuam acessíveis; a escadaria fica junto às paredes sem fechar a passagem do tapete. Colisão nova como `fixture`.

### Vistas de aceite

Da porta da rua para o salão; escadaria de baixo; balcão e livro de perto; vista alta do vestíbulo; cada tipo de porta de perto (salão, serviço, lounge, palco, Sala das Joias).

## Estudo da área

_Preenchido pelo agente da área: referências de uso real, por que cada móvel faz sentido, materiais e medidas._

## Implementado

_Preenchido pelo agente da área: cada item com arquivo e função, captura e estado._
