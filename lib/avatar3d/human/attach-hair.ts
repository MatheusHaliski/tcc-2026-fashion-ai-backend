import type * as THREE from "three";
import type { Human } from "./three-human";

/** Hair is authored in the body's bind space, even when attached during an idle pose.
 * Passing the original bind matrix prevents Three.js from recalculating the shared
 * skeleton inverses from the current pose (which resets every other skinned mesh).
 */
export function attachHair(human: Human, mesh: THREE.SkinnedMesh): THREE.SkinnedMesh {
  human.root.add(mesh);
  mesh.bind(human.skeleton, human.body.bindMatrix);
  return mesh;
}
