# Diagramas Completos do Sistema (BPMN, UML e Banco de Dados)

Este documento consolida **todos os tipos principais de diagramas possíveis** para documentação de software no contexto deste projeto.

## 1) BPMN (Business Process Model and Notation)

### 1.1 BPMN — Cadastro e autenticação
```mermaid
flowchart TD
    A([Início]) --> B[Usuário abre tela de cadastro/login]
    B --> C{Possui conta?}
    C -- Não --> D[Preenche signup]
    D --> E[Validação de campos]
    E --> F{Dados válidos?}
    F -- Não --> D
    F -- Sim --> G[Criar usuário]
    G --> H[Enviar confirmação/verificação]
    H --> I[Login]
    C -- Sim --> I
    I --> J[Gerar sessão/token]
    J --> K([Fim])
```

### 1.2 BPMN — Adição e processamento de peça do guarda-roupa
```mermaid
flowchart TD
    A([Início]) --> B[Usuário envia imagem/dados da peça]
    B --> C[Normalização de imagem]
    C --> D[Segmentação e isolamento]
    D --> E[Análise IA de categoria/material/cor]
    E --> F{Gerar 2D/3D?}
    F -- 2D --> G[Persistir metadados + overlay]
    F -- 3D --> H[Submeter job worker 3D]
    H --> I{Job concluído?}
    I -- Não --> J[Reconsultar status]
    J --> I
    I -- Sim --> L[Salvar ativo 3D e vínculos]
    G --> M([Fim])
    L --> M
```

### 1.3 BPMN — Criação de esquema/look
```mermaid
flowchart TD
    A([Início]) --> B[Usuário inicia criação de scheme]
    B --> C[Seleciona peças por slot]
    C --> D[Motor valida compatibilidade]
    D --> E{Compatível?}
    E -- Não --> C
    E -- Sim --> F[Gerar descrição/arte opcional com IA]
    F --> G[Salvar scheme]
    G --> H[Publicar ou manter privado]
    H --> I([Fim])
```

### 1.4 BPMN — Busca e descoberta
```mermaid
flowchart TD
    A([Início]) --> B[Usuário abre discover/search]
    B --> C[Informa filtros/intent]
    C --> D[API consulta peças/schemes/usuários]
    D --> E[Rankeamento + paginação]
    E --> F[Exibir resultados]
    F --> G{Interagir?}
    G -- Favoritar --> H[Persistir favorito]
    G -- Abrir detalhe --> I[Exibir modal detalhado]
    G -- Encerrar --> J([Fim])
    H --> J
    I --> J
```

## 2) UML — Diagramas possíveis

### 2.1 Diagrama de Casos de Uso
```mermaid
flowchart LR
    U((Usuário))
    A((Admin))

    UC1[Autenticar]
    UC2[Gerenciar perfil]
    UC3[Adicionar peça]
    UC4[Processar peça com IA]
    UC5[Criar scheme]
    UC6[Explorar e buscar]
    UC7[Executar try-on 2D]
    UC8[Executar pipeline 3D]
    UC9[Gerenciar catálogos/marcas]

    U --- UC1
    U --- UC2
    U --- UC3
    U --- UC5
    U --- UC6
    U --- UC7
    U --- UC8

    A --- UC9
    A --- UC8
```

### 2.2 Diagrama de Atividades — Try-on 2D
```mermaid
flowchart TD
    A([Start]) --> B[Selecionar manequim]
    B --> C[Selecionar peça]
    C --> D[Resolver anchors e escala]
    D --> E[Renderizar overlay]
    E --> F{Ajuste manual?}
    F -- Sim --> G[Aplicar ajustes]
    G --> E
    F -- Não --> H[Salvar resultado]
    H --> I([End])
```

### 2.3 Diagrama de Sequência — Upload de peça
```mermaid
sequenceDiagram
    actor User
    participant UI
    participant API
    participant Service
    participant Repo
    participant Worker as Worker3D

    User->>UI: Envia imagem + metadados
    UI->>API: POST /api/add-piece
    API->>Service: processPiece(payload)
    Service->>Repo: create wardrobe_item
    Service->>Worker: submit job 3D (opcional)
    Worker-->>Service: job_id/status
    Service-->>API: item + status
    API-->>UI: 201 Created
    UI-->>User: confirmação
```

### 2.4 Diagrama de Estados — Pipeline 3D
```mermaid
stateDiagram-v2
    [*] --> CREATED
    CREATED --> QUEUED
    QUEUED --> RUNNING
    RUNNING --> RETRYING: erro recuperável
    RETRYING --> RUNNING
    RUNNING --> COMPLETED
    RUNNING --> FAILED: erro fatal
    FAILED --> [*]
    COMPLETED --> [*]
```

### 2.5 Diagrama de Componentes
```mermaid
flowchart LR
    UI[Frontend Next.js]
    API[API Routes]
    SVC[Camada de Serviços]
    REP[Repositórios]
    DB[(MySQL/Firestore)]
    AI[Provedores IA]
    W3D[Worker Blender/Meshy]

    UI --> API
    API --> SVC
    SVC --> REP
    REP --> DB
    SVC --> AI
    SVC --> W3D
```

### 2.6 Diagrama de Implantação
```mermaid
flowchart TB
    C[Cliente Web/Mobile] --> V[Vercel/Next Runtime]
    V --> A[API Routes]
    A --> D1[(MySQL)]
    A --> D2[(Firestore)]
    A --> E[OpenAI/Google/Adobe APIs]
    A --> W[Runpod/Worker Blender]
    W --> O[(Object Storage/Assets)]
```

## 3) Diagrama Lógico-Relacional de Banco de Dados

```mermaid
erDiagram
    USERS ||--o{ SCHEMES : creates
    USERS ||--o{ WARDROBE_ITEMS : owns
    USERS ||--o{ OUTFIT_FAVORITES : favorites

    BRANDS ||--o{ PIECE_ITEMS : classifies
    MARKETS ||--o{ SCHEMES : targets

    SCHEMES ||--o{ SCHEME_ITEMS : contains
    WARDROBE_ITEMS ||--o{ SCHEME_ITEMS : composed_of

    WARDROBE_ITEMS ||--o{ PIPELINE_JOBS : generates

    USERS {
      bigint id PK
      varchar email
      varchar name
      varchar password_hash
      datetime createdAt
    }

    BRANDS {
      bigint id PK
      varchar name
      varchar logo_url
      datetime createdAt
    }

    MARKETS {
      bigint id PK
      varchar name
      varchar region
    }

    WARDROBE_ITEMS {
      bigint id PK
      bigint user_id FK
      bigint brand_id FK
      varchar category
      varchar color
      varchar material
      varchar image_url
      varchar model_3d_url
      datetime createdAt
    }

    PIECE_ITEMS {
      bigint id PK
      bigint brand_id FK
      varchar name
      varchar category
      json metadata
    }

    SCHEMES {
      bigint id PK
      bigint user_id FK
      bigint market_id FK
      varchar title
      text description
      boolean is_public
      datetime createdAt
    }

    SCHEME_ITEMS {
      bigint id PK
      bigint scheme_id FK
      bigint wardrobe_item_id FK
      varchar slot_name
      int z_index
    }

    OUTFIT_FAVORITES {
      bigint id PK
      bigint user_id FK
      bigint scheme_id FK
      datetime createdAt
    }

    PIPELINE_JOBS {
      bigint id PK
      bigint wardrobe_item_id FK
      varchar status
      varchar provider
      text error_message
      datetime createdAt
    }
```

## 4) Diagrama de Classes do Sistema

```mermaid
classDiagram
    class User {
      +id: number
      +email: string
      +name: string
      +authenticate()
      +updateProfile()
    }

    class WardrobeItem {
      +id: number
      +category: string
      +color: string
      +material: string
      +process2D()
      +process3D()
    }

    class Scheme {
      +id: number
      +title: string
      +description: string
      +isPublic: boolean
      +addItem(item)
      +publish()
    }

    class SchemeItem {
      +id: number
      +slotName: string
      +zIndex: number
    }

    class PipelineJob {
      +id: number
      +status: string
      +provider: string
      +start()
      +retry()
      +complete()
      +fail()
    }

    class WardrobeService {
      +addItem()
      +processPiece()
      +retry3D()
    }

    class SchemesService {
      +createScheme()
      +listPublicSchemes()
      +addPieceToScheme()
    }

    class BlenderPipelineService {
      +submitJob()
      +getStatus()
      +reconcile()
    }

    class OutfitCardAiService {
      +generateDescription()
      +interpretIntent()
    }

    User "1" --> "*" WardrobeItem : owns
    User "1" --> "*" Scheme : creates
    Scheme "1" --> "*" SchemeItem : contains
    SchemeItem "*" --> "1" WardrobeItem : references
    WardrobeItem "1" --> "*" PipelineJob : generates

    WardrobeService ..> WardrobeItem
    SchemesService ..> Scheme
    BlenderPipelineService ..> PipelineJob
    OutfitCardAiService ..> Scheme
```

## 5) Observações
- Estes diagramas estão em formato Mermaid para versionamento no Git e fácil manutenção.
- Caso queira, posso também gerar versões em `.drawio` e/ou `.bpmn` separadas por processo.
