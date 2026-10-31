# Módulo 13 — IA (Copilot, Autopilot, Lens e governança): lote LENS-SCAN-PROVENANCE-001

Base: `bcaee73` (main após PR #416). Branch: `gof/13-ia`. `git status --short` limpo antes do lote.

## Mapeamento real do fluxo (Lens, criação de scan)

`app/(site)/(app)/lens/page.tsx` (câmera/galeria; rostos borrados no aparelho, envia `redactionConfirmed`)
→ `LensController` (`POST /api/lens/scans` multipart e `POST /api/lens/scans/from-app`, `fai-web`)
→ `LensService.create` / `fromApp` (`@Transactional`: `Guard.requireCanCreate`, origem/intenção, `ImageOps`, cota diária
`RateLimitPort` bucket `lens:scan`)
→ `LensService.process` → `MultiPieceService.detectPieces` (núcleo do cadastro de várias peças, pelo `AiEngine`:
consentimento, cota, orçamento e fallback local; devolve `PieceDetection` com o `AiOutcome` governado)
→ **`LensScanProvenance`** (novo, puro: proveniência, estado, motivo de degradação, ordem de leitura, linha por peça)
→ `LensScanRepository`/`LensDetectionRepository` + `MediaStoragePort` (`restricted/users/{id}/lens/…`, JPEG sem metadados)
→ `LensViews.ScanView` (`status`, `errorCode`, `aiSource`, `algorithmVersion`, `modelVersion`, detecções, leitura).

Outros pontos do domínio inspecionados e não alterados: `CopilotService` (1419 linhas, léxico/intenções e montagem de
looks), `AutopilotService` (683), `InsightsController`/`insights/*`, `AiOutcome`/`AiCallResult`.

## Problema concreto e decisão

`LensService` (1427 linhas, congelado) misturava em `process()` a regra de governança da inferência — falha do detector
vira `FAILED` (nunca sucesso fictício), sem peças vira `NO_FASHION_FOUND`, leitura local só explica `CONSENT_REQUIRED`/
`QUOTA`, `aiSource`, `aiInferenceId`, `modelVersion` (detector+embedder, truncada a 160) e ordem de leitura — com
gravação no repositório, storage e devolução da cota. Essas regras eram estáticas soltas dentro do serviço, sem teste
isolado (o `LensServiceTest` cobria só dois casos pelo fluxo completo).

Decisão: extrair a tradução "resultado do detector → proveniência do scan + linhas de peça" para
`LensScanProvenance` (package-private, final, só estáticos puros): `localDetection`, `stamp(scan, det)`,
`degradedReason`, `modelVersion`, `readingOrder`, `fromDetected`. `LensService.process` continua dono da transação, da
decisão de mandar ou não a foto para a IA externa (`redactionConfirmed || inApp`), da captura da exceção do detector,
das gravações, do storage e de `rateLimit.release` quando o detector falha.

### Padrões avaliados e não aplicados

- **Adapter (detector → Lens):** a classe faz uma tradução de contrato, mas há um único detector e um único alvo; uma
  interface `Target` + implementação seria abstração artificial. Ficou função pura ("padrão não aplicado").
- **Strategy (seleção de provedor/fallback):** já resolvida no `AiEngine`/`MultiPieceService` (fora deste lote); o Lens só
  consome o `AiOutcome`.
- **State (status do scan):** são três estados finais decididos uma vez; não há transições/retries no Lens. Um `if` basta.
- **Chain of Responsibility (pré-validação):** a pré-validação de `create` tem 4 checagens com códigos distintos e
  ordem já clara; não há acumulação nem variação por tipo que justifique a cadeia.
- **Template Method / Facade / Proxy:** sem pipeline com especializações reais; `LensService` já é a fachada; cota e
  circuit-breaker já ficam em `RateLimitPort`/`AiEngine`.
- **Singleton:** nenhum manual; classe utilitária sem estado.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** da extração (`LensScanProvenanceCharacterizationTest`, 8 testes pelo `create` público com detector fake: IA ok com provedor/modelo/inferência e ordem de leitura; detector lança → `FAILED`/`local` + cota devolvida; sem peças; motivo local por consentimento/cota/erro/timeout/`ia`; foto sem confirmação do borrão nunca chama o detector; `modelVersion` com 160; linha da peça; cota pedida uma vez) + `LensServiceTest` existente | `mvn -B -o -pl fai-application -Dtest='LensScanProvenanceCharacterizationTest,LensServiceTest' test` | 26 testes, 0 falhas (`evidence/13-lens-provenance-baseline.log`) |
| Depois da extração + `LensScanProvenanceTest` (6 testes da unidade pura) + todos os testes do pacote `lens` | `mvn -B -o -pl fai-application -Dtest='LensScanProvenance*Test,Lens*Test' test` | 46 testes, 0 falhas (`evidence/13-lens-provenance-after.log`) |
| Consumidor HTTP (controller/segurança) | `mvn -B -o -pl fai-web -am -Dtest=LensAccessTest test` | 4 testes, 0 falhas (`evidence/13-lens-web-access.log`) |
| Catraca de linhas | `python …/scripts/refactoring/line_ratchet.py` | 0 violações nos arquivos tocados; `LensService` aparece como APERTAR 1427 → 1363. As 10 violações listadas são de arquivos de outros lotes já reduzidos na branch principal (base antiga da worktree) (`evidence/13-line-ratchet.log`) |

Sem banco, servidor, rede externa, IA real/paga, GPU ou Vertex: o detector é um mock Mockito determinístico. Nenhuma
imagem de pessoa é registrada em log (o único log do fluxo continua sendo `ex.toString()` do detector).

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `LensService.java` | 1427 | 1363 (−64; −4,5 %) |
| `LensScanProvenance.java` (novo) | — | 115 |
| Runtime combinado | 1427 | 1478 (+51: javadoc de governança e assinaturas) |
| `LensScanProvenanceCharacterizationTest.java` (novo) | — | 231 |
| `LensScanProvenanceTest.java` (novo) | — | 102 |

`LensService.round4` passou de `private` a package-private (usado pelo novo `fromDetected` e por `add`).

## Contratos preservados

URLs, DTO `LensViews.ScanView`, códigos `FAILED`/`NO_FASHION_FOUND`/`CONSENT_REQUIRED`/`QUOTA`, valores de `aiSource`,
formato de `modelVersion` e limite de 160, `algorithmVersion`, `@Transactional` de `create`/`fromApp`, regra de não
enviar foto sem confirmação do borrão à IA externa, devolução da cota só quando o detector falha, ordem de leitura,
JSON de caixa/confianças/embedding. Sem mudança de schema, migration, i18n ou configuração.

## Riscos e pendências do domínio 13

- `LensService` continua PARTIAL (1363 linhas): correções/adição de peça (`correct`/`add`), plano "Recriar" e o
  contexto por pedido (`Ctx`, com consultas a Hype/embeddings) ainda no mesmo bean. Próximo candidato: o `Ctx` como
  classe própria (carregamento preguiçoso por pedido), com caracterização de comunidade/visibilidade.
- `CopilotService` (1419) e `AutopilotService` (683) não foram tocados; `CopilotLexicon` já é a extração anterior do
  léxico. Candidato: montagem de sugestões de compra (`purchaseSuggestions`) como função pura.
- `LensServiceTest` (721, congelado) não foi alterado; os testes novos ficaram em arquivos próprios.
