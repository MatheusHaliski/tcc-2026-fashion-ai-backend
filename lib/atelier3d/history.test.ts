import { describe, expect, it } from "vitest";
import type { SceneDocument } from "./document";
import { commitSceneEdit, createSceneHistory, travelSceneHistory } from "./history";

const empty = (): SceneDocument => ({ nodes: {}, materials: {}, vertices: {} });
const edited = (): SceneDocument => ({
  nodes: { torso: { position: [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1], visible: false } },
  materials: { denim: { color: "#123456", roughness: 0.7, metalness: 0, repeat: [2, 3], rotation: 1 } },
  vertices: { torso: { "0": [0.1, 0.2, 0.3] } },
});

describe("local scene snapshots", () => {
  it("restores geometry, materials and node edits together through undo and redo", () => {
    const original = empty(), next = edited();
    const start = createSceneHistory(original);
    const committed = commitSceneEdit(start, next);
    const undone = travelSceneHistory(committed, "undo");
    expect(undone.doc).toBe(original);
    expect(travelSceneHistory(undone, "redo").doc).toBe(next);
    expect(start).toEqual({ past: [], doc: original, future: [] });
    expect(committed).toEqual({ past: [original], doc: next, future: [] });
  });

  it("drops the abandoned redo branch when editing an undone document", () => {
    const original = empty(), abandoned = edited(), replacement = edited();
    replacement.materials.denim.color = "#abcdef";
    const undone = travelSceneHistory(commitSceneEdit(createSceneHistory(original), abandoned), "undo");
    const result = commitSceneEdit(undone, replacement);
    expect(result.future).toEqual([]);
    expect(travelSceneHistory(result, "redo")).toBe(result);
    expect(travelSceneHistory(result, "undo").doc).toBe(original);
    expect(undone.future).toEqual([abandoned]);
  });

  it("keeps the existing 30-edit undo window without changing the latest document", () => {
    const documents = Array.from({ length: 36 }, empty);
    let history = createSceneHistory(documents[0]);
    for (const document of documents.slice(1)) history = commitSceneEdit(history, document);
    expect(history.doc).toBe(documents[35]);
    expect(history.past).toHaveLength(30);
    for (let i = 0; i < 30; i++) history = travelSceneHistory(history, "undo");
    expect(history.doc).toBe(documents[5]);
    expect(travelSceneHistory(history, "undo")).toBe(history);
    for (let i = 0; i < 30; i++) history = travelSceneHistory(history, "redo");
    expect(history.doc).toBe(documents[35]);
  });

  it("resetting to an installed/restored document starts an independent history", () => {
    const old = commitSceneEdit(createSceneHistory(empty()), edited());
    const fresh = createSceneHistory(empty());
    expect(fresh.past).toEqual([]);
    expect(fresh.future).toEqual([]);
    expect(travelSceneHistory(fresh, "undo")).toBe(fresh);
    expect(travelSceneHistory(fresh, "redo")).toBe(fresh);
    expect(old.past).toHaveLength(1);
  });
});
