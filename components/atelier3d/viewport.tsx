"use client";
import {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  Component,
  type ReactNode,
  type ComponentRef,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  Grid,
  OrbitControls,
  TransformControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import * as THREE from "three";
import {
  applyDocument,
  type LoadedAsset,
  type SceneDocument,
  type NodeEdit,
} from "@/lib/atelier3d/document";
import { useI18n } from "@/lib/i18n/i18n";
export type Tool = "translate" | "rotate" | "scale";
export type View = "perspective" | "front" | "back" | "left" | "right" | "top";
interface Props {
  asset: LoadedAsset;
  document: SceneDocument;
  selected: string;
  tool: Tool;
  view: View;
  fit: number;
  wireframe: boolean;
  snap: boolean;
  editable: boolean;
  onSelect: (key: string) => void;
  onTransform: (value: NodeEdit) => void;
}
class CanvasBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function Scene(props: Props) {
  const { asset, document, selected, view, fit, onSelect, onTransform } = props;
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size } = useThree();
  const object = asset.nodes.get(selected);
  useLayoutEffect(() => {
    applyDocument(asset, document);
  }, [asset, document]);
  useEffect(() => {
    for (const mesh of asset.primitives.values())
      for (const mat of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]) {
        if ("wireframe" in mat) mat.wireframe = props.wireframe;
      }
  }, [asset, props.wireframe]);
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(asset.gltf.scene);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()),
      radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.05);
    const direction =
      view === "front"
        ? [0, 0, 1]
        : view === "back"
          ? [0, 0, -1]
          : view === "left"
            ? [-1, 0, 0]
            : view === "right"
              ? [1, 0, 0]
              : view === "top"
                ? [0, 1, 0.001]
                : [1, 0.6, 1];
    let distance = radius * 3;
    if (camera instanceof THREE.PerspectiveCamera) {
      const vertical = THREE.MathUtils.degToRad(camera.fov),
        horizontal =
          2 * Math.atan((Math.tan(vertical / 2) * size.width) / size.height);
      distance = (radius / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.15;
    }
    camera.position
      .copy(center)
      .add(
        new THREE.Vector3(...(direction as [number, number, number]))
          .normalize()
          .multiplyScalar(distance),
      );
    camera.near = Math.max(radius / 10000, 0.0001);
    camera.far = Math.max(radius * 100, 100);
    camera.lookAt(center);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = Math.min(size.width, size.height) / (radius * 2 * 1.15);
    }
    camera.updateProjectionMatrix();
    controls.current?.target.copy(center);
    controls.current?.update();
  }, [asset, camera, view, fit, size.width, size.height]);
  return (
    <>
      <hemisphereLight intensity={2.3} groundColor="#b8b0a2" />
      <directionalLight position={[4, 6, 5]} intensity={2} />
      <directionalLight position={[-4, 3, -3]} intensity={1.1} />
      <Grid
        infiniteGrid
        fadeDistance={50}
        sectionColor="#9b9c99"
        cellColor="#d8d7d1"
      />
      <primitive
        object={asset.gltf.scene}
        onClick={(event: {
          stopPropagation: () => void;
          object: THREE.Object3D;
        }) => {
          event.stopPropagation();
          let o: THREE.Object3D | null = event.object;
          while (o && !o.userData.atelierNodeKey) o = o.parent;
          if (o) onSelect(o.userData.atelierNodeKey);
        }}
      />
      {object && <Selection object={object} />}
      {props.editable && object && (
        <TransformControls
          object={object}
          mode={props.tool}
          translationSnap={props.snap ? 0.01 : null}
          rotationSnap={props.snap ? Math.PI / 12 : null}
          scaleSnap={props.snap ? 0.1 : null}
          onMouseUp={() =>
            onTransform({
              position: object.position.toArray() as [number, number, number],
              rotation: [
                object.rotation.x,
                object.rotation.y,
                object.rotation.z,
              ],
              scale: object.scale.toArray() as [number, number, number],
              visible: object.visible,
            })
          }
        />
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        minDistance={0.01}
        maxDistance={10000}
      />
    </>
  );
}
function Selection({ object }: { object: THREE.Object3D }) {
  const [helper] = useState(() => new THREE.BoxHelper(object, "#ce850e"));
  useFrame(() => helper.setFromObject(object));
  useEffect(
    () => () => {
      helper.geometry.dispose();
      (helper.material as THREE.Material).dispose();
    },
    [helper],
  );
  return <primitive object={helper} />;
}
export default function AtelierViewport(props: Props) {
  const { t } = useI18n();
  return (
    <CanvasBoundary fallback={<p role="alert">{t("atelier3d.webglError")}</p>}>
      <Canvas
        camera={{ position: [2, 1.5, 3], fov: 45 }}
        aria-label={t("atelier3d.viewport")}
      >
        <color attach="background" args={["#f0eee7"]} />
        {props.view === "perspective" ? (
          <PerspectiveCamera makeDefault fov={45} />
        ) : (
          <OrthographicCamera makeDefault position={[0, 0, 3]} />
        )}
        <Scene {...props} />
      </Canvas>
    </CanvasBoundary>
  );
}
