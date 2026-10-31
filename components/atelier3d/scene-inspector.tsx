"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { Field, Input } from "@/components/ui";
import {
  updateNode,
  updateMaterial,
  type LoadedAsset,
  type SceneDocument,
  type Inspection,
  type Vec3,
} from "@/lib/atelier3d/document";
import { MaterialFields, VectorField } from "./scene-fields";
import styles from "./editor.module.css";

interface SceneInspectorProps {
  loaded: LoadedAsset;
  document: SceneDocument;
  selected: string;
  inspection?: Inspection;
  editable: boolean;
  vertex: number;
  onVertexChange: (index: number) => void;
  onChange: (document: SceneDocument) => void;
}

/** Edits the selected object; history, access and persistence stay in the editor. */
export function SceneInspector({
  loaded,
  document: doc,
  selected,
  inspection,
  editable: canEdit,
  vertex,
  onVertexChange: setVertex,
  onChange: change,
}: SceneInspectorProps) {
  const { t } = useI18n();
  const primitive = loaded
    ? [...loaded.primitives.entries()].find(([, mesh]) => {
        let o: typeof mesh.parent | typeof mesh = mesh;
        while (o) {
          if (o === loaded.nodes.get(selected)) return true;
          o = o.parent;
        }
        return false;
      })
    : undefined;
  const node = loaded
    ? (doc.nodes[selected] ?? loaded.baseline.nodes[selected])
    : undefined;
  const material =
    primitive && loaded
      ? (doc.materials[primitive[0]] ?? loaded.baseline.materials[primitive[0]])
      : undefined;
  return (
    <aside className={`${styles.panel} ${styles.inspector}`}>
      <fieldset disabled={!canEdit} className={styles.stack}>
        <h2 className="type-h3">{t("atelier3d.inspector")}</h2>
        {node && (
          <>
            <VectorField
              label={t("atelier3d.position")}
              value={node.position}
              onChange={(position) =>
                change(
                  updateNode(
                    doc,
                    selected,
                    { position },
                    loaded.baseline,
                  ),
                )
              }
            />
            <VectorField
              label={t("atelier3d.rotation")}
              value={
                node.rotation.map((n) => (n * 180) / Math.PI) as Vec3
              }
              onChange={(rotation) =>
                change(
                  updateNode(
                    doc,
                    selected,
                    {
                      rotation: rotation.map(
                        (n) => (n * Math.PI) / 180,
                      ) as Vec3,
                    },
                    loaded.baseline,
                  ),
                )
              }
            />
            <VectorField
              label={t("atelier3d.scale")}
              value={node.scale}
              min={0.001}
              onChange={(scale) =>
                change(
                  updateNode(doc, selected, { scale }, loaded.baseline),
                )
              }
            />
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={node.visible}
                onChange={(e) =>
                  change(
                    updateNode(
                      doc,
                      selected,
                      { visible: e.target.checked },
                      loaded.baseline,
                    ),
                  )
                }
              />
              {t("atelier3d.visible")}
            </label>
          </>
        )}
        {material && primitive && (
          <MaterialFields
            material={material}
            onChange={(value) =>
              change(
                updateMaterial(
                  doc,
                  primitive[0],
                  value,
                  loaded.baseline,
                ),
              )
            }
          />
        )}
        <h3 className="type-h3">{t("atelier3d.vertices")}</h3>
        {inspection?.skinned ||
        inspection?.morphs ||
        inspection?.animated ? (
          <p>{t("atelier3d.deformableWarning")}</p>
        ) : (
          primitive && (
            <>
              <Field
                id="vertex-index"
                label={t("atelier3d.vertexIndex")}
              >
                <Input
                  id="vertex-index"
                  type="number"
                  min={0}
                  max={
                    primitive[1].geometry.getAttribute("position")
                      .count - 1
                  }
                  value={vertex}
                  onChange={(e) =>
                    setVertex(
                      Math.min(
                        primitive[1].geometry.getAttribute("position")
                          .count - 1,
                        Math.max(0, Math.floor(Number(e.target.value))),
                      ),
                    )
                  }
                />
              </Field>
              <VectorField
                label={t("atelier3d.vertexPosition")}
                value={
                  doc.vertices[primitive[0]]?.[vertex] ??
                  (Array.from(
                    loaded.originalPositions
                      .get(primitive[0])!
                      .slice(vertex * 3, vertex * 3 + 3),
                  ) as Vec3)
                }
                onChange={(point) =>
                  change({
                    ...doc,
                    vertices: {
                      ...doc.vertices,
                      [primitive[0]]: {
                        ...doc.vertices[primitive[0]],
                        [vertex]: point,
                      },
                    },
                  })
                }
              />
            </>
          )
        )}
      </fieldset>
    </aside>
  );
}
