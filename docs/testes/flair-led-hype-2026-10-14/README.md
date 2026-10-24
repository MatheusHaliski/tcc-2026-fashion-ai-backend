# FLAIR metálico, AURA Hype, Metamorfose e bordas

## Distinção visual

| Elemento | Papel visual e dados |
| --- | --- |
| FLAIR | Carta de jogo com bronze cobre, prata fria ou ouro luminoso, reflexo animado e OVR em display de sete segmentos. Atributos reais de jogo na frente; detalhes Hype no verso. |
| AURA Hype | Tratamento da fotografia da roupa com apenas o Hype Score global em display luminoso. Não copia a tabela de atributos nem os metais da carta de jogo. |
| AURA Metamorfose | Identidade visual em torno da foto: Prisma, Constelação, Fio Vivo e Holografia. Modos renderizados não equivalem à concessão de variantes exclusivas. |
| Borda | Perímetro comum de 2 px com raio da anatomia. Automática, cor ou gradiente; acabamento automático, sem efeito, luz, brilho ou holografia. |

## Comportamento da borda Hype

Com AURA Hype ativo, um novo score maior sinaliza verde e um menor sinaliza vermelho por 2,4 segundos. Depois a borda volta à arte-base. Primeiro carregamento, ativação do AURA, troca de entidade e tendência histórica não simulam eventos novos. A cor personalizada é preservada.

Os cards AURA compartilham polling de snapshots em lote a cada 30 segundos enquanto a aba está visível. Isso detecta atualizações do backend; não promete push imediato. Respostas AVAILABLE mais antigas não substituem o snapshot mais recente. Sem AURA ativo, não há polling adicional. O frontend não calcula nem grava pontos de Hype.

## Validação

- 49 testes de frontend em dez arquivos passaram: LED, distinção FLAIR/Hype, modos Metamorfose, serialização, editor, pulsos temporários e polling em lote.
- Nove testes do BackgroundStudioService passaram, incluindo preservação de borda/Metamorfose com revisão e recusa de cores e modos inválidos.
- TypeScript e Stylelint passaram. Verificação i18n: zero erros; oito avisos legados de textos de topônimos iguais entre idiomas.
- As capturas usam páginas reais do app local, foto real da Columbia e API simulada. Os scores 62/74/88 e o Hype 84 são valores explícitos de teste, não dados de produção ou de concessão.
- O navegador verificou que a animação metálica fica ativa normalmente e para com `prefers-reduced-motion: reduce`.

O navegador também confirmou a sequência simulada **84 → 89 → 82**: sinal verde, expiração, sinal vermelho e expiração. Os quatro modos Metamorfose foram renderizados após leitura de configurações da API simulada. O relógio do teste foi acelerado para verificar os intervalos; isso não altera scores reais.

## Capturas

- [Bronze com LED e atributos de jogo](bronze.png)
- [Prata com LED](prata.png)
- [Ouro com LED](ouro.png)
- [AURA Hype: foto e um score global](hype-foto-score-global.png)
- [Ganho de Hype: borda verde](borda-ganho.png)
- [Perda de Hype: borda vermelha](borda-perda.png)
- [Metamorfose Prisma](metamorfose-prisma.png)
- [Metamorfose Constelação](metamorfose-constelacao.png)
- [Metamorfose Fio Vivo](metamorfose-fio_vivo.png)
- [Metamorfose Holografia](metamorfose-holografia.png)
- [Resultado do navegador](browser-result.json)

## Limites

Esta mudança implementa o motor visual e sua configuração. Minhas Artes, direitos exclusivos por card, concessões via FLAIR/ATELIER/selos e revogação de presets por perda de nível ainda exigem implementação de progressão. Não houve deploy nem alteração do banco de produção. Não certifica os demais itens do checklist geral.

## Reproduzir no navegador

Com o app local apontando para API `http://localhost:8080`, gate local desativado e porta 3102, execute com Playwright instalado:

```bash
FAI_TEST_PHOTO=/caminho/foto.jpg BASE=http://localhost:3102 \
node scripts/e2e/verify-flair-led-borders.mjs work/flair-evidencias
```

O script intercepta a API e a renovação de sessão exclusivamente no contexto de teste. `PLAYWRIGHT` e `CHROMIUM_EXECUTABLE_PATH` permitem indicar instalações existentes.

### Revisão final

A regra dinâmica da borda passou a pertencer ao Metamorfose: precisa de um modo Metamorfose selecionado e Hype ativo. As capturas anteriores documentam a versão anterior do fluxo; o teste unitário foi atualizado e o script reproduzível exige PRISMA. O servidor local interrompeu durante a captura das seis novas composições; apenas `preset-satin-ivory.png` foi obtida, sem certificar as demais no navegador. O reinício foi bloqueado pela revisão automática por limite de uso.

Foram regeneradas as fontes dos cinco tipos de diagramas (360 reescritas entre 369 arquivos processados) e renderizados 363 PlantUML sem erros. Diagramas sem correspondência implementada continuam explicitamente marcados como históricos.

Validação final: 55 testes de frontend (14 arquivos), 10 testes de BackgroundStudioService, dois testes Python da curadoria, TypeScript, estilos e verificação de i18n passaram. Sem teste de desempenho de produção.

### Capturas retomadas

Após restabelecer o servidor, as seis composições editoriais foram verificadas no navegador, sem erros JavaScript (`curated-browser-result.json`). O roteiro reproduzível FLAIR/bordas/Metamorfose foi executado novamente com a regra final: Hype e Metamorfose PRISMA ativos, score 84 → 89 → 82 e pulso que expira. As imagens das bordas e das quatro modalidades foram atualizadas. A API continua simulada; isto não prova resgate de selos.

| Composição | Captura |
|---|---|
| Cetim editorial | [Foto](preset-satin-ivory.png) |
| Cromo líquido | [Foto](preset-liquid-chrome.png) |
| Electro ciano | [Foto](preset-cyan-thread.png) |
| Electro rosé | [Foto](preset-rose-thread.png) |
| Splash violeta | [Foto](preset-violet-ink.png) |
| Splash coral | [Foto](preset-coral-ink.png) |

**Ainda sem comprovação fotográfica neste PR:** criadores de selos e cupons, resgate promocional, destaques de perfil, resgate Hype e jogos CBC exclusivos.
