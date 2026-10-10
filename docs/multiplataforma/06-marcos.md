# 06 — Marcos de implementação e estado

Estado em 10/10/2026. "Feito" só quando há código, teste ou artefato verificável neste repositório.

| # | Marco | Critério de aceite | Estado |
|---|---|---|---|
| 1 | Inventário web → celular → computador → console (telas, APIs, dados, assets) | `01-inventario-e-destino-das-telas.md` com as 55 rotas, APIs por área, dados e assets | **Feito** |
| 2 | Arquitetura, identidade, contratos e migração com compatibilidade | `02`; contratos novos no backend com testes; migração aditiva V55 | **Iniciado** — documento feito; implementados `GET /api/client/config`, `GET /api/me/avatar3d/canonical`, sessão do provador (`/api/try-on/session/**`), assets 3D de roupa com gate (`/api/admin/garment-assets/**`), 27 testes. Faltam: tipar respostas antigas no OpenAPI, ETag nos demais agregados, login por pareamento, atestado de app, bloqueios B1–B5 |
| 3 | Vertical slice instalável em iOS, Android, Windows, macOS: entrar → escolher peça → abrir provador Unreal → vestir o avatar → voltar mantendo o estado | builds instaláveis (TestFlight, faixa interna do Play, MSIX de teste, `.app` assinado) + gravação em aparelho real | **Esqueleto** em `clients/unreal/FashionAI/` (projeto, módulo, cliente HTTP da sessão do provador e do manifesto). **Não compilado** neste ambiente (Linux sem Unreal, sem Xcode, sem SDK Android) |
| 4 | Mesma conta, avatar e peça em ≥ 2 sistemas, incluindo reconexão e atualização concorrente | teste automatizado de contrato (feito no backend: `TryOnSessionServiceTest`) + teste manual em 2 aparelhos com gravação | **Parcial** — regra de concorrência testada no servidor; falta teste com clientes reais |
| 5 | Versão navegável por controle; builds PS5 e Xbox com acesso autorizado | navegação completa por controle no Windows (Xbox controller) e checklist de `04` §3; builds de console só com SDKs | **Não iniciado** — depende de contrato com Sony/Microsoft e acesso via Epic |
| 6 | Requisitos e artefatos de submissão por loja | `05` com checklists preenchidos por loja; contas, IDs, páginas, classificações, privacidade | **Planejado** — matriz feita; nada submetido |
| 7 | Capturas, gravações, medições, acessibilidade, arquivos alterados, custos e limitações | relatório com medições reais (modelo em `medicoes/TEMPLATE.json`) | **Não iniciado** (exige aparelhos). Custos e limitações em `07` |

## Ordem recomendada a partir daqui

1. Resolver **B1** (exclusão efetiva) e **B2** (mídia privada) — bloqueiam qualquer loja e valem também para o web.
2. Instalar UE 5.8 + Xcode 26 + Android SDK/NDK numa máquina de build (macOS para Apple; Windows para Windows/Android)
   e compilar o esqueleto de `clients/unreal`.
3. Importar `FAI_BODY_V1` (corpo MPFB2) e portar a deformação do rosto/corpo para C++; teste de identidade web × Unreal.
4. Ferramenta de importação de roupa (commandlet) que mede o gate; produzir 20 assets PATTERN para calibrar limites.
5. Vertical slice nos 4 sistemas; gravações; medições.
6. Abrir contas de loja (Apple, Google, Microsoft) e pedidos de acesso a console em paralelo — têm prazos próprios.

## Arquivos alterados neste marco

- `docs/multiplataforma/*` (novo)
- `fai-domain/.../model/TryOnSession.java`, `GarmentAsset3d.java`, `enums/TryOnSlot.java`, `enums/GarmentAssetStatus.java` (novos)
- `fai-domain/.../repository/TryOnSessionRepository.java`, `GarmentAsset3dRepository.java` (novos)
- `fai-infrastructure/persistence-mysql/.../V55__provador_multiplataforma.sql` (novo)
- `fai-application/.../multiplatform/*` (novo: `ClientPlatform`, `QualityProfile`, `ClientConfigService`,
  `AvatarCanonicalManifest`, `AvatarCanonicalService`, `GarmentFitGate`, `GarmentAssetService`, `TryOnSessionService`) e testes
- `fai-web/.../controller/MultiplatformController.java` (novo)
- `fai-web/.../config/SecurityConfig.java` (`/api/client/config` público; cabeçalhos `X-FAI-*`, `If-Match` e `ETag` no CORS)
- `clients/unreal/FashionAI/*` (novo, esqueleto)
