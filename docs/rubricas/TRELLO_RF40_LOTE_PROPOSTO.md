# Trello — lote RF40 (Avatar 3D) proposto em 29/09/2026

> Lote pronto para aplicar junto com o lote RF25–RF39 já autorizado (`TRELLO_RF25_RF39_DIFF_PROPOSTO.md`).
> Nada foi escrito no board: neste ambiente o conector do Trello está desconectado, as variáveis `TRELLO_*` não
> existem e a política de rede recusa `api.trello.com` (ver "Como destravar", abaixo).

## Origem

- Código: commits `dcb18ca` (sexo pelo rosto, nunca careca por engano, volume e cortes) e `4c48adc` (plano) na branch
  `claude/fashion-ai-interfaces-config-id7naj`.
- Plano: `docs/avatar3d/plano-cabelo-realista-e-acabamentos.md`.

## Operações

Aplicação: `python scripts/rubricas/aplicar_trello_rf40.py` (simulação) e, depois de revisar a saída,
`--apply`. Idempotente: compara critérios pelo texto e cards pelo título; não atribui responsável nem label.

### 1. HU-RF40

Se não existir, criar no **Product Backlog**:
`HU-RF40 — COMO usuário autenticado, POSSO gerar meu Avatar 3D a partir de uma foto, com corpo base, cabelo e roupa fiéis a mim, PARA usá-lo no provador, no quarto e na passarela`.
O card RF40 não é criado se não existir (o script avisa).

### 2. Critérios de aceite novos (checklist "Critérios de Aceite" da HU-RF40)

A numeração começa no próximo CA livre do RF40 no board (no teste com um board simulado com CA01–CA07: CA08–CA13).

| # | Critério |
|---|---|
| 1 | Dado uma foto com um rosto, quando o avatar é gerado, então o corpo base (feminino/masculino) é estimado no próprio aparelho; com certeza abaixo de 70% vale o sexo do cadastro; a pessoa troca em "Corpo base" e a escolha fica salva no modelo. |
| 2 | Dado que a foto mostra cabelo — inclusive loiro claro, cabelo da cor do fundo ou rosto pequeno na foto —, quando o avatar é gerado, então o avatar nunca sai careca; careca só quando o alto da cabeça mostra couro cabeludo liso. |
| 3 | Dado que a foto não permite decidir se há cabelo (escura, cortada, borrada), quando o avatar é gerado, então recebe cabelo suposto pelo corpo base, aviso "cabelo estimado" e os ajustes de corte e tom. |
| 4 | Dado o cabelo medido na foto, quando o avatar é exibido, então o volume (rente, normal, volumoso, muito volumoso) é aplicado ao cabelo 3D e mostrado junto do ajuste "Volume do cabelo" (100% = o medido). |
| 5 | Dado o avatar criado, quando a pessoa escolhe um corte (raspado, curto, topete, joãozinho, chanel, médio, longo), então só o corte muda — cor, tom e textura continuam os medidos ou os escolhidos. |
| 6 | Dado um avatar sem franja, quando é exibido de frente, então a linha do cabelo deixa a testa visível (5–6 cm acima da sobrancelha) e, nos cortes curtos, contorna a orelha. |

Evidência dos critérios 1–6 (implementados em `dcb18ca`): 56/56 acertos de sexo em 16 retratos rotulados e 40
variantes; todos os casos difíceis com cabelo deixaram de sair carecas, carecas reais continuam carecas; testes
`lib/avatar3d/sex-detect.test.ts`, `hair-volume.test.ts`, `hair-cut.test.ts`, `hair-tone.test.ts` e
`Avatar3dServiceTest` (corpo base no modelo).

### 3. Tarefas (checklist "Tarefas por área" da HU-RF40)

- `[QA] Conjunto de teste de cabelo (≥ 60 fotos com consentimento/licença) e bloqueio de "falso careca" no CI`
- `[FE] Cabelo longo por cima da roupa (não some sob a camiseta)`
- `[FE] Cabelo por fios: guias + fios + mechas, sombreamento de fio e níveis de detalhe`
- `[FE/ARTE] Biblioteca de 24–30 penteados, escolha automática e ajuste à silhueta medida`

### 4. Cards funcionais do plano (Product Backlog, sem responsável)

| Card | Seção do plano |
|---|---|
| `[RF40][QA] Nunca careca por engano: conjunto de teste e bloqueio no CI` | A2 |
| `[RF40][FE] Cabelo realista por fios (nível EA FC)` | A3 |
| `[RF40][FE/ARTE] Biblioteca de penteados ajustada à foto` | A3.2 |
| `[RF36][FE/BE] Especificação de construção da peça (gola, mangas, barra, costuras)` | B3 |
| `[RF36][FE] Gola, mangas, barra e costuras construídas em 3D` | B4 |
| `[RF36][FE/QA] Painéis de molde, foto das costas e relatório de fidelidade` | B5–B6 |

Cada card leva contexto, escopo, critérios de aceite mensuráveis e a seção do plano (texto completo no script).

## Como destravar a escrita (uma das duas vias)

1. **Conector do Trello (recomendado).** Reconectar em https://claude.ai/customize/connectors e abrir uma nova sessão.
   A escrita passa pelo conector e não depende da rede nem das variáveis deste ambiente. Com ele, os dois lotes
   (RF25–RF39 e RF40) são aplicados pelas mesmas regras: releitura do board, diff, escrita, releitura de conferência.
2. **Scripts do repositório.** Nas configurações do ambiente: adicionar `api.trello.com` aos domínios permitidos em
   *Network access* e cadastrar `TRELLO_API_KEY`, `TRELLO_TOKEN` e `TRELLO_BOARD_ID` como segredos (nunca no chat).
   Em seguida: `python scripts/rubricas/verificar_trello.py`, os dois scripts em simulação e, depois de revisar,
   `--apply`.
