# Auditoria das 15 modalidades FLAIR 3D (25/11/2026)

Auditoria por leitura do código e dos testes (um auditor por jogo), sem jogar no navegador: o ambiente não tem placa de vídeo. Escala única: 10 = jogo comercial de console. A nota final é a média dos sete critérios; a coluna "calibrada" corrige diferenças de rigor entre auditores.

Pedido da dona: todos os critérios acima de 8,0.

## Notas

| Jogo | Jogabilidade | Recursos | Sentido e objetivo | Gráficos | Efeito das roupas | Comandos | Cutscenes | Final | Calibrada | Pior critério |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PASSARELA | 3 | 2,5 | 6 | 5,5 | 3,5 | 4 | 5 | 4,2 | **4** | recursos 2,5 (empate com gameplay 3) |
| DRESS_FIGHTER | 4,5 | 5 | 7 | 5 | 5,5 | 3,5 | 4,5 | 5 | **4,6** | comandos 3 (golpe só por botão HTML) |
| DRESS_THE_STAR | 3 | 2 | 6,5 | 5,5 | 3 | 5 | 5 | 4,3 | **3,9** | recursos 2 |
| PERSONAGEM_FILME | 3 | 2 | 6 | 5 | 3,5 | 4 | 4,5 | 4 | **3,6** | recursos 2 |
| ROAD_TO_GLORY | 2,5 | 2 | 5,5 | 5 | 2 | 4 | 3,5 | 3,5 | **3,4** | efeito_das_roupas 2 (empate com recursos 2) |
| FASHION_DETECTIVE | 4,5 | 5,5 | 6 | 4 | 2 | 2,5 | 6,5 | 4,4 | **4,4** | efeito_das_roupas 1,5 |
| BOUTIQUE_3D | 2,5 | 2 | 5,5 | 5 | 1,5 | 3,5 | 4 | 3,4 | **3,5** | efeito_das_roupas 2 (empate com recursos 2) |
| CLUBE_CORACAO | 1,5 | 0,5 | 4 | 3 | 2,5 | 4,5 | 2,5 | 2,6 | **2,5** | recursos 1 |
| FAVORITE_SINGER | 1,5 | 1 | 5,5 | 3 | 1,5 | 4 | 2 | 2,6 | **2,6** | recursos 1 |
| LABIRINTO | 2,5 | 2 | 4,5 | 3,5 | 1,5 | 3 | 3,5 | 2,9 | **3** | efeito_das_roupas 2 (empate com recursos 2) |
| PILOTO_FAVORITO | 1,5 | 1 | 4,5 | 3,5 | 1 | 4 | 2,5 | 2,6 | **2,6** | recursos 1 |
| AROUND_THE_WORLD | 3 | 2,5 | 6 | 3,5 | 2,5 | 4 | 4 | 3,6 | **3,4** | efeito_das_roupas 2 |
| SUPER_HEROI | 1,5 | 1 | 4,5 | 2,5 | 1 | 3,5 | 2 | 2,3 | **2,4** | recursos 1 (empate com efeito_das_roupas 1,5 e gameplay 1,5) |
| FASHION_SPORTS | 3 | 3,5 | 6 | 4,5 | 4 | 4,5 | 3,5 | 4,1 | **4,3** | gameplay 3,5 (empate com recursos 3,5) |
| BATALHA_LOOKS | 2,5 | 1,5 | 6 | 5 | 3 | 4,5 | 4,5 | 3,9 | **3,4** | recursos 1,5 |

## O que é comum a quase todos

- **Jogabilidade:** na maioria, a partida é escolher cartas ou pintar zonas num menu e assistir a uma sequência pronta. Só o Fashion Detective e o Fashion Sports têm deslocamento ou duelo, e mesmo assim sem movimento livre.
- **Recursos:** não há vida, energia nem itens que se gastam, salvo a vida fixa do Dress Fighter e os atributos do Detective e do Sports.
- **Efeito das roupas:** a peça muda a pontuação e dispara luz, mas não muda vida, atributos nem destrava ação.
- **Comandos:** mapa de menu com muitos botões de enfeite (girar, zoom, posar); as ações que importam (jogar a carta, pular, ver o resultado) só existem como clique.
- **Cutscenes:** há abertura com travelling, mas sem pular, sem cortes nem final distinto de vitória e derrota.

## Teto realista

Teto realista de gráficos no navegador: 7 a 7,5 em desktop e 6 a 6,5 no celular de entrada, na escala única (10 = referência comercial de console). Isso pressupõe a etapa 16 completa: salas GLB do motor Blender com texturas PBR e lightmap assado, versões '-leve', humanoides GLB animados no lugar de silhuetas, tone mapping e bloom moderado, sombras só no perfil alto. Hoje os jogos estão entre 2,5 (Super-Herói, cidade de caixas) e 5,5 (Passarela, DTS). Passar de 8 em gráficos com WebGL só é defensável se a escala for 'jogo estilizado de navegador' (estilo low-poly coeso, iluminação assada bem feita), e mesmo assim só nas salas que recebem arte dedicada. Uma versão nativa em Unreal Engine 5 elevaria o teto para 8,5-9, mas é outro produto e exige reescrever o cliente.

O que não é alcançável:

- Gráfico de console AAA (Nanite/Lumen, captura facial, cabelo e tecido simulados, centenas de personagens animados) num navegador com three.js/WebGL: não é alcançável, ainda mais no celular sem placa de vídeo.
- Levar os 15 jogos acima de 8,0 em TODOS os critérios dentro do prazo de um TCC: o plano completo tem várias etapas G por jogo (movimento livre, salas GLB, fase de uso). O realista é passar de 8 em comandos, cutscenes e efeito_das_roupas nos 15 (etapas 1-14, comuns), e em gameplay/recursos só nos jogos que receberem as etapas 15-24.
- Gráficos acima de ~7,5 com honestidade nesta escala: ver teto_de_graficos. Pedir 8+ em gráficos exige comparar com jogos estilizados de navegador, não com console.
- Reaproveitar o código TypeScript/three.js numa versão Unreal Engine 5: nada dele roda na UE5. O que é portável são os contratos (códigos e números vindos do servidor), as tabelas de dados (peça-recurso, mapa de 5 ações e 2 eixos, catálogo de cutscenes em JSON, i18n) e o back Spring Boot. A mudança para app em UE5 é uma reescrita do cliente e decisão da dona; também não elimina por si só a segurança: o servidor continua exposto à internet e precisa das mesmas validações anti-forja.
- Física e colisão realistas (ragdoll, tecido) e multiplayer em tempo real entre pessoas: fora do escopo do repositório e do orçamento sem infraestrutura paga.
- Jogos de zonas (Clube, Singer, Piloto, Super-Herói) com 'peça virtual': depende de validação de produto pela dona; sem ela, as etapas 18-19 não devem começar.
- Gerar falas, texturas ou modelos com IA paga: proibido pelo repositório; tudo à mão ou pelo motor Blender local.

## Plano de trabalho

| # | Etapa | Jogos | Esforço | Depende de |
| --- | --- | --- | --- | --- |
| 1 | Corrigir reações erradas no fim (Clube, Batalha) e dar montagem ao Singer | CLUBE_CORACAO, BATALHA_LOOKS, FAVORITE_SINGER, PILOTO_FAVORITO, SUPER_HEROI | P | — |
| 2 | Caracterização e extrações preparatórias nos arquivos no limite | TODOS | M | — |
| 3 | Entrada de console: núcleo puro (ações, teclado, gamepad, glifos) | TODOS | M | 2 |
| 4 | EntradaProvider, menu de pausa e migração dos jogos de cartas e de zonas | DRESS_FIGHTER, FASHION_SPORTS, ROAD_TO_GLORY, CLUBE_CORACAO, FAVORITE_SINGER, PILOTO_FAVORITO, SUPER_HEROI, PASSARELA, DRESS_THE_STAR, PERSONAGEM_FILME, BOUTIQUE_3D, LABIRINTO, AROUND_THE_WORLD, BATALHA_LOOKS | M | 3 |
| 5 | Cinema: modelo puro de cutscene e câmera no instante | TODOS | M | 2 |
| 6 | Cinema na tela: overlay, câmera, hook e migração do Detective e da abertura | FASHION_DETECTIVE, TODOS | M | 4, 5 |
| 7 | Gatilhos e catálogo comum: abertura e finais VITORIA/EMPATE/DERROTA nos 15 jogos | TODOS | M | 6, 1 |
| 8 | Peça-recurso: tabela determinística no servidor com golden fixture | TODOS | M | 2 |
| 9 | Contrato aditivo no /efeitos e leitura no front (com correção de card-fx vale()) | TODOS os de cartas | P | 8 |
| 10 | Efeito imediato ao vestir: roda de atributos, texto curto, brilho e ação destravada | TODOS os de cartas | M | 9 |
| 11 | Uso da peça como recurso no servidor (anti-forja) e estado de recursos na partida | TODOS os de cartas | M | 8 |
| 12 | Uso na tela: roda de recursos, botão USAR e reconciliação otimista | TODOS os de cartas | M | 10, 11, 4 |
| 13 | Perfil por jogo: atributos pesam na nota e recurso-vida dá derrota (jogos de cartas) | PASSARELA, DRESS_THE_STAR, BOUTIQUE_3D, AROUND_THE_WORLD, LABIRINTO, PERSONAGEM_FILME, BATALHA_LOOKS, ROAD_TO_GLORY | G | 11 |
| 14 | Motores com Flair3dAtributos viram Adapter sobre a tabela (Dress Fighter, Detective, Sports) | DRESS_FIGHTER, FASHION_DETECTIVE, FASHION_SPORTS | M | 13 |
| 15 | Base comum de movimento livre em terceira pessoa (controlador, colisão, interagíveis, dica de botão) | PASSARELA, DRESS_THE_STAR, PERSONAGEM_FILME, BOUTIQUE_3D, LABIRINTO, AROUND_THE_WORLD, BATALHA_LOOKS, ROAD_TO_GLORY, FASHION_DETECTIVE | G | 4, 10 |
| 16 | Pipeline gráfico comum: salas e gente em GLB pelo motor Blender, luz assada e qualidade por aparelho | TODOS | G | — |
| 17 | Road to Glory: maquiagem no rosto 3D | ROAD_TO_GLORY | M | — |
| 18 | Jogos de zonas: a peça pintada veste o avatar (peça virtual) com atributos | CLUBE_CORACAO, FAVORITE_SINGER, PILOTO_FAVORITO, SUPER_HEROI | G | 8, 10, 16 |
| 19 | Jogos de zonas: fase de uso (estreia em campo, show, volta de classificação, missão) | CLUBE_CORACAO, FAVORITE_SINGER, PILOTO_FAVORITO, SUPER_HEROI | G | 18, 15, 12 |
| 20 | Dress Fighter: andar na arena, leitura parcial e cutscenes de luta | DRESS_FIGHTER | G | 12, 14, 7 |
| 21 | Fashion Detective: exploração livre nas salas com GLB, NPCs e culpado por semente | FASHION_DETECTIVE | G | 15, 16, 14, 7 |
| 22 | Fashion Sports: capitão controlável e duelo com habilidade | FASHION_SPORTS | G | 12, 14, 16 |
| 23 | Desfile jogável: Passarela, Dress the Star e Batalha de Looks | PASSARELA, DRESS_THE_STAR, BATALHA_LOOKS | G | 13, 15, 7 |
| 24 | Set, loja e caminho: Personagem de Filme, Boutique, Labirinto, Around the World, Road to Glory | PERSONAGEM_FILME, BOUTIQUE_3D, LABIRINTO, AROUND_THE_WORLD, ROAD_TO_GLORY | G | 13, 15, 16, 7 |

### Detalhe das etapas

**1. Corrigir reações erradas no fim (Clube, Batalha) e dar montagem ao Singer.** Em sequenciaDoResultado, a reação final passa a seguir desfechoDe (BOM->REACAO_3, MEDIO->REACAO_1, RUIM->REACAO_0) e não só as estrelas. Na montagem batalha, resultado de rodada (status ABERTA/ETAPA_CUMPRIDA) compara a nota da pessoa com a do adversário naquela rodada para decidir quem levanta o braço. Incluir montagens mínimas para FAVORITE_SINGER, CLUBE_CORACAO, PILOTO_FAVORITO e SUPER_HEROI (a peça mostrada, plateia/torcida reage pelo desfecho). Remover o mock de 3 estrelas que mascara o bug no teste da tela do Clube.

Aceite: Teste: CLUBE_CORACAO com resultado CONCLUIDO e 0 estrela termina em reação positiva; BATALHA_LOOKS com ETAPA_CUMPRIDA 100x25 não toca F_LEVANTA_O_BRACO no adversário; FAVORITE_SINGER tem sequência não vazia. Testes existentes de animations.test.ts continuam verdes; line_ratchet sem violação (sequences-auto.ts dentro de 250 ou extrair montagens para scene/montagens.ts).

**2. Caracterização e extrações preparatórias nos arquivos no limite.** Testes de caracterização de controls.ts, use-nucleo-controls, use-mao-controle, do POST /efeitos (itens e ordem por carta em 3 jogos), de card-fx.ts (pontua, selo, motivo), de opening.ts e camera-da-cena.ts. Extrair de nucleo-game.tsx (247/250) a ligação de controles e a preparação em hooks; extrair de Flair3dNucleoService.java (242/250) o cálculo de efeitos para Flair3dEfeitosDaCarta. Sem mudança de comportamento.

Aceite: Todos os testes antigos e os novos de caracterização verdes; nucleo-game.tsx e Flair3dNucleoService.java com folga (<220); python -m scripts.refactoring.line_ratchet sem violações; tela de um jogo de cartas idêntica antes/depois.

**3. Entrada de console: núcleo puro (ações, teclado, gamepad, glifos).** Criar lib/flair/entrada com acoes.ts (INTERAGIR, CANCELAR, ACAO, INVENTARIO, PAUSAR + eixos mover/câmera), teclado.ts (KeyboardEvent.code, reaproveita ignorarTecla), gamepad.ts (eixos 0/1 e 2/3, zona morta 0,2, leitura por borda, família PS/Xbox/genérico com fallback quando mapping != standard), glifos.ts e mapa-por-jogo.ts derivado de definicao.acoes (sem mudar o contrato do back). Registrar Adapter/Observer/State em docs/refactoring/gof/entrada-console.md.

Aceite: Testes puros: WASD/setas e analógico esquerdo dão o mesmo vetor normalizado; diagonal com hypot<=1; botão 0..3 e 9 viram as 5 ações; Espaço em botão focado é ignorado; controle não standard recebe glifos genéricos; mapa cobre os 15 códigos.

**4. EntradaProvider, menu de pausa e migração dos jogos de cartas e de zonas.** Provider único por rota (um keydown e um laço rAF), pilha de camadas JOGO<INVENTARIO<PAUSA<DIALOGO, MenuPausa (Continuar, Objetivo, Entregar, Comandos com glifos da família atual). Na ACAO, toda ação que hoje é só botão HTML ganha comando: golpes do Dress Fighter nos 4 botões de face, jogada de cena/seguir/ver resultado em INTERAGIR/CANCELAR, troca de câmera no analógico direito. Tradutor legado em controls.ts para não quebrar quem joga; i18n flair3d.entrada.* em pt-BR, en, es.

Aceite: Teste de componente: em cada jogo listado, uma partida vai da preparação ao resultado só com teclado e só com gamepad simulado (sem mouse); Dress Fighter aplica golpe forte/rápido/guarda/especial por botão; Esc abre a pausa, Tab navega nela e o foco volta ao canvas ao fechar; chaves i18n iguais nos 3 idiomas; nenhum listener duplicado (contagem de addEventListener).

**5. Cinema: modelo puro de cutscene e câmera no instante.** lib/flair/cinema/types.ts (Cutscene, Tomada, Enquadramento, TETO_S, validarCutscene) e tomada.ts (cameraNoInstante com TRAVELLING/ORBITA/GRUA/ZOOM, corte SECO/FUSAO, limiteDaCamera). Reproduzir exatamente as tomadas atuais da abertura comum (opening.ts) e do Detective (camera-da-cena.ts) como dados.

Aceite: Testes portados de camera-da-cena e opening passam contra cameraNoInstante sem mudança de números; validarCutscene rejeita tomada >5 s, mais de 1 fala por tomada e soma acima do teto.

**6. Cinema na tela: overlay, câmera, hook e migração do Detective e da abertura.** cinema-overlay.tsx (generaliza detetive-cutscene.tsx: faixas, legenda aria-live, Pular/Rever/Seguir), cinema-camera.tsx (única a escrever na lente enquanto toca, devolve suave ao rig), use-cutscene.ts (fila, pular por Esc/Enter/Espaço e botão 1 via EntradaProvider, reduzir movimento = quadro parado). Trocar Detective e abertura comum para o cinema e remover opening-camera.tsx e camera-da-cena.ts.

Aceite: Detective: legenda alinhada à tomada (nenhuma fala visível depois da tomada acabar); toda cutscene pulável desde o primeiro quadro por tecla e controle; com prefers-reduced-motion só a última tomada fixa; conferência visual em 390x844.

**7. Gatilhos e catálogo comum: abertura e finais VITORIA/EMPATE/DERROTA nos 15 jogos.** gatilhos.ts (ENTRAR, RESULTADO via desfechoDe, LANCE marcado, string do Detective -> id) e catalogo/comum.ts parametrizado pela sala, com fallback para todo jogo. Final por desfecho antes do painel de resultado; primeira fala reaproveita flair3d.narrativa.<JOGO>.final.<BOM|MEDIO|RUIM>; revanche toca abertura curta. Fecha a lacuna 'Falta em todos' de ESTADO_DOS_JOGOS.md.

Aceite: Teste sobre o catálogo inteiro: cada um dos 15 códigos tem ABERTURA, VITORIA, EMPATE e DERROTA; todas passam em validarCutscene; toda fala existe nos 3 idiomas; teste de tela: resultado RUIM toca a derrota e só depois mostra o painel.

**8. Peça-recurso: tabela determinística no servidor com golden fixture.** Pacote flair3d.recurso: Atributo, Recurso, AcaoDestravada, PerfilDaPeca, PerfilDoLook e Flair3dRecursoTabela (camadas vaga, subcategoria, material, cor, tier/OVR com clamp, sem Random, Locale.ROOT, coleções ordenadas). Golden fixture JSON compartilhada com o TS.

Aceite: Teste Java: cada peça da fixture dá exatamente os itens esperados; mesma entrada em ordem diferente dá mesmo perfil; deltas em [-50,50]; fator OVR em [0,9;1,1]; empate de dominante segue a ordem do enum.

**9. Contrato aditivo no /efeitos e leitura no front (com correção de card-fx vale()).** Flair3dRecursoCalculo.paraEfeitos acrescenta ATR_/REC_/USOS/DESTRAVA_/DOMINANTE_ ao POST .../efeitos. No front, lib/flair/recursos/{types,leitura,delta}.ts e filtro desses prefixos em card-fx.ts vale(), no mesmo commit.

Aceite: Teste de caracterização do /efeitos (etapa 2) continua igual nos itens antigos; recursos.test.ts lê a mesma golden fixture; card-fx: carta sem pontuação continua 'não pontua' e mantém o selo de motivo mesmo com ATR_ positivos.

**10. Efeito imediato ao vestir: roda de atributos, texto curto, brilho e ação destravada.** Radar SVG de 5 eixos interpolando em 400 ms, texto '+20 Agilidade' no lugar do n3d-fx-badge (máx. 2 itens), brilho/anel no avatar na cor do atributo dominante por 800 ms, chip de ação destravada no NucleoActionPanel; respeita reduzir movimento e use-fx-prefs. A roda fica visível também na ACAO (hoje some na luta e no Sports).

Aceite: Teste de componente: vestir tênis faz o eixo AGILIDADE subir e o chip CORRER aparecer sem nova requisição; desvestir volta; com reduzir movimento não há animação; a roda continua na tela na fase de ACAO do Dress Fighter e do Sports.

**11. Uso da peça como recurso no servidor (anti-forja) e estado de recursos na partida.** Acionamento.usar {carta, requestId}; EstadoDosRecursos no Andamento (leitura neutra em partida antiga); Flair3dRecursoUso valida partida da pessoa e ABERTA/EM_ACAO, carta no deck da partida, usos restantes, cooldown por lance, requestId idempotente, clamp 0..100; eventos RECURSO e placar RECURSOS. Vida a 0 vira DERROTA nos jogos cujo perfil declara vida.

Aceite: Teste: carta fora do deck 422; usos esgotados recusado; mesmo requestId devolve o mesmo resultado sem gastar de novo; partida salva antes da mudança retoma com recursos neutros ('Continuar partida' funciona); cooldown não depende de relógio.

**12. Uso na tela: roda de recursos, botão USAR e reconciliação otimista.** usarRecurso em api.ts, use-recursos-da-partida (otimista + reconciliação + reversão com mensagem i18n), nucleo-roda-recursos generalizando nucleo-barras-de-vida (VIDA, ENERGIA, FOCO, MOEDAS), carta marcada com usos e cinza em 0; USAR mapeado em INVENTARIO->ACAO na carta focada. Resultado lista 'o que o seu look fez'.

Aceite: Teste: usar carta sobe o medidor antes da resposta; recusa do servidor reverte sem piscar e mostra mensagem nos 3 idiomas; carta com 0 usos fica inativa e não é focável para USAR; funciona só com controle.

**13. Perfil por jogo: atributos pesam na nota e recurso-vida dá derrota (jogos de cartas).** Flair3dRecursoPerfil por código (atributos com peso, recurso que é a vida, o que cada ação destrava, teto de +15 pontos). Contexto.perfil() lido pela pontuação de cada núcleo, um jogo por commit menor se preciso. Prévia devolve atributos, nunca o desfecho. Decorator do perfil sobre Flair3dNucleo registrado em docs/refactoring/gof/R92-flair3d-peca-recurso.md.

Aceite: Testes de cada núcleo: bônus nunca passa de +15; look sem efeito tem a mesma nota de antes (caracterização); zerar o recurso-vida encerra a partida em DERROTA; prévia não revela vitória/derrota.

**14. Motores com Flair3dAtributos viram Adapter sobre a tabela (Dress Fighter, Detective, Sports).** Flair3dAtributos passa a ler da Flair3dRecursoTabela por Adapter, sem mudar as notas atuais. No Detective, o look passa a mudar passo máximo, cone dos vigias e vida (hoje constantes em DetetiveEstado.java:22,94-96); no Dress Fighter, vida máxima e fôlego vêm do look; no Sports, atributos e fôlego visíveis ao vivo.

Aceite: Testes de caracterização desses núcleos passam sem mudança de nota para looks neutros; Detective: look com FURTIVIDADE alta reduz o cone em teste determinístico; Dress Fighter: vida máxima varia por look dentro de faixa testada.

**15. Base comum de movimento livre em terceira pessoa (controlador, colisão, interagíveis, dica de botão).** Controlador de avatar puro (posição, rumo, velocidade por AGILIDADE, colisão contra retângulos/zonas da sala, sem física pesada) + câmera de terceira pessoa no rig existente + proximidade.ts/use-interagivel/DicaDeBotao com aria-live. Animações de caminhar/correr já existentes. O servidor recebe apenas a interação (id do interagível), nunca posição livre como fonte de pontos.

Aceite: Testes puros: avatar não atravessa parede; diagonal não é mais rápida; maisProximo escolhe o alvo à frente; teste de tela numa sala de prova: andar até um interagível com WASD e com analógico, ver a dica 'X Pegar' e interagir; 30+ fps no perfil de qualidade baixa.

**16. Pipeline gráfico comum: salas e gente em GLB pelo motor Blender, luz assada e qualidade por aparelho.** Receita Blender por família de sala (desfile, loja, set, rua, labirinto, estádio, ateliê) com texturas PBR, lightmap assado e versão '-leve' (como as araras de public/flair/3d/assets); humanoides GLB para plateia/equipe/clientes; pós-processamento leve (tone mapping, bloom só no alto). Um commit por família.

Aceite: Cada GLB tem versão leve; teste de carregamento sem 404; orçamento por sala (triângulos e texturas) checado em teste do script Blender; visual conferido a 390x844 e em desktop; perfil baixo mantém 30 fps.

**17. Road to Glory: maquiagem no rosto 3D.** Passar 'maquiagem' ao MakeUpScene3D e aplicá-la ao material do rosto (camadas de cor para lábio, sombra e blush no skin-bake), com a câmera de detalhe 'gola'.

Aceite: Teste: trocar o batom muda a cor do lábio no material 3D; caminho 2D continua igual; visual na câmera de detalhe.

**18. Jogos de zonas: a peça pintada veste o avatar (peça virtual) com atributos.** Depois de validar com a dona: GLB por peça com slots/material por zona (camisa, figurino, capacete+macacão, traje com emblema) gerado no motor Blender; o avatar veste a peça na hora; zona+cor+acabamento viram PerfilDaPeca virtual pela tabela da etapa 8. Substitui as faixas cilíndricas de effects-3d.tsx.

Aceite: Pintar uma zona muda só aquela região do GLB vestido; emblema do Super-Herói aparece no peito; capacete do Piloto deixa de ser 'lacaAmarela' fixa; radar de atributos reage à pintura.

**19. Jogos de zonas: fase de uso (estreia em campo, show, volta de classificação, missão).** Cada jogo ganha uma segunda fase curta usando a peça vestida: Clube (lance de bola com stamina), Singer (show de ritmo com hype), Piloto (volta com combustível/pneus), Super-Herói (terraço com drones e energia). Orçamento de tinta no ateliê como recurso. Um commit por jogo.

Aceite: Partida com vitória e derrota possíveis em teste do núcleo; recurso gasto e recuperado visível; atributos da peça mudam o resultado da fase (teste determinístico por semente); jogável só com controle.

**20. Dress Fighter: andar na arena, leitura parcial e cutscenes de luta.** Distância em 3 faixas controlada pela pessoa, leitura do golpe só parcial e com tempo, troca de peça entre rounds; catalogo/luta.ts com vinheta de round, nocaute e final; beco com oponente lutadora GLB.

Aceite: Teste: a resposta ótima depende da distância e não só da tabela; cutscene de lance <=3 s e só em round novo/nocaute; luta inteira jogável por controle.

**21. Fashion Detective: exploração livre nas salas com GLB, NPCs e culpado por semente.** Trocar ponto-a-ponto por movimento livre com colisão nas 9 salas; pistas e chaves visíveis como objetos; X interage/conversa, O esconde; culpado sorteado pela semente; DESCOBERTA/CONFRONTO no catálogo detetive.ts.

Aceite: Servidor valida que a interação ocorre a menos de passoMaximo do alvo; duas sementes geram culpados diferentes; salas carregam GLB leve; caso resolvível só com controle.

**22. Fashion Sports: capitão controlável e duelo com habilidade.** O avatar é o capitão; nas jogadas marcadas a pessoa escolhe direção e acerta uma barra de tempo que reduz a sorte de ±8; a peça da carta aparece no capitão; estádio GLB e telão.

Aceite: Teste do servidor: acerto de tempo reduz a variância do duelo de forma determinística; capitão usa o avatar da pessoa; gol dispara cutscene <=3 s.

**23. Desfile jogável: Passarela, Dress the Star e Batalha de Looks.** Desfile conduzido pela pessoa (andar, marcas de pose no tempo com medidor de Confiança/Presença como recurso-vida); Batalha: nota do adversário vem do look dele (remove sorteio {25,50,75}); DTS: perfil deduzido por pistas no bastidor; catalogo/desfile.ts.

Aceite: Teste: errar marcas baixa o medidor e pode dar DERROTA; nota do adversário muda conforme o look gerado e é reproduzível pela semente; prévia não revela o desfecho.

**24. Set, loja e caminho: Personagem de Filme, Boutique, Labirinto, Around the World, Road to Glory.** Um commit por jogo: PF sem título revelado pela prévia, pistas no set e equipe humana; Boutique arara->provador->balcão com paciência da cliente; Labirinto usando o mundo JARDIM_DOS_ESPELHOS já testado (lib/flair/mundos/mundos.ts) com chaves e mala; ATW uma sala por região; RTG camarim com estações e sessão de fotos com tempo.

Aceite: Para cada jogo: vitória e derrota alcançáveis em teste do núcleo; objetivo exige ação no cenário (interagível) validada no servidor; sala própria carregada (ATW: região certa por rodada).

## Regras comuns desenhadas

### Regra comum peça → atributos, recursos, vida e ações, com efeito imediato na tela, para as 15 modalidades do FLAIR 3D

REGRA COMUM "PEÇA-RECURSO"
Uma tabela pura no servidor transforma cada peça num perfil fixo. O perfil tem atributos (passivos enquanto a peça está vestida), recursos (entregues uma vez, quando a peça é usada como recurso) e ações destravadas. Cada jogo lê o perfil por meio de um "perfil do jogo", que diz quais atributos valem e qual recurso é a vida dele. O cliente nunca calcula nem envia valores; só mostra códigos e números que vieram do servidor. Isso vale tanto para o Next.js de hoje quanto para um futuro cliente Unreal Engine 5, que consome o mesmo contrato.

(1) TIPOS
Java, pacote br.com.fashionai.application.flair3d.recurso:

  enum Atributo { AGILIDADE, FURTIVIDADE, CARISMA, RESISTENCIA, FORCA }   // 0..100, neutro 50
  enum Recurso  { VIDA, ENERGIA, FOCO, MOEDAS }                          // VIDA/ENERGIA/FOCO 0..100; MOEDAS inteiro >= 0
  enum AcaoDestravada { CORRER, ESCONDER, CONVENCER, BLOQUEAR, REFLETIR, CARREGAR, TROCA_RAPIDA, ABRIR }
  record PerfilDaPeca(UUID cardId, String vaga, EnumMap<Atributo,Integer> atributos /* delta sobre 50, -50..+50 */,
                      Recurso recurso, int quantidade /* entregue no uso */, int usos /* por partida */,
                      Set<AcaoDestravada> acoes, String dominante /* atributo de maior |delta|, para o brilho */)
  record PerfilDoLook(EnumMap<Atributo,Integer> atributos /* 0..100, média por peça + clamp */, Set<AcaoDestravada> acoes)
  record EstadoDosRecursos(int vida, int energia, int foco, int moedas, Map<UUID,Integer> usosRestantes, int lance)

TypeScript, em lib/flair/recursos/types.ts: espelho só de leitura com os mesmos nomes, ATRIBUTOS e RECURSOS como "as const" e o tipo EfeitoDePeca = { atributos: Partial<Record<Atributo, number>>; recurso: { tipo: Recurso; quantidade: number } | null; usos: number; acoes: AcaoDestravada[]; dominante: Atributo | null }.

Contrato de transporte: reaproveita o Efeito(codigo, valor, motivo) existente, com prefixos novos. O contrato do /efeitos fica igual:
  ATR_<ATRIBUTO>  valor = delta (pode ser negativo)
  REC_<RECURSO>   valor = quantidade no uso
  USOS            valor = usos por partida
  DESTRAVA_<ACAO> valor = 1
  DOMINANTE_<ATRIBUTO> valor = 1

(2) TABELA DETERMINÍSTICA E PURA (Flair3dRecursoTabela.java)
As camadas se somam numa ordem fixa. Tudo em List e LinkedHashMap imutáveis, com toLowerCase(Locale.ROOT), sem Random e sem horário. Os nomes de material e subcategoria são os que Flair3dPecas e Taxonomy já usam.

A. Vaga (o "slot" do corpo). Dá o atributo base e o recurso do uso:
  SUP: CARISMA +8                 | uso FOCO 15
  INF: AGILIDADE +6               | uso ENERGIA 15
  CAL: AGILIDADE +10              | uso ENERGIA 20
  VES: CARISMA +6, RESISTENCIA +6 | uso VIDA 15
  ACE: FURTIVIDADE +4             | uso MOEDAS 5 (bolsa) ou FOCO 10 (os outros)

B. Categoria e subcategoria. Grupos sobre os conjuntos que já existem:
  Taxonomy.SNEAKERS: AGILIDADE +20, destrava CORRER
  heels/pumps/stiletto: AGILIDADE −15, CARISMA +15, destrava CONVENCER
  boots: RESISTENCIA +10, AGILIDADE −5
  maxi/gown: CARISMA +10, AGILIDADE −10
  camada (coat, parka, windbreaker, jacket, blazer): RESISTENCIA +15, destrava BLOQUEAR; uso troca para VIDA 20
  cardigan/vest: TROCA_RAPIDA
  sunglasses/hat/cap: FURTIVIDADE +15, destrava ESCONDER
  handbag/tote_bag/backpack/crossbody_bag: destrava CARREGAR (+1 uso em outra carta), uso MOEDAS 5
  joias (necklace, earrings, ring, bracelet, watch): CARISMA +10
  luvas e chaveiros/utility: destrava ABRIR

C. Material (tags.materials / Card.materials):
  leather, denim, wool (Flair3dAtributos.DEFESA): RESISTENCIA +12
  metal, gold, silver, plated (Flair3dAtributos.ATAQUE e similares): FORCA +10, CARISMA +5, destrava REFLETIR
  cotton, linen, knit, jersey, fleece, modal, viscose (conforto, como AfterpartyMods.COMFORT): RESISTENCIA +6; o uso dá ENERGIA +5 extra
  silk, satin: CARISMA +8, AGILIDADE +4
  sequin, pvc, latex, vinyl: CARISMA +10, FURTIVIDADE −15
  nylon, polyester, mesh: AGILIDADE +6

D. Cor. Família pela Taxonomy.COLOR_FAMILY, sem duplicar Flair3dCores:
  Preto/Cinza: FURTIVIDADE +10
  Branco/Amarelo: FURTIVIDADE −5, CARISMA +5
  Vermelho: FORCA +5
  Verde/Azul: AGILIDADE +3
  A ação de cor por jogo continua em Flair3dCores. A regra comum só soma o atributo.

E. Raridade e força (tier e ovr do CbcRules.Card; ainda não depende de rarity):
  multiplicador da quantidade no uso: BRONZE 1,00 | PRATA 1,25 | OURO 1,50 | ESPECIAL 2,00
  usos por partida: BRONZE 1 | PRATA 1 | OURO 2 | ESPECIAL 2
  fator do OVR (doc §3.2): 0,9 + 0,2 × (ovr − 45) / 47, com clamp em [0,9; 1,1]. Escala só os deltas de atributo, como teto anti-pay-to-win.

Fórmulas:
  delta(atributo) = clamp(round(Σ camadas × fatorOvr), −50, +50)
  quantidade = round(baseDaVaga × multiplicadorTier) + extraDoMaterial
  PerfilDoLook.atributo = clamp(50 + média dos deltas das peças vestidas, 0, 100), média como em AfterpartyMods.of
  dominante = o atributo de maior |delta|; no empate vale a ordem do enum

Flair3dAtributos continua com o mesmo contrato. Numa fase posterior, e com teste de caracterização, ele pode virar um Adapter sobre a tabela.

(3) COMO APARECE NA HORA
Tudo cabe em 1 s, respeita "reduzir movimento" e preferências (use-fx-prefs.ts) e fica fora da zona da roupa, como NucleoCardFx.

a) Ao VESTIR (preparação). Não depende de ida ao servidor, porque o /efeitos já foi buscado para o deck inteiro:
  - Roda de atributos: radar SVG de 5 eixos no canto, que interpola do look anterior ao novo em 400 ms. O eixo que sobe pisca na cor do atributo e o que desce fica cinza.
  - Texto curto subindo da peça (o lugar do n3d-fx-badge), por exemplo "+20 Agilidade · −15 Furtividade". Mostra no máximo 2 itens, ordenados por |delta|.
  - Brilho no avatar: luz de contorno, ou um anel no piso quando a cena não tiver rim light, na cor do atributo dominante (AGILIDADE #2FB39B, FURTIVIDADE #5B3F8C, CARISMA #E0B04D, RESISTENCIA #4A6FA5, FORCA #C62B28) durante 800 ms.
  - Ícone de ação destravada: chip com o ícone (CORRER, ESCONDER...) que entra na faixa de ações do NucleoActionPanel.
b) Ao USAR a peça como recurso (em ação):
  - A carta voa até a roda de recursos: 4 medidores circulares (VIDA, ENERGIA, FOCO e contador de MOEDAS), um componente genérico que generaliza nucleo-barras-de-vida.
  - O medidor do recurso sobe, com "+15 Vida" ao lado. É um update otimista feito com o REC_ do /efeitos e reconciliado com o evento RECURSO da resposta. Se o servidor recusar ou devolver outro número, o medidor volta ou corrige sem piscar.
  - A carta fica marcada com os usos restantes (o selo USOS). Com 0, fica cinza e inativa.
c) Fim da partida: o resultado lista "o que o seu look fez", ou seja, os eventos RECURSO, como já acontece com os passos da ação.

(4) VALIDAÇÃO NO SERVIDOR (anti-forja)
- O perfil só é calculado no servidor, pela Flair3dRecursoTabela, a partir do CbcRules.Card carregado por Flair3dCartas.daPessoa (dono conferido, 422 CARTA_ALHEIA). O cliente nunca manda número.
- O uso entra pelo endpoint que já existe, POST /api/flair/3d/partidas/{id}/acionar, com um campo novo opcional em Acionamento: usar { carta, requestId }. O servidor confere:
  (i) a partida é da pessoa e está ABERTA ou EM_ACAO (o filtro que já existe por userId e nucleo);
  (ii) a carta está no deck da partida (NucleoPartida.deck, gravado na abertura), não só na coleção;
  (iii) restam usos, contados por usosRestantes no Andamento (estadoJson);
  (iv) há cooldown por lance ou etapa, não por relógio, para continuar determinístico;
  (v) o requestId é idempotente e repetido devolve o mesmo resultado, como o requestId do AdventureAction;
  (vi) o recurso fica no clamp 0..100.
- A resposta traz Resultado.eventos com RECURSO {cardId, recurso, quantidade, antes, depois} e o placar RECURSOS {vida, energia, foco, moedas}, no mesmo padrão de LANCE_DA_LUTA/LUTA em luta.ts.
- A pontuação de cada núcleo lê o PerfilDoLook por um método novo, Contexto.perfil(), e nunca o que o cliente diz. As prévias (previa) devolvem os atributos e nunca o desfecho, como Flair3dNucleo.previa já define.
- Testes: um JSON de golden fixtures (peça → itens esperados) lido pelo teste Java e pelo teste TS, que só parseia códigos. Assim o contrato não diverge.

(5) PERFIL POR JOGO (Flair3dRecursoPerfil.java)
É uma tabela por código com: os atributos que pesam na nota (com peso), o recurso que é a "vida" do jogo, o que o uso destrava na mecânica e o teto de bônus de nota (no máximo +15 pontos, para não engolir o objetivo). Detalhe em "por_jogo".

Restrições do repositório:
- Cada arquivo novo fica abaixo do limite: Java service/lib 250, DTO 120; TS lib 250, hook 150; testes 400.
- Flair3dNucleoService.java está com 242 linhas e nucleo-game.tsx com 247, quase no limite de 250. Antes de acrescentar código neles, é preciso extrair responsabilidades.
- Os textos vão nos três idiomas, em flair3d.ui.recurso.* e flair3d.ui.atributo.*.
- Nada de IA paga. O GoF entra só onde já há estrutura: Decorator do perfil sobre o Flair3dNucleo, como o Flair3dJogadaDeCena, com a decisão registrada em docs/refactoring/gof/R92-flair3d-peca-recurso.md.

Ordem:

1. 1. Teste de caracterização do /efeitos atual (itens e ordem por carta em 3 jogos) e de card-fx.ts (pontua, selo, motivo); extrair Flair3dEfeitosDaCarta de Flair3dNucleoService e um hook de preparação de nucleo-game.tsx; rodar line_ratchet.
2. 2. PecaRecurso.java e Flair3dRecursoTabela.java com a golden fixture docs/flair/flair-3d/fixtures/peca-recurso-golden.json e Flair3dRecursoTabelaTest (determinismo, clamps, empate).
3. 3. Flair3dRecursoCalculo.paraEfeitos e inclusão dos itens ATR_/REC_/USOS/DESTRAVA_/DOMINANTE_ no POST .../efeitos (contrato aditivo).
4. 4. Front de leitura: lib/flair/recursos/{types,leitura,delta}.ts, a correção de vale() em card-fx.ts e recursos.test.ts lendo a mesma fixture.
5. 5. Efeito ao vestir: nucleo-roda-atributos, nucleo-recurso-fx (texto curto), use-brilho-do-avatar e a prop brilho em nucleo-avatar; CSS 37-flair3d-recursos.css; chaves i18n em pt-BR, en e es.
6. 6. Uso como recurso no servidor: Acionamento.usar, EstadoDosRecursos em Andamento (com leitura neutra), Flair3dRecursoUso com as validações anti-forja e os eventos RECURSO/RECURSOS; Flair3dRecursoUsoTest.
7. 7. Uso na tela: usarRecurso em api.ts, use-recursos-da-partida (otimista e reconciliação), nucleo-roda-recursos e o botão USAR no nucleo-action-panel.
8. 8. Flair3dRecursoPerfil e ligação na pontuação, jogo a jogo, com o teto de bônus: primeiro os 4 da jogada de cena (Passarela, Dress the Star, Boutique, Around the World), depois Labirinto, Personagem de Filme, Batalha de Looks e Road to Glory.
9. 9. Migração dos motores com Flair3dAtributos (Dress Fighter, Detetive, Esporte) para Adapter sobre a tabela, com os testes de caracterização desses núcleos passando sem mudança de nota.
10. 10. Jogos de ZONAS (Clube, Singer, Piloto, Super-Herói) com a peça virtual, depois de validar com a dona; registrar R92 em docs/refactoring/gof e atualizar ESTADO_DOS_JOGOS.md e CORES_E_ACOES.md.

Riscos:

- card-fx.ts vale() considera como pontuação qualquer item numérico > 0 que não seja COR_: sem filtrar os prefixos novos (ATR_/REC_/USOS/DESTRAVA_/DOMINANTE_), toda carta passa a aparecer como 'pontua' e o selo de motivo some. Corrigir no mesmo PR, com teste.
- Três sistemas de atributo já divergentes (Flair3dAtributos, AfterpartyMods, lib/heist/cards.ts) mais o desenho de PROTAGONISTA_E_RECURSOS.md §3.2: se a tabela nova não for a fonte única, vira um quarto. Plano: os núcleos novos usam a tabela e os antigos migram com teste de caracterização (Adapter).
- CbcRules.Card não traz rarity, stats nem os atributos do WardrobeItem (HEEL_HEIGHT, CLOSURE, FINISH). A tabela começa só com tier, ovr, material, cor e subcategoria; acrescentar campos ao record mexe no construtor usado em muitos lugares (use um overload, como o que já existe na linha 91).
- Arquivos perto do limite: Flair3dNucleoService.java (242 de 250) e nucleo-game.tsx (247 de 250). É obrigatório extrair antes de acrescentar código, senão o line_ratchet barra.
- Balanceamento: o bônus de nota pela tabela pode engolir o objetivo de cada jogo. Teto de +15 pontos por jogo no Flair3dRecursoPerfil e fator do OVR limitado a ±10% contra pay-to-win.
- Partidas salvas e retomadas (Flair3dRetomada, Andamento): sem EstadoDosRecursos, ler como neutro. Mudar o estadoJson não pode quebrar o 'Continuar partida'.
- Determinismo: ordem de Set (HashSet) nas cores e materiais. Usar TreeSet ou LinkedHashSet e Locale.ROOT, como já faz Flair3dCores.acao; cooldown por lance, nunca por relógio.
- Optimismo no front: o '+15 Vida' aparece antes da resposta. Se o servidor recusar (usos esgotados, carta fora do deck), a reversão tem de ser visível sem parecer bug e com mensagem i18n.
- Os jogos de ZONAS (Clube, Singer, Piloto, Super-Herói) não têm cartas: a 'peça virtual' a partir de zona, cor e acabamento é uma interpretação de produto e precisa de validação da dona antes de implementar.
- Acessório (ACE) não aparece no manequim (look.ts:12). Sem um marcador visual, o brilho e o recurso vindos de bolsa, joia ou óculos parecem vir do nada.
- Futuro Unreal Engine 5: o desenho só vale se o contrato continuar somente códigos e números vindos do servidor. Qualquer cálculo que vá para o cliente TS teria de ser reescrito em C++/Blueprint e abriria espaço para forja.

### Padrão único de comandos de console (teclado, Gamepad API, mouse e toque) para os 15 jogos FLAIR

PRINCÍPIO: cinco botões e dois eixos. Todo dispositivo vira as mesmas ações abstratas. O jogo nunca lê tecla nem índice de botão.

1. TIPOS (lib/flair/entrada/acoes.ts, puro)
```ts
export const ACOES_ENTRADA = ["INTERAGIR", "CANCELAR", "ACAO", "INVENTARIO", "PAUSAR"] as const;
export type AcaoEntrada = (typeof ACOES_ENTRADA)[number];
export interface Vetor { x: number; y: number }              // -1..1, já com zona morta
export interface EstadoEntrada { mover: Vetor; camera: Vetor; origem: Origem }
export type Origem = "TECLADO" | "CONTROLE" | "TOQUE" | "MOUSE";
export type FamiliaControle = "PLAYSTATION" | "XBOX" | "GENERICO";
export interface EventoEntrada { acao: AcaoEntrada; origem: Origem }
```

2. TABELA ÚNICA DE COMANDOS (a única fonte, que substitui a tabela de BASE_NUCLEOS.md:261-281)
| Ação | Teclado | Gamepad (layout padrão W3C) | Mouse | Toque |
|---|---|---|---|---|
| Mover | WASD e setas | analógico esquerdo (eixos 0/1) e direcional (12-15) | — | joystick virtual à esquerda |
| Câmera | — (o mouse cobre) | analógico direito (eixos 2/3) | arrastar com o botão direito ou o esquerdo no palco | arrastar com o segundo dedo / a metade direita |
| INTERAGIR (X / cruz) | Espaço ou E | botão 0 | clique no objeto | botão X na tela ou toque no objeto |
| CANCELAR / esquivar (O / círculo) | Shift ou Backspace | botão 1 | — | botão O |
| ACAO do jogo (quadrado) | F | botão 2 | — | botão quadrado (rótulo do jogo) |
| INVENTARIO de roupas (triângulo) | I ou Tab* | botão 3 | — | botão triângulo |
| PAUSAR (Start) | Esc ou Enter | botão 9 | — | botão de pausa no canto |
*Tab só quando o foco está no canvas, para não roubar a navegação por foco. Recomendo deixar só I.

Zona morta de 0,2 nos analógicos e direcional normalizado (diagonal com hypot ≤ 1). Os botões são lidos por borda (como lerGamepad faz hoje, controls.ts:77-95). Segurar CANCELAR durante o movimento = esquivar (só onde o jogo declara esquiva). Em menus e no inventário, mover vira foco (cima/baixo/lados), INTERAGIR confirma e CANCELAR volta.

Onde vai o que saiu:
- ZOOM: a câmera ajusta sozinha (distância por enquadramento, CAMERAS.md); no mouse, a roda faz zoom sem virar comando.
- GIRAR: virou o eixo câmera.
- POSAR e DESFILAR: viram ACAO conforme o jogo.
- TROCAR_ABA: abas do inventário no próprio foco (mover para os lados na linha de abas).
- ENTREGAR e VER_OBJETIVO: itens do menu de pausa (Start) e do inventário ("Entregar o look").
- Z desfazer: CANCELAR dentro do inventário.
- I ampliar: ACAO dentro do inventário sobre a carta focada.

3. LEITURA PURA POR DISPOSITIVO (Adapter)
- lib/flair/entrada/teclado.ts: `acaoDaTecla(code: string): AcaoEntrada | null` usando KeyboardEvent.code (KeyW, ArrowUp, Space...), que independe do layout ABNT/AZERTY; `vetorDasTeclas(pressionadas: ReadonlySet<string>): Vetor`. Reaproveita a lógica de ignorarTecla (use-nucleo-controls.ts:20-27: campos de texto, Ctrl/Alt/Meta, Espaço/Enter em botão focado).
- lib/flair/entrada/gamepad.ts: `lerControle(pad: PadLike, antes: boolean[]): { eventos: AcaoEntrada[]; mover: Vetor; camera: Vetor; botoes: boolean[] }` e `familiaDoControle(id: string): FamiliaControle` (vendor 054c = Sony → PLAYSTATION; "xinput"/"xbox"/045e → XBOX). Generaliza lerGamepad.
- lib/flair/entrada/glifos.ts: `glifo(acao, origem, familia): { simbolo: string; rotuloKey: string }`, ou seja X/○/□/△/Options para PlayStation, A/B/X/Y/Menu para Xbox e "Espaço", "Shift", "F", "I", "Esc" para teclado. O símbolo é só visual; o nome falado vem do i18n.

4. UM ÚNICO PONTO DE ESCUTA (Observer)
- components/flair/entrada/entrada-provider.tsx: provider por tela de jogo. Um só keydown/keyup e um só laço requestAnimationFrame (só com controle conectado, como hoje em use-nucleo-controls.ts:57-87). Guarda EstadoEntrada num ref (eixos lidos por frame no useFrame, sem re-render) e publica EventoEntrada a assinantes. Pilha de "camadas" (JOGO < INVENTARIO < PAUSA < DIALOGO): só a camada de cima recebe eventos, o que substitui os vários `ativo`.
- components/flair/entrada/use-entrada.ts (≤150): `useAcao(acao, fn, camada)`, `useEixos(): React.MutableRefObject<EstadoEntrada>`, `useOrigem(): { origem; familia }` (para trocar os glifos quando o último dispositivo usado muda).

5. PROXIMIDADE E DICA DE BOTÃO
- lib/flair/entrada/proximidade.ts (puro): `interface Interagivel { id: string; pos: [number, number, number]; raio: number; verboKey: string; desligado?: boolean }` e `maisProximo(avatar: Vetor3, alvos: Interagivel[], frente?: Vetor3): Interagivel | null` (desempate pelo que está à frente do avatar). No Detective usa os pontos de r.layout e o passoMaximo já existentes (lib/flair/detetive/acoes.ts:27-40).
- components/flair/entrada/use-interagivel.ts: o jogo registra objetos e recebe `alvoAtual`. INTERAGIR dispara `onInteragir(alvo.id)`, e o jogo toca o clipe de braço correspondente (pegar, abrir, vestir) via extras.tsx; o braço nunca é comandado pela pessoa.
- components/flair/entrada/dica-de-botao.tsx: `<Html>` do @react-three/drei (já dependência, package.json) ancorado acima do alvo, com o glifo de INTERAGIR mais o verbo ("X Abrir armário"). aria-hidden no 3D. O mesmo texto vai a uma região aria-live="polite" fora do canvas ("Perto: armário. Espaço para abrir"), anunciado só quando o alvo muda.

6. INVENTÁRIO E PAUSA
- components/flair/entrada/menu-pausa.tsx: role="dialog" aria-modal, foco preso, itens Continuar, Objetivo (o antigo VER_OBJETIVO), Entregar (o antigo ENTREGAR, quando o jogo permite), Comandos (a tabela com glifos da família atual), Acessibilidade e Sair. Ao fechar, o foco volta para o canvas.
- O inventário reaproveita o deck e a janela de recursos existentes (nucleo-deck-band.tsx, nucleo-resource-window.tsx). △ abre e fecha.

7. MAPA POR JOGO (lib/flair/entrada/mapa-por-jogo.ts, puro, tipado por código do núcleo)
```ts
type Movimento = "LIVRE" | "PONTOS" | "FOCO" | "NENHUM";
interface MapaDoJogo { movimento: Movimento; acaoKey: string | null; esquiva: boolean; inventario: boolean; interagiveis: string[] }
export const MAPA: Record<NucleoCodigo, MapaDoJogo>;
```
O mapa deriva da definicao.acoes que o back já manda (ex.: DESFILAR presente → acaoKey "desfilar"), para não mudar o contrato de GET /api/flair/3d/nucleos/{codigo} nem Definicao.ACOES. O back continua sem mudança.

8. ACESSIBILIDADE
- Tudo alcançável sem analógico: mover tem setas; câmera tem a opção "câmera automática" (segue o avatar), que vem ligada para quem só usa teclado.
- Foco visível no canvas (tabIndex=0, aria-label com o nome do jogo e "use as setas para andar") e em toda a UI de jogo; o foco nunca fica preso no canvas (Esc pausa e o menu é navegável por Tab).
- lib/flair/entrada/prefs.ts (localStorage, como fx-sound): inverter eixo Y da câmera, sensibilidade, "segurar ou alternar" para esquiva, câmera automática, tamanho dos botões de toque e reduzir movimento. Reduzir movimento começa em matchMedia('(prefers-reduced-motion: reduce)') ou em documentElement.dataset.reduceMotion (mesmo critério de lib/hype/use-fashion-depth.ts:8). Com ele: câmera sem balanço, cutscene com corte seco, sem vibração (gamepad.vibrationActuator só se ligado).
- Leitor de tela: a região aria-live anuncia alvo próximo, troca de camada ("Inventário aberto") e resultado da interação. Os glifos têm nome falado nos três idiomas.

9. TOQUE NO CELULAR
- components/flair/entrada/controle-de-toque.tsx: aparece quando o último dispositivo é TOQUE (pointerType === "touch"). Joystick virtual à esquerda (components/flair/entrada/use-joystick-toque.ts: pointer capture, raio e zona morta iguais ao do analógico), metade direita arrasta a câmera, quatro botões em losango (X, O, □ com o rótulo do jogo, △) e pausa no canto. Áreas de toque ≥ 44 px, posição espelhável (canhoto) nas prefs. Tocar direto num objeto com dica também INTERAGE (mantém o clique atual do Detective, sala-3d.tsx:157).

10. GoF: Adapter (teclado, gamepad e toque viram AcaoEntrada), Observer (provider e assinantes) e State (pilha de camadas). Registrar em docs/refactoring/gof/entrada-console.md.

11. i18n (pt-BR, en, es), chaves planas como as atuais: flair3d.entrada.acao.{INTERAGIR,CANCELAR,ACAO,INVENTARIO,PAUSAR}, flair3d.entrada.glifo.{teclado,ps,xbox}.*, flair3d.entrada.verbo.* (abrir, vestir, falar, pegar, posar, desfilar, jogarCarta, aplicar), flair3d.entrada.pausa.*, flair3d.entrada.perto ("Perto: {alvo}. {botao} para {verbo}"), flair3d.entrada.prefs.*. As chaves flair3d.ui.controls.* atuais ficam até a migração terminar e depois são removidas nos três arquivos.

Ordem:

1. 1. Testes de caracterização do que existe: teclas e botões de controls.ts, use-nucleo-controls, use-mao-controle, use-cbc-controle e o Z de use-cbc-jogo/use-elenco-jogo.
2. 2. lib/flair/entrada puro (acoes, teclado, gamepad, glifos, proximidade, prefs) com testes; registrar a decisão GoF em docs/refactoring/gof/entrada-console.md.
3. 3. EntradaProvider e use-entrada com pilha de camadas; tradutor legado em controls.ts para que use-nucleo-controls passe a ler do provider sem mudar o comportamento.
4. 4. Extrair de nucleo-game.tsx a ligação de controles para um hook (fica abaixo de 250) e montar o provider, o MenuPausa (objetivo, entregar e comandos saem dos botões) e as chaves i18n nos três idiomas.
5. 5. Migrar jogos FOCO e de cartas: ROAD_TO_GLORY (makeup-game), CLUBE_CORACAO, FAVORITE_SINGER, PILOTO_FAVORITO, SUPER_HEROI, DRESS_FIGHTER e FASHION_SPORTS (use-mao-controle); remover o grupo camera/deck de nucleo-controls.
6. 6. FASHION_DETECTIVE com PONTOS: use-interagivel e DicaDeBotao em sala-3d, X/quadrado/O/triângulo no painel e nas folhas.
7. 7. ControleDeToque e use-joystick-toque, e preferências de acessibilidade (reduzir movimento, câmera automática, inverter Y, canhoto).
8. 8. Hub (mode-hub.tsx) e afterparty-adventure no provider; apagar os laços de gamepad duplicados.
9. 9. Jogos LIVRE (PASSARELA, DRESS_THE_STAR, PERSONAGEM_FILME, BOUTIQUE_3D, LABIRINTO, AROUND_THE_WORLD, BATALHA_LOOKS) conforme cada cenário navegável ficar pronto, com use-camera-entrada.
10. 10. Remover TECLAS/BOTOES/BOTOES_TELA legados e as chaves flair3d.ui.controls.*, atualizar BASE_NUCLEOS.md e rodar python -m scripts.refactoring.line_ratchet.

Riscos:

- A maioria dos núcleos hoje é tela de cartas sem avatar andando: 'movimento LIVRE' em PASSARELA, BOUTIQUE_3D, LABIRINTO e outros exige cenário navegável, colisão e câmera de terceira pessoa que não existem. A entrada pode ficar pronta antes, mas o mapa por jogo depende disso. Comece por FOCO e PONTOS.
- W hoje é DESFILAR (controls.ts:31) e O é VER_OBJETIVO (l.33): mudar quebra a memória de quem já joga e os testes atuais (use-nucleo-controls.test.tsx, use-mao-controle.test.tsx, cbc.test.tsx:208-215). Faça teste de caracterização antes e migre tela a tela com o tradutor legado.
- O contrato do back (Definicao.ACOES e ACOES_ZONAS, l.20-23, e o campo acoes[] da API) deve continuar igual; o front só reinterpreta. Se alguém tentar renomear as ações no back, quebra a API pública.
- Gamepad API: o mapeamento 'standard' não é garantido (pad.mapping !== 'standard' em controles genéricos e no Safari); a família PlayStation ou Xbox pelo id é heurística. Precisa de fallback com glifos genéricos e de uma tela para testar os botões.
- Espaço como INTERAGIR conflita com o clique nativo de botão focado; a regra de ignorarTecla (use-nucleo-controls.ts:20-27) tem de ir junto. Tab como inventário roubaria a navegação por foco, por isso só I.
- nucleo-game.tsx tem 247/250 linhas: qualquer acréscimo sem extrair antes quebra o line_ratchet. afterparty-adventure.tsx está comprimido e precisa ser reformatado em arquivos auxiliares antes de mexer.
- Um provider por tela: se o hub e o jogo montarem dois, voltam os listeners duplicados. Garantir uma instância por rota.
- Leitor de tela e canvas: Html do drei sem aria-hidden duplica anúncios; a região aria-live precisa de controle de frequência (só quando o alvo muda).
- Toque: joystick virtual sobre o canvas do r3f pode disputar eventos com OrbitControls ou cliques em objetos; separar áreas e usar touch-action:none só nelas.
- Para o futuro em Unreal Engine 5 (pedido da usuária): a tabela de 5 ações e 2 eixos corresponde direto a Input Actions e Mapping Contexts do Enhanced Input; manter a tabela em lib/flair/entrada como fonte de verdade documentada facilita portar, mas nada deste código TS é reaproveitado no UE5.

### Cutscenes no padrão de ação e aventura nas 15 modalidades do FashionAI (abertura, momentos-chave, final de vitória e de derrota), com câmera própria, faixas de cinema, legenda e pular

MODELO COMUM: uma cutscene é um dado puro, independente de motor.
Pasta nova lib/flair/cinema. Os tipos ficam em lib/flair/cinema/types.ts:

```ts
export type Gatilho = "ABERTURA" | "DESCOBERTA" | "CONFRONTO" | "VIRADA" | "VITORIA" | "EMPATE" | "DERROTA";
export type Movimento = "FIXA" | "TRAVELLING" | "ORBITA" | "GRUA" | "ZOOM";
/** onde a câmera fica, relativo ao alvo (o mesmo vocabulário dos rigs de lib/flair/nucleos/camera/rigs.ts) */
export interface Enquadramento { dist: number; altura: number; angulo: number /* graus em volta do alvo */; mira: number /* altura do olhar */; fov?: number }
/** ator do Diretor ("avatar", "fig:OPONENTE:0", "movel:porta", "luz:estrela") ou ponto fixo da sala */
export type Alvo = string | { ponto: [number, number, number] };
export interface Tomada {
  duracaoS: number;          // 1,5 a 5 s; a soma respeita o teto do gatilho
  alvo: Alvo;
  de: Enquadramento;
  ate?: Enquadramento;       // sem `ate`: FIXA
  movimento: Movimento;
  corte?: "SECO" | "FUSAO";  // como entra nesta tomada (padrão SECO)
  fala?: string;             // chave i18n, ex. "flair3d.cinema.PASSARELA.VITORIA.1"
}
export interface Cutscene {
  id: string;                // "<JOGO>.<GATILHO>[.<variante>]", ex. "DRESS_FIGHTER.VIRADA.NOCAUTE"
  jogo: NucleoCodigo;
  gatilho: Gatilho;
  tomadas: Tomada[];
  sequencia?: string;        // id da Sequencia de atores tocada pelo Diretor existente (director.ts) em paralelo
  umaVezPorPartida?: boolean; // aberturas: na revanche, versão curta (só a última tomada)
}
/** Tetos de duração; uma cutscene de meio de jogo NUNCA tira o controle por mais que isso */
export const TETO_S: Record<Gatilho, number> = { ABERTURA: 12, DESCOBERTA: 4, CONFRONTO: 5, VIRADA: 4, VITORIA: 10, EMPATE: 8, DERROTA: 8 };
```

Regras do modelo, validadas por uma função pura `validarCutscene(c)` em types.ts e cobertas por teste sobre o catálogo inteiro:
- a soma de duracaoS é no máximo TETO_S[gatilho];
- toda `fala` existe nos três catálogos (pt-BR, en, es);
- toda cutscene pode ser pulada;
- com "reduzir movimento" vira quadro parado: só a última tomada, FIXA, por 1,5 s ou até o toque, com a legenda;
- uma tomada dura no máximo 5 s e tem no máximo 1 fala, para a legenda acompanhar a imagem. Isso corrige o descompasso atual do Detective, onde a legenda dura 14,4 s e a câmera 8 s.

CÂMERA NO INSTANTE: função pura em lib/flair/cinema/tomada.ts:
`cameraNoInstante(c: Cutscene, t: number, onde: (alvo: Alvo) => {x, y, z, giro}): { pos: V3; alvo: V3; fov: number; tomada: number; fala?: string; fim: boolean }`
- Acha a tomada pelo tempo acumulado.
- Interpola de→ate pelo movimento: TRAVELLING interpola linear, ORBITA varia o ângulo, GRUA varia a altura, ZOOM varia dist e fov, sempre com a curva suave já usada em opening.ts:29.
- No corte SECO a câmera salta; na FUSAO, o overlay faz um fade de 200 ms.
- Respeita limiteDaCamera(sala) (zones.ts), como opening.ts:35 já faz.
Esta função absorve opening.ts:24-49 e camera-da-cena.ts inteiro. As quatro tomadas atuais do Detective viram dados do catálogo, e os testes de camera-da-cena.test.ts são portados como caracterização antes da troca.

GATILHOS: função pura em lib/flair/cinema/gatilhos.ts, uma tabela sem lógica espalhada:
`cutscenesDoEvento(jogo, evento): string[]` com
`evento = { tipo: "ENTRAR" } | { tipo: "RESULTADO"; resultado: NucleoResultado } | { tipo: "LANCE"; jogadas: Jogada[]; fim: boolean } | { tipo: "DETETIVE"; cena: string }`
- ABERTURA vem do momento DECK→PREPARACAO (moments.ts:26-27) ou da chave de abertura que já existe em use-scene-director.ts:257-260.
- Os gatilhos do meio vêm dos eventos que o servidor já manda: ROUND e lances (sequences-match.ts:19), JOGADA_DE_CENA (use-scene-director.ts:250), regra TITULO (sequences-auto.ts:40), regra ACESSO (sequences-auto.ts:55), espelho e porta do LABIRINTO, momentoDoLance do Sports (momentos.ts:12).
- O final vem de desfechoDe (narrativa.ts:15): BOM→VITORIA, MEDIO→EMPATE, RUIM→DERROTA.
- No Detective, a string do servidor ("ABERTURA:SALAO", "RESOLUCAO:x", "ALIBI:n", "FINAL:x") vira o id "FASHION_DETECTIVE.<TIPO>.<ASSUNTO>". O contrato do back não muda.
A cena continua só mostrando o que o servidor calculou: nenhuma cutscene muda nota.

CATÁLOGO: dados agrupados por família de cena, um arquivo por família, cada um com até 250 linhas, em lib/flair/cinema/catalogo/:
- comum.ts: abertura e finais genéricos parametrizados pela sala;
- desfile.ts;
- luta.ts;
- set.ts;
- loja.ts;
- zonas.ts;
- caminho.ts;
- detetive.ts;
- esporte.ts.
Um índice `cutsceneDe(id)` e `cutscenesDoJogo(jogo)` com fallback para comum.ts, para nenhum jogo ficar sem abertura ou final.

TELA:
- Hook components/flair/cinema/use-cutscene.ts (no máximo 150 linhas):
  - fila de cutscenes;
  - relógio pelo agora() de stage-context;
  - pular por botão, Esc/Enter/Espaço e botão B do gamepad, reaproveitando use-nucleo-controls;
  - "rever";
  - onFim, que libera o momento seguinte;
  - toca a `sequencia` de atores no Diretor existente;
  - nunca empilha mais de uma cutscene de meio de jogo: se chega outra, a anterior é cortada.
- Overlay components/flair/cinema/cinema-overlay.tsx: generaliza detetive-cutscene.tsx com faixas de cinema animadas (entram em 300 ms), legenda com aria-live, contador, Pular/Rever/Seguir, e não é modal.
- Câmera components/flair/cinema/cinema-camera.tsx (useFrame): vale sobre o rig só enquanto a cutscene toca e devolve a lente suavemente ao rig, como opening-camera.tsx faz hoje.

TEXTOS: chaves novas `flair3d.cinema.<JOGO>.<GATILHO>[.<variante>].<n>` e `flair3d.cinema.ui.{titulo,pular,rever,seguir,dica}` nos três arquivos lib/i18n/messages/{pt-BR,en,es}.json. Nos finais, a primeira fala reaproveita `flair3d.narrativa.<JOGO>.final.<BOM|MEDIO|RUIM>`. As chaves `flair3d.detetive.cena.*` continuam válidas por um alias no catálogo. Sem IA paga: todo texto é escrito à mão e versionado.

REGRA DO CONTROLE:
- ABERTURA (até 12 s) e FINAL (até 10 s) podem tirar o controle, mas o Pular aparece desde o primeiro quadro.
- DESCOBERTA, CONFRONTO e VIRADA tiram no máximo 4 a 5 s.
- Na revanche, a abertura toca só a última tomada.
- Na luta do Dress Fighter e no Sports, que são lance a lance, a cutscene de lance dura no máximo 3 s e não toca em todo lance, só nos marcados: round novo, nocaute, gol.

GoF: o catálogo é tabela de dados e os gatilhos são uma tabela de transições, então não precisa de padrão GoF. O hook tem uma fila simples, também sem padrão. Registrar isso em docs/refactoring/gof/ só se aparecer um Command para rever ou pular, o que hoje não é necessário.

PORTABILIDADE PARA A UNREAL ENGINE 5 (o objetivo futuro do pedido): como Cutscene e Tomada são dados puros (alvo por id de ator, enquadramento relativo, duração, fala por chave i18n), o catálogo pode ser exportado para JSON e lido na UE5 como Level Sequence: cada Tomada vira uma seção da Camera Cut Track, Enquadramento vira transform relativo ao ator vinculado, `fala` vira legenda pela String Table importada dos mesmos JSON de i18n, e `sequencia` vira as faixas de animação dos atores. Por isso o desenho fica no lib puro, não nos componentes three.js.

LISTA POR MODALIDADE: 15 jogos, 82 cutscenes.
Legenda do status: EXISTE (mantém e migra para o modelo), REFAZER (há algo, falta câmera, legenda ou pular), NOVA.
- Existentes: 9, todas do Detective caso, Sports e núcleo gala.
- A refazer: 33.
- Novas: 40.
O detalhe está em por_jogo.

Ordem:

1. 1. Testes de caracterização: portar camera-da-cena.test.ts e opening.test.ts e acrescentar testes do comportamento atual de detetive-cutscene, nucleo-cutscene e opening-camera (duração, pular, reduzir movimento).
2. 2. lib/flair/cinema/types.ts e tomada.ts (puros), reproduzindo exatamente as tomadas atuais da abertura comum e do Detective; os testes do passo 1 passam sem mudança.
3. 3. Componentes comuns: cinema-overlay.tsx (generaliza detetive-cutscene.tsx), cinema-camera.tsx e use-cutscene.ts (pular por tecla e gamepad), mais o CSS 49-flair3d-cinema.css.
4. 4. Trocar a ligação sem mudar o visual: Detective caso (detetive-palco, detetive-cena-3d) e abertura comum (nucleo-scene-3d) passam a usar o cinema; remover opening-camera.tsx e camera-da-cena.ts.
5. 5. gatilhos.ts e catalogo/comum.ts: abertura e finais VITORIA, EMPATE e DERROTA genéricos para todos os jogos, com o painel do resultado depois do final (nucleo-result.tsx) e as falas nos três idiomas. Isso fecha a lacuna 'Falta em todos' (ESTADO_DOS_JOGOS.md:87).
6. 6. Refazer as cutscenes existentes no padrão: Detective com cortes, legenda alinhada, finais separados e gala no lugar de nucleo-cutscene.tsx; Sports com entrada em campo, replay e apito final.
7. 7. Catálogos por família, na ordem de valor: luta.ts (DRESS_FIGHTER), desfile.ts (PASSARELA, DRESS_THE_STAR, BATALHA_LOOKS), loja.ts, set.ts (inclui make-up), caminho.ts (LABIRINTO, AROUND_THE_WORLD) e zonas.ts (CLUBE, SINGER, PILOTO, SUPER_HEROI), cada um com teste de teto e falas.
8. 8. Cutscenes novas de meio de jogo (descoberta e confronto do Detective, round e nocaute, DESCOBERTA dos jogos de zonas), com a pausa no use-action-playback.
9. 9. Atualizar ESTADO_DOS_JOGOS.md, rodar python -m scripts.refactoring.line_ratchet sem violações e conferir a tela a 390×844 com reduzir movimento ligado e desligado.

Riscos:

- Tempo sem controle: com 82 cutscenes, somar aberturas, momentos e finais pode deixar a partida lenta. Mitigação: TETO_S validado em teste sobre o catálogo inteiro, abertura curta na revanche (umaVezPorPartida), Pular visível desde o primeiro quadro e pular a ação também pula a cutscene de meio.
- Jogos lance a lance (DRESS_FIGHTER, FASHION_SPORTS, Detective por cartas): cutscene a cada lance quebraria o ritmo. Só lances marcados disparam cutscene (round novo, nocaute, gol, chave), com no máximo 3 s e sem fila acumulada.
- Disputa entre câmeras: o rig do jogo (game-camera.tsx), a câmera da transmissão do Sports e o componente Camera do Detective já escrevem na lente a cada quadro. A CinemaCamera precisa ser a única a escrever enquanto a cutscene toca (montada depois do rig, como opening-camera.tsx faz hoje) e devolver a lente suavemente, senão aparecem saltos.
- Contrato do back: o Detective depende das strings 'TIPO:ASSUNTO' (DetetiveAcoes.java:177, 200, 202, 225). O desenho não muda o back: só traduz a string para o id do catálogo. Teste de caracterização antes de remover camera-da-cena.ts.
- i18n: dezenas de falas novas nos três idiomas. Um teste que exija as mesmas chaves em pt-BR, en e es evita legenda vazia. Textos escritos à mão, sem IA paga.
- Limite de linhas: transmissao-3d.tsx (149) e detetive-cena-3d.tsx (178) estão perto do limite de 250 para componente. A ligação com o cinema deve ir para um hook separado (até 150 linhas), e os catálogos ficam divididos por família para cada um caber em 250.
- Desempenho no celular sem placa de vídeo: cortes secos não custam nada, mas fusões e mais figurantes em cena pesam. Com 'reduzir movimento' e qualidade baixa (scene/qualidade.ts), usar quadro parado.
- Acessibilidade: as faixas de cinema não podem cobrir os controles; a legenda precisa de aria-live polite, foco no botão Pular e Esc funcionando; nada de piscar rápido nos flashes (L_FLASH).
- Migração futura para a Unreal Engine 5 (pedido de fundo da pessoa usuária): se a lógica de cutscene ficar dentro de componentes three.js, ela se perde na troca de motor. Manter Cutscene, Tomada e gatilhos como dados puros em lib/flair/cinema, exportáveis para JSON e mapeáveis para Level Sequence e String Table, reduz esse custo. A escolha de motor e de lojas de aplicativo continua sendo decisão da pessoa usuária.

## Auditoria por jogo

### PASSARELA

O jogador escolhe a rodada (tema surpresa ou treino de tema fixo), monta um deck de até 8 cartas e entra; a câmera faz um travelling de 6 s enquanto o avatar anda até a marca e a plateia aplaude, e um cartão de texto revela o tema. Na preparação ele só navega pela fileira de cartas e veste até 5 vagas (SUP, INF, CAL, ACE, VES), vendo a prévia da nota no HUD; girar, zoom, posar e desfilar são enfeites que não pontuam. Ao entregar, o servidor dá +10 por peça no tema e +20 se todas estão no tema (70 vira 100) e deixa a partida EM_ACAO pedindo uma cor; o jogador clica em uma carta fora do look (a cor pedida vale +10) ou segue sem carta. Só então roda sozinho o desfile até a ponta, com flashes e reação da plateia pela nota, que pode ser pulado. O fim mostra a nota, estrelas, APROVADO (60 ou mais) ou REPROVADO e a colocação contra 3 desfiles da casa com notas sorteadas; não há vida, tempo, inimigo nem derrota com consequência.

Efeito das roupas hoje: Vestir uma carta troca a peça no corpo do avatar, dispara por instantes o efeito de luz da família de cor na sala (silhueta, brisa, holofote, flashes, aplauso da plateia, passarela acesa) e atualiza a prévia da nota e das estrelas no HUD, com o selo no tema ou fora do tema na carta. Não muda vida, energia, atributos nem ações do avatar: esses conceitos não existem na Passarela. O único efeito mecânico da cor é na jogada de cena depois da entrega, quando a carta de cor igual à pedida soma 10 pontos fixos.

Melhorias propostas:

- **Desfile jogável em terceira pessoa** (Jogabilidade, G, +5.5): Trocar a sequência automática do desfile por um trecho controlado: o jogador anda pela passarela (z de -8 a 2,6, zona já descrita na sala) com o analógico esquerdo ou WASD, no ritmo da trilha, e para em 3 marcas de pose (pontoDePose já existe em moveis/marcas.ts). Em cada marca aperta o botão pedido dentro de uma janela de tempo (perfeito, bom, errou), e o fotógrafo dispara. O servidor recebe os acertos como acionamentos (mesmo canal da jogada de cena) e soma à nota; errar o ritmo ou sair da faixa custa pontos. Reaproveitar o movimento e a câmera SEGUE que o Fashion Detective já usa (lib/flair/detetive, rig EXPLORACAO) e os clipes CAMINHADA_DE_PASSARELA, PARADA_NA_PONTA e MEIA_VOLTA. Manter a opção de pular para quem usa reduzir movimento, com nota neutra.
- **Atributos da roupa que mudam o desfile na hora** (Efeito das roupas, M, +5): Dar a cada peça vestida um efeito de jogo calculado no servidor e mostrado no HUD ao vestir (o bloco de atributos da prévia já existe em NucleoScore): calçado define a velocidade de caminhada e a largura da janela de pose (salto: mais pontos, janela menor); material e peça de cima definem Presença (enche a barra de aplauso mais rápido); acessório dá uma pose extra; vestido libera o giro como pose especial; cada peça no tema soma Confiança inicial. Reaproveitar Flair3dAtributos e Flair3dPecas (já usados no Dress Fighter) e devolver os atributos como eventos da prévia. Na cena, o avatar muda o passo e a pose parada conforme o calçado e a luz de efeito fica ligada enquanto a peça está vestida, não só por um clipe.
- **Barra de Confiança, medidor de Aplauso e cartas gastas** (Recursos, M, +5.5): Criar dois recursos visíveis durante o desfile: Confiança (a vida: cai ao errar a pose, tropeçar ou sair da faixa; a zero, o desfile termina na marca em que está e a partida fecha REPROVADO) e Aplauso (a energia: enche com poses certas e peças no tema, e é gasta para ativar uma carta de cena). As até 3 cartas fora do look viram a mão do desfile: cada uma é gasta uma vez, custa Aplauso e faz o efeito da cor dela (FLASHES dobra a próxima pose, HOLOFOTE recupera Confiança, BRISA alarga a janela). Reaproveitar o componente NucleoBarrasDeVida do Dress Fighter e o registro de acionamentos do andamento no servidor; declarar os recursos novos em recursos do núcleo.
- **Mapa de comandos de console enxuto** (Comandos, M, +4.5): Refazer a tabela: analógico esquerdo e WASD movem o avatar no desfile (e navegam as cartas no preparo, junto com o direcional); analógico direito gira a câmera; X (A no layout padrão) confirma, veste e faz a pose pedida; círculo tira a peça ou cancela; quadrado joga a carta de cena em foco; triângulo abre o objetivo; LB/RB trocam de vaga; R3 troca de câmera; Start entrega e, em cutscene, pula. Remover como comando próprio GIRAR por tecla, ZOOM nos gatilhos, POSAR solto e DESFILAR liga/desliga (o desfile passa a ser a ação), e tirar cima/baixo em linhas de 4. Ler os eixos 0 e 1 em lerGamepad. Dar foco e botão de gamepad às opções do NucleoTrigger e ao pular. Mostrar no HUD os glifos do controle conectado e atualizar os textos flair3d.ui.controls nos arquivos de idioma.
- **Cutscenes com cortes, pular e final por desfecho** (Cutscenes, M, +3.5): Abertura em 3 planos com corte (painel de LED com o tema, plateia e fosso dos fotógrafos, avatar no arco do backstage), usando o Roteiro e os rigs que já existem; aceitar Start ou Enter para pular (zerar o início em CameraDeAbertura e chamar diretor.limpar). Dar cena própria à carta de cena: close de 1,5 s no efeito da cor quando ela é jogada, em vez de tocar junto com o resultado. Final distinto por desfecho: 3 estrelas com giro de grua, plateia de pé e chuva de flashes; aprovado com travelling e reverência; reprovado com plano do fosso, fotógrafos baixando a câmera e o avatar voltando de costas. Antes do resultado, mostrar os 3 desfiles da casa em plano rápido com humanoides de lib/flair/nucleos/gente/humanoides.ts.
- **Sala da passarela com modelos detalhados do motor Blender** (Gráficos, G, +3): Gerar em scripts/blender3d os GLB que faltam e registrá-los no manifesto com versão leve: passarela (tampo com borda chanfrada, saia com painéis e fita de LED embutida), painel de LED com moldura e treliça, arco do backstage com cortina, grade do fosso, câmeras com tripé no fosso (camera-tripe já existe no manifesto e não é usada nesta sala) e canhões de luz (canhao-luz também existe). Aumentar a plateia para as 22 cadeiras com variação de roupa por semente, pôr fotógrafos humanos com o gesto de fotografar, ligar sombra no foco dos spots e textura de reflexo no tampo de laca. Adicionar a câmera de terceira pessoa (rig SEGUE) para o desfile jogável. Conferir no teste de orçamento da cena e tirar fotos do desfile completo.
- **Vitória, derrota e rivais que desfilam** (Sentido e objetivo, M, +2.5): Tornar o desfecho legível e com peso: mostrar no HUD do desfile o objetivo da vez (tema, marcas de pose restantes, colocação parcial); fazer os 3 desfiles da casa aparecerem como modelos humanoides que cruzam a passarela antes do jogador com a nota no painel de LED, para a colocação ter rosto; derrota explícita quando a Confiança zera ou a nota fica abaixo de 60, com tela própria e a dica do que trocar (o rateio por carta já vem do servidor); e progressão na campanha, em que cada rodada vencida abre a seguinte com janela de pose menor e nota da casa mais alta (ampliar NOTAS_DA_CASA por rodada).

Problemas de gravidade alta:

- Jogabilidade: O desfile, núcleo do jogo, é uma sequência automática sem entrada do jogador; ele só pode pular. Não há movimento livre do avatar em nenhum momento. (`lib/flair/nucleos/scene/sequences-auto.ts`)
- Jogabilidade: Na ACAO só valem CAMERA e PULAR; DESFILAR está mapeado como ação de vestir e só funciona na preparação, sem efeito na nota. (`lib/flair/nucleos/moments.ts`)
- Recursos: Recurso único (CARTAS); sem vida, energia, moeda ou tempo. A carta da jogada de cena não é gasta e o bônus é fixo. (`lib/flair/nucleos/passarela.ts`)
- Efeito das roupas: A roupa só dá pontos por tema e um efeito de luz; não existe atributo do avatar na Passarela (ao contrário do Dress Fighter, que usa Flair3dAtributos). (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/PassarelaNucleo.java`)
- Comandos: O gamepad não lê o analógico esquerdo (só o eixo 2); não há mover. W alterna o desfile. X, Y e os gatilhos estão gastos com pose, desfile de enfeite e zoom. (`lib/flair/nucleos/controls.ts`)

### DRESS_FIGHTER

A pessoa monta um deck de até 6 cartas (1 calçado obrigatório), escolhe uma das três arenas (bairro, veloz, blindada) e, depois de uma abertura de 6 s com a câmera e a oponente em guarda, veste a avatar vendo velocidade, ataque e defesa do look na prévia do servidor. Ao entregar (Enter/Start), a partida fica EM_ACAO: são 9 lances em 3 rounds, as duas com 100 de vida; em cada lance a tela mostra o golpe que a oponente vai fazer (a "leitura") e a pessoa clica num botão HTML com uma carta da mão, cuja cor é o golpe (vermelho forte, amarelo rápido, preto guarda, verde esquiva, azul fôlego +10 de vida, branco foco/contra-ataque, Especial uma vez), ou em "Guarda sem carta". O servidor calcula o dano pelos atributos do look e pelos combos (Relâmpago, Contragolpe, Muralha), a cena 3D toca o lance na câmera lateral de arcade e as barras de vida descem. A luta acaba por nocaute ou no nono lance (vence quem ganhou mais rounds por dano; empate, quem tem mais vida): vitória 100 pontos, derrota com um round 50, senão 0, com a queda de quem perdeu, texto de fim e progresso da campanha das arenas. A avatar nunca é movida pelo jogador: não há deslocamento, tempo de reação nem botão de golpe no teclado ou no controle. Nada disso foi visto em tela com GPU (o próprio ESTADO_DOS_JOGOS.md marca "não" em "Visto na tela" para todos os itens do jogo); a auditoria é de código e testes.

Efeito das roupas hoje: Parcial. Na preparacao, cada peca vestida muda na hora os tres atributos mostrados no HUD (previa do servidor): OVR/10 em velocidade, ataque e defesa; tenis +20 velocidade, salto -20; metal ou couro +20 ataque; couro, jeans ou la +20 defesa. Na luta esses atributos entram na conta: golpe forte = 12 + ataque/5, rapido = 7 + velocidade/6, a guarda deixa passar menos conforme a defesa, o contra-ataque do foco usa ataque + velocidade. A cor da carta jogada (vestida ou nao) escolhe o golpe e a carta Especial da um golpe indefensavel de 20 + OVR/10. O que NAO acontece: a vida maxima nao muda, nao ha recurso que a roupa de ou tire, a peca vestida nao libera nem bloqueia acao, o painel de atributos some durante a luta, nao ha troca de peca entre rounds e nenhuma peca brilha ou deixa rastro quando age. O jogador ve o efeito da roupa antes da luta e depois so o deduz pelos numeros de dano.

Melhorias propostas:

- **Golpes no controle e no teclado, no padrao de console** (Comandos, M, +4.8): Criar um mapa de comandos proprio da luta, ativo so em ACAO: quadrado = golpe rapido (amarelo), triangulo = golpe forte (vermelho), X = guarda (preto), O = esquiva (verde), L1 = folego (azul), R1 = foco (branco), R2 = Especial, com as teclas J/I/K/L/U/O/Espaco equivalentes; o comando escolhe a primeira carta da mao com aquela cor (direcional troca entre cartas da mesma cor) e chama o mesmo onAcionar de hoje. Mostrar o glifo do botao em cada carta do painel do lance. Em ACAO, tirar POSAR/GIRAR/ZOOM do mapa (a camera fica no seletor, em L3/R3) e remover o botao 'Ver o resultado' enquanto a luta espera. Como nucleo-game.tsx esta com 247 de 250 linhas, por a ligacao num hook novo (use-luta-comandos.ts), sem crescer o arquivo.
- **Cutscenes de luta: abertura pulavel, vinheta de round, nocaute e final com camera propria** (Cutscenes, M, +3.8): Reaproveitar o sistema de tomadas de opening.ts e os rigs de camera/rigs.ts para um roteiro de cutscenes da luta: (1) abertura com apresentacao da oponente (close nela, nome da arena) e botao/Start para pular; (2) vinheta 'Round N' de 1,5 s com corte para a camera de ombro; (3) no evento NOCAUTE, corte para CLOSE + camera lenta e GRUA subindo; (4) final por desfecho com camera propria (contra-plongee na vencedora, cinturao na ultima arena) em vez da ORBITAL_360. Adicionar as cameras NOCAUTE e VITORIA em camera/jogos.ts e generalizar NucleoCutscene (hoje so Detective) para legenda e 'pular'. Todas respeitam 'reduzir movimento' (quadro parado).
- **Andar na arena: distancia, tempo de resposta e leitura parcial** (Jogabilidade, G, +3.7): Deixar o jogador mover a avatar dentro do ringue (analogico esquerdo/WASD, limitado por zonas.avatar), com a camera OMBRO/SEGUE que ja existe, reaproveitando a locomocao e a exploracao do Fashion Detective. A distancia vira regra do servidor: o acionamento do lance leva alvo PERTO ou LONGE (o campo 'alvo' ja existe em AcionamentoPedido); forte e basico so acertam de perto, recuar evita o rapido mas nao cura, e os caixotes/tambores do beco dao cobertura (meia guarda) ate quebrarem. Para haver risco: a leitura mostra o golpe exato so se a velocidade do look for maior que a da oponente, senao mostra so 'ataque' ou 'defesa'; e a janela do lance fecha em 5 s (o servidor recebe sem carta = guarda basica). Extrair a regra de distancia para uma classe nova (DressFighterDistancia) para DressFighterLuta nao crescer; teste de caracterizacao antes.
- **Folego, cartas gastas e moedas: recursos que se gastam e voltam** (Recursos, M, +3.3): Acrescentar no servidor uma barra de folego (0 a 100): forte gasta 30, rapido 15, esquiva 10, Especial 50; guarda recupera 10 e a carta azul 35 (alem dos 10 de vida); sem folego, o golpe sai como basico. A carta jogada vai para o descarte e so volta no round seguinte (hoje basta alternar duas). Vida maxima = 80 + defesa/2 e folego maximo = 80 + resistencia (o atributo ja existe em Flair3dAtributos e nao e usado aqui). Vitoria paga moedas do circuito que compram um item de canto entre rounds (agua = +15 de vida, toalha = folego cheio). Devolver tudo no evento LUTA e desenhar a segunda barra e os itens em nucleo-barras-de-vida.tsx. Extrair DressFighterFolego para manter os arquivos dentro do limite.
- **A roupa age na luta e o jogador ve: passivas por peca, atributos na tela e troca entre rounds** (Efeito das roupas, M, +3): Manter velocidade/ataque/defesa visiveis durante a luta ao lado da barra de vida, com a peca que deu cada bonus. Dar a cada peca vestida uma passiva calculada no servidor e mostrada como icone: tenis = revela a leitura exata e age primeiro; couro = -3 de dano sofrido; metal = +4 no forte; salto = esquiva custa o dobro de folego; peca inteira (VES) = +10 de vida maxima. Quando a passiva dispara, a peca acende (LuzDeEfeito/effects-3d.tsx ja tem a luz de efeito; apontar para o slot da peca) e sai um numero flutuante. Abrir entre os rounds a troca de uma peca (o tipo TROCA ja existe em nucleo-trigger.tsx), com as barras e os atributos mudando na hora. So pecas vestidas contam para a passiva; a cor da carta continua sendo o golpe.
- **Beco com modelos do motor Blender, oponente lutadora e impacto nos golpes** (Gráficos, G, +3.2): Gerar no motor Blender do repositorio (scripts/blender3d/receitas, licenca propria, sem servico pago) os objetos que hoje sao primitivas: grade de arame, letreiros de neon, calcada com meio-fio, lixeira, escada de incendio, poste (ja existe poste.glb) e publicar no manifest.json com games DRESS_FIGHTER, apontando-os com comGlb nos moveis. Dar a oponente um look de lutadora por arena em roupaDoPapel (case OPONENTE: top/regata, calca cargo ou legging, tenis; veloz de tenis, blindada de couro), coerente com os atributos dela. Subir os torcedores mais proximos para os humanoides de gente/humanoides.ts. Nos golpes: faiscas/poeira instanciadas no ponto de impacto, tremor curto de camera e flash da luz 'rastro' em todo dano; sombra em 2048 na qualidade alta; neblina leve e reflexo do neon no asfalto. Conferir o orcamento da cena no teste e, sobretudo, ver em GPU real.
- **Resultado que ensina e arenas com regra propria** (Sentido e objetivo, P, +1.3): No resultado, uma linha por round com o dano dado e sofrido, o lance que decidiu e a dica concreta ('faltou defesa: vista couro ou jeans'), fechando o item pendente do doc. Separar o texto final de vitoria por nocaute do de vitoria por rounds. Dar a cada arena uma regra visivel alem dos numeros (veloz: janela do lance mais curta; blindada: a guarda dela quebra depois de dois rapidos) e uma quarta arena de chefe valendo o cinturao. Tutorial de 3 passos no primeiro lance (leitura, cor, combo). Corrigir os comentarios desatualizados e registrar em docs/flair/flair-3d/JOGOS.md a decisao de trocar o autobattler pedido pela dona pela luta jogada.

Problemas de gravidade alta:

- Comandos: O golpe nao tem tecla nem botao de controle: so botoes HTML. Em ACAO o teclado/gamepad so aceitam camera e objetivo; o mapa do controle e de provador (A vestir, B tirar, X posar). (`lib/flair/nucleos/moments.ts`)
- Jogabilidade: A avatar nao e movida pelo jogador em nenhum momento (o analogico esquerdo nem e lido; so o eixo 2). Nao ha distancia, posicionamento nem interacao com o cenario; o beco e so fundo. (`lib/flair/nucleos/controls.ts`)
- Jogabilidade: A leitura entrega o golpe exato da oponente antes de todo lance, sem limite de tempo: com as cores certas no deck a resposta otima e uma consulta de tabela, sem risco. Sem as cores, nao ha o que decidir. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/DressFighterLuta.java`)
- Recursos: So existe vida. Nenhum golpe custa nada, as cartas nao sao gastas (basta alternar duas), nao ha energia, moedas nem itens; a vida maxima e 100 para qualquer look. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/DressFighterGolpes.java`)
- Cutscenes: A abertura de 6 s nao pode ser pulada e nao ha cutscene de round, de nocaute nem de final com camera propria; o resultado usa a orbital comum. (`components/flair/nucleos/scene/opening-camera.tsx`)
- Efeito das roupas: Os atributos do look so aparecem na preparacao (aoVivo = momento PREPARACAO); na luta nada mostra o que a roupa esta fazendo, e a peca vestida nao muda vida, recurso nem acoes disponiveis. (`components/flair/nucleos/nucleo-hud.tsx`)

### DRESS_THE_STAR

O jogador escolhe uma das tres rodadas da campanha (Estrela Pop dos anos 2000, Modo Stylist, Look Relampago), monta um deck de ate 8 cartas (1 parte de cima e 1 de baixo obrigatorias) e entra no palco: uma abertura de 6 s com travelling de camera, o avatar andando ate a marca dourada e a plateia aplaudindo, mais um cartao de premissa/briefing sobre a faixa do deck. Na preparacao ele fica parado na marca e veste 4 vagas (SUP, INF, CAL, ACE) com cartas que batem o estilo ou a cor do perfil da estrela, que o proprio briefing entrega por escrito; a previa do servidor mostra a nota a cada troca (25 por peca). No Look Relampago o look-alvo fica 10 s no avatar e em lista e deve ser recriado de memoria. Ao entregar, a partida fica EM_ACAO e abre a "jogada de cena": um botao por carta fora do look, e a cor pedida (dita na tela) soma 10 pontos; depois roda sozinha a sequencia entrada no palco, estrela revelada, pose, reacao da plateia pela nota e reverencia. Termina com APROVADO (60 ou mais; estrelas em 60, 80 e 100) ou REPROVADO, um texto de final por desfecho e a campanha liberando ou nao a rodada seguinte; nao ha vida, tempo (fora os 10 s do Relampago) nem derrota durante a partida.

Efeito das roupas hoje: Quase nenhum. Vestir uma carta gera (1) o selo de pontuacao FIGURINO +25 ou o motivo FORA_DO_FIGURINO e a nota da previa, e (2) um efeito cosmetico de ate 4 s pela familia de cor (ELEGANCIA e TAPETE_VERMELHO acendem os canhoes, BRILHO pisca o telao, FLASH_FOTOGRAFOS faz a plateia aplaudir, FRESCOR e SERENIDADE so a luz de efeito), que o proprio codigo declara que 'nao muda a nota'. Nenhuma peca altera vida, energia, atributo, velocidade ou acao do avatar; a jogada de cena depois da entrega soma no maximo 10 pontos. Ou seja: a roupa e pontuacao no fim mais enfeite de luz.

Melhorias propostas:

- **Bastidores exploraveis: andar em terceira pessoa e pegar as pecas no cenario** (Jogabilidade, G, +4.5): Trocar a preparacao parada por uma fase de bastidores: ampliar a sala (camarim, corredor de araras, coxia, palco) e deixar o avatar andar livremente ate araras, penteadeira e bau de acessorios, onde as cartas do deck ficam distribuidas (posicao tirada da semente da partida). Reaproveitar o andar ponto a ponto e a camera EXPLORACAO (rig SEGUE) que o Fashion Detective ja usa, a colisao de camera de lib/flair/nucleos/camera/colisao.ts e os GLB que ja existem (arara, penteadeira, espelho, cadeira-de-camarim, rolos-de-tecido). Um contra-regra (humanoide 'seguranca'/elenco) faz ronda e atrasa quem esbarra. A entrega passa a ser subir ao palco e pisar na marca dourada. O servidor continua dono da nota: so recebe as cartas vestidas e o tempo gasto.
- **Recursos reais: contagem para o show, folego, confianca da estrela e fichas de pista** (Recursos, G, +6.5): Criar no servidor um andamento da partida com quatro medidores no HUD: (1) contagem regressiva para o show (acabou, a estrela sobe com o que estiver vestido); (2) folego do stylist, gasto ao correr e recuperado parado ou no bebedouro do camarim; (3) confianca da estrela (a 'vida'): cai a cada peca fora do perfil mostrada no espelho e a cada esbarrao no contra-regra, sobe com peca certa, e zerar encerra a noite como derrota; (4) fichas de pista, ganhas por achar objetos de cena e gastas para abrir a proxima pista. Seguir o modelo ja testado de DressFighterLuta (vida) e dos medidores do Detetive, e reaproveitar NucleoBarrasDeVida no HUD. A previa da nota deixa de ser gratuita: so aparece ao gastar uma ficha.
- **Cada peca vestida muda o avatar na hora: a cor vira habilidade e a vaga vira atributo** (Efeito das roupas, M, +5.5): Dar regra a tabela de cores do jogo, que hoje e so de cena (Flair3dCores.DE_CENA), no molde das tabelas DETETIVE e ESPORTE: preto = furtividade (o contra-regra demora a notar), verde = recupera folego, amarelo = +segundos na contagem, azul = acalma a estrela (+confianca), vermelho = corrida mais rapida, branco = abre uma pista sem gastar ficha. A vaga define o atributo (calcado = velocidade, acessorio = raio de interacao). O efeito aparece no instante de vestir: a barra correspondente sobe com animacao, o avatar ganha o gesto/velocidade nova e a luz de efeito ja existente acende na cor. O servidor devolve os efeitos em efeitos() e aplica no andamento; a tela so mostra.
- **Comandos no padrao de console: mover no analogico, quatro botoes de face para o cenario** (Comandos, M, +3.5): Analogico esquerdo e WASD movem o avatar; analogico direito gira a camera; cruz (A) interage com o que esta na frente (pegar a peca da arara, abrir o bau, falar com a estrela) e confirma a carta da jogada de cena; circulo (B) tira a peca/cancela; quadrado (X) joga a carta de cena em foco; triangulo (Y) abre o objetivo e as pistas; R1/L1 trocam a vaga; R3 troca a camera; Start entrega/pausa e pula cutscene. Remover como comando proprio GIRAR, ZOOM, POSAR e DESFILAR (pose e desfile ficam automaticos na cena do show; zoom fica no seletor de camera). Liberar na ACAO os comandos de escolher e confirmar a carta e de pular, que hoje comandoPermitido bloqueia, e dar foco navegavel aos botoes do NucleoTrigger. Atualizar a ajuda e os tres catalogos.
- **Cutscenes com camera propria, cortes e pular: chegada da estrela, subida ao palco e tres finais** (Cutscenes, M, +3.5): Criar um roteiro de tomadas por jogo (lista de {camera, alvo, duracao, corte ou travelling}) tocado pelo Diretor que ja existe, com faixa de cinema e legenda da narrativa. Abertura propria: plano do teatro vazio, a estrela (humanoide inteiro) entra pela coxia e entrega o bilhete com as pistas, close no bilhete, corte para o stylist. Momento-chave: ao pisar na marca, cortina abre, canhoes acendem, plano do fosso, contraplano da plateia. Final por desfecho: BOM = grua subindo com a plateia de pe e a estrela abracando o stylist; MEDIO = plano lateral, aplauso contido; RUIM = close da estrela devolvendo a peca e a luz apagando. Todas pulaveis em Start/Enter (hoje a abertura de 6 s nao pula) e resumidas a um quadro com reduzir movimento. Generalizar NucleoCutscene, que hoje so serve ao Detetive.
- **Teatro modelado no motor Blender e gente de verdade na plateia** (Gráficos, G, +3): Escrever receitas em scripts/blender3d/receitas para os objetos que hoje sao caixas: boca de cena com arco e ornamento, cortina de veludo com drapeado e franja, telao com moldura entalhada, parede de imprensa, pedestal com cordao, piso do palco com tabuas, e registrar os GLB (e a versao leve) em public/flair/3d/assets/manifest.json para entrarem no lugar das partes procedurais pelo mecanismo comGlb/glbDoMovel que ja existe. Fazer o telao exibir a silhueta e as pistas da estrela (textura dinamica como o scoreboard). Trocar a estrela-silhueta por um humanoide inteiro de lib/flair/nucleos/gente/humanoides.ts vestido com o look que o jogador montou, e ampliar a plateia para 3 fileiras usando o corpo leve (pessoa-leve.glb, 1072 triangulos para todos) com reacoes de gente/reacoes.ts; subir o orcamento de corpos inteiros da sala de 2 para 4. Acrescentar sombra nos focos do palco e nevoa volumetrica barata (cone aditivo) nos canhoes. Conferir em foto 390x844 e paisagem.
- **Pistas de verdade e show jogado: deduzir o perfil e acertar as marcas no palco** (Jogabilidade, M, +2): Tirar a resposta do texto das pistas (hoje 'Perfil: estilos..., cor...' vem escrito) e revelar o perfil so no resultado; as tres pistas passam a ser objetos achados nos bastidores (capa de disco, cartaz, bilhete), cada uma abrindo um atributo. A peca passa a valer 25 so com estilo E cor, 10 com um dos dois. No show, trocar a sequencia automatica por tres marcas no palco que acendem em ordem: o jogador anda ate cada uma antes do holofote apagar e joga a carta da cor pedida (a jogada de cena deixa de ser um botao com a resposta escrita e vira tres jogadas com janela de tempo; errar tira confianca da estrela). Corrigir o texto 'rosa ou prata' x 'cor rosa' e alinhar o perfil do Stylist com a regra base.
- **Derrota, fases e chefe de turne: progressao que o jogador sente** (Sentido e objetivo, M, +2): Dar consequencia ao desfecho: confianca zerada ou contagem estourada encerra a noite como DERROTA (ja existe em NAO_VENCE na campanha) com a cutscene de final ruim; cada rodada da turne vira um palco maior (clube, teatro, arena) com mais araras, menos tempo e contra-regras mais atentos, e a ultima e a estrela exigente que troca de perfil no meio do show. Mostrar no HUD um objetivo de uma linha sempre visivel ('Ache 3 pistas, vista as 4 vagas, suba ao palco antes do sinal') que avanca passo a passo, e no resultado o motivo da derrota. Implementar 'Para Onde Ela Vai?' como rodada bonus entre palcos (10 perguntas com personagens vestidas, ja desenhada em OBJETIVOS_POR_JOGO.md).

Problemas de gravidade alta:

- Jogabilidade: Nao ha movimento livre nem interacao com o cenario: o avatar fica numa zona de 2 m x 2,3 m e 'desfilar' e um roteiro fixo ligado/desligado. (`lib/flair/nucleos/scene/salas/dress-the-star.ts`)
- Jogabilidade: Sem risco nem habilidade: o perfil vem escrito no briefing ('Perfil: estilos..., cor...'), a previa da a nota antes de entregar e basta 1 atributo (estilo OU cor) por peca. A 'plateia que adivinha' e so a mesma conta de 25 por peca. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/DressTheStarNucleo.java`)
- Recursos: So existe o recurso CARTAS; nao ha vida, energia, tempo, moeda nem item que se gaste ou recupere, e nada no HUD alem da nota. (`lib/flair/nucleos/dress-the-star.ts`)
- Efeito das roupas: O efeito de cor da peca e so luz de cena e por definicao nao muda a nota nem o avatar; os efeitos FRESCOR e SERENIDADE sao praticamente iguais (so a luz de efeito). (`lib/flair/nucleos/scene/sequences-color.ts`)
- Comandos: Na ACAO o teclado e o controle so aceitam camera e objetivo: jogada de cena, 'seguir sem jogada' e 'Ver o resultado' nao tem tecla nem botao; a troca de camera tambem nao. (`lib/flair/nucleos/moments.ts`)
- Comandos: Nao ha mover no analogico esquerdo nem em WASD (W e 'desfilar'); quadrado e triangulo estao gastos em posar e desfilar, que sao so exibicao. (`lib/flair/nucleos/controls.ts`)

### PERSONAGEM_FILME

Caminhos citados são relativos à raiz do worktree /tmp/claude-0/-home-user-tcc-2026-fashion-ai-backend/3c446a49-08ee-5c67-b33e-9659d9295c24/scratchpad/wt. A pessoa escolhe um deck de até 8 cartas e entra num set de filmagem: a câmera faz um travelling de 6 s, o avatar anda até a marca e um cartão de texto dá a premissa e a pista da cena. Na preparação ela não anda pelo cenário: navega por uma grade de cartas, veste até 4 partes do figurino (12,5 pontos cada) e escolhe um título entre 4 (50 pontos), depois aperta Entregar. O servidor pontua de uma vez e a cena toca sozinha: refletores acendem, a claquete bate, o avatar faz "ação", uma pose e "corta", com a câmera na grua. O fim é um painel com pontos, estrelas (60/80/100), APROVADO ou REPROVADO, dicas do que trocar e "jogar de novo"; não há vida, tempo, tentativa nem derrota além da nota abaixo de 60. Auditoria feita só por leitura de código e testes; nada foi executado nem visto na tela.

Efeito das roupas hoje: Quase nenhum além de pontuação. Vestir uma carta mostra a peça no avatar, solta um selo com som por até 1 s (FIGURINO +12,5, ou +25 na peça inteira, ou 'não é do figurino do personagem'), acende uma luz da cor da família atrás do avatar e atualiza a prévia de pontos no HUD. Não muda vida, energia, atributos nem ações, porque o jogo não tem nenhum deles. O valor real só entra na nota final da entrega.

Melhorias propostas:

- **Set jogável em terceira pessoa: andar, investigar pistas e ir ao camarim** (Jogabilidade, G, +5): Transformar a preparação numa fase de exploração: o avatar anda pelo set (analógico esquerdo ou WASD) com a câmera EXPLORACAO/SEGUE que já existe, e interage com 3 a 4 pontos do cenário (monitor do video assist, cadeira do diretor, claquete, arara do camarim). Cada ponto revela uma pista da cena; a arara abre o deck para vestir; a marca no piso inicia a tomada. Reaproveitar o caminhar manual de LABIRINTO e AROUND_THE_WORLD (manual: "CAMINHAR" em animations.ts), a colisão de camera/colisao.ts e a exploração do Fashion Detective. Aumentar a sala (hoje 12 x 15 m, com zona do avatar de 1,8 m) e criar arquivos novos para o estado da exploração, em vez de crescer nucleo-game.tsx (247 linhas, no limite de 250).
- **Recursos de filmagem: tomadas (vida), rolo de filme (energia) e bilheteria (moeda)** (Recursos, G, +6): Dar custo e risco às decisões no servidor: 3 tomadas por cena (título errado gasta uma e a partida fica ABERTA, como no Labirinto; sem tomadas, derrota clara 'o diretor cortou'); rolo de filme que cada pista aberta consome e que uma peça certa do figurino devolve; bilheteria ganha por acerto na primeira tomada e gasta para eliminar uma opção de título. Corrigir junto o vazamento: previa() nunca deve incluir a regra TITULO, nem na rodada base, e a base deve sortear a cena como CENA_SORTEADA. Mostrar os três recursos no HUD, reaproveitando nucleo-barras-de-vida.tsx. Cobrir com testes de caracterização antes de mexer no núcleo.
- **Roupa com poder imediato: cada peça do figurino muda um atributo e libera uma ação** (Efeito das roupas, M, +5): Fazer efeitos() devolver, além de FIGURINO, um efeito de atributo por vaga, visível na hora no HUD e na cena: parte de cima do figurino dá Presença (recupera uma tomada), calçado dá Passo (o avatar anda mais rápido no set), acessório dá Faro (abre uma pista sem gastar rolo), peça inteira dá Foco (elimina uma opção de título). Peça fora do figurino tira rolo de filme. Na cena, acender a luz do gênero (sequences-color.ts já tem SUSPENSE, AVENTURA, COMEDIA, FICCAO, ROMANCE) e animar a barra do recurso no mesmo instante em que a carta entra (use-card-fx.ts já emite o evento de entrada).
- **Esquema de controle de console, com só o necessário** (Comandos, M, +4.5): Criar um mapa próprio do jogo: analógico esquerdo e WASD movem; analógico direito gira a câmera; X (botão 0) interage ou veste; O (botão 1) cancela ou tira; quadrado (botão 2) abre o guarda-roupa; triângulo (botão 3) abre pistas e objetivo; Options (botão 9) pula cutscene e confirma a tomada; L1/R1 trocam de vaga. Tirar deste jogo GIRAR, ZOOM e POSAR como botões separados e o W/Y morto do desfile. Ligar o PULAR ao controle (hoje só clique) e mostrar na tela os glifos do botão conforme o contexto. lerGamepad precisa ler os eixos 0 e 1.
- **Cutscenes dirigidas: abertura do set, pista encontrada e a tomada final com cortes** (Cutscenes, M, +4): Abertura própria do jogo em sequenciaDeAbertura (hoje genérica): o diretor chama, os refletores acendem um a um, a claquete bate, com 3 tomadas de câmera e botão de pular (CameraDeAbertura não tem pulo). Momento-chave: ao achar a última pista, corte curto de close no objeto. Final: a tomada com cortes dirigidos (close na roupa, lateral, grua) em vez de um rig contínuo, variantes para título certo, figurino errado e 'sem tomadas', e um plano de encerramento com os créditos da campanha. Generalizar a câmera de abertura num tocador de tomadas reaproveitável pelos outros jogos.
- **Equipe humana no set e um cenário por gênero, com modelos do motor Blender** (Gráficos, G, +3.5): Trocar a silhueta e o manequim por gente: papéis DIRETOR, OPERADOR e ASSISTENTE (fora de NAO_HUMANOS), usando os humanoides já versionados (eric, carla, claudia em public/flair/3d/gente) e subindo CORPOS_CHEIOS_DA_CENA de 0 para 2; incluir os papéis em RECEPCAO e em gente/reacoes.ts para receberem o avatar e reagirem ao 'corta'. Criar receitas Blender (scripts/blender3d/receitas) para o cenário de três paredes, a claquete, o monitor e adereços de gênero, e registrar 4 variantes de sala (noir com chuva, orla em neon, corredor da nave, salão de flores) em VARIANTES, escolhidas pela cena sorteada, para o cenário virar pista. Conferir o teto do orçamento em orcamento.test.tsx.
- **Filme em 3 cenas com pistas de verdade, dificuldade crescente e derrota clara** (Sentido e objetivo, M, +2.5): Uma partida passa a ser um filme de 3 cenas em etapas (o Resultado já aceita EM_ACAO e ABERTA): a cada cena as pistas ficam mais curtas e o número de tomadas cai. Tirar das pistas a linha 'Figurino: ...' e deixar a dedução para as pistas achadas no set e para o cenário do gênero. O resultado da cena mostra na própria imagem o que acertou (luz do gênero para o título, refletor por peça certa). Vitória: as 3 cenas vão para a montagem; derrota: acabar as tomadas, com final próprio. Ajustar os textos nos três idiomas e os testes de rodadas.

Problemas de gravidade alta:

- Jogabilidade: O personagem não anda nem interage com o set: a partida é vestir num menu, escolher 1 de 4 e assistir. Não há animação manual de caminhar nem câmera de terceira pessoa neste jogo. (`lib/flair/nucleos/scene/animations.ts:48 ; lib/flair/nucleos/camera/jogos.ts:64`)
- Jogabilidade: Na rodada base a prévia devolve a nota completa, com a regra TITULO; trocando de opção, o placar ao vivo revela o título certo. Além disso, o título certo é constante (CERTO). (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/PersonagemFilmeNucleo.java:36 e 141-145`)
- Recursos: Não existem vida, energia, moedas, itens nem tempo; nada é gasto ou recuperado. O deck de 8 cartas é só um filtro do guarda-roupa. (`lib/flair/nucleos/personagem-filme.ts:8`)
- Efeito das roupas: O efeito da carta é só FIGURINO em pontos; nenhuma peça dá atributo, habilidade ou ação. Fora da partida, nas rodadas sorteadas, o selo vira 'conforme a etapa'. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/PersonagemFilmeNucleo.java:153-162`)
- Comandos: Não há comando de mover (analógico esquerdo não é lido); Y fica morto; pular a cena, trocar de câmera e ir à aba do título não têm botão de controle. (`lib/flair/nucleos/controls.ts:43-58 e 85 ; components/flair/nucleos/nucleo-action-panel.tsx:40`)
- Gráficos: O set não tem gente: CAMERA e CLAQUETE são não humanos (silhueta e manequim), figurantes vazio e zero corpos inteiros. A sequência final manda F_APLAUSO e F_LAMENTA para esses dois bonecos. (`lib/flair/nucleos/gente/figurantes.ts:15 ; lib/flair/nucleos/scene/orcamento-da-cena.ts:41 ; lib/flair/nucleos/scene/sequences-auto.ts:45`)

### ROAD_TO_GLORY

A partida abre com a abertura genérica dos núcleos: a câmera passa 6 s do plano aberto ao lateral, o avatar entra andando até o tapete do camarim e dispara um flash. A fotógrafa não reage, porque não está na tabela de recepção. Na preparação, o jogador navega por menus: veste cartas do guarda-roupa inteiro, sem deck, nas vagas SUP/INF/CAL/ACE e escolhe a família e o acabamento de lábios, olhos e bochechas para cumprir as 4 regras do brief da rodada (Ensaio de Verão, Entrevista ou Primeiro Encontro), 25 pontos cada. Enquanto isso, uma prévia do servidor mostra a nota. Ao entregar, o servidor deixa a partida EM_ACAO com uma cor pedida sorteada da semente. O jogador clica numa carta que não está no look: a cor dela acende uma luz no camarim, e se for a cor pedida soma 10. Seguem dois flashes com duas poses (olhar para a câmera, virar o rosto). O fim é o resultado APROVADO/REPROVADO (corte em 60), as estrelas e um texto de fim (BOM/MEDIO/RUIM). Não há vida, risco nem derrota em tempo real. O avatar nunca sai do tapete.

Efeito das roupas hoje: Nenhum efeito em vida, recurso, atributo ou ação. A roupa aparece vestida no avatar 3D e conta pontos pelas regras do brief (ocasião e material, com selo por carta e prévia). Na sessão de fotos, a cor de uma carta fora do look escolhe qual luz acende e dá +10 se for a cor pedida. A maquiagem conta pontos, mas não aparece no rosto 3D: só aparece no fallback 2D.

Melhorias propostas:

- **Maquiagem visível no rosto 3D** (Gráficos, M, +0.6): Passar estado.sel.maquiagem de MakeUpScene e de NucleoStage até o avatar 3D e pintar lábios, pálpebras e bochechas numa camada de textura sobre o skin-bake, por família e acabamento (tomDe de lib/flair/make-up/palette.ts dá a cor; gloss e cetim mudam roughness e clearcoat). Fazer o ZOOM no rosto (CLOSE_ROSTO) mostrar o resultado na hora. Também sobe efeito_das_roupas, porque a mudança passa a ser imediata e visível.
- **Camarim explorável com estações (andar e interagir)** (Jogabilidade, G, +1): Trocar o tapete fixo por um camarim explorável na câmera EXPLORACAO/OMBRO que o Fashion Detective já usa: analógico esquerdo/WASD andam, e X (Cross) interage com estações. A arara abre a escolha de peças, a penteadeira abre a maquiagem, o espelho prova o look (a prévia) e o set da fotógrafa inicia a sessão. Reaproveitar o rig SEGUE de lib/flair/nucleos/camera/jogos.ts e a locomoção do Detective.
- **Sessão de fotos como desafio de timing com energia** (Jogabilidade, G, +0.9): Transformar a sessão numa sequência de 5 a 6 pedidos da fotógrafa (pose, ângulo, luz) com janela de tempo: X/O/quadrado/triângulo para poses, analógico para virar o rosto. Cada acerto rende 'brilho', e o erro ou o atraso gasta 'Energia' (barra que começa em 100 e se recupera com uma pausa no camarim). A barra reaproveita nucleo-barras-de-vida.tsx; o servidor valida a sequência pela semente, como a luta lance a lance do Dress Fighter (acionamento LANCE). Energia zerada = sessão cancelada (derrota clara).
- **Roupa e maquiagem como atributos da sessão** (Efeito das roupas, M, +0.9): No servidor, cada peça e área maquiada dá um atributo calculado na entrega e mostrado ao vestir. Material leve dá mais Energia máxima (calor do estúdio), a ocasião certa alarga a janela de timing, batom gloss dá bônus de brilho no close, e acessório libera uma pose extra (triângulo). Mostrar o atributo mudando no HUD no momento em que se veste. Reaproveitar Efeito e useNucleoEffects, que já entregam selos por carta.
- **Cutscenes de abertura, virada e final com câmera própria** (Cutscenes, M, +0.7): Pôr FOTOGRAFA em RECEPCAO (gesto 'photo' + F_ACENA). Criar uma cutscene de abertura do brief (o cliente apresenta o pedido, câmera própria pela porta do camarim), uma de meio quando a sessão começa (a fotógrafa ergue a câmera, as luzes acendem) e um final por desfecho com câmera própria: BOM vira capa de revista (plano grua até um quadro da capa na parede), MEDIO aprova as fotos, RUIM mostra o cliente recusando. Todas puláveis com O/Start. Reaproveitar Roteiro e luzId/fig de sequences-auto.ts e as tomadas de opening.ts.
- **Recursos de carreira dentro da partida (cachê, energia, cartas consumíveis)** (Recursos, G, +0.8): Unificar núcleo e MAKE UP numa única campanha: o Prestígio de FlairMakeUpCarreira entra na partida do núcleo como cachê. O cachê compra retoques (refazer uma área de maquiagem no meio da sessão) e a carta usada como luz fica 'em lavanderia' na rodada seguinte (consumível). A Energia (melhoria 3) se recupera no banco estofado do camarim. Mostrar tudo no HUD.
- **Mapa de comandos de console enxuto** (Comandos, P, +0.6): Remover DESFILAR (W/Y) do mapa quando a ação não está em definicao.acoes, e mostrar os rótulos por plataforma (Cross/Circle/Square/Triangle quando o gamepad.id indicar PlayStation). Mapear analógico esquerdo/WASD para andar, X/Cross para interagir, O/Circle para voltar/tirar, quadrado e triângulo para poses na sessão, e deixar a jogada da carta selecionável por D-pad + X. Juntar GIRAR, ZOOM e POSAR no analógico direito e nos gatilhos.
- **Set de fotos completo e gente com humanoides GLB** (Gráficos, M, +0.5): No camarim, incluir camera-tripe.glb, refletor.glb e um fundo infinito (receita nova em scripts/blender3d/receitas/palco.py). Dar à fotógrafa um humanoide GLB de lib/flair/nucleos/gente/humanoides.ts (carla/claudia) com câmera na mão, e acrescentar o cliente do brief como segundo NPC. Fazer o MAKE UP abrir no mesmo camarim em vez do provador genérico.

Problemas de gravidade alta:

- Gráficos: A maquiagem escolhida não aparece no rosto do avatar 3D: MakeUpScene3D não recebe 'maquiagem', e o skin-bake não gera cor de lábio. Só o fallback 2D mostra as amostras. Num jogo de maquiagem, o jogador não vê o próprio trabalho. (`components/flair/make-up/makeup-scene.tsx`)
- Jogabilidade: O personagem não anda nem interage com o cenário: fica preso no tapete, e todos os comandos são de menu ou câmera. A sessão de fotos é um clique numa carta. (`lib/flair/nucleos/scene/salas/road-to-glory.ts`)
- Efeito das roupas: Peças e maquiagem só pontuam no fim. Não mudam atributo, recurso nem ação do avatar durante a partida. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/RoadToGloryLook.java`)
- Recursos: Não há recurso que se gaste ou recupere: o guarda-roupa é liberado (SEM_DECK), a carta da sessão não é consumida e não há energia nem tempo. O Prestígio existe só no MAKE UP. (`lib/flair/nucleos/road-to-glory.ts`)

### FASHION_DETECTIVE

Na preparação, a pessoa monta um deck de até 12 cartas, com pelo menos um SUP ou VES, e entrega o look da gala. As cartas que sobram fora do look viram o baralho, e a mão tem 5 cartas (DetetiveMao.java:163-175). A partida começa EM_ACAO na ENTRADA, com a cutscene ABERTURA:ENTRADA (DetetiveEstado.java:26-50). A cada passo, a pessoa escolhe num painel de botões um ponto vizinho (até 3,6 m), uma porta, um armário, um esconderijo, o bolso de um vigia, um confronto, o enigma da sala, o mercado ou ESPERAR. A ação de cor só vale com a carta da cor certa: verde abre, preto esconde e furta, azul convence, amarelo cura, branco completa a pista, vermelho compra (DetetiveAcoes.java:131-143). Depois de cada passo, os vigias fazem a ronda e perseguem quem entra no cone. Quem é pego perde 1 vida e 30 s e volta para a porta da sala. Com 0 vidas, a vida volta a 3 e a pessoa perde mais 60 s (DetetivePerseguicao.java:147-158). Ao longo das 9 salas, a pessoa junta 5 chaves e 12 pistas e resolve até 8 enigmas de 3 opções. Na PASSARELA acusa um dos suspeitos de 2 a 9. A nota final é COMPLETO (culpado certo e 8 pistas ou mais), PARCIAL (culpado certo com menos pistas), ERRADO_REVER (primeiro erro, pode acusar de novo) ou ERRADO_REVELA (segundo erro). Pontos: 5 por pista, 3 por enigma, mais o bônus do final, menos 2 por vez que foi pego (DetetiveCaso.java:35-55; FashionDetectiveAcusacao.java:270-286).

Efeito das roupas hoje: nenhum. O look da gala vestido aparece no avatar, mas não muda vida, alcance do passo, cone dos vigias, confronto nem tempo (DetetiveEstado.java:22,94-96 são constantes). As peças do look só saem do baralho (DetetiveCaso.java:36; DetetiveMao.java:172). O que tem efeito é a COR das cartas que ficaram FORA do look, usadas como cartas de ação (Flair3dCores.java:22-23). Na nota final, os pontos só são divididos igualmente entre as peças (DetetiveCaso.java:54). Os atributos de Flair3dAtributos não entram no caso novo.

Melhorias propostas:

- **Exploração livre em terceira pessoa com X para interagir** (gameplay, comandos, G, +1.3): Na tela, trocar o 'ir de ponto a ponto' por movimento contínuo: WASD ou analógico esquerdo movem o avatar dentro da sala, com colisão nas caixas dos móveis, e o analógico direito ou o mouse giram a câmera de exploração. O servidor continua com pontos discretos: ao soltar o movimento, a tela manda IR:<ponto mais próximo> se ele estiver a até um passo, e assim a lógica e a reprodução determinística não mudam. Criar lib/flair/detetive/interacao.ts, que escolhe em acoesPossiveis a ação contextual do objeto mais próximo e mostra um ícone 'X Abrir armário' sobre ele. Layout de console só para o Detective: X interage (abre o seletor de carta já filtrado pela cor), O esconde ou cancela, quadrado abre a mão de cartas, triângulo abre caderno e mapa, R1/L1 trocam a carta, Start pausa. Usar o ciclo de caminhada de lib/avatar3d/human/locomotion no avatar (hoje o estado é PARADO). Desligar GIRAR, ZOOM e POSAR nesse momento. Os braços não se movem direto: a animação de abrir ou furtar é tocada pela ação.
- **A roupa muda os atributos e os recursos na hora, com rodas no HUD** (efeito_das_roupas, recursos, M, +1.2): No servidor, somar Flair3dAtributos.soma(look) no início da DetetivePartida e guardar no DetetiveEstado. Velocidade aumenta o PASSO e reduz os segundos por passo. Defesa dá +1 vida máxima por faixa e reduz a penalidade. Resistência faz o vigia perseguir mais devagar. Técnica dá dica do enigma sem errar antes. Peças escuras ou pretas (Flair3dPecas) diminuem o alcance do cone. Mandar 'atributos' e 'recursosMax' no retrato. Criar a ação VESTIR:<carta> nas araras do CAMARIM e do ATELIE, que troca uma peça do look no meio do caso e recalcula tudo, para o efeito ser imediato e visível. Na tela, criar components/flair/detetive/detetive-rodas.tsx com duas rodas (atributos em radar SVG e recursos: vida, fôlego, cartas, chaves) que pulsam quando uma peça entra ou sai.
- **Salas com GLB, texturas e luz por sala; chaves e pistas visíveis no cenário** (Gráficos, G, +1): Trocar as caixas de sala-3d.tsx por receitas do motor Blender: scripts/blender3d/receitas/interior.py, mobilia.py e atelie.py para as 9 salas (balcão de recepção, mesas do salão, monitores da segurança, penteadeira, mesa de corte, estantes, cofre, mesa do escritório). Carregar os modelos com components/flair/nucleos/scene/glb-prop.tsx e lib/flair/nucleos/scene/assets.ts, reaproveitando os GLB que já existem (arara, bancada, espelho, cadeira de camarim, refletor, luminária, armário de ferramentas). Somar luzes pontuais e spot por sala, aplicar texturas de scripts/blender3d/texturas.py e respeitar orcamento-da-cena.ts. Mostrar chaves e papéis de pista como objetos que brilham sobre o armário enquanto não foram pegos (itens coletáveis no cenário).
- **Risco e derrota de verdade; culpado sorteado pela semente** (sentido_e_objetivo, recursos, gameplay, M, +0.8): Com 0 vidas, o caso fecha como derrota (CAPTURADO), em vez de devolver as vidas. A AJUDA da casa passa a ter 2 usos por caso e custa 1 vida ou 3 min. O enigma errado tira 1 vida na segunda vez. A acusação só fica liberada com 6 pistas ou mais (o servidor recusa com aviso). Em FashionDetectiveAcusacao, sortear o culpado entre 2 e 9 pela semente (contexto.sorteio) e trocar o conjunto de pistas decisivas pelo culpado, para que rejogar tenha mistério. Dar estrelas por tempo e furtividade (zero capturas).
- **Diálogo com NPCs pelo X** (gameplay, sentido_e_objetivo, cutscenes, M, +0.6): Criar o verbo FALAR:<papel> no servidor para o elenco de cada sala (lib/flair/detetive/elenco.ts já tem quem está em cada uma). Cada NPC tem 2 ou 3 falas com escolha de resposta, e a resposta certa entrega uma pista ou abre uma porta barrada sem carta azul. Ao se aproximar, a tela mostra 'X Falar com Cleo' e abre components/flair/detetive/detetive-dialogo.tsx, com retrato, falas em legenda e câmera de dois personagens (nova tomada em camera-da-cena.ts). Durante a fala, o NPC usa gestos de lib/flair/nucleos/gente/gestos.ts (pensar, apontar). Textos em flair3d.detetive.dialogo.* nas três línguas.
- **Armadilhas e inimigos mais variados** (gameplay, recursos, M, +0.5): Adicionar o record Armadilha em DetetiveSala, com o ponto e o tipo: feixe de sensor na Segurança e no Arquivo que liga e desliga por passo, piso que range no Salão e faz o vigia procurar, câmera de vigilância que gira. O servidor checa a armadilha em DetetivePerseguicao.depoisDoPasso. A carta preta desarma e o atributo técnica mostra o ciclo. Na cena, desenhar o feixe (linha emissiva) e a câmera girando. Pôr vigias com ronda mais longa e um segundo vigia em PASSARELA e ATELIE.
- **Cutscenes de ação com atores animados** (Cutscenes, M, +0.4): Criar cenas curtas e puláveis para PEGO (o vigia segura e leva de volta à porta), CHAVE (close do armário abrindo), PORTA_ABERTA e TEMPO_ESGOTADO (Iolanda chama), disparadas pelos avisos que o servidor já manda (DetetiveAcoes.java:205,265; DetetivePartida.java:96). Em cada fala da cutscene, quem fala toca um gesto (reacoes.ts e gestos.ts) e a câmera corta para ele. O final vira uma sequência de 3 planos: confronto, reação e grua. Ligar Pular e Avançar a O/Start e X no gamepad.
- **Limpar comandos e automatizar o supérfluo** (Comandos, P, +0.3): No momento EM_ACAO do Detective, tirar da ajuda e do pad os comandos do provador (GIRAR, ZOOM, POSAR, VESTIR, TIRAR, DESFILAR). Completar a pista rasgada automaticamente quando houver carta branca na mão, mantendo o botão como confirmação. Juntar VIDA e TROCAR no menu do quadrado, que é a mão de cartas. Mostrar no NucleoHelp o mapa de comandos de aventura.

Problemas de gravidade alta:

- Efeito das roupas: O look vestido não tem efeito mecânico na investigação. Flair3dAtributos (velocidade, ataque, defesa, técnica, resistência) existe no servidor, mas o caso novo não o usa. Não há roda de atributos nem de recursos. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/detetive/DetetiveCaso.java`)
- Comandos: Na investigação não há teclado nem gamepad: o controle global continua mapeado para o provador (A vestir, X posar, Y desfilar) e GIRAR, ZOOM e POSAR não fazem nada na sala. Não existe X para interagir, O para esconder ou cancelar, nem analógico para andar. (`lib/flair/nucleos/controls.ts`)
- Jogabilidade: Não há exploração livre: o movimento é de ponto fixo a ponto fixo, escolhido por botão. O avatar desliza sem animação de caminhada (estado PARADO). (`components/flair/detetive/detetive-cena-3d.tsx`)
- Gráficos: As 9 salas são caixas e cilindros de cor chapada, sem GLB e sem textura, com uma luz direcional só. Já existem GLB em public/flair/3d/assets e o motor Blender em scripts/blender3d, mas nada disso é usado aqui. Pistas e chaves não aparecem como objetos na cena. (`components/flair/detetive/sala-3d.tsx`)

### BOUTIQUE_3D

O jogador escolhe a rodada (Festa em preto, Personal Stylist, Vitrine que Vende ou Provador Lotado) e monta um deck de até 8 cartas com pelo menos 1 peça de cima e 1 de baixo. A partida abre com um travelling de 6 s: a cliente acena e o avatar anda até o tapete. No preparo, ele navega pelo deck e veste peças nas vagas SUP/INF/CAL com o avatar parado e então ENTREGA. O servidor pontua o pedido (33 por peça de festa em preto; nas rodadas em etapas, estrelas por ocasião, cor e estilo, 10 clientes por manequim ou 20 por substituta certa). A cena automática mostra a entrega, a cliente prova e gira, e a vendedora aplaude ou lamenta. Na jogada de cena, uma carta fora do look dispara um efeito de cor (+10 se for a cor pedida). Termina em APROVADO (60 pontos ou mais) ou REPROVADO, com um texto final bom, médio ou ruim. Não há derrota durante a partida, nem deslocamento livre ou gasto de recursos.

Efeito das roupas hoje: nenhum. A peça vestida não muda vida, recursos, atributos nem ações do avatar. Ela só conta pontos no servidor quando o look é entregue (+33 por peça de festa em preto, ou estrelas por ocasião, cor e estilo) e decide se a cliente comemora ou devolve. Na jogada de cena, a cor de uma carta fora do look aciona uma luz ou um gesto e soma +10 se for a cor pedida.

Melhorias propostas:

- **Avatar andando pela loja com interações de cenário (arara, provador, balcão)** (Jogabilidade, G, +1.4): Ligar o analógico esquerdo e WASD a um deslocamento do avatar dentro de zonas.avatar ampliada para a loja inteira, com colisão nas caixas dos móveis, reaproveitando a locomoção do Detective/Labirinto (CAMINHAR, câmera EXPLORACAO). Criar pontos de interação: arara (X abre o estoque filtrado por vaga), provador (X leva o look para a cliente provar), balcão (triângulo entrega e fecha a venda). VESTIR deixa de ser menu solto e passa a acontecer na arara. Usar a camera EXPLORACAO na ação da Boutique.
- **Recursos de loja: paciência da cliente, caixa e estoque que se gasta** (Recursos, G, +1.3): No servidor, adotar o jogo 70 'Cinco Clientes' (PROTAGONISTA_E_RECURSOS.md §2.5). Cada cliente tem uma barra de paciência que cai a cada peça errada levada ao provador. A peça vendida sai do deck/estoque; a devolvida volta à arara. Uma venda certa rende moedas, que compram 1 reposição de carta ou 1 'dica da vendedora' entre clientes. Paciência zerada faz a cliente ir embora (derrota parcial). Exibir com o mesmo componente de barra do Dress Fighter.
- **Roupa com efeito imediato: atributos do look mudam a reação e as ações** (Efeito das roupas, M, +1.2): Ao vestir no avatar (que funciona como modelo de prova), calcular na hora os atributos da carta já enviados pelo servidor (ocasião, cor, estilo, material) e aplicar efeitos visíveis: a peça no pedido enche a paciência da cliente (+), e a cliente reage na hora (F_ACENA ou F_LAMENTA via gente/reacoes.ts). Material quente libera a ação 'oferecer casaco' no Provador Lotado, e peça de festa acende a luz da vitrine. Mostrar o delta no HUD no instante do VESTIR, não só no resultado.
- **Mapa de controle no padrão de console e enxugamento** (Comandos, M, +0.9): Analógico esquerdo e WASD movem o avatar; analógico direito gira a câmera (não o avatar). X/A (botão 0) interage com o objeto próximo, O/B (1) cancela ou devolve a peça, quadrado/X (2) abre o estoque, triângulo/Y (3) entrega no balcão. R1/L1 trocam a vaga, Options/Start pausa e mostra o objetivo, Touchpad/Select troca a câmera. Remover POSAR, ZOOM livre e DESFILAR da Boutique e dar à jogada de cena um atalho (triângulo). Mostrar glifos PS/Xbox na NucleoHelp.
- **Cutscenes próprias da Boutique com câmera dedicada** (Cutscenes, M, +0.8): Generalizar NucleoCutscene (hoje só do Detective) para um roteiro por jogo. Abertura: a loja abre (porta, vitrine acende, câmera grua). Chegada de cada cliente em etapa: a figurante entra pela porta caminhando até o balcão com plano de dois e o pedido em fala. Final: plano próprio no espelho (close na roupa e depois aberto), a cliente sai com a sacola ou devolve no balcão. Todas puláveis com O/B, e com quadro parado em 'reduzir movimento'.
- **Modelos da loja pelo motor Blender e mais humanoides** (Gráficos, M, +0.7): Criar receitas em scripts/blender3d/receitas para balcão com caixa registradora, vitrine com manequins e cabine de provador com cortina de tecido (PBR, versão leve automática) e trocá-las por comGlb() em moveis/loja.ts. Ativar sombras projetadas nas luzes principais e no espelho. Acrescentar ao catálogo de humanoides.ts mais 2 a 3 modelos CC0/CC BY com esqueleto Mixamo e usar clipes de animação gratuitos (Mixamo) no lugar da pose procedural da cliente e da vendedora.
- **Fila de clientes com vitória e derrota claras** (Sentido e objetivo, M, +0.6): Trocar a cliente fixa da Festa em preto pela fila sorteada (CLIENTELA já existe em Boutique3dRodadas). A vitória é atender 4 de 5 antes que a fila perca a paciência; a derrota é 2 clientes indo embora. Mostrar no HUD 'Cliente 2/5' e as moedas do dia, e na campanha usar as moedas para desbloquear a rodada seguinte.

Problemas de gravidade alta:

- Jogabilidade: O avatar fica preso na marca do tapete e não se move pela loja. Não existe ação no cenário (pegar na arara, levar ao provador, entregar no balcão): tudo é menu de cartas mais animação automática. (`lib/flair/nucleos/scene/salas/boutique-3d.ts`)
- Efeito das roupas: A roupa é só pontuação no fim. Nenhum atributo, recurso ou ação do avatar muda ao vestir. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/Boutique3dNucleo.java`)
- Recursos: O único recurso é o deck de cartas. Moedas, paciência da cliente, estoque gasto e reposição estão pendentes, então errar não custa nada além da nota. (`lib/flair/nucleos/boutique-3d.ts`)

### CLUBE_CORACAO

A partida começa direto na preparação, sem deck (SEM_DECK, momentoInicial com semDeck): a câmera faz um travelling genérico de 6 s sobre o ateliê com a arquibancada ao fundo, e o avatar do perfil fica parado no tablado. O jogador escolhe a rodada (Clube Atlântico azul e branco, Clube Aurora vermelho e preto, ou Uniforme de E-sports) e pinta quatro abas (Frente, Costas, Mangas, Gola), cada uma com 10 cores e 4 acabamentos; cada escolha vira na hora uma faixa cilíndrica colorida num manequim ao lado, que gira sozinho. Ele aperta Entregar, a ação mostra dois passos de regra com um spot e o servidor devolve CONCLUIDO ou INCOMPLETO (nas rodadas dos clubes, 0 ponto e 0 estrela) ou uma nota de 0 a 100 (E-sports). No fim aparecem o texto pelo desfecho e o botão de jogar de novo. O personagem não anda, não interage com o cenário, não corre risco nenhum, e o jogo não tem derrota de verdade: sempre dá para tentar de novo.

Efeito das roupas hoje: Pintar uma zona aparece na hora como uma faixa cilíndrica no manequim, com a cor e o acabamento escolhidos (components/flair/nucleos/scene/effects-3d.tsx:87-105). O avatar não veste a peça, e nada muda em vida, recursos, atributos ou ações: as zonas só contam na entrega, para CONCLUIDO/INCOMPLETO ou para a nota de 0 a 100 do E-sports.

Melhorias propostas:

- **Estreia em campo: o avatar veste a camisa e joga com ela** (Efeito das roupas, G, +1.6): Depois do ateliê, o avatar veste a camisa pintada e entra num jogo curto no estádio do Fashion Sports, reaproveitando sequences-match e a partida por cartas. Cada zona e cada acabamento vira atributo visível na HUD: as cores do clube dão moral da torcida (bônus no duelo), fosco dá resistência, brilhante dá visibilidade e destaque, metálico dá velocidade. Com o fim do jogo de zonas, a camisa sai de lookComTroca/pecasDoLook como peça da vaga SUP, pintada por zona via human-outfit. O servidor calcula os atributos na entrega (novo Flair3dZonas.atributos), e a estreia usa esses atributos.
- **Ateliê explorável com tinta como recurso e risco** (Jogabilidade, G, +1.4): O avatar se move pelo ateliê com o analógico esquerdo ou WASD (reaproveitar o CAMINHAR e a câmera EXPLORACAO de Labirinto e Around the World). Com X/Cruz ele pega latas de tinta na bancada; a tinta é limitada (cada lata pinta N zonas e cada acabamento custa uma unidade de verniz). Com Quadrado ele pinta a zona do manequim para onde está virado. Uma barra de tempo até o apito da estreia completa o desenho. Repintar gasta tinta, e acabar a tinta ou o tempo é derrota. O servidor valida o gasto a partir da semente, para a prévia nunca gastar.
- **Montagem de cutscene do Clube e correção do lamento na vitória** (Cutscenes, M, +1): Adicionar CLUBE_CORACAO em MONTAGENS. Na entrega, o spot acende sobre o manequim, que dá uma volta completa, a câmera faz um close por zona (CLOSE_ROUPA) e a torcida reage pelo desfecho (F_COMEMORA no CONCLUIDO, F_LAMENTA no INCOMPLETO). Final com câmera própria: grua saindo do manequim para a arquibancada. Trocar a reação final do avatar para usar desfechoDe (narrativa.ts) quando o resultado é sem placar, em vez de estrelas. Deixar a abertura ser pulada com Start ou Círculo.
- **Camisa de verdade pelo motor Blender, com slots por zona** (Gráficos, M, +0.9): Criar uma receita em scripts/blender3d/receitas para uma camisa de futebol com quatro grupos de material (FRENTE, COSTAS, MANGAS, GOLA), exportada como GLB. Ela substitui os cilindros de PecaPintada (pintar o material de cada grupo com a cor e o acabamento de ACABAMENTO_3D) e serve também para vestir o avatar. Revisar a sala do Clube (CENARIOS.md): túnel de acesso, bandeiras e faixas sem marca real, refletores do estádio com sombra, a torcida com camisas nas cores da rodada.
- **Comandos de console enxutos** (Comandos, P, +0.7): Analógico esquerdo e WASD para mover. Cruz/A interage (pegar tinta, vestir). Quadrado/X pinta a zona em foco. Círculo/B desfaz a última pincelada (TIRAR passa a valer aqui). Triângulo/Y abre o objetivo. Start entrega ou pula a cutscene. O analógico direito gira a câmera, e não o avatar. Tirar POSAR e ZOOM do núcleo (o seletor de câmera já cobre o zoom) e atualizar NucleoHelp e os testes.
- **Vitória, derrota e progressão de temporada** (Sentido e objetivo, M, +0.6): Dar nota às rodadas dos clubes (as regras atuais passam a valer pontos, mais o bônus de tinta e tempo que sobraram), com derrota clara: a torcida vaia e o uniforme é recusado quando o tempo ou a tinta acabam. Encadear as rodadas como temporada (Atlântico, Aurora, Vórtex), com a ficha do clube que pede a camisa e o placar da estreia. Corrigir o texto 'Ninguém além de você'.

Problemas de gravidade alta:

- Sentido e objetivo: A vitória vira lamento. As rodadas dos clubes devolvem CONCLUIDO com 0 estrela (Resultado.of(0,...)), e sequenciaDoResultado termina sempre com reacaoPorEstrelas(estrelas), que toca REACAO_0 (ombros caídos) mesmo quando a camisa foi aprovada. O teste da tela mascara isso com um mock de 3 estrelas. (`lib/flair/nucleos/scene/sequences-auto.ts`)
- Jogabilidade: Não há gameplay de ação nem de aventura: nada de movimento, interação com o cenário, risco, tempo ou habilidade. É um formulário de 4 campos com entrega. (`lib/flair/nucleos/clube-coracao.ts`)
- Recursos: Não existe recurso que se gaste ou se recupere: a paleta é infinita e errar é de graça. (`lib/flair/nucleos/palette.ts`)
- Efeito das roupas: A peça pintada fica num manequim feito de cilindros e nunca vai para o avatar, nem muda atributos. (`components/flair/nucleos/scene/effects-3d.tsx`)

### FAVORITE_SINGER

A pessoa escolhe uma de três rodadas: Era Neon (a da base), Era Acústica ou Jaqueta da Banda. A partida abre direto na preparação, porque o jogo não tem deck. Uma câmera de abertura genérica de 6 s desce do plano aberto até o avatar, parado no tablado de um ateliê com um palco pequeno ao fundo. O jogo inteiro acontece num menu: em cada uma das 4 abas de zona (FRENTE, COSTAS, MANGAS e GOLA, ou CORPO, MANGAS, FERRAGENS e GOLA na jaqueta), a pessoa escolhe 1 de 10 cores e 1 de 4 acabamentos. As faixas coloridas aparecem num busto de costura que gira devagar, e o placar mostra uma prévia do servidor a cada mudança. Ao entregar, o servidor dá 25 pontos por regra cumprida e marca REPROVADO ou INCOMPLETO quando falta zona. A ação toca um passo de luz por regra e o avatar reage às estrelas. O fim é um texto BOM, MEDIO ou RUIM e o botão de jogar de novo. O avatar não anda, não interage com nada e não veste a peça.

Efeito das roupas hoje: nenhum: as cores e os acabamentos aparecem na hora como faixas cilíndricas no busto de costura (PecaPintada), mas o avatar não veste a peça, e nenhuma zona muda vida, recursos, atributos ou ações; a peça só vale pontos na nota final

Melhorias propostas:

- **Show ao vivo: a peça veste o avatar e a ação vira uma apresentação jogável no palco** (Jogabilidade, G, +1.6): Depois de entregar, o avatar sobe ao palco vestindo a peça: a malha da peça usa as zonas como materiais do corpo do avatar, e não o busto. Ligar manual 'CAMINHAR' com o analógico esquerdo e criar o acionamento 'JOGADA' em ACAO. A cada refrão, a cantora ou a plateia pede uma família de cor ou um acabamento, e a pessoa precisa ir à marca de luz certa no palco e apertar X dentro de uma janela de tempo. Errar a marca ou o tempo baixa o hype. Cada pedido conferido no servidor soma pontos, como já acontece com JOGADA_DE_CENA nos jogos de deck.
- **Atributos imediatos da peça: presença, brilho e estilo** (Efeito das roupas, M, +1.2): Cada zona pintada muda na hora um atributo do avatar, mostrado na barra do HUD (reaproveitar nucleo-barras-de-vida). Família dominante da era dá Presença (o hype cai mais devagar no show). Acabamento metálico ou espelhado dá Brilho (aumenta a intensidade das luzes 'era' e 'era2' e alarga a janela de acerto). Contraste nas mangas dá Estilo (libera uma pose especial com X). Cada troca de cor dispara emitirFx e muda a luz da sala na hora.
- **Recursos: orçamento de tinta no ateliê e hype no show** (Recursos, M, +1): A preparação ganha um orçamento de tinta (ex.: 10 unidades). Fosco custa 1, brilhante 2, metálico ou espelhado 3, e TIRAR devolve metade. A prévia ao vivo custa 1 'ensaio' (3 por partida), em vez de ser grátis. No show, o hype é a vida: cai com erro e sobe com acerto, e em 0 o show acaba antes (derrota). O servidor confere o orçamento para impedir trapaça.
- **Cutscenes próprias: camarim, passagem de som e final pelo desfecho** (Cutscenes, M, +0.9): A abertura própria sai do camarim, mostra a turnê no painel do palco e passa pela cantora, um humanoide de humanoides.ts entregando o briefing da era. No meio, quando metade das zonas estiver pintada, a passagem de som acende a luz da era sobre o busto. Criar uma montagem 'favoriteSinger' em MONTAGENS: entrada no palco, plateia com reacaoDaPlateia, GRUA e depois PLATEIA. Generalizar NucleoCutscene para legendas fora do detetive. O botão O/B pula cada cutscene.
- **Palco e peça em GLB pelo motor Blender, com plateia humana** (Gráficos, G, +0.8): Criar receitas em scripts/blender3d/receitas para o palco da era (treliça, refletores, caixas de retorno, painel) e para uma jaqueta ou figurino com materiais 'sala:FRENTE', 'sala:MANGAS' etc., registrados no manifest.json com movel 'palcoPequeno'. Pintar a peça trocando o material de cada zona, em vez dos cilindros. Pôr plateia com fileira() e torcida-3d e a cantora como humanoide no lugar do busto.
- **Comandos de console enxutos** (Comandos, P, +0.7): Neste jogo: analógico esquerdo e WASD movem o avatar (ateliê e palco); X aplica ou age na marca; O tira ou limpa a zona (ligar TIRAR); quadrado alterna o acabamento sem navegar na grade; triângulo abre o objetivo; LB e RB trocam a zona; o analógico direito gira a câmera em volta do busto, não o avatar. Tirar POSAR e GIRAR do avatar na preparação e atualizar NucleoHelp.
- **Progressão de carreira: eras em sequência e vitrine 'Eras'** (Sentido e objetivo, M, +0.5): Encadear as rodadas como turnê: Era Acústica, depois Era Neon e Jaqueta da Banda, cada uma liberada com 2 estrelas na anterior e com um pedido extra no show. A peça aprovada entra na vitrine 'Eras' do perfil, e o selo 'coleção da carreira' sai ao fechar todas. Deixar a derrota explícita (show cancelado com hype 0) e esconder a regra que falta até o ensaio pago.

Problemas de gravidade alta:

- Jogabilidade: O jogo é um formulário de 4 abas com prévia ao vivo da nota. Não há movimento, risco nem interação com o cenário, e a ação não tem acionamento. (`lib/flair/nucleos/moments.ts`)
- Efeito das roupas: A peça pintada fica num busto e nunca veste o avatar. Não há efeito de jogo, só a nota. (`components/flair/nucleos/nucleo-scene-3d.tsx`)
- Recursos: Não há recurso algum: paleta infinita e grátis, sem energia, tinta, moedas ou cartas. (`lib/flair/nucleos/favorite-singer.ts`)
- Cutscenes: Falta montagem de resultado: FAVORITE_SINGER não está em MONTAGENS. O 'show' prometido na premissa nunca acontece, e não há cutscene no meio nem final com câmera própria. (`lib/flair/nucleos/scene/sequences-auto.ts`)

### LABIRINTO

O jogador escolhe uma rodada (Espelho 1, Escada de Espelhos, Três Portas ou Corredor de Holofotes) e um deck de até 8 cartas. Depois de 6 s de travelling genérico, o avatar está parado no centro de uma única sala quadrada de 8,4 m, com quatro paredes iguais, cada uma com espelho e porta. O jogador veste cartas nas vagas SUP, INF e CAL pelo painel de baixo (nas Três Portas também escolhe a porta numa aba) e aperta 'Apresentar ao espelho'. A partir daí o avatar anda sozinho até o espelho do fundo: se o look cumpre a regra (por exemplo, 3 peças da mesma família de cor), o espelho acende, a porta abre e o avatar a atravessa; se não, uma luz vermelha ondula, a partida continua ABERTA e uma dica diz quantas peças faltam. Não há derrota. Na 3ª apresentação o servidor soma sozinho uma 'peça achada' (na Escada e nas Portas, o espelho cede na 4ª), e a partida termina com pontos/estrelas e um texto de fim.

Efeito das roupas hoje: Nenhum efeito imediato sobre o avatar. A peça só conta como família de cor (ou ocasião, estilo, material, conforme a rodada) no momento de 'Apresentar ao espelho'. Isso decide se a porta abre e quantos pontos ela rende (100/80/60). A cor da carta acende só um efeito de luz decorativo. Vida, recursos, atributos e ações não mudam.

Melhorias propostas:

- **Andar livre pelo Jardim dos Espelhos** (Jogabilidade, G, +1.3): Transformar os 12 pontos de JARDIM_DOS_ESPELHOS em salas ou nós navegáveis: o analógico esquerdo, WASD ou toque no destino move o avatar entre nós vizinhos, com colisão nas sebes. Usar a câmera EXPLORACAO por trás do ombro e a aérea para o mapa. Reaproveitar a caminhada das sequências manuais (CAMINHAR com mover) e a infraestrutura de salas interligadas do Fashion Detective. A sala atual vira o 'espelho-mestre'.
- **Peças no cenário, chaves e mala da partida** (Recursos, G, +1): Trocar a peça concedida por tentativa (LabirintoNucleo.achadas) por peças reais em manequins e araras de nós específicos, coletadas com o botão X ao se aproximar, e por chaves liberadas pelos espelhos que abrem portas trancadas. O servidor guarda mala e chaves em Andamento (estado_json, sem migration) e valida cada coleta, como já faz o passo a passo do Detective (5 chaves, inventário).
- **Roupa com efeito imediato: aura de espelho e passagens** (Efeito das roupas, M, +1): Ao vestir, cada família de cor acende no HUD e no piso a 'trilha' da mesma cor (sequences-color TRILHA) que revela passagens daquela cor. Uma peça de couro ou metal dá resistência contra os espelhos-armadilha, e uma peça de festa abre os atalhos de holofote. Com 3 peças da mesma família, a aura fica visível no avatar. Calcular no front a partir dos selos FAMILIA_* de /efeitos, que já existem, e validar no servidor.
- **Vida (Reflexo) e derrota real** (Sentido e objetivo, M, +0.9): Criar o recurso REFLEXO (3 a 5 pontos), exibido com nucleo-barras-de-vida. Cada apresentação errada ou cada espelho-armadilha tira 1, e uma peça achada ou uma fonte recupera 1. Com 0, a partida fecha como derrota em vez de o espelho 'ceder'. Remover CEDE_NA e a peça automática. Mostrar no HUD um objetivo explícito ('chegar ao espelho-mestre com N chaves').
- **Cenário de labirinto com GLB do motor Blender** (Gráficos, G, +0.8): Gerar com scripts/blender3d (receitas novas: módulo de sebe, arco de pedra, espelho ornamentado, fonte do pátio, escada da galeria) GLBs com texturas cozidas (texturas.py). Carregar com glb-prop.tsx e assets.ts, montar os corredores pelos nós do mundo e liberar orçamento em orcamento-da-cena.ts (hoje 0). Pôr no pátio NPCs guardiões com os humanoides de lib/flair/nucleos/gente/humanoides.ts e no lugar do manequim busto.
- **Comandos de aventura por contexto** (Comandos, M, +0.8): Para o LABIRINTO, criar um perfil de ações próprio em acoesDe: analógico esquerdo/WASD para mover; X (botão 0) para interagir (pegar peça, apresentar ao espelho, abrir porta); O (1) para cancelar ou voltar; quadrado (2) para abrir a mala/guarda-roupa; triângulo (3) para o mapa (câmera aérea); analógico direito para a câmera. Retirar GIRAR, ZOOM, POSAR e DESFILAR do jogo e mostrar o prompt do botão perto do objeto.
- **Cutscenes com câmera própria e pulo** (Cutscenes, M, +0.6): Abertura específica: grua sobre o jardim mostrando o espelho-mestre e a luz violeta guia, depois a câmera desce para as costas do avatar no portão. Cutscene curta ao abrir cada espelho ou ganhar chave (close do espelho, a porta distante abrindo). Final com câmera própria: travelling pela porta de saída para BOM, espelho rachando e avatar recuando para RUIM. Generalizar NucleoCutscene (hoje só no Detective) para legendas e permitir pular qualquer uma com Start ou O.

Problemas de gravidade alta:

- Jogabilidade: Não há labirinto: é uma sala única com um ponto fixo diante do espelho, e o jogador não controla o movimento. O mundo JARDIM_DOS_ESPELHOS (12 pontos, duas camadas) existe só como dado testado e não é usado na tela. (`lib/flair/nucleos/scene/salas/labirinto.ts; lib/flair/mundos/mundos.ts`)
- Recursos: A definição da dona pede peças espalhadas pelo cenário e chaves liberadas por espelhos. Hoje a 'peça achada' é concedida automaticamente pelo número da tentativa e não existem chaves, mala nem inventário. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/LabirintoNucleo.java`)
- Efeito das roupas: A roupa não altera nada no avatar durante o jogo. É só uma contagem para a pontuação. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/LabirintoNucleo.java`)
- Comandos: São os comandos de provador (girar, zoom, posar, desfilar) num jogo de aventura. Falta mover pelo analógico esquerdo ou WASD e interagir com o cenário pelo botão de ação. (`lib/flair/nucleos/controls.ts; lib/flair/nucleos/labirinto.ts`)

### PILOTO_FAVORITO

A pessoa escolhe uma de três rodadas (capacete Equipe Aurora, macacão Equipe Boreal ou Tênis dos Sonhos). A partida abre direto na preparação, sem deck, com 6 s de travelling da câmera até o avatar em cima do tablado de um ateliê com o box de corrida ao fundo. Depois disso, o jogo é um editor de cores num menu: em cada aba (uma zona: TOPO, LATERAIS, FAIXA_VISEIRA, VISEIRA) a pessoa toca numa amostra de cor ou de acabamento. A cor escolhida vira uma faixa cilíndrica no busto de costura ao lado do avatar, enquanto a prévia do servidor mostra a nota ao vivo. Ao apertar Entregar, cada regra acende um spot de 700 ms. Com 60 pontos ou mais (25 por regra) o resultado é APROVADO, abaixo disso REPROVADO, e a partida fecha com uma linha de texto de fim. O avatar não anda, não usa a peça pintada e não interage com o cenário.

Efeito das roupas hoje: Nenhum durante o jogo. A cor e o acabamento de cada zona aparecem só como faixas cilíndricas num busto de costura ao lado do avatar (effects-3d.tsx:97-101) e servem para calcular a nota no servidor (25 por regra). O avatar não veste o capacete, o macacão nem o tênis. O capacete do cenário continua amarelo fixo, e nenhum atributo, recurso ou ação muda.

Melhorias propostas:

- **Volta de classificação: o piloto vestido corre e a pintura vira atributo** (Jogabilidade, G, +2): Depois de pintar vem uma fase de ação no box e na pista (reaproveitar a câmera EXPLORACAO e o CAMINHAR do Labirinto/Around the World). O piloto entra no carro, e a volta tem três setores com decisões em tempo real: A/Cruz para frear na curva, X/Quadrado para ultrapassar, O/Círculo para entrar no box. Cada regra cumprida dá um atributo: viseira espelhada dá visão contra o sol (janela de reação maior no setor 2), faixa verde dá boost de largada, laterais amarelas dão visibilidade (o rival não fecha a porta). O servidor resolve a volta a partir da semente e da entrega, como os lances do Fashion Sports, e fecha a partida com posição de chegada e não só com pontos.
- **O avatar veste o capacete, o macacão e o tênis pintados na hora** (Efeito das roupas, M, +1.4): Trocar PecaPintada (faixas num busto) por malhas da própria peça com submalhas por zona: capacete (casco, laterais, faixa, viseira), macacão e tênis. Gerar essas malhas no motor Blender (scripts/blender3d/receitas, com nova receita 'piloto.py') e exportar GLBs com material nomeado por zona. Aplicar cor e acabamento ao material de cada zona no avatar (NucleoAvatar) a cada toque. A pose POR_O_CAPACETE passa a encaixar o GLB na cabeça e BAIXAR_A_VISEIRA anima a viseira. Pintar o capaceteNoSuporte com as mesmas zonas.
- **Recursos de corrida: combustível, pneus e créditos da equipe** (Recursos, M, +1.2): Cada lata de tinta custa créditos da equipe (orçamento por rodada vindo do servidor). Acabamentos caros (espelhado, metálico) custam mais, e repintar gasta. Os créditos que sobram viram jogos de pneus ou litros de combustível para a volta da melhoria 1. Os pneus se desgastam a cada freada errada e se recuperam no pit stop (O/Círculo), que custa tempo. Mostrar tudo no HUD reaproveitando nucleo-barras-de-vida.tsx.
- **Box com gente e modelos detalhados** (Gráficos, M, +1): Pôr no box a equipe com humanoides (lib/flair/nucleos/gente/humanoides.ts e elenco.ts): um engenheiro, dois mecânicos e o piloto-rival, com reações (reacoes.ts). Substituir carroDeCorrida e capaceteNoSuporte por GLBs do motor Blender (receita em scripts/blender3d/receitas/urbano.py, nos moldes da pilha-de-pneus), com texturas de carbono e pintura que recebem as cores das zonas. Acrescentar a luz de recorte do box e sombra com contato.
- **Cutscenes de abertura, momento-chave e final com câmera própria** (Cutscenes, M, +1): Abertura: o piloto entra no box, a equipe recebe e o engenheiro entrega o pedido (Roteiro em opening.ts com fig('MECANICO'), fig('PILOTO')). Momento-chave: ao entregar, close na viseira baixando (CLOSE_ROUPA) e corte para o grid. Final por desfecho: pódio com champanhe (BOM), box com retoque (MÉDIO), capacete de volta à bancada (RUIM), cada um com Tomadas próprias em vez da câmera GRUA do resultado. Todas puláveis com Start e Enter, reaproveitando o padrão de NucleoCutscene do Detective.
- **Controles de console coerentes para pintar e andar** (Comandos, P, +0.8): Liberar TIRAR para zonas (B/Círculo limpa a zona) em acoesDe quando o recurso for ZONAS. Ligar o analógico esquerdo (eixos 0/1) à locomoção no box e à NAVEGAR, e deixar o direito só para a câmera. Usar Quadrado para alternar acabamento e Triângulo para ver o objetivo. Tirar POSAR do botão de face (vai para o menu de fotos). Atualizar BOTOES, TECLAS (WASD para andar) e a ajuda.
- **Pedido escondido e campanha da temporada** (Sentido e objetivo, M, +0.7): Em vez de regras que dão a resposta, o engenheiro passa pistas (cores do patrocinador inventado, regulamento noturno, sol baixo na pista sorteado da semente com Contexto.sorteio). A pessoa deduz a combinação, e a prévia mostra só quantas regras foram cumpridas, sem dizer quais. Encadear as três rodadas como etapas de uma temporada com classificação no campeonato (Flair3dCampanha). Derrota tira o piloto do grid na etapa seguinte.

Problemas de gravidade alta:

- Efeito das roupas: A peça pintada não é a peça. As zonas do capacete (TOPO, LATERAIS, FAIXA_VISEIRA, VISEIRA) viram faixas empilhadas no tronco do busto (BASE 0,93 m a TOPO 1,5 m). O capacete do suporte é um móvel com material fixo 'lacaAmarela' e não reage à pintura. (`components/flair/nucleos/scene/effects-3d.tsx`)
- Jogabilidade: O jogo se resume a um formulário de cores. As regras entregam a resposta, a prévia mostra a nota ao vivo e não há risco, tempo, adversário nem movimento. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/PilotoFavoritoNucleo.java`)
- Recursos: Não há nenhum recurso de jogo (vida, combustível, pneus, moedas, peças). As cores são infinitas e grátis. (`lib/flair/nucleos/piloto-favorito.ts`)

### AROUND_THE_WORLD

O jogador escolhe a rodada (Rio de Janeiro, Volta ao Mundo com 8 regiões, Elevador da Torre, Metrô de Moda ou Shopping de 4 Andares) e monta um deck de até 12 cartas, com pelo menos uma peça de cima e uma de baixo. A abertura tem um travelling de 6 s pela calçada do Rio, o avatar entra e a premissa aparece. Depois o jogador navega pelo deck e veste as cartas nas vagas SUP/INF/CAL/ACE, vendo um selo de pontos em cada peça. Quando entrega, o servidor dá a nota (25 por regra, aprovado com 60). Em seguida vem a 'jogada de cena': o jogador joga uma carta de fora do look, a cor dela aciona um efeito de luz ou um gesto dos passantes e a cor pedida vale +10. Por fim o avatar anda 1,2 m pela calçada, os passantes aplaudem ou acenam, o marcador do mapa avança e aparece um texto de fim. Nas rodadas em etapas a mesma calçada do Rio se repete em cada região, andar ou estação. Depois de 4 tentativas o caminho abre mesmo sem cumprir as regras.

Efeito das roupas hoje: Nenhum efeito sobre vida, recursos, atributos ou ações. Vestir mostra um selo de pontos e um clarão (CIMA_LEVE/BAIXO_LEVE/COR_QUENTE/MARCA_BR, 25 cada) e entra na nota final. A cor da carta jogada na jogada de cena só aciona um efeito de luz ou um gesto dos passantes, e a cor pedida vale +10 pontos.

Melhorias propostas:

- **Andar pela Orla do Mirante com o analógico** (Jogabilidade, G, +1.2): Ler os eixos 0 e 1 do gamepad e as teclas WASD como MOVER, com um controlador de personagem que anda pelo grafo de pontos de ORLA_DO_MIRANTE: colisão pelos limites de zona e câmera EXPLORACAO por trás do ombro. Montar a sala a partir de lib/flair/mundos (marco, luz guia, laço) com os móveis já existentes. A vitrine do mirante passa a ser o lugar onde se entrega o look, e o ateliê do beco dá uma carta de presente.
- **Roupa como atributo imediato: conforto climático e estilo** (Efeito das roupas, M, +1): Calcular no servidor, a partir de Flair3dPecas (material, família, estilo), dois medidores por região: CONFORTO, que cai com o tempo se o material não combina com o clima (calor no Rio, frio em Seul), e ESTILO, que abre interações. Mostrar as barras com nucleo-barras-de-vida e trocá-las na hora em que a peça é vestida. Com conforto zero o avatar anda devagar e a etapa falha. Peça de estilo da região faz o passante abrir uma loja ou um atalho.
- **Recursos de viagem: vida (conforto), dinheiro de viagem e mala limitada** (Recursos, M, +0.9): Acrescentar ENERGIA e MOEDAS em recursos. A mala é o deck de 12, e trocar de peça numa região custa moeda (o Elevador e o Metrô já contam trocas no método trocas()). Passantes e bancas vendem ou dão peças. Cada etapa aprovada repõe energia, e errar gasta. Tirar o CEDE_NA automático e pôr no lugar 'gastar moedas para pular a região'.
- **Uma sala por região e por rodada** (Gráficos, G, +0.9): Criar salas para Nova York, Paris, Tóquio etc., e para elevador, vagão de metrô e shopping, reutilizando materials, moveis/urbano e os móveis do motor Blender (scripts/blender3d/receitas) para trocar caixas por GLB próprios: fachada, banca, placa, catraca, vagão. Escolher a sala pelo código da etapa (Flair3dPercurso.primeira). Pôr os passantes de humanoides.ts com roupa da região perto da câmera.
- **Comandos de console enxutos** (Comandos, P, +0.6): Mapear analógico esquerdo e WASD para mover, analógico direito para orbitar a câmera, X (A) para interagir ou vestir, O (B) para cancelar ou tirar, quadrado (X) para abrir a mala, triângulo (Y) para o mapa ou objetivo e Start para pausar. Remover GIRAR, ZOOM e POSAR deste jogo (acoesDe com uma opção de exploração) e esconder os botões de câmera em nucleo-controls.
- **Cutscenes de chegada e de carimbo com câmera própria** (Cutscenes, M, +0.6): Na chegada a cada região, tocar uma cutscene com tomada aérea da cidade, letreiro e legenda do enredo, usando tomadasDaAbertura por sala e o texto de nucleo-cutscene generalizado para além do Detective. No fim da etapa, plano fechado do passaporte sendo carimbado, com câmera própria em vez do TRAVELLING do resultado. Botão e tecla (Start/O) para pular, e a cena final da Volta inteira no farol do mirante.
- **Missões de região com risco no cenário** (Sentido e objetivo, M, +0.5): Dar a cada região um objetivo no mundo (chegar ao mirante antes do pôr do sol, achar a banca que vende a peça da paleta) com marcador no mapa já existente (marcadorDoMapa, M_MAPA_AVANCA). Indicar na HUD o próximo ponto da rota principal e a derrota clara: energia zerada ou tempo esgotado, com tentativas que custam moedas.

Problemas de gravidade alta:

- Sentido e objetivo: Há uma única sala (calçada do Rio) para as 8 regiões da Volta ao Mundo e para o Elevador, o Metrô e o Shopping. O cenário contradiz o objetivo da etapa. (`lib/flair/nucleos/scene/salas/around-the-world.ts`)
- Jogabilidade: O avatar não se move por comando: DESFILAR e a caminhada do resultado são roteiros fixos, e a câmera EXPLORACAO segue um avatar parado. (`lib/flair/nucleos/scene/sequences-manual.ts`)
- Recursos: O único recurso é CARTAS. Não há vida, energia, moedas nem itens no mundo, e a recompensa do ateliê do beco (mundos.ts) não está ligada a nada. (`lib/flair/nucleos/around-the-world.ts`)
- Efeito das roupas: A peça só pontua. Não muda resistência ao clima, velocidade, acesso a lugares nem reação dos NPCs durante a partida. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/AroundTheWorldNucleo.java`)

### SUPER_HEROI

A pessoa escolhe uma de três rodadas (ARMADURA, TRAJE_COLANTE, VIGILANTE_DA_NOITE). Por não ter deck, a partida começa direto na preparação, depois da abertura comum: a câmera vai do plano aberto até o avatar, que entra até a marca, e a premissa aparece em duas linhas. A preparação acontece num ateliê aberto para um terraço à noite. Ali a pessoa percorre as abas da janela de recursos (PEITO, CAPA, BRACOS, PERNAS e a aba de resposta), escolhe cor e acabamento para cada zona e um dos três emblemas, e a pintura aparece como faixas cilíndricas num manequim de costura ao lado. Ao entregar, o servidor dá 25 pontos para cada uma das quatro regras da rodada; a cena acende um spot, o avatar faz poses de herói e o resultado mostra a nota, as estrelas e um texto de fim (bom, médio ou ruim). Ninguém anda pela cena, não há inimigo, risco nem recurso para gastar, e a partida acaba numa única entrega.

Efeito das roupas hoje: Nenhum sobre o avatar. A cor e o acabamento de cada zona aparecem só como faixas cilíndricas no manequim de costura (effects-3d.tsx:87-103), e o emblema escolhido não aparece em lugar nenhum da cena. Tudo isso conta apenas como pontuação no fim (4 regras de 25 pontos, SuperHeroiNucleo.java:69-73).

Melhorias propostas:

- **Missão no terraço: o avatar anda, pula entre telhados e enfrenta drones** (Jogabilidade, G, +1.6): Depois da preparação, abrir uma fase de ação curta (EM_ACAO, como a jogada de cena e o Dress Fighter): o avatar anda com o analógico esquerdo ou WASD pelo terraço e por 2 ou 3 telhados ligados, desvia de holofotes de vigia (reaproveitar o cone dos vigias do Detective) e desativa drones com as ações do traje. O servidor valida passo a passo, partindo da semente, como já faz o Flair3dPercurso. A câmera SEGUE/OMBRO já existe.
- **Cada zona do traje vira um atributo e uma ação imediata** (Efeito das roupas, M, +1.3): Ligar cada zona a um atributo do herói: PEITO METALICO dá defesa (escudo), CAPA dá planar (salto longo), BRACOS dão o golpe ou raio na cor da zona (tabela de Flair3dCores) e PERNAS dão velocidade. O HUD mostra o atributo mudando no momento em que a cor ou o acabamento é aplicado, e a missão usa esses valores. O emblema escolhe o superpoder especial (ESTRELA cura, RAIO atordoa, ASA dá voo curto).
- **Vida, energia e cargas de poder com custo e recuperação** (Recursos, M, +1.2): Dar ao herói barras de vida e de energia (reaproveitar nucleo-barras-de-vida do Dress Fighter): o raio e o voo gastam energia, que volta parado na luz da lua ou com um item de recarga escondido no telhado, e o dano dos drones tira vida. Vida zerada é derrota; desativar os drones e salvar o civil é vitória. Os valores iniciais vêm dos atributos do traje.
- **O avatar veste o traje (malha com zonas) e mostra o emblema** (Gráficos, G, +1.2): Trocar as faixas de cilindro no manequim por um traje vestido no avatar: gerar no motor Blender (scripts/blender3d/receitas) um GLB de traje e capa com material por zona (PEITO, CAPA, BRACOS, PERNAS) e um decal para cada emblema, e pintar no runtime pelo nome do material. A capa passa a ser uma malha com ossos presos ao avatar, com o M_CAPA_AO_VENTO aplicado nela.
- **Cidade noturna com GLBs, sombras e civis humanos** (Gráficos, G, +0.9): Gerar no motor Blender prédios com fachada texturizada, caixas-d'água, antenas, letreiros e telhados ligados, no lugar das caixas de predio(). Ativar sombra da luz da lua e colocar civis e um vilão como humanoides (lib/flair/nucleos/gente/humanoides.ts, reacoes.ts) que reagem ao resgate. Tudo dentro do orçamento de triângulos da sala.
- **Cutscenes de herói com câmera própria e opção de pular** (Cutscenes, M, +0.9): Criar três cutscenes. Abertura: o alarme da cidade, a câmera desce da lua até o herói no parapeito. Meio: o traje fica pronto, o herói veste com zoom no emblema acendendo. Final, pelo desfecho: voo sobre a cidade na vitória, recuo ferido na derrota. Reaproveitar NucleoCutscene e o padrão de legendas do Detective, com uma sequência de rigs (grua, contra-plongée, orbital) e o botão de pular (Start/O).
- **Mapa de comandos por jogo, no padrão de console** (Comandos, P, +0.8): Gerar TECLAS, BOTOES e BOTOES_TELA a partir de config.acoes, sem DESFILAR nem TIRAR onde o núcleo não os tem. Na missão: analógico esquerdo ou WASD para mover; X (botão 0) pula ou plana; quadrado (2) dá o golpe; triângulo (3) usa o poder do emblema; O (1) defende ou interage; R1/L1 trocam o alvo. Na preparação: LB/RB para as abas e o D-pad para as cores. Ler o eixo 0/1 em lerGamepad.
- **Campanha de três missões ligadas aos arquétipos, com derrota real** (Sentido e objetivo, M, +0.7): Encadear as rodadas como capítulos (ARMADURA, depois TRAJE_COLANTE, depois VIGILANTE_DA_NOITE). Cada uma tem uma ameaça cujo ponto fraco pede um arquétipo, por exemplo o drone que só cai com peito metálico. A vitória libera o próximo capítulo; a derrota repete a missão. Reaproveitar nucleo-campanha e use-nucleo-progresso, com o objetivo da missão sempre no HUD.

Problemas de gravidade alta:

- Efeito das roupas: O traje criado nunca é vestido pelo avatar: fica em faixas de cilindro no manequim, e o avatar recebe só as peças de carta, que este jogo não tem. (`components/flair/nucleos/nucleo-scene-3d.tsx`)
- Jogabilidade: Não há ação de herói: sem movimento, sem inimigo, sem risco. A partida é um formulário de 5 campos e acaba numa única entrega. (`lib/flair/nucleos/super-heroi.ts`)
- Recursos: Não existe vida, energia ou item. Os recursos declarados (ZONAS, RESPOSTA) são só abas de seleção. (`lib/flair/nucleos/super-heroi.ts`)
- Gráficos: A cidade é feita de caixas (prédio = 2 caixas), a capa é uma placa e o traje são cilindros de 20 lados. Não há GLB próprio, e a sala consta como ainda não revisada. (`lib/flair/nucleos/scene/moveis/urbano.ts`)

### FASHION_SPORTS

Na preparação, o jogador monta um deck de até 15 cartas, veste o uniforme (parte de cima, de baixo e calçado, que somam os atributos do time) e escolhe a modalidade. Ao entrar, uma vinheta de texto "Apito inicial" aparece e a transmissão 3D mostra 10 jogadores gerados pela semente; o avatar do próprio jogador não entra em campo. A partida tem 16 jogadas (2 tempos de 8). Em cada uma, o jogador escolhe 1 das 5 cartas da mão, ou segue sem carta, numa janela de 30 s. A cor da carta decide a ação (passe, condução, drible, chute, desarme, goleiro) e o poder dela entra num duelo de números que o servidor resolve com sorte de -8 a +8. Depois o jogador assiste ao lance animado de 1,7 s. No fim, vitória vale 100, empate 60 e derrota 0, e a tela mostra o resumo estatístico. Não há outra condição de derrota nem progressão além de trocar de modalidade.

Efeito das roupas hoje: Vestir as 3 peças do uniforme pinta os 10 jogadores do time com as cores delas (visível na hora) e soma velocidade, técnica, resistência, defesa e físico à força de base do time. Essa força entra no duelo de cada jogada e no cansaço do 2º tempo, mas os números só aparecem na prévia da preparação. A cor de cada carta da mão decide a ação, e o poder dela (OVR, nível, afinidade de material, Hype) soma ao duelo. A peça da carta jogada nunca aparece vestida em ninguém. A roupa muda o resultado sem que o jogador veja o efeito durante a partida.

Melhorias propostas:

- **Avatar controlável em campo (capitão) com movimento em tempo real** (Jogabilidade, G, +1.6): Pôr o avatar da pessoa como jogador NOS-2 (o capitão) e deixar o jogador movê-lo pelo campo no analógico esquerdo ou WASD com a locomoção já existente (lib/avatar3d/human/locomotion-model, AtorDeCena). Durante a janela da jogada, a posição do capitão escolhe o alvo do passe e a zona de chute, e a proximidade com a bola ou o rival habilita a ação. No servidor, aceitar no Acionamento um 'alvo' (jogador ou ponto) e dar bônus quando o capitão está bem posicionado. Os outros 8 continuam vindo de EsporteCampo.
- **Duelo com habilidade: botões de console e barra de tempo** (Comandos, M, +1.2): Mapear as ações a botões fixos em vez de 'carta em foco + A': X passe, O drible/desarme, Quadrado chute, Triângulo goleiro/recompor. A carta da mão vira o reforço da ação (LB/RB trocam a carta). No chute e no desarme, abrir uma barra de tempo (QTE) cujo acerto substitui parte da sorte de ±8 no servidor (o acerto vai no Acionamento e é validado por intervalo). Tirar as duplicatas Espaço/Start e o 'seguir sem carta' explícito, que passa a ser só o timeout. Ler o analógico esquerdo em lerGamepad.
- **Recursos que se gastam: stamina do time, energia de carta e itens** (Recursos, M, +1): Mostrar no HUD a barra de fôlego (EsporteForcas.Time.folego) e um custo de energia por carta, igual ao poder dela, com recarga por jogada e no intervalo. Tirar a reciclagem gratuita: o descarte só volta no intervalo. Mostrar também embalo e goleiro pronto como ícones. O servidor já calcula tudo isso: basta mandar no evento SITUACAO e validar o custo.
- **A roupa age na hora: a peça da carta no capitão e atributos ao vivo** (Efeito das roupas, M, +0.9): Ao jogar a carta, vestir a peça dela no capitão durante o lance: trocar a peça em pecasDoUniforme pela Look3dPiece da carta, para que o replay mostre de fato a peça. Mostrar no placar os 5 atributos do uniforme e o efeito da carta ('+6 drible', aura na cor da carta). Peça de material firme dá ombrada visível no desarme. Cansaço alto muda o gesto para 'tired'.
- **Cutscenes de verdade com câmera própria: entrada dos times, gol e cerimônia final** (Cutscenes, M, +0.9): Trocar as vinhetas de texto por sequências do diretor de cena (lib/flair/nucleos/gente/reacoes.ts e scene/ritmo.ts), cada uma com uma pose de câmera em lib/flair/esporte/camera.ts. Abertura: túnel, os times entram, hino e capitão em close. Gol: câmera em grua contornando a comemoração. Final: troféu ou lamento conforme desfechoDoPlacar, em plano fechado. Cada cena pode ser pulada com O/Start.
- **Estádio em GLB pelo motor Blender e telão com placar** (Gráficos, G, +0.8): Criar receitas em scripts/blender3d/receitas para arquibancada, gols, bancos, túnel e refletores, com texturas próprias (scripts/blender3d/texturas.py), e carregar os GLB com fallback para as primitivas atuais. Escrever o placar no telão com CanvasTexture. Usar os humanoides de lib/flair/nucleos/gente/humanoides.ts no lugar da figura de caixas enquanto o corpo carrega. Adicionar luz de refletor e sombra de 2048 em qualidade ALTA.
- **Progressão: campeonato com fases e derrota antecipada** (Sentido e objetivo, M, +0.6): Criar rodadas de campeonato (grupos, semi, final) com rivais mais fortes (rival[] maior pela semente da rodada) e ligar FASHION_SPORTS em Flair3dCampanha.EM_SEQUENCIA. Adicionar uma regra de nocaute (por exemplo, 3 gols de diferença encerram a partida) e mostrar o objetivo da fase no briefing. Trocar os 'manequim' da preparação por gente do elenco.

Problemas de gravidade alta:

- Jogabilidade: Confirmado: não há personagem controlável. elencoDaPartida gera os 10 jogadores pela semente e não usa o avatar da pessoa. As posições vêm do servidor (EsporteCampo) e a tela só interpola. Ninguém se move pelo cenário, interage com ele ou disputa a bola em tempo real: a disputa é um cálculo no servidor com sorte de ±8. (`lib/flair/esporte/elenco.ts`)
- Jogabilidade: Jogada sem carta é sempre pior e nunca é escolha tática. O duelo depende muito da sorte (±8 contra forças de 20 a 40), o que reduz o peso da habilidade. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/esporte/EsporteLance.java`)
- Recursos: O baralho volta inteiro quando acaba, sem custo. Fôlego, embalo e goleiro pronto não aparecem no HUD. Não há energia, stamina nem item gasto ou recuperado que o jogador consiga ver. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/esporte/EsporteMao.java`)

### BATALHA_LOOKS

A pessoa monta um deck de até 8 cartas de roupa, com pelo menos 1 parte de cima, 1 parte de baixo e 1 calçado, e entra na sala. Uma abertura de 6 s com câmera em travelling mostra a avatar entrando na passarela em Y enquanto a plateia aplaude, e um cartão traz a premissa e o briefing da rodada. Na rodada principal ("Batalha de 3 rodadas") o servidor sorteia pela semente 3 objetivos: um monocromático, um convite com peça proibida e um clima. Em cada um a pessoa só escolhe as 4 vagas (SUP, INF, CAL, ACE) com cartas do deck, vê a nota prévia calculada no servidor e aperta Entregar. Toda entrega avança, e a nota do adversário (25, 50 ou 75) também sai da semente. No fim vence quem somou mais; no empate, a plateia vota (também pela semente). A cena toca a sequência automática: os dois posam lado a lado e o vencedor levanta o braço sob o foco de luz. Aparecem então o resultado com a nota de cada rodada e um texto de final (BOM ou RUIM).

Efeito das roupas hoje: Vestir uma carta mostra a peça na avatar na hora, e o selo da carta e a prévia do servidor dizem quanto ela vale (+25 se cumpre a regra da rodada, −25 se é a peça proibida do convite). A roupa não muda vida, energia, atributo, ação nem o comportamento do adversário ou da plateia durante a rodada. Ela só vira pontuação somada na entrega e no fim, e a mesma carta pode ser reusada nas 3 rodadas sem custo.

Melhorias propostas:

- **Duelo de passarela com medidor de Presença: o look vira atributo e ação** (gameplay, recursos, efeito_das_roupas, G, +2): Transformar cada rodada num duelo por turnos no modelo do Dress Fighter, reaproveitando o EM_ACAO e o acionamento (lib/flair/nucleos/luta.ts, nucleo-barras-de-vida.tsx). Cada lado tem uma barra de Presença (vida) e Energia. Cada peça vestida que cumpre a regra dá atributo imediato: +Presença máxima para SUP e INF, +velocidade de passo para CAL, golpe especial para ACE. A peça proibida drena Energia na hora. Na fase de ação a pessoa escolhe entre Pose (X), Giro (quadrado ou Y) e Carta de efeito de cor (triângulo), que custam Energia e acertam a Presença do adversário. A carta usada numa rodada fica cansada na seguinte (gasta), e a energia volta entre as rodadas. As barras sobem e descem na hora em que a pessoa veste.
- **Adversário que monta look de verdade e a nota dele vem do look** (gameplay, graficos, sentido_e_objetivo, M, +1.2): Trocar o sorteio fixo de {25, 50, 75} em BatalhaLooksRodadas.adversario por um deck da casa sorteado da semente (cartas do catálogo) que o servidor avalia com as mesmas regras. Mandar as peças do adversário no evento RODADA_DA_BATALHA e vestir o figurante ADVERSARIO com elas (roupaDoPapel aceitando as peças do servidor). Esconder a nota dele até a entrega, para haver risco, e mostrar só uma 'dica' (a família de cor dele).
- **Corrigir a reação entre rodadas e o painel de LED** (cutscenes, sentido_e_objetivo, P, +0.8): Na montagem 'batalha', ler o evento RODADA_DA_BATALHA do resultado parcial: quem fez mais na rodada levanta o braço, e não há reacaoPorEstrelas enquanto status for ABERTA. No placarDaCena, mostrar 'voce × adversario' da rodada e, no fim, SOMA_DA_BATALHA. Cobrir com testes em sequences-auto e scene.test.
- **Avatar se move na passarela com analógico e WASD, com interações no cenário** (gameplay, comandos, G, +0.9): Adicionar a ação MOVER (analógico esquerdo, eixos 0 e 1, e WASD) limitada à zona do avatar e à passarela em Y. Usar o locomotion-model e a câmera que já segue o lugar do avatar no diretor (game-camera.tsx). Pontos de interação no palco: marca de pose (X ou quadrado para posar ali), ponta da passarela (triângulo para virar e ganhar Presença) e mesa dos jurados (círculo para mostrar a peça). Liberar W para mover, mover DESFILAR para Y ou triângulo, e tirar do HUD girar e zoom (deixar no analógico direito).
- **Sala da Batalha em GLB pelo motor Blender** (Gráficos, G, +0.7): Criar receitas em scripts/blender3d/receitas para passarelaEmY, painelLed, mesaDosJurados e trilhoSpots (os 5 tipos que faltam no PLANO_MOTOR_BLENDER), com texturas de scripts/blender3d/texturas.py, bake de luz e LOD. Carregar pelo glb-prop.tsx e use-glb-manifest.ts, sem passar do orçamento da sala (orcamento-da-cena.ts). Pôr os 3 jurados mais perto da câmera no catálogo de humanoides.
- **Cutscenes de rodada e de adversário, que podem ser puladas** (Cutscenes, M, +0.6): Criar uma tomada de 'apresentação do desafiante' (close do adversário e grua) e, a cada PROXIMA_ETAPA, uma vinheta de 3 s com o objetivo no painel de LED e a câmera vindo da plateia (Roteiro em opening.ts e tomadas em camera/rigs.ts). Pôr letterbox e pular com Start ou Enter na CameraDeAbertura e na vinheta. No final, um plano de câmera próprio (contra-plongée no vencedor) antes do painel de resultado.
- **Textos e objetivo coerentes com a Batalha de 3 rodadas** (Sentido e objetivo, P, +0.3): Atualizar flair3d.nucleo.BATALHA_LOOKS.objective (pt-BR, en, es) para a Batalha de 3 rodadas. Mostrar no HUD o contador 'Rodada n/3' e a soma parcial 'você × adversário' a partir de RODADA_DA_BATALHA (nucleo-rounds.tsx). Explicar no briefing que a carta usada fica cansada (depois da melhoria 1).

Problemas de gravidade alta:

- Cutscenes: Entre as rodadas da Batalha, a cena recebe o resultado parcial (status ABERTA, resultado ETAPA_CUMPRIDA, 0 estrelas). A montagem 'batalha' trata qualquer resultado que não seja VITORIA como derrota: a plateia lamenta (desfechoDe dá RUIM), o adversário levanta o braço e a avatar faz a reação de 0 estrelas, mesmo quando a pessoa fez 100 contra 25 naquela rodada. Encontrado na leitura do código; falta conferir na tela. (`lib/flair/nucleos/scene/sequences-auto.ts`)
- Jogabilidade: A nota do adversário em cada rodada é sorteada de {25, 50, 75} pela semente, sem relação com o look dele nem com o que a pessoa faz. Com a prévia mostrando a nota exata antes de entregar, não há risco: o jogador só confere a soma. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/nucleos/BatalhaLooksRodadas.java`)
- Recursos: As cartas não são gastas: a mesma carta serve nas 3 rodadas e soma pontos em cada uma. Não existe vida, energia, moeda nem item consumível na Batalha. (`fai-application/src/main/java/br/com/fashionai/application/flair3d/Flair3dPercurso.java`)

