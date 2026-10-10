# Prova no espelho dentro do quarto (RF27 ↔ RF28)

As abas **Meu Quarto** e **Espelho** passam a ser um fluxo só: o personagem caminha até o espelho e a prova abre sozinha,
sem sair do quarto e sem trocar de tela; afastar-se volta ao quarto. A tela `/mirror` continua existindo (Vista-me,
tipo de look, GRWM), mas a prova rápida de "o que eu tenho na mão" acontece no próprio quarto.

## Estados e transições

```
Quarto ──(distância < 1,15 m, por 350 ms)──► Aproximação ──► Prova ──(troca)──► Prova
  ▲                                                                   │
  └──(distância > 1,70 m, por 250 ms)── Saída ◄──────────────────────┘
```

| Fase | O que a pessoa vê | Câmera | Personagem |
|---|---|---|---|
| `room` | quarto, painel com a ajuda de primeiro uso e **Abrir espelho** | visão geral (guarda-roupa, personagem, espelho) | anda com as setas |
| `approach` | "Chegando ao espelho…" | começa a ir para a frente do espelho | vira de frente para o espelho |
| `tryon` | lista **Roupas em mãos**, por lugar do corpo | de frente para o espelho, personagem e vidro no quadro | parado, reage a cada troca |
| `exit` | "Saindo do espelho…" | volta à visão geral | anda |

Regras (em `lib/room3d/mirror-session.ts`, sem React):

- **Zona com histerese**: entra a menos de 1,15 m, só sai a mais de 1,70 m, com 350 ms na entrada e 250 ms na saída.
  Parar exatamente na divisa não faz a prova piscar; voltar durante a saída retoma a prova sem reabrir do zero.
- **Abrir à mão** (`Abrir espelho`) mantém a prova aberta a qualquer distância até **Voltar ao quarto**. Fechar à mão
  dentro da zona não reabre sozinho: a pessoa precisa sair da zona e voltar.
- **A seleção mais recente prevalece**: cada troca recebe um número; a resposta de um pedido antigo que chega depois é
  ignorada. Uma falha mantém a roupa anterior (o espelho só muda com a resposta do servidor) e avisa sem opinar:
  "Não deu para trocar (…); a peça anterior continua."
- O estado é um só para a cena 3D (`RoomAvatarController`), o painel (`MirrorHands`) e a página (`/room`): a cena
  atualiza a fase pela distância a cada quadro; a página faz os pedidos à API do espelho (`POST/DELETE
  /api/me/mirror/pieces`, `GET /api/me/mirror/wardrobe?slot=`) e o reflexo (Prévia 2D no vidro) e a roupa do personagem
  seguem o mesmo estado do espelho.

## Roupas em mãos

Quatro lugares: **Parte de cima · Parte de baixo · Calçado · Acessório** (camada externa e vestido contam como parte de
cima). Cada peça mostra miniatura, nome, categoria, se está **no espelho** ou **na mão** (pegou no guarda-roupa e ainda
não vestiu) e o estado do asset:

| Estado | Significado |
|---|---|
| Modelo 3D | a peça tem `model3dUrl` próprio |
| Molde 3D (aproximação) | molde paramétrico da subcategoria (`kindOf`), com a foto projetada |
| Só na prévia 2D | sem molde (acessórios): aparece só na Prévia 2D/reflexo |
| Foto em processamento | foto ainda sem a versão final |

Ações: **Vestir** (peça na mão), **Tirar** (vestida), **Trocar** (escolha manual do guarda-roupa para o lugar, a mesma
lista da tela Espelho) e **Voltar ao quarto**.

## Reação à troca

Ao vestir, o personagem reage conforme o lugar: parte de cima abre os braços e gira o tronco; parte de baixo levanta o
joelho; calçado bate o pé; acessório inclina a cabeça (`reactionPose`). Com "reduzir movimento" a reação é a mesma, 35%
da amplitude e 320 ms em vez de 1,1 s; a câmera vai direto, sem percurso. As mensagens descrevem ("Pronto: camiseta no
espelho."), nunca avaliam a roupa.

## Ajuda de primeiro uso

"Aproxime-se do espelho para experimentar suas peças" fica no painel até a pessoa escolher **Não mostrar novamente**
(guardado por usuário no aparelho: `fai:room-mirror-help:v1:<id>`). O tutorial de comandos ilustrados continua, com o
passo "Provar a roupa" descrevendo o fluxo novo.

## Testes

- `lib/room3d/mirror-session.test.ts`: histerese e tempos nas bordas, abrir/fechar à mão com trava, pedido mais recente
  prevalece, falha mantém a roupa anterior, mapeamento dos slots e estado do asset, câmera/orientação, reação (menor
  com movimento reduzido).
- `components/room3d/mirror-hands.test.tsx`: ajuda com "Não mostrar novamente" persistida, abrir à mão, quatro lugares,
  Vestir/Tirar/Trocar/Voltar, troca em andamento, falha e sucesso.
- `lib/room3d/interaction.test.ts`: andar, pegar, carregar e soltar continuam iguais.

## Evidências

Capturas do fluxo com a API simulada (Chromium headless, WebGL por SwiftShader), em
`docs/evidencias/quarto-espelho-2026-10-10/`: `01-quarto-ajuda` (ajuda de primeiro uso e Abrir espelho),
`02-aproximacao`, `03-prova-roupas-em-maos` (câmera de frente para o espelho, personagem virado para ele, lista por
lugar do corpo), `04-trocar-parte-de-cima` (escolha do guarda-roupa), `05-troca-reacao` e `06-vestida` (camiseta
vestida no personagem e "Pronto: Camiseta azul no espelho."), `07-sem-tenis` (Tirar), `09-quarto-de-volta` (saiu da
zona: câmera e painel de volta ao quarto) e `10-abrir-a-mao`. O vídeo da mesma sequência (`quarto-espelho-960.webm`)
fica na pasta quando couber no repositório; o roteiro da captura é o mesmo da descrição acima.

## Limites

- A cena exige WebGL; sem ele o quarto abre em 2.5D e a prova continua pela tela Espelho.
- Os moldes 3D continuam aproximação (ver `docs/avatar3d/PIPELINE_VESTIMENTAS_3D.md`).
