# Selos de Hype de marcas e celebridades

## Modalidade e critérios

O criador de selos admite uma política com `mode: "HYPE"` para os níveis `PECA` e `LOOK`. O emissor deve ser uma marca aprovada ou uma celebridade verificada, com conta ativa. Celebridades também precisam do consentimento institucional para emitir selos. A modalidade exige pelo menos um critério de Hype e não aceita um `referenceModel` simultâneo.

Exemplo de política:

```json
{
  "mode": "HYPE",
  "match": "ALL",
  "rules": [{ "brand": "Nike" }],
  "hype": {
    "minScore": 60,
    "dimensionMins": { "ENGAGEMENT": 70 },
    "momentum": ["RISING", "EMERGING"]
  }
}
```

As dimensões aceitas são `POPULARITY`, `ENGAGEMENT`, `TREND`, `TREND_VELOCITY`, `ORIGINALITY`, `RARITY`, `LONGEVITY`, `NOVELTY` e `INFLUENCE`. Os mínimos devem ser inteiros de 0 a 100. Todas as dimensões selecionadas devem ser atendidas; as opções de momento são alternativas. Para um selo de peça, os critérios de Hype são avaliados no score da peça. Para um selo de look, os critérios gerais usam o score do look; regras individuais de peça continuam usando os scores das peças.

O servidor usa o estado atual do HypeScore e a política normalizada para a avaliação. O pedido passa pelo `AiEngine.local` com `SEALBOND_MATCHER`, registrando uma inferência auditável. Não há chamada externa de IA nem previsão de crescimento para emitir esses selos.

## API e atribuição

- `GET /api/hype/PIECE/{pieceId}/seal-offers?page=0&size=12`
- `GET /api/hype/SCHEME/{schemeId}/seal-offers?page=0&size=12`
- `POST /api/hype/PIECE/{pieceId}/seal-offers/{sealId}/request`
- `POST /api/hype/SCHEME/{schemeId}/seal-offers/{sealId}/request`

A listagem devolve `items`, `total`, `page`, `size` e o resumo de Hype. A página é limitada a 24 ofertas, ordenadas por data de criação e ID. O GET consulta métricas em lote, não recalcula Hype e não grava vínculos. Entidades invisíveis retornam 404. Um look público não permite consultar a compatibilidade de políticas com peças privadas do guarda-roupa; essa avaliação fica disponível apenas a quem consegue ver todas as peças envolvidas.

Cada oferta traz `seal`, `eligible`, `reason`, `canRequest`, `requiresReview`, `requiredImageRightsConsent`, `issuerProfileUrl` e, para o autor, o vínculo já solicitado. Visitantes podem consultar ofertas de entidades visíveis; apenas o autor, com conta ativa e e-mail confirmado, pode solicitar a atribuição.

Para celebridade, o POST exige:

```json
{ "imageRightsConsent": true }
```

O pedido revalida aprovação do emissor, bloqueios entre usuários, disponibilidade e cota do selo, publicação/moderação da entidade, versão e atualização das métricas e todos os critérios da política. Métricas ausentes, insuficientes ou antigas não emitem selo. A peça ou o look e o selo recebem bloqueios de escrita antes da avaliação do pedido, serializando solicitações concorrentes. Marcas que dispensam revisão aprovam automaticamente; marcas com revisão e celebridades seguem para a fila do emissor. A aprovação na fila também reavalia as métricas.

## Persistência e telas existentes

A migração `V58__selos_hype_de_peca.sql` adiciona `piece_id` a `seal_bonds` e permite `scheme_id` nulo. Um CHECK exige exatamente um alvo e restringe alvos diretos de peça ao nível `PECA`. Os vínculos anteriores continuam usando `scheme_id`. Há uma chave estrangeira para o guarda-roupa e índice por peça/status.

O DTO do vínculo contém `schemeId` ou `pieceId`, além do resumo `piece` para títulos, foto e links na fila do emissor e em Meus Selos. Selos emitidos diretamente para uma peça aparecem no endpoint de medalhões e nos filtros do guarda-roupa, mesmo quando a peça não participa de um look. Excluir a peça revoga seus vínculos diretos; resgates anteriores permanecem registrados.

Os selos automáticos FashionAI (`VIRAL`, `TRENDING`, `EMERGING`, `CLASSIC`, `RARE`) continuam derivados do score e separados dessas campanhas. `sealProgress` mantém `code`, `earned` e `criteria` e acrescenta `available`, `publicEligible` e `requirements`: atual, meta, pontos faltantes, momentos/faixas aceitos, dimensões e alternativas `ALL`/`ANY`. As metas vêm da configuração do backend, sem interpretar frases traduzidas ou repetir limiares no frontend. Dados indisponíveis produzem valores atuais/faltantes nulos.

## Validação

57 testes Java passaram, abrangendo políticas, ofertas, privacidade, autor versus visitante, consentimento, aprovação do emissor, atualização das métricas, quota/período, atribuição e revisão, medalhões de peça isolada, filtro do guarda-roupa, exclusão de peça e equivalência entre metas estruturadas e regras dos selos automáticos. A suíte inclui regressões do Copilot de política de selo e indisponibilidade de IA externa.

A migração foi aplicada a MySQL 8.4.11 descartável, usando a definição original de `seal_bonds` e registros anteriores de peça/look. O teste confirmou preservação desses registros, inserção dos novos alvos, rejeição de alvo ausente/duplo/tier incorreto e chave estrangeira inválida, além da criação do índice. A evidência está em `docs/evidence/selos-hype-2026-10-09/mysql-migration.json`. Esse teste é específico da migração V58; a inicialização integral do backend executa também a cadeia completa do Flyway.

A validação integral também passou: backend Java 21 empacotado, 58 migrações Flyway aplicadas a um banco local vazio MySQL 8.4.11, API com saúde UP e consultas JPA executadas. Dois perfis fictícios confirmaram contadores em lote e restrição de perfil privado; a consulta de ofertas respondeu 200 sem oferecer selos para uma peça sem métricas. Não houve acesso ou alteração ao banco de produção. Evidência: [full-flyway-api.json](evidence/selos-hype-2026-10-09/full-flyway-api.json).
