# UML Actor Diagrams — Main Project Activities

This document provides **actor-focused UML use case diagrams** for each main activity of the SAI project, following the same style as your sample (actors outside the system boundary, use cases inside, with `<<include>>` and `<<extend>>` relations).

Main activities covered:
1. Create a new wardrobe piece.
2. Create and save an outfit card (scheme).
3. Run and monitor the 3D pipeline.

---

## 1) Main Activity: Create a New Wardrobe Piece

### Actors
- **End User**: fills item form and submits the new piece.
- **Brand Detection/Enrichment AI**: helps classify and enrich metadata.
- **Blender Worker**: receives optional 3D processing jobs.

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome

actor "End User" as User
actor "Brand Detection /\nEnrichment AI" as AI
actor "Blender Worker" as Blender

rectangle "SAI Platform" {
  usecase "Create Wardrobe Piece" as UC_CreatePiece
  usecase "Fill Item Metadata" as UC_FillMeta
  usecase "Upload Piece Image" as UC_UploadImage
  usecase "Validate Required Fields" as UC_Validate
  usecase "Persist Piece in Wardrobe" as UC_Persist
  usecase "Detect / Resolve Brand" as UC_Brand
  usecase "Prepare 2D Processing" as UC_Process2D
  usecase "Submit 3D Job" as UC_Submit3D
  usecase "Track Job Status" as UC_TrackJob
}

User --> UC_CreatePiece
UC_CreatePiece .> UC_FillMeta : <<include>>
UC_CreatePiece .> UC_UploadImage : <<include>>
UC_CreatePiece .> UC_Validate : <<include>>
UC_CreatePiece .> UC_Persist : <<include>>
UC_CreatePiece .> UC_Brand : <<include>>
UC_CreatePiece .> UC_Process2D : <<include>>
UC_Submit3D .> UC_CreatePiece : <<extend>>
UC_TrackJob .> UC_Submit3D : <<include>>

AI --> UC_Brand
Blender --> UC_Submit3D
Blender --> UC_TrackJob
@enduml
```

---

## 2) Main Activity: Create and Save an Outfit Card (Scheme)

### Actors
- **End User**: configures outfit slots, style, and metadata.
- **Outfit Interpretation AI**: optional prompt-based recommendation helper.

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome

actor "End User" as User
actor "Outfit Interpretation AI" as AI

rectangle "SAI Platform" {
  usecase "Create Outfit Card" as UC_CreateCard
  usecase "Select Piece by Slot" as UC_SelectSlots
  usecase "Configure Title / Style / Occasion" as UC_Metadata
  usecase "Generate Description with AI" as UC_GenAI
  usecase "Build OutfitCardData" as UC_BuildCard
  usecase "Validate Outfit Payload" as UC_ValidateCard
  usecase "Save Scheme" as UC_SaveScheme
  usecase "Save Scheme Items" as UC_SaveItems
  usecase "Render Outfit Card Preview" as UC_RenderPreview
}

User --> UC_CreateCard
User --> UC_RenderPreview
UC_CreateCard .> UC_SelectSlots : <<include>>
UC_CreateCard .> UC_Metadata : <<include>>
UC_CreateCard .> UC_BuildCard : <<include>>
UC_CreateCard .> UC_ValidateCard : <<include>>
UC_CreateCard .> UC_SaveScheme : <<include>>
UC_SaveScheme .> UC_SaveItems : <<include>>
UC_GenAI .> UC_CreateCard : <<extend>>

AI --> UC_GenAI
@enduml
```

---

## 3) Main Activity: Execute 3D Pipeline and Visualization

### Actors
- **End User**: requests generation and checks progress/results.
- **Blender Worker**: executes UV/model processing jobs.
- **Storage/CDN**: serves generated artifacts back to the app.

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome

actor "End User" as User
actor "Blender Worker" as Blender
actor "Storage / CDN" as Storage

rectangle "SAI Platform" {
  usecase "Start 3D Pipeline" as UC_Start3D
  usecase "Build Worker Payload" as UC_BuildPayload
  usecase "Submit Pipeline Job" as UC_SubmitJob
  usecase "Poll Job Status" as UC_Poll
  usecase "Handle Job Failure" as UC_Failure
  usecase "Attach Generated Asset URLs" as UC_AttachUrls
  usecase "Open 3D Viewer" as UC_OpenViewer
  usecase "Inspect Model and UV Result" as UC_Inspect
}

User --> UC_Start3D
User --> UC_OpenViewer
UC_Start3D .> UC_BuildPayload : <<include>>
UC_Start3D .> UC_SubmitJob : <<include>>
UC_Start3D .> UC_Poll : <<include>>
UC_Failure .> UC_Poll : <<extend>>
UC_Start3D .> UC_AttachUrls : <<include>>
UC_OpenViewer .> UC_Inspect : <<include>>

Blender --> UC_SubmitJob
Blender --> UC_Poll
Blender --> UC_Failure
Storage --> UC_AttachUrls
Storage --> UC_OpenViewer
@enduml
```

---

## Notes
- These are **actor/use-case diagrams** only (not sequence diagrams), intentionally matching the visual intent of your screenshot.
- If you want, I can generate a second version with stricter UML relation semantics (for example, avoiding `<<include>>` from optional technical substeps).
- These diagrams are ready to render in PlantUML-compatible tools.
