import type { MaterialEdit, NodeEdit, SceneDocument } from "./document";

/**
 * Edições imutáveis do documento da cena: cada uma devolve um documento novo (o histórico guarda os anteriores).
 * O valor do arquivo (`baseline`) completa os campos que o documento ainda não tem.
 */
export function updateNode(
  document: SceneDocument,
  key: string,
  value: Partial<NodeEdit>,
  baseline: SceneDocument,
): SceneDocument {
  return {
    ...document,
    nodes: {
      ...document.nodes,
      [key]: { ...baseline.nodes[key], ...document.nodes[key], ...value },
    },
  };
}
export function updateMaterial(
  document: SceneDocument,
  key: string,
  value: Partial<MaterialEdit>,
  baseline: SceneDocument,
): SceneDocument {
  return {
    ...document,
    materials: {
      ...document.materials,
      [key]: {
        ...baseline.materials[key],
        ...document.materials[key],
        ...value,
      },
    },
  };
}
