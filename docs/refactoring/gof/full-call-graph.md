# Grafo estático e fluxos conferidos

`dependencies.csv` é grafo de imports resolvidos, não call graph completo de runtime. `java-ast.json` inclui chamadas por método e `typescript-ast.json` consumidores HTTP. Sem resolução semântica completa, reflection, DI e eventos não permitem afirmar alcançabilidade ou ausência de ciclos reais. `evidence/cycles.json` compara SCCs antes/depois excluindo imports exclusivamente de tipo.

## FLOW-A3D-HISTORY-001 — histórico local (refatorado)

`Atelier3dEditor.change` → `commitSceneEdit` → setter funcional React → `doc` → renderização. `travel` → `travelSceneHistory` → documento anterior/próximo. Carregamento/restauração → `createSceneHistory(structuredClone(document))`. Limite30 e descarte de redo após nova edição preservados. Guardas busy/edit, dirty e pause permanecem no editor. Helper importa apenas tipo de documento.

## Fronteira de salvamento (inspecionada; sem alteração)

`components/atelier3d/scene-api.ts` → POST `/api/atelier/projects/{id}/scene/versions` → `fai-web/.../web/atelier3d/Atelier3dController.save` → `fai-application/.../application/atelier3d/Atelier3dService.save` → `AtelierProjectService.access3d(..., true)` → persistência versionada. DTO Save contém expectedSequence, requestId, assetId, document e evidência de gênero. `@Transactional` permanece no service.

Guest: cliente monta `/api/atelier/guest/{invite}` e header `X-Atelier-Guest` → métodos guest do mesmo controller/service. Esse caminho não foi extraído para o helper e não foi certificado por teste HTTP neste lote.

## Dependências ainda a reconciliar

Wildcards Java, nested types, imports dinâmicos, herança, metaanotações, routers e consumidores construídos por expressão estão explicitamente pendentes. `HTTP_CONTRACTS.csv` contém candidatos lexicais; correspondência de URL/método não verifica payload, autorização, status ou versão.

## FLOW-A3D-INSPECTOR-002 — propriedades selecionadas

Editor fornece documento, GLB carregado, seleção, índice do vértice e capacidade editável → SceneInspector resolve nó e primitiva descendente → VectorField/MaterialFields em scene-fields.tsx emitem valores validados → funções updateNode/updateMaterial ou patch de vértice → callback change do editor → histórico local. Nenhuma rede/persistência foi transferida para o inspetor. Fieldset readonly e bloqueios skinned/morph/animated permanecem.
