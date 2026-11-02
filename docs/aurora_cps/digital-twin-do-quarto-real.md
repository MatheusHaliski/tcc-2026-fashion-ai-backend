# RF56 · Digital twin do quarto real — escanear o próprio quarto e viver nele no app

> Rascunho de requisito. Integra o Meu Quarto ao Aurora CPS pela camada de **percepção**: a pessoa escaneia o quarto
> de verdade com o celular (vídeo e fotos), o sistema reconstrói uma versão digital, e o Meu Quarto passa a acontecer
> **dentro do quarto dela**, com o guarda-roupa, o espelho e as peças nos lugares reais. É independente dos portais de
> jogo do Fashion Hall; eles continuam funcionando no quarto FAI paramétrico ou no quarto real, à escolha.

## 1. A ideia em uma frase

Hoje o Meu Quarto é o gêmeo digital do **guarda-roupa**: cada objeto representa o estado de uma peça real, num quarto
genérico de quatro paredes. O RF56 fecha o loop do Aurora ("corpo + ambiente → percepção → processamento → atuação")
tornando o **ambiente** também real: o quarto onde as peças vivem é o quarto onde a pessoa vive.

## 2. O que "tempo real" significa aqui

É importante separar três coisas, porque a câmera de um celular não gera geometria 3D confiável a partir de um vídeo ao
vivo, e prometer isso quebraria a confiança no produto.

| Camada | Cadência | O que é |
|---|---|---|
| **Captura** | 2 a 5 minutos, guiada | a pessoa gira o celular pelo quarto seguindo instruções na tela (cantos, paredes, chão, o guarda-roupa aberto); o app confere cobertura e pede o que faltou |
| **Reconstrução** | assíncrona, minutos | um job processa a captura e gera o twin; a pessoa recebe notificação ("Seu quarto está pronto"); re-escanear atualiza só o que mudou |
| **Twin vivo** | contínuo, em tempo real | o que já é ao vivo hoje continua: estado das peças (poeira, cesto, arara), luz pelo horário, clima pela Open-Meteo, interruptor, e, com o celular no quarto, a luminosidade real do sensor de luz. É o *estado* que muda em tempo real, não a geometria |

Em termos de Aurora: captura e reconstrução são a **percepção** do ambiente; o twin vivo é o **processamento**; o que o
quarto mostra (peças, luz, alertas) é a **atuação**. A geometria é um sensor de baixa frequência (dias); o estado é de
alta (segundos).

## 3. Três níveis de fidelidade

Os níveis se somam. O TCC entrega o N1 completo e o N2 quando houver fotos; o N3 é experimental.

| Nível | O que a pessoa vê | De onde vem | Encaixe no código de hoje |
|---|---|---|---|
| **N1 · Planta** | paredes com as medidas reais, porta, janelas e móveis como volumes simples; o guarda-roupa FAI Origem redimensionado para o móvel real; o espelho onde a pessoa indicou | planta paramétrica (RoomPlan no iOS com LiDAR; medição guiada por AR nos demais) | é exatamente o modelo atual: `Wall`, `RoomDoor`, `RoomWindow`, colisões, as 4 vistas de câmera; só muda a fonte das dimensões (`GET /api/me/room` passa a devolver a planta da pessoa) |
| **N2 · Texturas** | as paredes, o piso e os móveis com as fotos reais projetadas; o quarto fica reconhecível | fotos da captura retificadas por plano (homografia) | texturas nos mesmos planos; sem mudança de cena |
| **N3 · Fotorreal** | o quarto como uma nuvem fotorrealista navegável, com o móvel, o espelho e as peças sobrepostos como objetos interativos | Gaussian splatting treinado a partir do vídeo (poses por COLMAP ou GLOMAP; treino em GPU ou em Metal no Mac Mini) | viewer de splats em R3F (`drei` já tem `Splat`); os objetos do quarto ficam em cima, ancorados na planta do N1 |

O N1 é o que dá função; o N2 e o N3 dão pertencimento. Um quarto só com planta já muda o produto: a cadeira das "peças
que não cabem" vira a cadeira real da pessoa; a janela acende com o sol real pela orientação da bússola; o caminho até
o espelho é o caminho que ela faz de manhã.

## 4. Pipeline de captura e reconstrução

```
celular ──captura guiada──▶ pacote de captura ──▶ job de reconstrução ──▶ RoomTwin ──▶ GET /api/me/room
          (vídeo + fotos +      (criptografado,     (N1: planta · N2:       (planta, âncoras,
           poses AR + bússola    privado, expira)    texturas · N3: splat)   texturas, splat opcional)
           + sensor de luz)
```

| Dispositivo | N1 planta | N2 texturas | N3 fotorreal |
|---|---|---|---|
| iPhone/iPad com LiDAR | **RoomPlan** (Apple): paredes, portas, janelas, aberturas e móveis por categoria (storage, bed, table, chair, television…) em USDZ + JSON, em 1 a 2 minutos, no aparelho | fotos retificadas pelas paredes do RoomPlan | vídeo da mesma sessão → poses pelo ARKit → splat |
| iPhone sem LiDAR / Android | **medição guiada por AR** (ARKit/ARCore): a pessoa toca nos cantos do chão e na altura do teto; o app desenha a planta ao vivo e pede a porta, as janelas e o guarda-roupa | idem | vídeo → COLMAP/GLOMAP → splat (mais lento, mais falhas) |
| Sem AR | formulário com medidas e 4 fotos (uma por parede); planta retangular | fotos das paredes | não disponível |

O processamento pesado (N3) roda num worker Python em `services/room_twin/`, no mesmo padrão de `services/catalog_photos`
(job, auditoria em JSONL, cache por hash da captura). Pode rodar na GPU alugada ou **no Mac Mini da equipe**: o treino de
splats tem implementações em Metal e até em navegador (projetos como o Brush, em Rust/WGPU), e o N1 e o N2 não precisam de
GPU nenhuma.

### Mapeamento do que a câmera encontra para o quarto FAI

| Detectado | No Meu Quarto | Observação |
|---|---|---|
| Paredes, pé-direito | as paredes do quarto, com as medidas reais | as 4 vistas de câmera e os limites de órbita recalculados pela planta |
| Porta | `RoomDoor` (Chave do Quarto, convites) | no lugar real |
| Janelas | `RoomWindow` com a luz do horário **e** da orientação (bússola da captura) | manhã na janela leste, tarde na oeste |
| Móvel de armazenamento (storage) | o **FAI Origem redimensionado** para a caixa real; portas e gavetas distribuídas pela largura; endereços `door:n/hanger:k`, `drawer:n` preservados | se houver dois armários, o segundo vira o guarda-roupa 2 sem exigir o nível Loft |
| Cama | objeto do quarto onde as peças "em uso hoje" aparecem dobradas (novo estado visual, mesmo dado do Look do Dia) | só visual |
| Cadeira | a **cadeira das peças que não cabem** passa a ser a cadeira real | o estado que já existe, no móvel de verdade |
| Mesa, TV, outros | volumes com a textura da foto | colisão própria |
| Espelho | **não é detectado** por nenhuma API de layout; a pessoa toca na parede onde ele está (ou escolhe "não tenho espelho", e o espelho FAI fica como item da loja) | a prova no espelho (RF28) funciona nos dois casos |
| Pessoas e rostos | **removidos** da captura antes de qualquer processamento | segmentação de pessoa já disponível em `services/anatomical_vton` (MediaPipe) e rembg |

## 5. Dados e API

| Entidade | Conteúdo | Retenção |
|---|---|---|
| `RoomScan` | id, pessoa, dispositivo, método (roomplan, ar_guided, manual), hash do pacote, consentimento (versão do texto, data), status | pacote bruto (vídeo e fotos originais) apagado por padrão **ao concluir o job**; opção de guardar 7 dias para reprocessar |
| `RoomTwin` | planta (paredes, porta, janelas, orientação), âncoras (`storage`, `mirror`, `bed`, `chair`…), texturas (URLs privadas), splat opcional (URL privada), versão, `scan_id` de origem | enquanto a conta existir; apagável a qualquer momento; substituído por re-scan |
| `RoomTwinJob` | fila, etapa (planta, texturas, splat), métricas (cobertura, erro de reprojeção), erros | 30 dias |

Endpoints (rascunho): `POST /api/me/room/scans` (cria o scan e devolve URLs de upload), `POST /api/me/room/scans/{id}/complete`
(dispara o job), `GET /api/me/room/scans/{id}` (status e cobertura), `GET /api/me/room` (passa a incluir `twin` quando
existe, com `source: "fai" | "twin"`), `PUT /api/me/room/mode` (`fai` ou `twin`), `DELETE /api/me/room/twin`. Texturas e
splat são servidos **pela API** (bucket privado, como `S3_SERVE_THROUGH_API=true`), nunca por URL pública.

## 6. Privacidade: o quarto é o dado mais íntimo do app

O interior da casa de alguém é mais sensível do que uma foto de roupa. Regras, na ordem em que importam:

1. **Consentimento específico e separado**, com texto próprio ("você vai filmar o interior da sua casa"), não embutido
   nos termos gerais; revogável, e a revogação apaga o twin.
2. **Local primeiro.** O N1 (planta) é calculado no aparelho sempre que houver AR; só a planta sobe. Fotos e vídeo só
   sobem se a pessoa escolher N2 ou N3, e a tela diz o que vai subir.
3. **Pessoas e rostos saem antes de subir**, no aparelho quando possível, e de novo no servidor. Fotos na parede
   (porta-retratos) são borradas por padrão, com opção de manter.
4. **Nada de treino.** A captura não alimenta nenhum modelo; as capacidades de IA do app seguem com log de inferência e
   consentimento por capacidade, como já é a regra.
5. **Visitantes com a Chave do Quarto veem o quarto FAI**, nunca o twin, a menos que a pessoa libere explicitamente
   aquele visitante; o modo público do perfil nunca mostra o twin.
6. **Apagar é apagar**: planta, texturas, splat, pacote bruto e derivados, com confirmação na tela.
7. **Criptografia em repouso** para texturas e splat (a chave `DATA_ENCRYPTION_KEY` já existe para campos sensíveis;
   para blobs, criptografia do lado do servidor no bucket).

## 7. O quarto real dentro do Aurora CPS

| Camada do Aurora | Antes do RF56 | Com o RF56 |
|---|---|---|
| Percepção do ambiente | clima (Open-Meteo), horário | + geometria e aparência do quarto, orientação solar, luminosidade real pelo sensor do celular quando ele está no quarto |
| Processamento | estado das peças, Inventory Score | + o estado é posicionado no espaço real: a peça esquecida está na terceira gaveta de baixo do armário de verdade |
| Atuação | o quarto digital mostra; o espelho sugere | + o espelho físico (RF55) e o twin são o mesmo lugar visto de dois jeitos; no futuro, uma peça Aurora com atuador pode acender a gaveta certa de verdade |
| Gêmeo digital por peça (§8.1 do Aurora) | histórico de uso, conquistas | + **onde** a peça fica, de fato, no quarto da pessoa |

Com peças Aurora reais (fase 2 do roadmap do Aurora), o twin ganha o que o documento chama de nó de borda: a peça
avisa onde está e em que estado, e o quarto digital reflete sem a pessoa tocar em nada. Sem hardware, o RF56 já entrega
o lado do ambiente desse loop.

## 8. Relação com o Fashion Hall

Nenhuma dependência. O Hall abre o corredor dos portais numa parede do quarto; no twin, a pessoa escolhe em qual parede
real ele "abre" (ou o corredor nasce da porta real do quarto, o que é a opção mais bonita). Os jogos continuam no cenário
deles (Museu Vesper, cidade da Noite Aurum), e a Gala Lumière já reaproveita o quarto FAI à noite como salão; com o twin
ela poderia reaproveitar o quarto real, mas isso é uma decisão de arte, não de requisito.

## 9. Critérios de aceite (rascunho)

1. Com iPhone com LiDAR, a captura N1 leva menos de 3 minutos e a planta aparece no app em menos de 1 minuto após o
   envio, com erro de medida abaixo de 5 cm nas paredes (comparado com trena).
2. Sem LiDAR, a medição guiada produz uma planta utilizável em menos de 5 minutos; o app mostra a cobertura e pede o
   que faltou antes de permitir "concluir".
3. O FAI Origem se ajusta ao armário real mantendo todos os endereços de peça; nenhuma peça fica sem posição.
4. O caminho do avatar até o espelho e a prova no espelho (RF28) funcionam no twin como no quarto FAI (mesmos testes
   de `mirror-session`).
5. Nenhum quadro com pessoa chega ao servidor; o job rejeita capturas com rosto detectado não borrado.
6. O pacote bruto é apagado ao fim do job por padrão, e o apagamento do twin remove todos os derivados (verificável
   por auditoria em JSONL como em `catalog_photos`).
7. Visitante com Chave do Quarto nunca recebe `twin` na resposta da API, a menos que liberado explicitamente.
8. Sem WebGL, o 2.5D mostra a planta real em vez do quarto genérico.

## 10. Fases e riscos

| Fase | Entrega | Risco principal |
|---|---|---|
| 1 (TCC) | N1 por RoomPlan e por medição guiada; mapeamento do armário, porta, janelas, cadeira; modo `fai`/`twin`; privacidade completa | qualidade da medição sem LiDAR; precisa de testes com quartos reais e trena |
| 2 | N2 texturas; luminosidade real; orientação solar | fotos distorcidas em quartos pequenos; custo de storage |
| 3 (experimental) | N3 splat no Mac Mini ou GPU alugada; viewer em R3F | tempo de treino (dezenas de minutos), tamanho do arquivo (dezenas de MB), qualidade em vídeo tremido |

**O que não prometer:** reconstrução ao vivo durante a filmagem, medidas milimétricas, detecção automática do espelho,
e qualquer uso do quarto para recomendar compras de móveis. O twin existe para a pessoa ver o guarda-roupa dela no
lugar dela, e só.
