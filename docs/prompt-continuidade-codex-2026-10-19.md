# Prompt de continuidade para o Codex

Continue meu trabalho no FashionAI. Este documento consolida meus pedidos nesta conversa; nao considere um pedido concluido apenas porque o assistente anterior afirmou que implementou. Confira o codigo, os testes e a experiencia real. Responda em portugues e implemente as correcoes, nao fique apenas em planejamento.

## Contexto e regras de trabalho

- Data da transferencia: 19/10/2026. Ambiente macOS.
- Checkout principal: `/Users/matheushaliski/tcc-2026-fashion-ai-backend`.
- Repositorio: `MatheusHaliski/tcc-2026-fashion-ai-backend`.
- Branch usada: `fix/try-on-lower-piece-3d`. Confira a branch e o remoto atuais.
- O VS Code tambem foi usado com workspace virtual `vscode-vfs://github/...`; nao confunda esse workspace com o checkout local nem com outros worktrees.
- Existiram worktrees `tcc-avatar3d-gpu-pr` e `tcc-avatar3d-ultrarealistic` e a branch `feat/avatar3d-gpu-pipeline-quality`. Confira o que ja foi integrado antes de portar ou duplicar codigo.
- Preserve mudancas do usuario e de outros processos. Leia os arquivos atuais antes de editar; nao use reset destrutivo, force push nem descarte alteracoes pendentes.
- Tenho autorizado commit e push automaticos ao terminar as alteracoes. Publique apenas as mudancas pertinentes, sem segredos. Houve pedidos anteriores de abrir/atualizar PRs dos pipelines de avatar GPU: confira PRs existentes antes de criar duplicados.
- Valide cada comportamento com testes focados e, para UI/3D, no navegador em desktop e mobile. Informe o que nao foi validado. Nao apresente testes unitarios como prova de realismo visual.
- Frontend Next.js/React/TypeScript/Vitest; backend Java 21/Spring Boot/Maven multi-modulo; avatar Three.js/React Three Fiber com asset MakeHuman/MPFB2 e exportacao GLB/glTF.

## 1. Aura Hype: especificacao correta e prioridade pendente

Eu pedi para REDUZIR as opcoes porque muitas nao fazem diferenca. A implementacao antiga tem 40 combinacoes de tecnica/paleta. Separar esses mesmos 40 presets em dois grupos de 20 NAO atende ao pedido completo.

Ao clicar em AURA Hype no editor de arte de fundo, mostrar DUAS FAIXAS: cards estaticos e cards dinamicos. Oferecer quatro estilos estaticos e quatro dinamicos para cada categoria bronze, prata, ouro e especial. O codigo usa tambem COMMON/RARE/LEGENDARY/COLLAB_DROP e nomes Comum/Rara/Lendaria/Collab; verifique e harmonize o mapeamento real, sem inventar equivalencias ou confundir classificacao da peca com nivel FAI XP do usuario.

### Quatro estilos estaticos

1. Numeros dos atributos na horizontal.
2. Numeros dos atributos na vertical.
3. Numeros em duas colunas verticais.
4. Apenas o Hype Score global da peca.

Estatico significa PAINEL/ORGANIZACAO FIXOS, nao score congelado. Os numeros continuam atualizando com o Hype real. Nao basta pausar animacoes decorativas.

### Quatro estilos dinamicos

1. Ranking por barras LED horizontais: ordenar atributos por valor, maior primeiro e menor por ultimo. Ao mudar o score, animar comprimento e reordenacao; o atributo sobe/desce de posicao automaticamente.
2. Maior e menor atributos: destaque amarelo com seta para cima para o maior/crescente e vermelho com seta para baixo para o menor/decrescente. Diferencie ranking atual de tendencia temporal quando houver dados; nao fabrique crescimento/queda a partir de um unico snapshot.
3. Texto opinativo dinamico sobre o atributo em destaque. Exemplo pedido: "Peca Versatil!", score do atributo e seta para cima. O texto acompanha o atributo atual, sem inventar valores.
4. Tres atributos-chave que mais combinam com a peca, considerando marca, cor, ocasiao, nome, categoria/subcategoria. Adicionar miniestrelas piscando. Definir selecao explicavel, sem fingir que decoracao mede tecido ou gera metricas reais.

Ao editar peca OU look, o usuario deve ver o Hype recalculado e os numeros atualizados conforme a edicao. Verifique invalidacao, atualizacao de resumo e o backend, nao apenas a animacao da previa.

No seletor de arte, criar demonstracoes animadas/videos com numeros ficticios que mostrem cada estilo. Identificar valores como exemplos somente nas previas. Nos cards publicados, usar dados reais; indisponivel nao vira zero.

### Bloqueios e integracao

- Em `/pieces/new`, ainda foi possivel acessar presets bloqueados ao abrir Aura Hype. Aplicar a permissao FAI XP tambem nesse caminho e na aplicacao/persistencia, nao apenas desabilitar miniaturas dos niveis.
- Prata, ouro e especial exigem FAI XP suficiente acima do basico. Usar regras existentes de permissao; nao confiar apenas no cliente.
- As informacoes nas janelas/abas Info e Hype devem ficar organizadas e alinhadas com o estilo escolhido no editor de arte.
- Efeitos selecionados em Aura & Material precisam renderizar imediatamente na previa real do card, nao apenas nas miniaturas do seletor.
- Remover a faixa preta duplicada de score abaixo do cabecalho do dono. Mostrar o score vivo no controle que alterna para os dados Hype, preservando estados sem dados/stale.
- Nao deixar duas listas verticais extensas. As duas faixas precisam ser realmente utilizaveis e visivelmente diferentes.

Arquivos de entrada: `components/hype/aura-hype-picker.tsx`, `lib/hype/aura-hype-presets.ts`, `components/hype/aura-hype.tsx`, `components/hype/fashion-card-panel.tsx`, `components/piece-card-panels.tsx`, `components/background-studio.tsx`, `lib/fashion-card/aura-gating.ts`, `lib/hype/use-hype.ts`, traducoes e CSS.

Estado conhecido: foram criados apenas grupos static/dynamic por tecnica, mantendo os 40 presets. Isso nao implementa os oito layouts solicitados. A ultima mudanca local trocou a grade por fluxo horizontal e adicionou `data-preset-kind` com CSS para parar animacoes estaticas. Essa ultima mudanca NAO teve testes, validacao visual nem publicacao confirmados antes da troca de assunto. Revise-a e complete a especificacao correta.

## 2. Cards e previas

- Dobrar a largura dos cards de peca, look e DNA em `/feed`, `/search`, `/u/[username]` e demais abas que usam esses cards, inclusive criadores de pecas/looks, preservando responsividade.
- Meu pedido sobre retirar/realocar "compacto" foi corrigido: a opcao correta e AMPLIADO na etapa 3, Arte de fundo. Nao aplicar a instrucao antiga sobre compacto.
- Ampliado deve mostrar o CARD FINAL REAL, nao apenas aumentar uma amostra de arte nem mudar somente a proporcao da foto.
- Colocar toggle com icone no canto superior esquerdo, dentro do card, alternando Feed/Ampliado e permitindo voltar ao Feed para continuar a edicao.
- Relatei que o toggle aparece, mas nao alterna de verdade. A correcao anterior apenas adicionou `expanded` ao PieceCard e proporcao 4/5: confira se isso atende ao card final; provavelmente e parcial.
- Em `/pieces/new`, manter a previa inteira acessivel no topo/sticky durante a edicao, sem precisar rolar ate o final. Conferir pais com overflow, altura do viewport, cabecalho e comportamento mobile.
- Em `/closet`, remover hover do modal aberto ao clicar numa peca, preservando interacoes necessarias dos controles. A correcao anterior desativou hover de links/linhas em todos os dialog-card; revisar se o escopo e o efeito removido sao os corretos.

Arquivos: `components/piece-art-editor.tsx`, `components/piece-card.tsx`, `components/card-preview-mode-toggle.tsx`, `components/scheme-builder.tsx`, `components/detail-modal.tsx`, `components/expanded-card.tsx`, `app/(site)/(app)/pieces/new/page.tsx`, `app/(site)/globals.css`.

## 3. Avatar 3D e pipeline GPU/fotografia

- Continuar melhorando a deteccao fotografica e a geracao semirrealista/ultrarrealista do avatar, preservando identidade, proporcoes e detalhes da foto.
- Colocar o avatar da aba Meu Avatar 3D dentro do ambiente do provador, sem ficar flutuando no vazio, preservando controles do editor.
- Adicionar ao provador controle remoto equivalente ao do Meu Quarto.
- Investigar o fluxo `StylizedPortraitPort`, implementacoes Java, `available()`, worker Python de `stylized_portrait`/`portrait`, `services/anatomical_vton/`, variaveis reais de conexao e Vertex AI. Esclarecer se a foto vai ao worker proprio, Vertex ou ambos, e se e necessario subir imagem no Google Cloud. Nao inventar nomes de variaveis/recursos.
- Houve pedido de recuperar operacoes exatas de `/tmp/avatar-edit-ops.jsonl` no worktree isolado `tcc-avatar3d-gpu-pr`, sem tocar o checkout original naquela tarefa. Esse e um pedido historico: verifique se o trabalho ja foi integrado antes de repeti-lo; nao transforme o worktree antigo em destino automatico de novas tarefas.
- Publicar e organizar os trabalhos de pipeline GPU nos PRs adequados, sem perder alteracoes existentes.

### Rosto e pele

- Geometria: macas do rosto/zigomaticos, mandibula, queixo, crista das sobrancelhas e profundidade das orbitas; morph targets/blendshapes para expressoes.
- Pele: SSS em nariz, orelhas e palpebras; poros, rugas e linhas de expressao por normal/displacement; roughness variando entre zonas secas e oleosas.
- Albedo com variacao anatomica: centro avermelhado (bochechas, nariz, labios), testa mais palida/amarelada, mandibula/queixo com variacao inferior e sombra de barba quando aplicavel.
- Preservar marcas individuais da foto: sardas, manchas, acne, cicatrizes, veias e olheiras, sem inventar caracteristicas pessoais.
- Labios: sulcos verticais, transicao suave, umidade e cavidade oral.
- Olhos: curvatura/reflexo/refracao da cornea, esclera com veias sutis, fibras e profundidade da iris, pupila e possivel variacao de diametro, menisco lacrimal e encaixe correto nas palpebras.

### Cabelo e pelos

- Direcao natural, vortice/coroa, hairline, baby hair, flyaways e fios soltos para evitar aspecto rigido.
- Shader anisotropico, transmissao de luz, variacao de cor por fio, raizes e mechas; flow maps e alpha/opacity quando usar hair cards.
- Sobrancelhas/cilios com espessura, curvatura e densidade progressivas; barba/stubble coerentes quando presentes.
- Balancear grooming/fios e hair cards conforme desempenho real, sem prometer fotorrealismo apenas mudando tons.

### Orelhas: pedido reiterado

- Corrigir anatomia e silhueta: helice, anti-helice, trago, anti-trago, concha e lobulo preso/solto, espessura e caimento.
- SSS vermelho/laranja quente sob contraluz, sem brilho emissivo constante.
- AO/cavidade mais escura no canal auditivo e concha, especularidade sutil, dobras e suporte coerente a acessorios/furos quando aplicavel.
- Integracao com cabelo sem cobrir/remover indevidamente a orelha; acompanhar morphs, esqueleto e exportacao.
- Materiais/shaders, topologia e iluminacao precisam ser conferidos visualmente frontal/perfil/contraluz e em tons de pele diferentes.

Estado conhecido: orelhas receberam mascara topologica `earVertexMask`, atributo `earMask` e shader `installEarScattering` em `three-human.ts`. O primeiro shader usava um include inadequado e cor constante; foi trocado por insercao em `opaque_fragment` e contribuicao das luzes direcionais atras da normal, modulada pela cor da pele. Existe `ear-scattering.test.ts`; 10 testes de shader/mascara passaram, inclusive apos merge. Nao houve confirmacao visual nem implementacao completa de anatomia/canal/AO. O efeito e uma aproximacao, nao SSS fisico completo.

Arquivos principais: `lib/avatar3d/human/three-human.ts`, `hair-geometry.ts`, `skin-bake.ts`, `eyes.ts`, `brows.ts`, `hair-strands.ts`; `lib/avatar3d/pipeline.ts`, `quality.ts`, `atlas.ts`, `hair.ts`, `hair-tone.ts`, `hair-flow.ts`, `identity/brows.ts`; `components/three/human-avatar.tsx`, `avatar-lighting.tsx`, `components/avatar3d/my-avatar.tsx`, `human-lab.tsx`; servico Java `Avatar3dService.java`. Leia as versoes atuais: varios desses arquivos foram alterados em paralelo.

## 4. Espelho e camera no provador/quarto

- Em `/try-on`, corrigir o enquadramento ao entrar no espelho, relatado com captura de tela no historico.
- Em `/room`, o analogico direito permite atravessar a roupa ao rotacionar a camera: impedir isso.
- Nos espelhos de AMBOS ambientes, criar modo focado no reflexo, camera sempre apontando para a borda superior do espelho, sem focar em objetos fora do reflexo.
- Limitar orbita, distancia, colisao e alvo de forma consistente; testar com controles remotos/analogicos e evitar atravessar avatar, roupa ou espelho.
- Houve mudancas remotas de fitting-stage/fitting-remote-controls e iluminacao: confirmar comportamento, nao assumir que ja resolvem o foco do espelho.

Entradas: `components/try-on/`, `components/three/fitting-room-scene.tsx`, `components/room3d/`, `lib/room3d/camera-views.ts`, `mirror-session.ts`, `room-bounds.ts`, `interaction.ts`.

## 5. Backend, API e login

- Pedidos recorrentes para iniciar/reiniciar frontend/backend porque API estava indisponivel e login retornava 500.
- Executar Maven na raiz correta do repositorio; houve erro de reactor ao executar em `/Users/matheushaliski`.
- Comando usual backend: `mvn -pl fai-bootstrap -am spring-boot:run`, com Java 21 e variaveis corretas. Frontend: `npm run dev`.
- O host MySQL foi alterado para `iriguchi.proxy.rlwy.net`; porta observada 42234, banco fashionai, usuario fai_app. Use configuracao atual autorizada, nunca imprima senha/chave nem versione `.env`.
- Conexao Railway e migrations ja funcionaram; houve falha de login com `AesGcmStringConverter`, `Unable to decrypt sensitive attribute`, `AEADBadTagException: Tag mismatch`.
- Diagnostico anterior: possivel divergencia da DATA_ENCRYPTION_KEY em relacao aos dados criptografados. Confirmar sem apagar dados, recriar banco ou trocar chave arbitrariamente; obter a chave correta de forma segura se necessario.
- Houve backend saudavel na porta 8080 e novas tentativas falhando por porta ocupada. Inspecione processos/health antes de iniciar outra instancia.
- Existiam alteracoes pendentes em `fai-bootstrap/src/main/resources/application.yml` e `ResendEmailSender.java`: preservar e revisar antes de incluir em commits.

## 6. Documentacao e localizacao dos arquivos

- Pedi um PDF com minhas mensagens de solicitacao de alteracao, dentro de `/docs` do checkout LOCAL, alem de disponivel no remoto.
- Arquivo criado: `docs/solicitacoes-conversa-2026-10-19.pdf`, 8 paginas, aproximadamente 119 KB, exportado com 75 mensagens do registro (inclui complementos e possivelmente mensagens operacionais; nao e auditoria perfeita de requisitos).
- Texto auxiliar local: `docs/solicitacoes-conversa-2026-10-19.txt`; nao presumir que foi commitado.
- PDF commitado em `11c3ecdc` e enviado a `fix/try-on-lower-piece-3d`.
- Confirme o caminho local antes de dizer que um arquivo esta no workspace remoto ou em outro worktree.
- Historico bruto completo, se disponivel: `/Users/matheushaliski/Library/Application Support/Code/User/workspaceStorage/d661cdec5bee8dac80c045e07a416f5a/GitHub.copilot-chat/transcripts/55693957-c8e5-4a5e-bcb1-84845d528fd1.jsonl`. Consultar mensagens `user.message`, removendo contexto automatico e respostas do assistente. Nao transportar segredos de logs.

## 7. Commits e verificacoes conhecidas (nao substituem inspecao atual)

- `684d6dbd`: toggle ampliado da peca, implementacao parcial por proporcao 4/5.
- `812de8ba`: separacao nominal dos 40 presets em static/dynamic e traducoes PT/EN/ES; 15 testes passaram, mas a especificacao dos oito layouts nao foi cumprida.
- `82e097f6`: shader de contraluz das orelhas e teste; merge posterior `0df832f9` integrou trabalho remoto e foi publicado.
- `11c3ecdc`: PDF em docs.
- Um teste Splash falhou em uma execucao por src de videos ainda nao carregados e passou depois. Nao chamar de falha preexistente comprovada sem reproduzir/baseline.
- Ultima mudanca de faixas horizontais/CSS estatico pode estar apenas local e sem commit; conferir `git status` e diff.
- Existem atividades de auditoria de catalogo/try-on nos terminais e arquivos `docs/avatar3d/matriz-3d/achados.csv` e `data/catalog/audit/`. Sao contexto de trabalho paralelo: preservar, nao incluir em escopo/commit automaticamente.

## Como prosseguir

Primeiro confira branch, status, diferencas locais/remotas e instrucoes do repositorio. Monte uma matriz curta de requisitos atendidos/parciais/pendentes com evidencia. Priorize concluir o Aura Hype correto (quatro estaticos + quatro dinamicos, duas faixas, permissoes e dados vivos), previa Feed/Ampliado real e sticky; depois camera do espelho e realismo do avatar/orelhas. Preserve qualquer prioridade nova que eu fornecer. Implemente incrementalmente, valide com testes e navegador, publique as mudancas pertinentes e relate com precisao as pendencias e limitacoes.