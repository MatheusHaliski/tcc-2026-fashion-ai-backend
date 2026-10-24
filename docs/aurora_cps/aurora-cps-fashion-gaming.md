# AURORA — Adaptive Urban Reality Outfit & Response Architecture
## Sistema Ciberfísico Completo de Moda Inteligente com Gamificação

> Documento de Arquitetura e Conceito para o SAI-TCC-2026  
> Baseado nos fundamentos de Sistemas Ciberfísicos (CPS)

---

## 1. Visão Geral

AURORA é um sistema ciberfísico (CPS) onde cada peça de roupa funciona como uma interface bidirecional entre o corpo humano e o mundo digital. Diferente de wearables convencionais que acopla tecnologia *sobre* o tecido, AURORA integra computação, sensores e atuadores *no* tecido — tornando a vestimenta o dispositivo em si.

### O Loop de Feedback Fundamental

```
Corpo + Ambiente
      │
      ▼  [Percepção]
Sensores no Tecido
(biométrico, ambiental, postura, localização)
      │
      ▼  [Processamento]
IA Contextual + Motor de Jogos
(edge → nuvem híbrido)
      │
      ▼  [Atuação]
Tecido Responsivo
(cor, temperatura, háptico, compressão, LED)
      │
      ▼
Corpo + Ambiente (estado alterado)
      │
      └──────────────────────────────► (loop contínuo)
```

O ciclo é contínuo e em tempo real. O estado emocional do usuário altera a roupa; a roupa alterada muda como o ambiente e as pessoas reagem; essa reação altera o estado emocional — um CPS de segunda ordem onde o humano é parte integrante do loop.

---

## 2. Integração com o SAI Existente

O AURORA se conecta nativamente ao pipeline já estabelecido no SAI:

| Módulo SAI Atual | Extensão AURORA |
|---|---|
| `saiWardrobeItems` | Cada item recebe `aurora_capabilities[]` (quais sensores/atuadores suportados) |
| `saiPieceItems` | Peça física ganha `digital_twin_id` com estado em tempo real |
| `saiSchemes` (looks) | Schemes passam a incluir `aurora_game_mode` e regras de atuação |
| Pipeline 3D (Meshy/Blender) | Modelo 3D do item inclui zonas de sensor e atuador mapeadas no UV |
| Dress Tester 2D/3D | Preview mostra estado dinâmico da peça (cor atual, feedback háptico) |
| `saiUsers` | Perfil ampliado com `biometric_baseline`, `gaming_profile`, `health_history` |

---

## 3. Arquitetura de Hardware — Camada de Percepção

### 3.1 Sensores Integrados ao Tecido

#### Biométricos (corpo do usuário)

| Sensor | Material/Tecnologia | Posição na Peça | Dado Capturado | Taxa de Amostragem |
|---|---|---|---|---|
| Cardíaco (ECG/PPG) | Fios de grafeno condutivo | Torso (costelas, 2 eletrodos) | BPM + HRV (variabilidade) | 250 Hz |
| Galvânico cutâneo (GSR) | Eletrodos de Ag/AgCl flexíveis | Punho interno | Condutividade da pele → emoção | 32 Hz |
| Temperatura corporal | Termistores NTC em rede | 5 pontos: pescoço, peito, costas, axilas | Temperatura por zona | 1 Hz |
| Respiração | Fibra piezoelétrica PVDF | Faixa torácica | Taxa respiratória, amplitude | 50 Hz |
| EMG superficial | Eletrodos secos de carbono | Ombros, antebraços | Tensão muscular, gestos | 1000 Hz |
| Postura/Movimento | Acelerômetro + giroscópio (IMU 6-DOF) | 3 nós: ombro, cinto, tornozelo | Postura, passos, gestos | 100 Hz |

#### Ambientais (mundo ao redor)

| Sensor | Posição | Dado Capturado |
|---|---|---|
| UV (VEML6075) | Gola/ombro externo | Índice UV em tempo real |
| Qualidade do ar (SGP30) | Bolso/lapela | CO₂ eq., VOCs, PM2.5 |
| Temperatura ambiente + umidade (SHT40) | Costas, externo | Conforto térmico ambiental |
| Luz ambiente (TSL2591) | Gola | Luminosidade, temperatura de cor |
| Pressão barométrica (BMP390) | Cintura | Altitude, mudança climática |

#### Contextual (localização e interação social)

| Tecnologia | Dado Capturado |
|---|---|
| BLE 5.3 (scanner passivo) | Dispositivos próximos → detecção de pessoas conhecidas |
| NFC (tag no botão/zíper) | Ambiente (academia, escritório, show, hospital) via tap |
| UWB (Ultra-Wideband) | Distância precisa de outras peças AURORA (até 10 cm de precisão) |
| GPS integrado ao cinto | Localização para contexto e jogos de geolocalização |

### 3.2 Nó de Borda (Edge Node) por Peça

Cada peça AURORA embarca um microcontrolador dedicado:

```
ESP32-S3 (dual-core 240MHz, Wi-Fi + BLE)
├── Processador principal: fusão de sensores, ML embarcado (TFLite)
├── Coprocessador ULP: coleta contínua durante modo sleep
├── Flash 8MB: modelo de ML local + buffer de dados offline
└── Bateria: LiPo flexível 1000mAh + carregamento wireless (Qi)
    └── Autonomia: ~18h uso ativo, ~72h modo passivo
```

---

## 4. Arquitetura de Software — Camada de Processamento

### 4.1 Pipeline de IA em Três Níveis

```
[Peça — Edge]          [Smartphone]           [Nuvem SAI]
     │                      │                      │
Fusão de sensores      Motor de contexto      Digital Twin
ML embarcado           (agenda, GPS, social)  Modelo global
< 10ms latência        < 100ms latência       treinamento contínuo
```

#### Nível 1 — Edge (na peça, < 10ms)
- **Fusão de sensores**: Kalman filter combinando IMU + biométrico
- **Detector de emoção local**: Modelo TFLite 4-classes (calmo, estressado, animado, fatigado) com acurácia ≥ 87% baseado em HRV + GSR + respiração
- **Detector de gesto**: CNN 1D no EMG para reconhecer 12 gestos pré-definidos (usados no sistema de jogos)
- **Modo de falha local**: Se smartphone desconectar, peça opera com regras pré-programadas

#### Nível 2 — Smartphone (app SAI + AURORA, < 100ms)
- **Motor de Contexto**: Cruza dados da peça com calendário, GPS, histórico social
- **Gerenciador de Jogos**: Estado de sessão de jogo, regras, placar, eventos
- **Roteador de Atuação**: Decide quais atuadores acionar com base em emoção + contexto + jogo ativo
- **Cache de Perfil**: Preferências do usuário, baseline biométrico, histórico de conquistas

#### Nível 2 — Nuvem SAI (< 2s, operações não-críticas)
- **Digital Twin Service**: Estado persistente de cada peça, histórico de uso
- **Modelo de Personalização**: Retreino incremental do perfil emocional do usuário
- **Servidor de Jogos Multiplayer**: Sessões sociais, rankings globais, eventos de comunidade
- **Analytics de Saúde**: Tendências de longo prazo, alertas preditivos

### 4.2 Mapa Emocional — Modelo de Inferência

```
Entrada (12 features):
├── HRV (RMSSD, pNN50, LF/HF ratio)
├── GSR (nível base + pico de resposta)
├── Taxa respiratória + amplitude
├── Temperatura da pele (delta do baseline)
└── Score de postura (ângulo de coluna)

Saída (4 estados primários + intensidade 0.0-1.0):
├── 😌 CALMO       → tons azul/verde, temperatura neutra
├── ⚡ ANIMADO     → tons âmbar/coral, vibração rítmica suave
├── 😰 ESTRESSADO  → tons roxo escuro, compressão suave, háptico respiração
└── 😴 FATIGADO    → tons cinza/índigo, atuação mínima, alerta de descanso
```

---

## 5. Arquitetura de Hardware — Camada de Atuação

### 5.1 Atuadores Integrados ao Tecido

#### Visuais

| Atuador | Tecnologia | Efeito | Zonas |
|---|---|---|---|
| Mudança de cor | Tintura eletrocrômica (PEDOT:PSS em substrato têxtil) | Transição entre paletas de cor em 1.5s | Corpo inteiro, por setor |
| Padrões dinâmicos | Micro-LEDs (0.3mm, flexíveis) em painéis translúcidos | Animações, padrões, indicadores de jogo | Costas, mangas, peito |
| Brilho adaptativo | OLEDs orgânicos em fita têxtil | Efeito de brilho suave contornando peça | Bordas e costuras |

#### Térmicos

| Atuador | Tecnologia | Efeito | Zonas |
|---|---|---|---|
| Resfriamento ativo | Micro-módulos Peltier (2cm²) em rede | Redução de até 4°C local | Pescoço, pulsos |
| Aquecimento zonal | Fios de carbono resistivos | Aquecimento até 38°C | Costas, torso |
| Materiais de mudança de fase | PCM microencapsulado no tecido | Buffer térmico passivo ±3°C | Corpo inteiro |

#### Hápticos (Feedback Tátil)

| Atuador | Tecnologia | Efeito | Uso |
|---|---|---|---|
| Vibração focal | Atuadores LRA (Linear Resonant) 8mm | Pulso preciso, < 1ms rise time | Notificações, eventos de jogo, navegação |
| Pressão dinâmica | Micro-câmaras pneumáticas (silicone) | Compressão ajustável de 0-40 mmHg | Feedback de ansiedade, performance atlética |
| Onda de pressão | Sequência de câmaras pneumáticas | "Onda" ao longo do braço | Sinalização direcional, efeito imersivo em jogo |

#### Mecânicos

| Atuador | Tecnologia | Efeito |
|---|---|---|
| Ajuste de caimento | Liga de memória de forma Nitinol (fios embutidos) | Manga sobe/desce, gola abre/fecha — 3 posições programadas |
| Tensão adaptativa | Fios de spandex com tensão controlada | Ajuste de compressão muscular para performance |

---

## 6. Camada de Comunicação

### 6.1 Topologia de Rede

```
[Peça AURORA] ──BLE 5.3──► [Smartphone]
                                  │
                            Wi-Fi 6 / 5G
                                  │
                           [Backend SAI / Firebase]
                                  │
                    ┌─────────────┴──────────────┐
                [Digital Twin DB]         [Game Server]
```

### 6.2 Protocolo Peça-a-Peça (Mesh Social)

Quando dois ou mais usuários AURORA estão próximos (< 10m), peças formam uma rede mesh BLE direta:

```
[Peça A] ◄──── UWB (posição) + BLE (dados) ────► [Peça B]
              latência: < 5ms
              sem necessidade de internet
              → Habilita jogos offline entre usuários próximos
```

### 6.3 Requisitos Temporais

| Evento | Deadline Máximo | Justificativa |
|---|---|---|
| Feedback háptico (notificação) | 50ms | Percepção humana: atrasos > 50ms parecem "desconectados" |
| Mudança de cor por emoção | 2s | Transição gradual é esteticamente preferível a instantânea |
| Atualização de placar de jogo | 200ms | UX de jogos: > 200ms gera frustração |
| Sincronização Social Sync | 500ms | Dois usuários sentindo ao mesmo tempo |
| Alerta de saúde crítico | 100ms | Segurança (arritmia, hipotermia) |
| Upload para Digital Twin | 30s | Não-crítico, pode ser em batch |

---

## 7. AURORA GAMES — Sistema Completo de Gamificação

### 7.1 Filosofia do Design

Os sensores do tecido tornam-se **controladores de jogo naturais**: o corpo é o controle. Não é gamificação superficial com badges — é uma nova categoria de jogos onde **estados fisiológicos, gestos reais e contexto ambiental** são mecânicas de jogo de primeira classe.

```
Biométrica → Mecânica de jogo
Gestos do corpo → Comandos
Localização real → Mapa do jogo
Outros usuários AURORA → NPCs / aliados / inimigos
Ambiente real → Eventos do mundo do jogo
```

---

### 7.2 BIORHYTHM QUEST — O Jogo Principal

**Gênero**: RPG de aventura contínua (sempre em execução em background)  
**Premissa**: Você é um herói em uma jornada. Seu mundo do jogo reflete seu estado físico real.

#### Mecânicas Core

| Estado Biométrico | Evento no Jogo |
|---|---|
| FC < 65 BPM + HRV alto (calmo) | Zona de cura: HP regenera, mana acumula |
| FC 65-100 BPM (ativo/focado) | Zona de combate: dano aumentado em 30% |
| FC > 100 BPM + GSR alto (estressado) | Boss encounter: inimigo mais forte aparece — vencer = grande recompensa |
| Respiração lenta e profunda (5 ciclos) | Habilidade especial desbloqueada: "Foco Total" |
| Postura ereta por 30min | Bônus de XP passivo acumulado |
| Detecção de movimento rítmico (caminhada) | Mapa se expande, novos territórios revelados |

#### Gestos como Comandos (via EMG no antebraço)

| Gesto | Ação no Jogo |
|---|---|
| Punho fechado forte (EMG spike) | Ataque físico |
| Rotação de pulso horária | Ativar escudo |
| Toque dedo médio + indicador | Inventário |
| Extensão de braço + pausa 2s | Habilidade de magia |
| Dois tapas no peito (IMU + vibração) | Ativar mapa |
| Agachar rápido (IMU) | Esquivar |

#### Feedback do Jogo na Peça

| Evento no Jogo | Resposta na Roupa |
|---|---|
| Dano recebido | Pulso de vibração forte na costas + flash vermelho nos LED |
| Cura ativada | Onda de pressão suave do torso para os braços + verde pulsando |
| Level up | Onda de vibração da cintura até os ombros + explosão de cor âmbar |
| Boss iniciado | LED pulsando vermelho acelerado + compressão torácica gradual |
| Inimigo derrotado | Sequência háptica de "vitória" + display de XP nos LEDs |
| Zona de cura ativa | Temperatura da gola diminui levemente + azul calmo suave |

#### Progressão e Metajogo

```
Personagem do Jogador:
├── Nível 1-100 (XP por: BPM controlado, postura, passos, conquistas)
├── Classe: Guerreiro (alta FC), Sábio (alta HRV), Explorador (muitos passos)
├── Atributos:
│   ├── FORÇA     = picos de FC sustentados (exercício)
│   ├── SABEDORIA = HRV médio alto (controle emocional)
│   ├── AGILIDADE = passos/dia + qualidade do movimento
│   ├── VITALIDADE = temperatura corporal estável + boa respiração
│   └── CARISMA   = interações sociais com outras peças AURORA
└── Equipamentos = combinações de peças AURORA do seu guarda-roupa
    (um look inteiro equipado = bônus de atributos do outfit)
```

---

### 7.3 PULSE WARS — Batalha Biométrica Multiplayer

**Gênero**: PvP em tempo real  
**Jogadores**: 2–6 usuários AURORA próximos (< 50m) ou online  
**Premissa**: Sua fisiologia é sua arma. Quem controla melhor seu corpo, vence.

#### Modos de Batalha

**Modo CALMA** (Zen Duel)
- Ambos jogadores partem do mesmo BPM
- Vence quem conseguir reduzir mais o BPM e aumentar HRV em 3 minutos
- Estratégia: respiração, meditação, relaxamento muscular
- Peça exibe um gradiente de cor: quanto mais calmo, mais azul celeste

**Modo FOCO** (Concentration Arena)
- Ambos executam uma sequência de gestos exibidos nos LEDs da peça do oponente
- Quem erra menos gestos em 2 minutos vence
- EMG detecta tensão muscular desnecessária = penalidade
- Premia precisão sobre velocidade

**Modo RESISTÊNCIA** (Endurance)
- Os dois caminham/correm ao mesmo tempo
- Vence quem mantém a FC mais próxima da zona alvo (60-70% da FC máx)
- Componente tático: se você forçar demais, perde; se economizar demais, também perde
- GPS registra distância percorrida simultaneamente

**Modo SOCIAL SYNC** (Harmonia)
- Modo cooperativo: dois usuários tentam sincronizar suas biométricas
- Objetivo: FC dos dois a < 5 BPM de diferença por 60 segundos
- Ponto mais alto: respiração sincronizada (mesmo ritmo)
- Ambas as peças pulsam com a mesma cor quando sincronizadas
- Recompensa: XP bônus + token de "Harmonia" no perfil social

**Modo STORM** (Caos Controlado)
- Jogo de múltiplos rounds: cada round exige um estado biométrico diferente
  - Round 1: fique calmo enquanto a peça vibra e toca sons dissonantes
  - Round 2: eleve a FC para 80+ BPM rapidamente sem se mover
  - Round 3: mantenha respiração perfeitamente regular enquanto resolve puzzle mental
- Vence quem passa mais rounds

#### Visualização de Batalha nas Peças

```
Peça A (jogador 1)           Peça B (jogador 2)
┌─────────────────┐          ┌─────────────────┐
│  LED: HP = 80%  │◄──BLE──► │  LED: HP = 60%  │
│  Cor: azul      │          │  Cor: laranja   │
│  Háptico: suave │          │  Háptico: forte │
│  BPM: 62 ✓      │          │  BPM: 88 ✗      │
└─────────────────┘          └─────────────────┘
```

---

### 7.4 CHROMACITY — Jogo de Expressão e Moda Social

**Gênero**: Social/Criativo  
**Premissa**: Sua roupa conta uma história visual. A comunidade julga, vota e interage.

#### Mecânicas

**Daily Color Challenge**
- Às 7h, o app envia o "Desafio do Dia": uma paleta ou emoção alvo
- Exemplos: "Vista calma pura até o meio-dia", "Expresse energia urbana", "Harmonize com o clima de hoje"
- Seus sensores rastreiam se sua fisiologia + visual da peça combinam com o desafio
- Pontuação: autenticidade biométrica (você realmente estava calmo?) + voto da comunidade

**Look Battle**
- Dois usuários postam seus looks do dia (foto capturada automaticamente pelo app)
- Acompanhado do "biometric signature" do look: gráfico de HRV, temperatura média, GSR ao longo do dia
- Comunidade vota: qual look contou melhor história emocional?
- Vencedor recebe tokens de moda + destaque no feed

**Color Memory**
- Sistema registra a "cor emocional" de cada dia nos últimos 30 dias
- Gera um mosaico visual do seu mês: um calendário onde cada dia é uma cor que representa seu estado dominante
- Compartilhável como arte generativa no perfil social
- Insights: "Você tende a ser mais calmo às terças. Suas melhores reuniões são quando você usa tons azuis."

**Style Heritage**
- Cada peça AURORA acumula um histórico de estados que passou com você
- Uma jaqueta que você usou em seu melhor dia de trabalho ganha tag "Jaqueta da Vitória"
- Peças com histórico rico têm valor aumentado no mercado de segunda mão (integrado ao SAI)

---

### 7.5 URBAN HUNTER — Geolocalização e Mundo Real

**Gênero**: Aventura de geolocalização (tipo Pokémon GO mas com o corpo como sensor)

**Premissa**: O mundo físico tem camadas ocultas acessíveis apenas por quem usa AURORA e que domina seu estado biométrico.

#### Mecânicas Principais

**Portais de Emoção**
- Locais reais (café, parque, museu, academia) emitem "aura de emoção" detectável pelo NFC/BLE do ambiente
- Para ativar um portal, você precisa chegar ao local com o estado emocional correto
- Exemplos:
  - Museu exige "contemplação" (HRV alto, GSR baixo) → revela arte interativa no espaço via AR
  - Academia exige "energia" (FC acima de 90) → ativa boss fight especial
  - Parque exige "serenidade" (respiração < 12/min) → revela tesouro escondido

**Território de Cor**
- Cada bairro/área tem uma "cor dominante" determinada pela média das emoções dos usuários AURORA que passaram por lá
- Você "pinta" o território com sua cor emocional ao passar
- Bairros de cor diferente oferecem bônus: "Zona Azul" = +XP para meditação; "Zona Vermelha" = +XP para batalhas
- Visualização no mapa: heatmap emocional da cidade em tempo real

**Missões Climáticas**
- Quando UV index > 7: missão especial "Protetor Solar" — use AURORA com bloqueio UV ativo por 2h = recompensa
- Quando qualidade do ar ruim (AQI > 100): missão "Respirador Urbano" — dados do sensor ambiental = contribuição para mapa de poluição da cidade = XP cívico
- Chuva detectada (pressão cai): evento surpresa — "Tempestade" libera monstros raros no mapa

**AURORA Trails**
- Ao caminhar, você deixa um "rastro emocional" invisível no mapa, visível apenas para amigos AURORA
- Amigos podem seguir seu rastro e reviver sua jornada emocional do dia
- Locais com muitos rastros de emoções positivas viram "Pontos de Poder" no mapa

---

### 7.6 HEALTH SENTINEL — Jogo de Saúde Preventiva

**Gênero**: RPG de longevidade (sem fim)  
**Premissa**: Sua saúde é um personagem que você protege. Ameaças são reais, baseadas em dados biométricos.

#### Mecânicas de Proteção

**Guardiões do Corpo**
- Cada sistema do corpo tem um "Guardião" com HP próprio
- Guardião Cardíaco: se alimentado com HRV consistentemente alto → sobe de nível
- Guardião Pulmonar: respiração profunda diária → recompensa
- Guardião Neural: sono de qualidade detectado (HRV noturno) → bônus matinal

**Ameaças e Eventos**

| Detecção Biométrica Real | Evento no Jogo |
|---|---|
| BPM em repouso aumentando por 3 dias | "Invasão de Estresse" — missão de gerenciamento |
| Temperatura corporal > 37.5°C | "Dragão de Febre" aparece — alerta real + missão de recuperação |
| Postura ruim por > 1h | "Corrosão Postural" drena HP do Guardião Neural |
| GSR consistentemente alto todo dia | "Maré de Ansiedade" — missão especial de técnicas de respiração |
| FC muito baixa em exercício (< 50% FC max) | "Desafio de Intensidade" — missão de ativação |

**Sistema de Streak e Conquistas de Saúde**

```
Conquistas Permanentes (desbloqueiam skins de peça):
├── "Semana Zen"        → 7 dias com HRV médio > 50ms
├── "Corredor Urbano"   → 10.000 passos/dia por 30 dias
├── "Mestre da Postura" → 90% do tempo com postura correta por 14 dias
├── "Coração de Ferro"  → FC em repouso < 60 BPM por 30 dias
├── "Respirador Mestre" → Técnica de respiração 4-7-8 por 21 dias
└── "Social Healer"     → 10 sessões de Social Sync completas
```

---

### 7.7 Sistema de Progressão Global

#### Moeda do AURORA — "THREAD" (THR)

```
Fontes de THREAD:
├── Vencer Pulse Wars: 50-500 THR
├── Daily Color Challenge: 10-100 THR
├── Health Sentinel streak: 5 THR/dia
├── Urban Hunter portal descoberto: 20-200 THR
├── Social Sync completado: 30 THR
└── Conquistas especiais: 500-5000 THR

Uso de THREAD:
├── Comprar paletas de cor exclusivas para a peça
├── Desbloquear modos de jogo premium
├── Customizar gestos de controle
├── Skins de personagem no BioRhythm Quest
├── Boost de XP temporário
└── Trocar por desconto em peças AURORA físicas (integração SAI)
```

#### Ranking e Liga

```
Liga de Jogadores AURORA:
├── Liga Bronze  (0-999 XP/semana)
├── Liga Prata   (1000-4999 XP/semana)
├── Liga Ouro    (5000-14999 XP/semana)
├── Liga Platina (15000-39999 XP/semana)
└── Liga Diamante (40000+ XP/semana) — Top 1% global

Ranking por Dimensão:
├── Ranking de Calma (HRV médio global)
├── Ranking de Estilo (votos em Look Battle)
├── Ranking de Saúde (Guardião Level médio)
├── Ranking de Explorador (Portais descobertos)
└── Ranking Social (Social Syncs + conexões)
```

---

## 8. Digital Twin — Arquitetura de Dados

### 8.1 Estrutura do Gêmeo Digital por Peça

```typescript
interface AuroraPieceDigitalTwin {
  piece_id: string;               // referência ao saiPieceItems
  twin_id: string;
  created_at: Timestamp;

  // Estado físico atual
  physical_state: {
    color_zones: ZoneColor[];     // cor atual por zona do tecido
    temperature_zones: number[];  // temperatura atual por zona (°C)
    haptic_active: boolean;
    compression_level: number;    // 0-100%
    battery_level: number;        // 0-100%
    firmware_version: string;
    last_sync: Timestamp;
  };

  // Histórico de uso
  usage_history: {
    total_hours_worn: number;
    wash_count: number;
    actuator_cycles: ActuatorCycleLog[];
    sensor_calibration_date: Timestamp;
    carbon_footprint_kg: number;  // estimativa acumulada
  };

  // Dados de jogo associados
  game_data: {
    total_xp_generated: number;
    battles_participated: number;
    portals_activated: number;
    best_hrv_recorded: number;
    emotional_signature_30d: EmotionalDay[]; // mosaico mensal
  };

  // Saúde e sustentabilidade
  sustainability: {
    estimated_remaining_life_cycles: number;
    recommended_maintenance: string[];
    resale_value_estimate: number; // baseado em histórico
    eco_score: number;            // 0-100, baseado em uso responsável
  };
}
```

### 8.2 Estrutura do Perfil de Jogo do Usuário

```typescript
interface AuroraGamingProfile {
  user_id: string;               // referência ao saiUsers
  
  // Personagem
  character: {
    level: number;               // 1-100
    class: 'warrior' | 'sage' | 'explorer' | 'hybrid';
    xp: number;
    xp_to_next_level: number;
    attributes: {
      strength: number;          // baseado em picos de FC sustentados
      wisdom: number;            // baseado em HRV médio
      agility: number;           // baseado em passos e movimento
      vitality: number;          // baseado em estabilidade biométrica
      charisma: number;          // baseado em interações sociais
    };
    achievements: Achievement[];
    unlocked_skins: string[];
  };

  // Biométrica basal (calibrada nas primeiras 2 semanas)
  biometric_baseline: {
    resting_hr: number;          // BPM em repouso
    hrv_baseline: number;        // RMSSD médio
    skin_temp_baseline: number;  // temperatura basal da pele
    stress_threshold_gsr: number; // nível de GSR que indica stress para este usuário
    calibrated_at: Timestamp;
    recalibration_due: Timestamp;
  };

  // Jogos
  pulse_wars: {
    rank: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
    mmr: number;                  // matchmaking rating
    wins: number;
    losses: number;
    win_streak: number;
    favorite_mode: string;
  };

  currency: {
    threads: number;              // THR acumulado
    threads_lifetime: number;
  };
}
```

---

## 9. Propriedades Críticas do CPS

### 9.1 Tempo Real

| Subsistema | Deadline | Estratégia |
|---|---|---|
| Feedback háptico crítico (saúde) | 50ms | Processamento 100% na peça (edge), sem round-trip |
| Eventos de jogo visuais (LED) | 100ms | BLE direto peça→peça em mesh local |
| Sincronização multiplayer | 200ms | Servidor de jogo com low-latency UDP + WebSocket |
| Atualização Digital Twin | 30s | Batch assíncrono, não-crítico |

### 9.2 Safety (Segurança Física)

- Corrente máxima no corpo: **< 1mA** (norma IEC 60601-1 para dispositivos médicos de contato)
- Temperatura máxima dos atuadores: **40°C** (limiar de queimadura: 45°C, margem de 5°C)
- Pressão máxima pneumática: **40 mmHg** (acima = risco de trombose venosa)
- Failsafe: se a peça perder comunicação por > 5s, todos os atuadores retornam ao estado neutro automaticamente
- Watchdog timer embarcado: reinicia o sistema se loop principal travar por > 500ms

### 9.3 Cibersegurança

- **Dados biométricos**: criptografia AES-256 end-to-end; nunca enviados em plaintext
- **Dados de jogos**: separados dos dados de saúde em namespaces distintos no Firestore
- **Perfil emocional**: armazenado localmente por padrão; opt-in explícito para nuvem
- **Comunicação BLE**: pairing por ECDH, sessão com chave efêmera por conexão
- **Digital Twin**: isolamento por user_id; sem acesso cross-user por padrão

### 9.4 Confiabilidade e Modos de Falha

| Modo de Falha | Impacto | Mecanismo de Tolerância |
|---|---|---|
| Sensor biométrico falha | Dados incompletos | Fusão degrada graciosamente: usa sensores disponíveis, notifica usuário |
| BLE cai (peça ↔ phone) | Jogo pausa, atuação para | Peça opera com último estado + regras locais por 5min |
| Internet indisponível | Multiplayer offline | Modo local ativado; dados sincronizam quando reconectar |
| Bateria < 10% | Funcionalidade reduzida | Atuadores desligam; sensores continuam; notificação de carregamento |
| Servidor de jogos down | Multiplayer indisponível | Modo solo continua; fila de ações sincroniza depois |
| Falha de atuador (PCM, Peltier) | Feature perdida | Sistema detecta via self-test na inicialização; desabilita zona; continua |
| Firmware corrompido | Peça não inicializa | Bootloader de recovery na memória protegida; atualização OTA forçada |

---

## 10. Integração com o Pipeline 3D do SAI

### 10.1 Extensão do Pipeline Existente

O pipeline de ingestão de peças (Stages A-D do `markdowns/DRESS_TESTER_PIPELINE_OUTLINE.md`) ganha uma Stage E:

**Stage E — Mapeamento AURORA**
1. A partir do modelo `.glb` gerado na Stage C, identificar zonas anatômicas da peça
2. Gerar `aurora_zone_map.json`: mapeamento de cada zona do tecido para tipo de sensor/atuador suportado
3. Simular o visual da peça em diferentes estados de cor no Dress Tester 3D
4. Publicar preview dinâmico: o usuário pode ver a peça mudando de cor no manequim virtual

```json
{
  "piece_id": "piece_abc123",
  "aurora_capabilities": ["electrochromic", "haptic", "thermal_passive"],
  "zones": [
    {
      "zone_id": "torso_front",
      "area_cm2": 420,
      "sensor_types": ["ecg", "gsr", "temperature"],
      "actuator_types": ["electrochromic", "led_micro"],
      "uv_coords": [[0.1, 0.2], [0.5, 0.8]]
    },
    {
      "zone_id": "left_sleeve",
      "area_cm2": 180,
      "sensor_types": ["emg", "imu"],
      "actuator_types": ["haptic_lra", "pneumatic"],
      "uv_coords": [[0.6, 0.1], [0.8, 0.6]]
    }
  ]
}
```

---

## 11. User Stories Prioritizadas para Implementação

### Épico AURORA Core

**HU-AU01 — Onboarding Biométrico**
> **Como** novo usuário AURORA  
> **Posso** realizar calibração biométrica inicial (14 dias)  
> **Para** que o sistema aprenda minha linha de base e as inferências de emoção sejam personalizadas

**HU-AU02 — Mapa Emocional em Tempo Real**
> **Como** usuário com peça AURORA ativa  
> **Posso** visualizar meu estado emocional atual no app  
> **Para** ter autoconsciência e ver como a peça está respondendo

**HU-AU03 — Controle Manual de Atuação**
> **Como** usuário  
> **Posso** sobrescrever qualquer atuação automática pelo app  
> **Para** ter controle total sobre minha peça quando a automação não for desejada

### Épico AURORA Games

**HU-AU04 — Iniciar BioRhythm Quest**
> **Como** usuário  
> **Posso** ativar o modo BioRhythm Quest  
> **Para** ter minha jornada de RPG contínua rodando em background durante o dia

**HU-AU05 — Desafiar outro usuário no Pulse Wars**
> **Como** usuário  
> **Posso** convidar outro usuário AURORA próximo ou online para uma batalha biométrica  
> **Para** competir de forma gamificada usando meu controle fisiológico

**HU-AU06 — Participar do Daily Color Challenge**
> **Como** usuário  
> **Posso** ver o desafio de cor/emoção do dia e ter minha performance rastreada automaticamente  
> **Para** engajar com a comunidade de forma criativa diariamente

**HU-AU07 — Explorar Portais no Urban Hunter**
> **Como** usuário com GPS ativo  
> **Posso** ver portais de emoção no mapa e ativá-los chegando ao local com o estado biométrico correto  
> **Para** explorar a cidade e desbloquear conteúdo exclusivo

**HU-AU08 — Ver Digital Twin da minha peça**
> **Como** usuário  
> **Posso** acessar o gêmeo digital de cada peça AURORA no meu guarda-roupa  
> **Para** ver histórico de uso, estado atual, conquistas associadas e valor de revenda estimado

### Épico AURORA Health

**HU-AU09 — Alerta de Saúde Proativo**
> **Como** usuário  
> **Posso** receber alertas discretos (háptico na peça + notificação) quando padrões preocupantes são detectados  
> **Para** tomar ação preventiva antes que se torne um problema

**HU-AU10 — Relatório Mensal de Mosaico Emocional**
> **Como** usuário  
> **Posso** visualizar e exportar meu mosaico emocional dos últimos 30 dias  
> **Para** ter insights sobre padrões de bem-estar e compartilhar como arte generativa

---

## 12. Roadmap de Desenvolvimento

### Fase 1 — Fundação Digital (Meses 1-3)
- [ ] Extensão do schema Firestore com coleções AURORA
- [ ] Simulador de sensores (para desenvolvimento sem hardware)
- [ ] Motor de contexto básico (calendário + GPS)
- [ ] UI de mapa emocional no app SAI
- [ ] Daily Color Challenge (modo software-only, sem hardware)

### Fase 2 — Protótipo de Hardware (Meses 4-6)
- [ ] Primeira peça AURORA com ESP32-S3 + sensores básicos (FC, IMU)
- [ ] Comunicação BLE estável peça ↔ app
- [ ] Primeiro atuador: vibração háptica (LRA)
- [ ] Calibração biométrica funcional
- [ ] BioRhythm Quest básico (sem gestos EMG)

### Fase 3 — Jogos Core (Meses 7-9)
- [ ] Pulse Wars 1v1 (modo Calma + modo Foco)
- [ ] Sistema de XP, THREAD e progressão
- [ ] Social Sync entre dois dispositivos
- [ ] Mosaico emocional mensal

### Fase 4 — Experiência Completa (Meses 10-12)
- [ ] Eletrocrômico funcional (mudança de cor real)
- [ ] Urban Hunter com geolocalização
- [ ] Digital Twin completo com histórico
- [ ] Integração com marketplace SAI (revenda com histórico de peça)

---

## 13. Referências Técnicas

- **Grafeno em têxteis**: Graphene-based smart textiles — *Nature Electronics*, 2023
- **Eletrocrômicos flexíveis**: PEDOT:PSS on textile substrates — *Advanced Materials*, 2022
- **HRV para detecção de emoção**: Valence-arousal model com biosignals — *IEEE Transactions on Affective Computing*, 2021
- **EMG para reconhecimento de gesto**: Surface EMG gesture classification — *Journal of NeuroEngineering*, 2020
- **Edge ML em vestimentas**: TFLite micro on ESP32 for biometric inference — *ACM MobiSys*, 2023
- **Segurança de dados biométricos**: GDPR/LGPD compliance for health wearables — *Privacy Law Review*, 2024
- **CPS — Fundamentos**: Helen Gill, *Cyber-Physical Systems*, NSF Workshop Report, 2006
- **Tempo Real em CPS médico**: Therac-25 post-mortem — Leveson & Turner, *IEEE Computer*, 1993
