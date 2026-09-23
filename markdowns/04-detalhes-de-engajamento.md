# Detalhes de Engajamento — Meu Quarto, Destaques, Desafios e Copilot

**Projeto:** FashionAI (SAI-TCC-2026)
**Status:** proposta (v0.1), para revisão do time
**Complementa:** [`01-especificacao-meu-quarto.md`](01-especificacao-meu-quarto.md) · [`02-inventory-score-calculo.md`](02-inventory-score-calculo.md) · [`03-desafios-e-games.md`](03-desafios-e-games.md)

> **Premissa:** um detalhe pode valer mais do que uma estrutura inteira. Cada item aqui é pequeno de implementar, está preso a um RF já especificado e se apoia num princípio reconhecido de moda, design, marketing, publicidade ou games, ou num ritual que as comunidades de moda já praticam.

Cada detalhe tem um ID `DET-xx`, a regra verificável (o que precisa acontecer para contar como entregue), o RF que o hospeda e a fase de entrega de [`01`](01-especificacao-meu-quarto.md) §7.

---

## 1. Os 7 prioritários

Se só couber uma parte, são estes:

| # | ID | Detalhe | Por quê |
|---|---|---|---|
| 1 | DET-G01 | Álbum de Combinações | transforma a Versatilidade num jogo de colecionar **o que você já tem**: a gamificação mais alinhada ao manifesto |
| 2 | DET-M01 | Botão "Tira uma coisa" | um botão que carrega a teoria de moda inteira e dá personalidade ao espelho |
| 3 | DET-K01 | Retrospectiva do Guarda-Roupa | ritual anual compartilhável, divulgação orgânica |
| 4 | DET-K02 | "Arrume-se Comigo" automático | formato viral que sai de graça de uma interação que já existe |
| 5 | DET-M03 | Peça em croqui que ganha cor | resolve catalogação incompleta com beleza, sem cobrança |
| 6 | DET-C04 | Desafio do Dia | motivo diário para abrir o app e conversa em comum (RF36) |
| 7 | DET-D01 | Interruptor de luz = modo escuro | quase sem custo, e é o que as pessoas mostram para os amigos |

---

## 2. Teoria de moda (`DET-M`)

| ID | Detalhe | Regra verificável | RF | Fase |
|---|---|---|---|---|
| DET-M01 | **"Tira uma coisa"** (regra atribuída a Coco Chanel) | com um look completo que tenha ≥ 1 acessório ou camada opcional, o espelho mostra o botão. A IA indica **uma** peça para tirar e diz por quê ("o colar compete com a estampa"). Aceitar atualiza o look no espelho | RF33 | 2 |
| DET-M02 | **Etiqueta de composição como interface** | o detalhe da peça no quarto abre como uma etiqueta costurada: símbolos de lavagem, composição, origem e contador de usos. Os mesmos dados do modal atual, em outra apresentação | RF32 | 2 |
| DET-M03 | **Peça em croqui** | peça sem `approved_catalog_2d_url` aparece como desenho técnico em traço. Quando a imagem é aprovada, uma animação de ~600 ms faz a transição do croqui para a foto | RF32 | 1 |
| DET-M04 | **Contador "30 usos"** (#30wears) | a etiqueta mostra o número de usos. Ao chegar a 30, a peça ganha um ponto dourado permanente. Se o preço estiver cadastrado, mostra o **custo por uso**, só para o dono | RF32, RF34 | 2 |
| DET-M05 | **Coloração pessoal** | o DNA ganha um campo opcional de estação (primavera/verão/outono/inverno). Com o campo preenchido, a luz do espelho usa a temperatura da estação e o Vista-me prioriza a cartela | RF13, RF33 | 3 |
| DET-M06 | **Leitura de silhueta e proporção** | com um look completo no espelho, uma sobreposição que pode ser ligada e desligada mostra a silhueta (A, H, V, X) e a regra de 1/3–2/3. O Copilot explica com vocabulário de moda | RF33 | 3 |
| DET-M07 | **Origem da peça** | campo opcional no RF4: comprada · garimpada · herdada · presente · feita à mão · trocada. O Copilot pode usar ("aquele blazer herdado não sai há 80 dias") e a origem garimpada gera o selo **Garimpo** | RF4, RF10 | 2 |

## 3. Design de produto e design gráfico (`DET-D`)

| ID | Detalhe | Regra verificável | RF | Fase |
|---|---|---|---|---|
| DET-D01 | **Interruptor de luz = modo escuro** | um interruptor na parede do quarto alterna o tema do app (RF23). A preferência é a mesma das Configurações, e os dois controles ficam sincronizados | RF32, RF23 | 1 |
| DET-D02 | **Luz do horário real** | a iluminação da cena segue o horário local: manhã fria, tarde dourada, noite com abajur. Com "reduzir movimento" ativo, a luz fica fixa | RF32 | 1 |
| DET-D03 | **O "puff" da poeira** | ao resgatar uma peça esquecida, uma partícula de poeira (≤ 400 ms) sai e o cabide balança. Respeita "reduzir movimento" | RF32 | 2 |
| DET-D04 | **Som de tecido e háptico** | gavetas e portas têm som por material (jeans ≠ seda) e háptico leve no celular. **Desligado por padrão** para som, ligado para háptico. Controles nas Configurações | RF32 | 2 |
| DET-D05 | **Look pendurado no espelho** | um look incompleto continua no espelho entre sessões, com um post-it indicando o que falta ("faltou o sapato") | RF33 | 1 |
| DET-D06 | **Progresso inicial concedido** | o painel de primeiros passos do Inventory Score já começa com os passos cumpridos no cadastro (conta criada, primeira peça) marcados | RF34 | 2 |
| DET-D07 | **Fecho do Vista-me** | ao aceitar um look, a porta aberta se fecha, a luz do espelho sobe e aparece a foto do look. É o pico emocional no fim do fluxo | RF33 | 2 |
| DET-D08 | **Estado vazio com charme** | gaveta sem peças mostra um sachê de lavanda e uma meia sem par, com a ação "Adicionar peça a esta gaveta" | RF32 | 1 |
| DET-D09 | **Antes e depois da peça** | no detalhe da peça, um controle deslizante compara a foto original com o flat lay tratado pelo pipeline do RF4. Pode ser exportado como imagem | RF4, RF32 | 2 |

## 4. Marketing e publicidade (`DET-K`)

| ID | Detalhe | Regra verificável | RF | Fase |
|---|---|---|---|---|
| DET-K01 | **Retrospectiva do Guarda-Roupa** | uma vez por ano (dezembro), a Destaques gera uma sequência de 6 a 8 cards 9:16: peça mais usada, peça resgatada do ano, cor pessoal do ano, número de looks únicos, custo por uso médio (só se houver preço, e nunca no card público) | RF34 | 3 |
| DET-K02 | **"Arrume-se Comigo" automático** | depois de um Vista-me aceito, a opção "Gerar vídeo" exporta um vídeo vertical (≤ 15 s) com a sequência de portas acendendo, peças indo ao espelho e o look pronto. Sem música com direitos autorais | RF33 | 3 |
| DET-K03 | **Monograma nas portas** | a partir do nível Studio, o usuário grava até 3 iniciais nas portas e gavetas do móvel, em baixo-relevo | RF35 | 3 |
| DET-K04 | **Manifesto "Vista o que você tem"** | o manifesto aparece no onboarding do Meu Quarto e em Destaques. Na Fashion Revolution Week (abril), o desafio `WEAR_WHAT_YOU_HAVE` (RF36) entra em destaque | RF34, RF36 | 3 |
| DET-K05 | **Chave do Quarto** | um convite é entregue como uma chave. Quem aceita pode visitar o quarto de quem convidou (Room Tour) e ser convidado para desafios (RF36.CA04). A chave aparece pendurada num gancho perto da porta | RF32, RF36 | 4 |
| DET-K06 | **Prova social pelo DNA** | frases como "12 pessoas com o seu arquétipo usaram jaqueta jeans esta semana". O número só aparece quando o grupo tem ≥ 10 pessoas, e nenhuma é identificada | RF10, RF13 | 4 |
| DET-K07 | **Capa de revista FAI** | quando um Look do Dia atinge a faixa "Arrasando no Look" ou superior do Hype Score, o usuário recebe uma capa editorial "FAI Magazine" com o look e o nome dele, exportável. Nenhuma marca editorial real é imitada | RF6 | 4 |

## 5. Games (`DET-G`)

| ID | Detalhe | Regra verificável | RF | Fase |
|---|---|---|---|---|
| DET-G01 | **Álbum de Combinações** | em Destaques, mostra "Você descobriu X% das combinações possíveis". As combinações válidas ([`02`](02-inventory-score-calculo.md) §3.4) ainda não montadas aparecem como silhuetas cinza, e tocar numa delas leva a composição ao espelho. É calculado por máscara de ocasiões, sem contar duas vezes a mesma combinação ([`02`](02-inventory-score-calculo.md) §7) | RF34, RF33 | 2 |
| DET-G02 | **Copilot com corpo** | no quarto, o Copilot é representado por um busto de costura no canto, que vira quando o usuário fala e aponta a posição citada na resposta. Sem rosto humano | RF10, RF32 | 2 |
| DET-G03 | **Conquistas secretas** | conquistas que não aparecem na lista até serem obtidas: Monocromático (look de uma cor só), Chanel (usar "Tira uma coisa"), Sexta Casual, Madrugada (Vista-me entre 0 h e 5 h). Ao desbloquear, a lista mostra a conquista com a data | RF34 | 3 |
| DET-G04 | **Modo foto** | o quarto tem modo foto com 4 enquadramentos pré-definidos, profundidade de campo e 3 filtros. A exportação sai sem a interface | RF32 | 3 |
| DET-G05 | **Recordes pessoais** | Destaques mostra recordes do próprio usuário: dias seguidos sem repetir look, peças resgatadas numa semana, maior 10×10. Nunca comparados com outros usuários | RF34 | 2 |
| DET-G06 | **Cabide de reserva** | protege uma sequência (Look do Dia, Sem Repetir) em 1 dia perdido por semana, automaticamente. Nenhuma notificação de "você vai perder sua sequência" | RF35, RF36 | 3 |
| DET-G07 | **Estações vivas** | decoração sazonal discreta em datas reais (festa junina, fim de ano). Pode ser desligada | RF32 | 4 |

## 6. Rituais das comunidades (`DET-C`)

| ID | Comunidade de origem | Ritual | Onde entra | RF | Fase |
|---|---|---|---|---|---|
| DET-C01 | Style Bee / capsule wardrobe | 10×10 | desafio `TEN_X_TEN` com quadro de cortiça no quarto | RF36 | 3 |
| DET-C02 | Project 333 | 33 peças por 3 meses | desafio `CAPSULE_SEASON` | RF36 | 3 |
| DET-C03 | Reddit (r/malefashionadvice, r/femalefashionadvice) | WAYWT semanal | tópico fixo semanal "O que você está vestindo?" no The Runway | RF19 | 4 |
| DET-C04 | Wordle | mesma regra para todos, resultado em emoji | desafio `DAILY_CHALLENGE` | RF36 | 4 |
| DET-C05 | Roblox *Dress to Impress* | rodadas temáticas com votação | desafio `RUNWAY_BATTLE` com votação às cegas | RF36 | 4 |
| DET-C06 | TikTok / Pinterest | microestéticas "-core" (old money, quiet luxury, gorpcore, coquette, Y2K) | o arquétipo do DNA usa esse vocabulário, com o quiz "Qual é o seu core?" como primeiro contato | RF13 | 3 |
| DET-C07 | Letterboxd | diário, notas e estatísticas | **Diário da Peça**: cada uso com data, ocasião e uma nota curta opcional | RF32, RF34 | 3 |
| DET-C08 | BeReal / selfie no espelho | espontaneidade num horário aleatório | desafio `REAL_MIRROR` (opcional, privado por padrão) | RF36 | 4 |
| DET-C09 | Enjoei / Vinted / brechós | "desapego" e "garimpo" | a arara de venda se chama **Arara do Desapego**, e a peça garimpada ganha o selo **Garimpo** (DET-M07) | RF32 | 2 |
| DET-C10 | Instagram BR | #lookdodia | o Look do Dia mantém esse nome e ganha um formato de exportação pronto para o feed | RF6 | 2 |
| DET-C11 | Dribbble / Behance | mostrar processo | modo foto (DET-G04) e antes e depois (DET-D09) viram o "portfólio" do guarda-roupa | RF32 | 3 |

---

## 7. Limites éticos (normativos)

Todos os detalhes acima estão sujeitos a estas regras, que têm peso de critério de aceitação:

| ID | Regra |
|---|---|
| ETI-01 | Escassez (drops, edições limitadas) só existe para **itens cosméticos**. Nenhuma função fica atrás de escassez |
| ETI-02 | Nenhuma notificação de culpa ou de perda ("você vai perder sua sequência!", "sua equipe está esperando por você"). Toda sequência tem o Cabide de Reserva (DET-G06) |
| ETI-03 | Prova social só com grupos de ≥ 10 pessoas e sem identificar ninguém (DET-K06) |
| ETI-04 | Custo por uso e preço das peças nunca são públicos, nem em cards exportados ou desafios |
| ETI-05 | Qualquer foto real do usuário (Espelho de Verdade) é privada por padrão e exige consentimento explícito para ser vista pela equipe |
| ETI-06 | Todo efeito de movimento respeita "reduzir movimento". Todo som vem desligado por padrão |
| ETI-07 | Nenhum detalhe imita marca, veículo editorial ou pessoa real (a capa é "FAI Magazine", sem logotipo de terceiros) |
