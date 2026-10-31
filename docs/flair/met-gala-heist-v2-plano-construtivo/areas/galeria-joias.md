# Instituto do Traje e Sala das Joias

**Zonas do blueprint:** Z07 (galeria de moda), Z08 (conservação, guarda e acervo) · **Salas da planta:** `galeria`, `cofre`

**Dimensões:** galeria x −12 a 12, z −22 a −6,5 (24 × 15,5 m), pé-direito 5,5 m; Sala das Joias x −22 a −12,5, z −22 a −6,5, pé-direito 5,2 m

**Arquivos da área:** `components/heist/scene/areas/galeria.ts`, `components/heist/scene/areas/cofre.ts` (e arquivos novos `areas/galeria-*.ts`)

## Como está hoje

Galeria como corredor de museu à noite (arcadas, mezanino, caixotões, vitrines com manequins, estátuas). Sala das Joias com veludo, latão, câmeras, lasers e o pedestal do diamante.

## Plano construtivo

| Item | O que construir |
| --- | --- |
| Piso | Galeria: parquet de carvalho em espinha de peixe ou mármore claro com rodapé escuro; Sala das Joias: mármore preto polido com rosácea de latão |
| Paredes | Galeria: paredes de cor profunda por seção da exposição, textos de parede, molduras; Sala das Joias: damasco ameixa, lambri, nichos de vitrine embutidos |
| Teto | Galeria: caixotões com trilhos de luz e spots; Sala das Joias: teto escuro com spots precisos e câmeras |
| Portas | Vão aberto para o salão; porta blindada da Sala das Joias (desenhada pela área do vestíbulo); porta para o terraço |
| Luz | Spots de museu em cada vitrine, luz baixa de ambiente, luz de segurança; na Sala das Joias, foco duro no pedestal |

### Móveis únicos

| Móvel | Uso e razão de estar aqui | Medidas de referência | Colisão | Estado |
| --- | --- | --- | --- | --- |
| Vitrines com manequins individuais e vestidos-escultura | A exposição do Instituto do Traje | vitrine 2 × 2 × 2,4 m | vidro (já existe) | PLANEJADO |
| Vitrine circular de joia com vidro espesso | Peça central de joalheria | Ø 1,0 × 1,8 m | vidro | PLANEJADO |
| Banco escultural de galeria | Pausa para olhar | 2,4 × 0,5 × 0,45 m | baixa (já existe) | PLANEJADO |
| Mesa de croquis e amostras têxteis | Processo criativo exposto | 2,0 × 0,9 × 0,9 m | baixa | PLANEJADO |
| Mesa de restauração com suportes acolchoados (Sala das Joias) | Conservação do acervo (Z08) | 1,8 × 0,9 × 0,9 m | baixa | PLANEJADO |
| Gaveteiro horizontal, estação fotográfica e carrinho de acervo | Guarda e documentação (Z08) | gaveteiro 1,5 × 1,0 × 1,0 m | baixa | PLANEJADO |

### Objetos de cena

Etiquetas das peças, textos de parede, cordões de distância, sensores, catálogos, luvas brancas, lupas, réguas, câmeras no teto, placas de saída.

### Pessoas

Convidados olhando as vitrines, curadora circulando, seguranças da Sala das Joias.

### Regras de jogo

A porta da Sala das Joias, o pedestal, os lasers, o duto e as vitrines com joias continuam onde estão (furto e cena do diamante dependem deles). Colisão nova como `fixture`.

### Vistas de aceite

Galeria do vão do salão; vitrine de perto (vidro, manequim e etiqueta); Sala das Joias da porta; pedestal de perto; vista alta.

## Estudo da área

_Preenchido pelo agente da área: referências de uso real, por que cada móvel faz sentido, materiais e medidas._

## Implementado

_Preenchido pelo agente da área: cada item com arquivo e função, captura e estado._
