import type { SceneDocument } from "./document";

/** Local document snapshots only. Persistence revisions, authorization and dirty flags belong to the editor. */
export interface SceneHistory {
  past: SceneDocument[];
  doc: SceneDocument;
  future: SceneDocument[];
}

export function createSceneHistory(doc: SceneDocument): SceneHistory {
  return { past: [], doc, future: [] };
}

export function commitSceneEdit(history: SceneHistory, next: SceneDocument): SceneHistory {
  return {
    past: [...history.past, history.doc].slice(-30),
    doc: next,
    future: [],
  };
}

export function travelSceneHistory(history: SceneHistory, direction: "undo" | "redo"): SceneHistory {
  if (direction === "undo" && history.past.length) {
    return {
      past: history.past.slice(0, -1),
      doc: history.past.at(-1)!,
      future: [history.doc, ...history.future],
    };
  }
  if (direction === "redo" && history.future.length) {
    return {
      past: [...history.past, history.doc],
      doc: history.future[0],
      future: history.future.slice(1),
    };
  }
  return history;
}
