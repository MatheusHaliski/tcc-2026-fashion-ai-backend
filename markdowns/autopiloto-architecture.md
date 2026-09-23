# Autopiloto de Looks — Arquitetura Técnica

## 1) Visão geral

O Autopiloto de Looks é uma funcionalidade de sugestão contextual diária que cruza três
eixos de dados para gerar looks personalizados:

1. **Contexto externo** — temperatura e clima da cidade via API meteorológica.
2. **Contexto do usuário** — ocasião informada, humor, histórico de uso das peças.
3. **Preferências aprendidas** — pontuação acumulada pelo feedback de looks anteriores (HU19).

O resultado é um conjunto de três esquemas prontos, visualizados no manequim existente
(HU09), com possibilidade de salvar como look do dia e compartilhar (HU10).

---

## 2) Novas coleções Firestore

### `saiDailyLooks`
Registra o look do dia escolhido pelo usuário.

```
saiDailyLooks/{dailyLookId}
  user_id:      string
  date:         string          // "YYYY-MM-DD"
  scheme_id:    string          // referência ao esquema salvo
  occasion:     string          // "trabalho" | "casual" | "balada" | "academia" | "evento"
  mood:         string          // "disposto" | "cansado" | "confiante" | "criativo"
  weather_c:    number          // temperatura em Celsius no momento da geração
  city:         string
  feedback:     string | null   // "loved" | "used" | "skipped" | null (pendente)
  feedback_at:  Timestamp | null
  created_at:   Timestamp
```

### `saiOutfitPreferences`
Perfil de preferências aprendidas por usuário — atualizado a cada feedback.

```
saiOutfitPreferences/{userId}
  user_id:          string
  style_scores:     Record<string, number>   // ex: { "casual": 4.2, "formal": 1.8 }
  occasion_scores:  Record<string, number>
  piece_weights:    Record<string, number>   // wardrobe_item_id → peso de sugestão
  color_affinities: string[]                 // cores que recebem feedback positivo
  updated_at:       Timestamp
```

### `saiWeekPlans`
Planejamento semanal gerado (HU18).

```
saiWeekPlans/{weekPlanId}
  user_id:    string
  week_start: string          // "YYYY-MM-DD" (segunda-feira)
  days:       WeekPlanDay[]
  created_at: Timestamp

WeekPlanDay {
  date:      string
  occasion:  string
  scheme_id: string | null    // null = lacuna (peças insuficientes)
  gap_hints: string[]         // IDs de peças do catálogo sugeridas para preencher lacuna
}
```

---

## 3) Novos endpoints de API

### `POST /api/autopilot/daily`
Gera três sugestões de look para o dia.

**Request body**
```json
{
  "occasion": "trabalho",
  "mood": "confiante",
  "city": "São Paulo",
  "exclude_scheme_ids": []
}
```

**Response**
```json
{
  "suggestions": [
    {
      "scheme_id": "tmp-1",
      "title": "Look do Dia #1",
      "items": [...],
      "weather_fit_note": "Adequado para 18°C com chuva leve",
      "mannequin_preview_url": "..."
    }
  ],
  "weather": { "temp_c": 18, "condition": "rain", "city": "São Paulo" }
}
```

### `POST /api/autopilot/daily/confirm`
Salva o look escolhido como look do dia.

**Request body**
```json
{ "scheme_id": "tmp-1", "occasion": "trabalho", "mood": "confiante" }
```

### `PATCH /api/autopilot/daily/{dailyLookId}/feedback`
Registra avaliação do look.

**Request body**
```json
{ "feedback": "loved" }
```

### `POST /api/autopilot/week`
Gera planejamento semanal.

**Request body**
```json
{
  "week_start": "2026-05-25",
  "days": [
    { "date": "2026-05-25", "occasion": "trabalho" },
    { "date": "2026-05-26", "occasion": "casual" }
  ]
}
```

---

## 4) Novos serviços de backend

### `AutopilotService`
Orquestra a geração de looks contextuais. Responsabilidades:

- Busca peças do guarda-roupa do usuário (`WardrobeService`).
- Consulta perfil de preferências (`saiOutfitPreferences`).
- Chama `WeatherService` para obter temperatura e condição atual.
- Chama `OutfitRankingService` para pontuar e selecionar combinações.
- Descarta combinações em `exclude_scheme_ids` para evitar repetição imediata.
- Persiste o resultado temporário e retorna as sugestões ao cliente.

### `WeatherService`
Integração com API meteorológica pública (Open-Meteo — gratuita, sem chave).

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &current_weather=true
```

- Geocodificação por nome de cidade via Nominatim (OpenStreetMap, gratuito).
- Resultado em cache por 30 minutos no servidor para evitar chamadas excessivas.

Mapeamento de temperatura → categoria de vestuário:

| Faixa (°C) | Categoria |
|---|---|
| ≥ 28 | verão / leve |
| 18–27 | primavera/outono |
| 10–17 | outono / camadas |
| < 10 | inverno / pesado |

### `OutfitRankingService`
Pontua combinações candidatas com base em quatro critérios:

| Critério | Peso |
|---|---|
| Adequação à ocasião | 0.35 |
| Adequação ao clima | 0.25 |
| Preferências aprendidas (feedback histórico) | 0.25 |
| Diversidade de peças (evitar peças não usadas) | 0.15 |

- Gera combinações candidatas a partir do produto cartesiano de peças do guarda-roupa.
- Filtra combinações climaticamente inadequadas antes de pontuar.
- Retorna o top-3 para o Autopiloto diário.

### `PreferenceLearningService`
Atualiza `saiOutfitPreferences` após cada feedback recebido (HU19).

- **Feedback "loved"**: incrementa `style_scores`, `occasion_scores`, e `piece_weights` das peças do look.
- **Feedback "used"**: incremento moderado.
- **Feedback "skipped"**: decremento leve.
- Normaliza os scores após cada atualização para evitar drift ilimitado.

### `WeekPlanService`
Gera planejamento semanal sem repetição de combinação.

- Executa `OutfitRankingService` iterativamente dia a dia.
- Remove da candidatura as peças já fortemente utilizadas nos dias anteriores do plano.
- Detecta lacunas (dias em que não há combinação viável) e consulta o catálogo de marcas para sugerir peças complementares.

---

## 5) Integrações com serviços existentes

| Serviço existente | Como o Autopiloto usa |
|---|---|
| `WardrobeService.listUserWardrobe()` | Fonte de peças disponíveis para combinação |
| `SchemesService.createAiScheme()` | Persiste o look escolhido como esquema |
| `OutfitCardAiService` | Gera descrição textual do look sugerido |
| `SchemesRepository.findByUser()` | Recupera histórico de looks para evitar repetição |
| Manequim 3D (HU09) | Preview visual das sugestões ao usuário |
| Compartilhamento (HU10) | Compartilhar "look do dia" nas redes sociais |

---

## 6) Estrutura de arquivos novos

```
app/
  api/
    autopilot/
      daily/
        route.ts                  ← POST /api/autopilot/daily
        confirm/route.ts          ← POST /api/autopilot/daily/confirm
        [id]/feedback/route.ts    ← PATCH /api/autopilot/daily/:id/feedback
      week/
        route.ts                  ← POST /api/autopilot/week

  backend/
    controllers/
      AutopilotController.ts
    services/
      AutopilotService.ts
      WeatherService.ts
      OutfitRankingService.ts
      PreferenceLearningService.ts
      WeekPlanService.ts
    repositories/
      DailyLooksRepository.ts
      OutfitPreferencesRepository.ts
      WeekPlansRepository.ts

  (app-router pages)
  autopilot/
    page.tsx                      ← Tela do Autopiloto diário
    week/page.tsx                 ← Tela da Semana Planejada
    history/page.tsx              ← Histórico de looks e avaliações
```

---

## 7) Fluxo de dados — geração diária

```
[Usuário informa ocasião + humor]
        │
        ▼
AutopilotController.generateDaily()
        │
        ├── WeatherService.getCurrentWeather(city)
        │         └── Open-Meteo API → { temp_c, condition }
        │
        ├── WardrobeService.listUserWardrobe(userId)
        │         └── Firestore saiWardrobeItems
        │
        ├── PreferencesRepository.findByUser(userId)
        │         └── Firestore saiOutfitPreferences
        │
        └── OutfitRankingService.generateTop3(wardrobe, context, preferences)
                  │
                  └── [ SchemeCandidate, SchemeCandidate, SchemeCandidate ]
                              │
                              ▼
                    AutopilotController → response { suggestions[] }
```

---

## 8) Fluxo de aprendizado — feedback loop

```
[Usuário avalia: "loved" / "skipped"]
        │
        ▼
PATCH /api/autopilot/daily/{id}/feedback
        │
        ▼
PreferenceLearningService.applyFeedback(userId, dailyLook, feedback)
        │
        ├── Lê saiOutfitPreferences do usuário
        ├── Ajusta scores das dimensões do look (estilo, ocasião, peças)
        ├── Normaliza vetores de score
        └── Salva em saiOutfitPreferences
```

---

## 9) Variáveis de ambiente necessárias

```
# Geocodificação (Nominatim — sem chave, respeitar rate limit 1 req/s)
NOMINATIM_USER_AGENT="sai-tcc-2026/1.0"

# Cache de clima (Redis ou in-memory)
WEATHER_CACHE_TTL_SECONDS=1800

# Geração de looks
AUTOPILOT_MAX_CANDIDATES=50
AUTOPILOT_MIN_WARDROBE_PIECES=3
AUTOPILOT_TOP_N=3

# Feature flag
ENABLE_AUTOPILOT=true
ENABLE_WEEK_PLAN=true
```

---

## 10) Fases de implementação

### Fase 0 — Dados e repositórios (2–3 dias)
- Criar coleções `saiDailyLooks`, `saiOutfitPreferences`, `saiWeekPlans` no Firestore.
- Implementar os três repositórios.
- Atualizar `firestore.indexes.json` com índices compostos.

### Fase 1 — Serviços core (4–5 dias)
- `WeatherService` com geocodificação e cache.
- `OutfitRankingService` com os quatro critérios de pontuação.
- `AutopilotService` orquestrando diário e semanal.

### Fase 2 — APIs e controller (2–3 dias)
- Rotas de geração, confirmação e feedback.
- `AutopilotController` com validações de sessão.

### Fase 3 — Frontend (4–5 dias)
- Tela do Autopiloto diário com seleção de ocasião/humor.
- Preview dos três looks no manequim.
- Tela da Semana Planejada com visualização por dia.
- Componente de feedback (swipe/botões).

### Fase 4 — Aprendizado e refinamento (2–3 dias)
- `PreferenceLearningService` com feedback loop.
- Ajuste de pesos do `OutfitRankingService` com base em dados reais.

**Total estimado: 14–19 dias de desenvolvimento.**

---

## 11) Critérios de aceitação técnica

- Geração de três looks em < 2 segundos (excluindo primeira chamada de clima).
- Planejamento semanal de sete dias gerado em < 5 segundos.
- Após 10 feedbacks, sugestões devem divergir estatisticamente das sugestões iniciais.
- Nenhum look duplicado em um planejamento semanal.
- Fallback gracioso quando clima indisponível (sugestões sem filtro climático).
