# Recomendação de tamanho por produto — MVP

O módulo usa a tabela real e revisada de um produto adulto do catálogo, nas famílias `TSHIRT` e `JEANS`. Não há tabelas ou medidas de demonstração inseridas pela V78. `/fit` permite guardar/apagar medidas privadas e abrir um produto por ID; `ProductFitDialog` permite integrar a comparação ao catálogo. Nenhuma imagem/avatar é usada como medida ou como prova de caimento.

## Configuração e privacidade

`fashionai.fit.enabled` é `true` por padrão; configure `false` para interromper o piloto preservando dados. O módulo reutiliza `DATA_ENCRYPTION_KEY` e o conversor AES-GCM existentes. A gravação de medidas falha com `503 FIT_ENCRYPTION_UNAVAILABLE` se a chave existente não estiver disponível; não há chave nova, fallback em texto aberto ou alteração da chave antiga. Medidas e protocolos permanecem privados e respostas pessoais usam `Cache-Control: no-store`.

Cada pessoa acessa apenas seu perfil, recomendações e feedback, inclusive se tiver papel admin. Apagar medidas também apaga seu histórico de recomendações e feedback. O hook `FitAccountDataCleanup` também remove os dados ao expurgar uma conta, mesmo com o piloto desligado. Exclusão física de conta remove essas linhas por FK com `CASCADE`; nenhuma nova projeção de feed ou card recebe esses dados. Resultados persistidos incluem razões e versões, mas não os valores das medidas privadas.

## Fonte e protocolo

Uma tabela é cadastrada pelo `PUT /api/catalog/products/{id}/size-chart` ou pelo editor JSON do diálogo quando `canEdit=true`. Só admin ou perfil MARCA ativo, e-mail confirmado e vinculado à marca responsável pelo produto pode publicar. O produto deve ter `ageGroup=ADULT`, categoria/subcategoria `upper_piece/t_shirt` para `TSHIRT` ou `lower_piece/jeans` para `JEANS`. Tabela legada com família incompatível causa abstenção `INCOMPATIBLE_CHART`. Fonte HTTP(S), nome, revisão, data, prazo de validade, mercado e autorização explícita são obrigatórios. A publicação representa revisão declarada pela pessoa autorizada; não é extração automática ou certificação externa.

O corpo do PUT é `{ "expectedVersion": null, "chart": ... }` para criar; em atualizações, `expectedVersion` deve ser a versão retornada na leitura. `chart` possui:

| Campo | Contrato |
| --- | --- |
| `type` | `BODY_RANGE` ou `GARMENT_MEASUREMENT` |
| `family` | `TSHIRT` ou `JEANS`, adultos |
| `market` | Mercado da fonte, até 20 caracteres |
| `sourceName`, `sourceUrl`, `sourceRevision` | Identificação e URL da fonte autorizada |
| `sourceDate`, `validUntil` | Instantes ISO-8601; fonte não futura e validade futura |
| `sourceAuthorized` | `true`, somente após revisar autorização |
| `options` | Até 40 opções; `label` original único, `order` inteiro único e `measurements` |
| `measurements` | Até cinco pontos únicos por opção: `region`, `protocol`, `min`, `max`, todos em cm |
| `easeByPreference` | Opcional em cada dimensão: `SLIM`, `REGULAR`, `LOOSE`, cada um com `min`/`max` em cm. A folga deve vir da fonte; não há constante universal |

As opções devem cobrir os mesmos pontos e protocolos. Não se ordenam tamanhos por texto P/M/G ou números regionais. Faixas corporais com protocolos `BODY_*` e medidas da roupa com `GARMENT_*` não são intercambiáveis.

| Protocolo | Significado aceito |
| --- | --- |
| `BODY_CIRCUMFERENCE_V1` | Perímetro corporal horizontal, sem comprimir: `CHEST` na parte mais larga do tórax; `WAIST` na cintura natural; `HIP` na parte mais larga; `THIGH` na parte mais larga de uma coxa |
| `GARMENT_CIRCUMFERENCE_V1` | Perímetro completo de uma roupa nos pontos da fonte. Comparar com corpo exige folga por preferência explicitamente declarada na dimensão |
| `GARMENT_FLAT_WIDTH_V1` | Largura de borda a borda da roupa estendida sem esticar; só compara com roupa de referência com o mesmo protocolo |
| `BODY_LENGTH_V1` | Apenas `INSEAM`: linha interna da entreperna até o osso interno do tornozelo; a fonte deve declarar exatamente esses pontos |
| `GARMENT_LENGTH_V1` | Apenas `INSEAM`: costura interna da entreperna até a barra; compara apenas com roupa de referência com os mesmos pontos |

Comprimento nunca se compara com perímetro; largura plana nunca é multiplicada para adivinhar circunferência. A ausência de `THIGH` numa tabela não cria uma medida de coxa inferida. Folga negativa/elasticidade e protocolos de fonte diferentes dos definidos acima ficam fora do piloto: não publicar a tabela como compatível. Não há suporte a tabelas infantis ou por variante nesta entrega.

## Motor e retorno

`BODY_RANGE` exige que cada medida corporal esteja na faixa da fonte. A preferência é registrada, mas não altera faixas corporais. Em `GARMENT_MEASUREMENT`, roupa de referência usa o mesmo protocolo; comparação roupa/corpo só aceita perímetro completo e folga não negativa explicitamente declarada para a preferência. Todas as dimensões de uma opção precisam atender; nenhuma aproximação percentual escolhe o tamanho.

Estados: `RECOMMENDED`, `AMBIGUOUS`, `NO_CHART`, `CHART_EXPIRED`, `INCOMPATIBLE_CHART`, `INSUFFICIENT_MEASUREMENTS`, `INCOMPATIBLE_PROTOCOL`, `NO_COMPATIBLE_SIZE`. Opções mostram razões por região (`WITHIN_RANGE`, `TIGHT`, `LOOSE`, ausência/protocolo/folga). `missingInformation` enumera pontos/protocolos/regra ausentes. `qualitativeEvidence` distingue comparação completa (`SOURCE_MATCH`), empate (`AMBIGUOUS_SOURCE_MATCH`) e evidência insuficiente; não é probabilidade de acerto. A regra `fit-adult-v1`, revisão da tabela, versão do perfil e prazo acompanham o retorno. Resultados expiram em no máximo 30 dias, ou antes se a tabela vencer; mudanças de tabela/perfil tornam resultados anteriores `stale`.

Feedback privado usa `TIGHT`, `COMFORTABLE` ou `LOOSE` por região do tamanho provado. A próxima comparação mostra `priorExperience`: avaliação própria mais recente por tamanho, limitada ao mesmo produto e mesma revisão de tabela, com fonte `SAME_PRODUCT_SAME_CHART_SELF_REPORTED`. Esse alerta auxilia a interpretar a sugestão sem modificar as faixas da marca. Não há aprendizado estatístico automático, uso de dados de outros compradores, verificação automática de compra ou garantia de devolução reduzida.

## API autenticada

- `GET /api/fit/config` — estado do piloto e versão de regra.
- `GET/PUT /api/catalog/products/{id}/size-chart` — produto visível no catálogo; alteração restrita à autoridade acima.
- `GET/PUT/DELETE /api/me/fit-measurements` — perfil próprio; GET sem perfil retorna 204. PUT recebe `expectedVersion`, `measuredAt` e `measurements` com `region`, `protocol`, `value`, `unit` (`CM`/`IN`). Normaliza polegadas com 2,54 cm. DELETE exige `expectedVersion` na query.
- `POST /api/catalog/products/{id}/size-recommendations` — `preference` e `requestKey` idempotente; lê medidas do usuário no servidor.
- `GET /api/size-recommendations/{id}` — autor, resultado e experiência própria aplicável.
- `POST /api/size-recommendations/{id}/feedback` — autor; `experienceKey` idempotente, `triedSize` presente na tabela da recomendação e mapa `regions`.
- `DELETE /api/fit-feedback/{id}` — autor.

Conflitos de versão ou reutilização divergente de chave retornam 409. IDs de dono e resultados calculados não são aceitos do cliente. Escritas de perfil, recomendação e feedback serializam pelo usuário para não duplicar comandos concorrentes. Tabelas têm versão otimista, revisão e auditoria do editor.

A interface reutiliza a chave de recomendação quando uma resposta falha; após sucesso, uma nova comparação usa uma nova chave e pode atualizar um resultado desatualizado. O mesmo vale para tentativas de envio de uma avaliação sem alterar seu conteúdo. Ao fechar o diálogo de um produto em `/fit`, o perfil privado é relido para refletir medidas alteradas ou apagadas dentro do diálogo.

## Validação

`FitEngineTest` cobre ausência/expiração, protocolos, empate, ordem declarada, roupa de referência, folga explícita e distinção de coxa/entreperna. `FitServiceTest` cobre dono/admin, marca errada, ausência sem dado inventado, polegadas, versão, exclusão, família real do catálogo e histórico limitado ao próprio produto/revisão. `FitAccountDataCleanupTest` cobre expurgo na ordem das dependências.

Os 11 cenários de `components/fit/ProductFitDialog.test.tsx` cobrem ausência sem pedir medidas, diálogo fechado, fonte/abstenção/retry idempotente, nova chave após comparação concluída, consentimento/exclusão, separação de protocolos, coxa e entreperna, evidência qualitativa/experiência anterior, envio idempotente e exclusão de feedback, publicação autorizada com versão e releitura do perfil ao fechar o diálogo. Nenhum teste com fixture demonstra acerto de caimento real; esse resultado depende de piloto com tabelas autorizadas e prova por pessoas.
