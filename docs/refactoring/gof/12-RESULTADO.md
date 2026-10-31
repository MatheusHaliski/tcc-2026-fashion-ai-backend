# Módulo 12 — provador 2D/3D, avatar, assets e render: lote AVATAR3D-MODEL-RULES-001

Base: `bcaee73` (main após PR #416). Branch: `gof/12-provador`. `git status --short` limpo antes do lote.
Primeiro lote do domínio 12.

## Mapeamento real do fluxo (Meu Avatar 3D)

`app/(site)/(app)/avatar/page.tsx` (reconstrução do rosto/corpo no navegador, `lib/avatar3d/model.ts` valida no cliente)
→ `Avatar3dController` (`fai-web`): `GET|POST|PATCH|DELETE /api/me/avatar3d`, `POST /api/me/avatar3d/body-scan`,
`/stylized-portrait`, `GET /api/me/avatar3d/versions`, `POST …/versions/{version}/approve|restore`,
`GET /api/avatar3d/{userId}/texture`
→ `Avatar3dService` (`@Transactional`; consentimento LGPD art. 11, textura em `restricted/`, versões de identidade,
moderação, auditoria)
→ **`Avatar3dModelRules.validate`** / **`Avatar3dBodyRules.validate`** / **`Avatar3dBodyRules.publicModel`** (novos, puros)
→ `UserAvatar3dRepository`, `AvatarIdentityVersionRepository`, `MediaStoragePort`, `AiEngine` (moderação)
→ view `Map<String,Object>` → controller. `AvatarBodyScanService` (`body-scan`) reutiliza as faixas `BODY_RANGE` /
`BODY_DEPTH_RANGE`. Consumidores de manequim (`forMannequin`, provador/quarto) recebem `publicModel` para terceiros.

Provador (`TryOnService` 326, `TryOnSessionService` 289, `AnatomicalTryOnService` 121, `GarmentAssetService` 148) foi
lido para triagem e **não** alterado neste lote: o maior arquivo congelado do domínio era `Avatar3dService` (889).

## Problema concreto e decisão

`Avatar3dService` tinha 889 linhas, das quais ~300 (linhas 562–862) eram regras puras de validação do modelo enviado
pelo cliente — forma (468×3 pontos), pele, cabelo (13 campos opcionais), olhos/heterocromia, sobrancelhas/zonas — e do
corpo (faixas de proporção, profundidade de perfil, altura/peso, medidas de fita) mais o recorte de privacidade
`publicModel`. Essas regras não tocam repositório, storage, IA nem transação, mas estavam misturadas ao ciclo de
versões, moderação e textura, e `AvatarBodyScanService` dependia de constantes do bean inteiro.

Extração em duas classes package-private, sem Spring, por responsabilidade:

- `Avatar3dModelRules` (215 linhas): `validate` (antigo `validateModel`), `validBrows`, `validEyes`, `validTone`,
  `validOutline`, listas de valores e `MODEL_VERSION`/`SHAPE_LEN`/`HEX`. Delega o corpo a `Avatar3dBodyRules`.
- `Avatar3dBodyRules` (132 linhas): `validate` (antigo `validateBody`), `bounded`, `publicModel`, `BODY_RANGE`,
  `BODY_DEPTH_RANGE`, `BODY_SOURCES`, `TAPE_RANGE`, `PERSONAL_BODY_KEYS` — o dado corporal pessoal fica isolado e
  testável sozinho (consentimento/privacidade).

`Avatar3dService` mantém `validateModel`, `validateBody` e `publicModel` como delegações estáticas de uma linha
(assinatura e visibilidade inalteradas; `Avatar3dServiceTest`, congelado, roda sem mudança) e expõe
`MODEL_VERSION`/`SHAPE_LEN` como aliases das constantes das regras. `clampAdjust` (ajustes finos) e
`normalizeTexture` (decodificação de imagem) ficaram no serviço. Ordem das verificações, mensagens e códigos
(`MODELO_INVALIDO`, `CORPO_INVALIDO`) são os mesmos; o código foi movido por recorte de linhas, só com renomeação dos
dois métodos de entrada e o javadoc solto de `BODY_RANGE` reposicionado sobre a constante.

**Padrão aplicado: nenhum.** É extração de funções puras (Extract Class); não há variação de política em runtime.

### Padrões avaliados e não aplicados neste lote

- **Chain of Responsibility (validação):** ao contrário do cadastro (02), aqui não há acumulação de erros ordenados —
  obrigatórios abortam no primeiro problema e opcionais são descartados em silêncio; elos não acrescentariam clareza.
- **Strategy (encaixe/pose/ambiente):** a validação tem uma única política espelhada do cliente; sem variação real.
- **Bridge/Factory Method (renderer 2D/3D/fallback):** o render vive no frontend (`lib/avatar3d`, `components/three`);
  nada de render no backend tocado; fica para lote TS com testes de lógica (sem WebGL).
- **Flyweight (assets/materiais):** `GarmentAssetService`/`AssetCatalogService` não tocados; sem evidência de custo.
- **State (versões de identidade APPROVED/NEEDS_REFINEMENT):** transições dentro de métodos `@Transactional`; mover
  exigiria caracterização própria de approve/restore/prune. Pendência.
- **Facade (sessão do provador):** `TryOnSessionService` já é a fachada; não alterado.
- **Singleton:** nenhum manual; classes de regras são utilitárias estáticas com construtor privado.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** da extração (8 testes novos em `Avatar3dModelValidationCharacterizationTest`: ordem das chaves do modelo e do corpo, opcionais do cabelo descartados, heterocromia, zonas da sobrancelha, obrigatórios do corpo, `publicModel` sem corpo devolve a mesma instância) + existentes | `mvn -B -pl fai-application -Dtest='Avatar3d*Test,AvatarBodyScanServiceTest' -Dsurefire.failIfNoSpecifiedTests=false test` | 36 testes (8 + 21 + 7), 0 falhas |
| Depois da extração + `Avatar3dModelRulesTest` (6) + `Avatar3dBodyRulesTest` (5: limites inclusivos de todas as faixas, profundidade com origem sem valor, altura/peso, não mutação em `publicModel`, delegação) | mesmo comando | 47 testes, 0 falhas |
| Consumidor web (`Avatar3dController`; `ServiceFakes` estende `Avatar3dService`) | `mvn -B -pl fai-web -am -Dtest=ControllerDelegacaoTest -Dsurefire.failIfNoSpecifiedTests=false test` | 697 testes, 0 falhas |
| Catraca de linhas | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | 0 violações nos arquivos tocados; `Avatar3dService` APERTAR 889 → 600. As 10 violações listadas são de arquivos de outros lotes já reduzidos na branch principal (worktree em `bcaee73`) |

Logs: `evidence/12-avatar3d-baseline.log`, `evidence/12-avatar3d-after.log`.

Sem banco, servidor, navegador, WebGL/GPU, rede, IA paga ou fotos reais. Suíte completa não executada (máquina
compartilhada com outros lotes); só os testes do domínio tocado e do consumidor web.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `Avatar3dService.java` (congelado) | 889 linhas | 600 (−289; −32,5 %) |
| `AvatarBodyScanService.java` | 126 | 126 (só referência às faixas) |
| `Avatar3dModelRules.java` (novo) | — | 215 |
| `Avatar3dBodyRules.java` (novo) | — | 132 |
| Runtime combinado (serviço + novos) | 889 | 947 (+58: cabeçalhos, javadoc, delegações) |
| Testes novos | — | 222 + 68 + 78 = 368 (todos ≤ 400) |

O ganho é coesão (o serviço fica com transação, versões, moderação e textura) e teste isolado das regras de dado
corporal, não redução global de código.

## Contratos preservados

URLs e métodos de `Avatar3dController`, `SaveCommand`/`SettingsCommand`, códigos e chaves i18n
(`avatar3d.modelo_invalido`, `avatar3d.corpo_invalido`), ordem das chaves do modelo/corpo salvos em JSON, faixas do
corpo idênticas às de `lib/avatar3d/body-spec.ts` e `lib/tryon/sizes.ts`, recorte de medidas pessoais para terceiros
(`PERSONAL_BODY_KEYS`), consentimento obrigatório antes de validar, `@Transactional` dos métodos, schema e migrations.
Slots do provador, ordem de camadas, âncoras e fallback 2D/3D não foram tocados.

## Riscos e pendências do domínio 12

- Comentários em `lib/avatar3d/model.ts` e `lib/avatar3d/body-spec.ts` citam “Avatar3dService” como validador do
  backend — continua verdadeiro (ele delega); `scripts/diagramas/v5/citacoes.json` é índice histórico, não alterado.
- `Avatar3dService` continua PARTIAL (600 linhas): ciclo de versões (approve/restore/prune/makeCurrent) é o próximo
  candidato a extração, com caracterização de poda e versão aprovada.
- `TryOnService` (326) e `TryOnSessionService` (289) acima do limite e não tocados; `lib/avatar3d/*` congelados
  (renderer/Three.js) aguardam lote TS com testes de lógica pura, sem WebGL.
- COVERAGE.csv/COVERAGE_FINAL.csv/INDEX.md não editados (consolidação do orquestrador).
