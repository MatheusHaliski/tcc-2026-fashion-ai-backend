"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Dialog, Field, Input, Select } from "@/components/ui";
import {
  loadGlb,
  disposeAsset,
  exportGlb,
  downloadBlob,
  updateNode,
  EMPTY_DOCUMENT,
  type LoadedAsset,
  type SceneDocument,
} from "@/lib/atelier3d/document";
import { sceneApi, type SceneAccess } from "./scene-api";
import { createSceneHistory, commitSceneEdit, travelSceneHistory, type SceneHistory } from "@/lib/atelier3d/history";
import type {
  SceneResponse,
  SceneVersion,
  Asset,
  GenderEvidence,
} from "./contracts";
import { SceneInspector } from "./scene-inspector";
import { GenderPanel } from "./gender-panel";
import { GuestPanel } from "./guest-panel";
import type { Tool, View } from "./viewport";
import styles from "./editor.module.css";
const Viewport = dynamic(() => import("./viewport"), { ssr: false });
export function Atelier3dEditor({ projectId, guestId, token }: SceneAccess) {
  const { t } = useI18n(),
    client = useMemo(
      () => sceneApi({ projectId, guestId, token }),
      [projectId, guestId, token],
    );
  const [scene, setScene] = useState<SceneResponse | null>(null),
    [asset, setAsset] = useState<Asset | null>(null),
    [loaded, setLoaded] = useState<LoadedAsset | null>(null);
  const [history, setHistory] = useState<SceneHistory>(() => createSceneHistory(EMPTY_DOCUMENT));
  const doc = history.doc;
  const [selected, setSelected] = useState(""),
    [tool, setTool] = useState<Tool>("translate"),
    [view, setView] = useState<View>("perspective"),
    [fit, setFit] = useState(0),
    [wireframe, setWireframe] = useState(false),
    [snap, setSnap] = useState(false);
  const [ids, setIds] = useState<string[]>([]),
    [evidence, setEvidence] = useState<GenderEvidence | null>(null),
    [confirmed, setConfirmed] = useState<string | null>(null),
    [confirmedHash, setConfirmedHash] = useState<string | null>(null),
    [sequence, setSequence] = useState(0);
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState<string | null>(null),
    [conflict, setConflict] = useState(false),
    [autosave, setAutosave] = useState(true),
    [paused, setPaused] = useState(false),
    [confirmReload, setConfirmReload] = useState(false);
  const [vertex, setVertex] = useState(0);
  const activeAsset = useRef<LoadedAsset | null>(null),
    busyRef = useRef(false),
    dirtyRef = useRef(false),
    sequenceRef = useRef(0),
    pending = useRef({ payload: "", requestId: "" });
  const mounted = useRef(true);
  const translateRef = useRef(t);
  translateRef.current = t;
  const effectiveConfirmed =
    confirmed && confirmedHash === evidence?.hash ? confirmed : null;
  const canEdit = !!scene?.edit && !busy,
    canExport = !!scene?.export;
  dirtyRef.current = dirty;
  sequenceRef.current = sequence;
  const install = useCallback(
    async (meta: Asset, document: SceneDocument) => {
      const bytes = await client.bytes(meta.id),
        next = await loadGlb(bytes);
      if (!mounted.current) {
        disposeAsset(next);
        return;
      }
      if (activeAsset.current) disposeAsset(activeAsset.current);
      activeAsset.current = next;
      setLoaded(next);
      setAsset(meta);
      setHistory(createSceneHistory(structuredClone(document)));
      setSelected(next.nodes.keys().next().value ?? "");
      setVertex(0);
      setFit((n) => n + 1);
    },
    [client],
  );
  const reportError = useCallback((e: unknown, fallback: string) => {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      setScene((current) =>
        current ? { ...current, edit: false, export: false } : current,
      );
      setError(translateRef.current("atelier3d.accessRevoked"));
      setPaused(true);
    } else setError(e instanceof ApiError ? e.message : fallback);
  }, []);
  const reload = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await client.get();
      setScene(result);
      setSequence(result.current?.sequence ?? 0);
      setIds(result.current?.gender.sources.map((s) => s.id) ?? []);
      setEvidence(result.current?.gender ?? null);
      setConfirmed(result.current?.confirmedTipoLookId ?? null);
      setConfirmedHash(result.current?.gender.hash ?? null);
      if (result.asset)
        await install(result.asset, result.current?.document ?? EMPTY_DOCUMENT);
      else {
        if (activeAsset.current) disposeAsset(activeAsset.current);
        activeAsset.current = null;
        setLoaded(null);
        setAsset(null);
        setHistory(createSceneHistory(EMPTY_DOCUMENT));
      }
      setDirty(false);
      setConflict(false);
      setPaused(false);
    } catch (e) {
      reportError(e, translateRef.current("atelier3d.loadError"));
      setScene((s) => (s ? { ...s, edit: false, export: false } : s));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [client, install, reportError]);
  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
      if (activeAsset.current) {
        disposeAsset(activeAsset.current);
        activeAsset.current = null;
      }
    };
  }, [reload]);
  useEffect(() => {
    let alive = true;
    setEvidence(null);
    client
      .evidence(ids)
      .then((next) => {
        if (alive) setEvidence(next);
      })
      .catch((e) => {
        if (alive) {
          reportError(e, translateRef.current("atelier3d.gender.error"));
          setPaused(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [client, JSON.stringify(ids), reportError]); // stable source identity, not array reference
  useEffect(() => {
    if (!scene) return;
    const timer = setInterval(() => {
      if (busyRef.current) return;
      client
        .get()
        .then((next) => {
          if ((next.current?.sequence ?? 0) > sequenceRef.current) {
            setConflict(true);
            setPaused(true);
          }
          if (!next.edit)
            setScene((current) =>
              current ? { ...current, edit: false } : current,
            );
        })
        .catch((e) => {
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
            setScene((current) =>
              current ? { ...current, edit: false, export: false } : current,
            );
            setError(translateRef.current("atelier3d.accessRevoked"));
            setPaused(true);
          }
        });
    }, 15000);
    return () => clearInterval(timer);
  }, [client, !!scene]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  function change(next: SceneDocument) {
    if (busyRef.current || !scene?.edit) return;
    setHistory((history) => commitSceneEdit(history, next));
    setDirty(true);
    setPaused(false);
  }
  function travel(direction: "undo" | "redo") {
    if (busyRef.current || !scene?.edit) return;
    setHistory((history) => travelSceneHistory(history, direction));
    setDirty(true);
    setPaused(false);
  }
  async function save() {
    if (busyRef.current || !asset || !scene?.edit || !evidence || conflict)
      return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const body = {
      expectedSequence: sequence,
      assetId: asset.id,
      document: doc,
      productIds: ids,
      confirmedTipoLookId: effectiveConfirmed,
      genderEvidenceHash: evidence.hash,
    };
    const payload = JSON.stringify(body);
    if (pending.current.payload !== payload)
      pending.current = { payload, requestId: crypto.randomUUID() };
    try {
      const version = await client.save({
        ...body,
        requestId: pending.current.requestId,
      });
      setSequence(version.sequence);
      setScene((s) =>
        s
          ? {
              ...s,
              current: version,
              asset,
              history: [
                version,
                ...s.history.filter((v) => v.id !== version.id),
              ].slice(0, 30),
            }
          : s,
      );
      setDirty(false);
      setPaused(false);
    } catch (e) {
      reportError(e, t("atelier3d.saveError"));
      setPaused(true);
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (
      !autosave ||
      !dirty ||
      busy ||
      paused ||
      conflict ||
      !asset ||
      !evidence
    )
      return;
    const timer = setTimeout(() => void save(), 2500);
    return () => clearTimeout(timer);
  }, [
    doc,
    ids,
    effectiveConfirmed,
    dirty,
    busy,
    autosave,
    paused,
    conflict,
    asset,
    evidence,
  ]); // saves the exact displayed document
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        travel(e.shiftKey ? "redo" : "undo");
      } else if (e.key.toLowerCase() === "g") setTool("translate");
      else if (e.key.toLowerCase() === "r") setTool("rotate");
      else if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey)
        setTool("scale");
      else if (e.key.toLowerCase() === "f") setFit((n) => n + 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function upload(file: File) {
    if (busyRef.current || !scene?.edit) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await client.upload(file);
      await install(next, EMPTY_DOCUMENT);
      setDirty(true);
      setPaused(false);
    } catch (e) {
      reportError(e, t("atelier3d.importError"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function download() {
    if (
      !loaded ||
      !effectiveConfirmed ||
      !canExport ||
      dirty ||
      busyRef.current
    )
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      const bytes = await exportGlb(loaded, doc);
      downloadBlob(
        new Blob([bytes], { type: "model/gltf-binary" }),
        `fashionai-v${sequence}.glb`,
      );
    } catch {
      setError(t("atelier3d.exportError"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function restore(summary: Pick<SceneVersion, "id">) {
    if (busyRef.current || !scene?.edit || dirty) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const version = await client.version(summary.id);
      const [bytes, meta] = await Promise.all([
        client.bytes(version.assetId),
        client.metadata(version.assetId),
      ]);
      const next = await loadGlb(bytes);
      if (!mounted.current) {
        disposeAsset(next);
        return;
      }
      if (activeAsset.current) disposeAsset(activeAsset.current);
      activeAsset.current = next;
      setLoaded(next);
      setAsset(meta);
      setHistory(createSceneHistory(structuredClone(version.document)));
      setIds(version.gender.sources.map((p) => p.id));
      setConfirmed(version.confirmedTipoLookId);
      setConfirmedHash(version.gender.hash);
      setSelected(next.nodes.keys().next().value ?? "");
      setDirty(true);
      setPaused(false);
    } catch {
      setError(t("atelier3d.loadError"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={styles.editor}>
      {projectId && (
        <Link className="btn" href={`/atelier/projects/${projectId}`}>
          {t("atelier3d.back")}
        </Link>
      )}
      <h1 className="type-h1">{scene?.title ?? t("atelier3d.title")}</h1>
      <p>{t("atelier3d.subtitle")}</p>
      <p role="status" className={styles.status}>
        {busy
          ? t("common.loading")
          : dirty
            ? t("atelier3d.unsaved")
            : t("atelier3d.saved")}{" "}
        · {t("atelier3d.version", { number: sequence })}
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {conflict && (
        <div role="alert" className={styles.evidence}>
          <p>{t("atelier3d.conflict")}</p>
          <Button onClick={() => setConfirmReload(true)}>
            {t("atelier3d.reload")}
          </Button>
        </div>
      )}
      <div className={styles.toolbar}>
        <Field id="atelier-glb-file" label={t("atelier3d.import")}>
          <Input
            id="atelier-glb-file"
            type="file"
            accept=".glb,model/gltf-binary"
            disabled={!canEdit}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </Field>
        <Button
          disabled={!canEdit || !dirty || !evidence || conflict}
          onClick={() => void save()}
        >
          {t("common.save")}
        </Button>
        <Button
          disabled={
            !loaded || !effectiveConfirmed || !canExport || dirty || busy
          }
          onClick={() => void download()}
        >
          {t("atelier3d.export")}
        </Button>
        <Button
          disabled={busy}
          onClick={() => (dirty ? setConfirmReload(true) : void reload())}
        >
          {t("atelier3d.reload")}
        </Button>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={autosave}
            onChange={(e) => setAutosave(e.target.checked)}
          />
          {t("atelier3d.autosave")}
        </label>
      </div>
      {!loaded ? (
        <p>{t("atelier3d.empty")}</p>
      ) : (
        <>
          <div className={styles.toolbar}>
            {(["translate", "rotate", "scale"] as Tool[]).map((mode) => (
              <Button
                key={mode}
                aria-pressed={tool === mode}
                onClick={() => setTool(mode)}
              >
                {t(`atelier3d.${mode}`)}
              </Button>
            ))}
            <Button
              disabled={!canEdit || !history.past.length}
              onClick={() => travel("undo")}
            >
              {t("atelier3d.undo")}
            </Button>
            <Button
              disabled={!canEdit || !history.future.length}
              onClick={() => travel("redo")}
            >
              {t("atelier3d.redo")}
            </Button>
            <Select
              aria-label={t("atelier3d.view")}
              value={view}
              onChange={(e) => setView(e.target.value as View)}
            >
              {(
                [
                  "perspective",
                  "front",
                  "back",
                  "left",
                  "right",
                  "top",
                ] as View[]
              ).map((v) => (
                <option key={v} value={v}>
                  {t(`atelier3d.view.${v}`)}
                </option>
              ))}
            </Select>
            <Button onClick={() => setFit((n) => n + 1)}>
              {t("atelier3d.fit")}
            </Button>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={wireframe}
                onChange={(e) => setWireframe(e.target.checked)}
              />
              {t("atelier3d.wireframe")}
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={snap}
                onChange={(e) => setSnap(e.target.checked)}
              />
              {t("atelier3d.snap")}
            </label>
          </div>
          <div className={styles.layout}>
            <aside className={styles.panel}>
              <h2 className="type-h3">{t("atelier3d.objects")}</h2>
              <div className={styles.tree}>
                {[...loaded.nodes].map(([key, n]) => (
                  <Button
                    key={key}
                    aria-pressed={selected === key}
                    onClick={() => {
                      setSelected(key);
                      setVertex(0);
                    }}
                  >
                    {n.name || key}
                  </Button>
                ))}
              </div>
            </aside>
            <div className={styles.viewport}>
              <Viewport
                asset={loaded}
                document={doc}
                selected={selected}
                tool={tool}
                view={view}
                fit={fit}
                wireframe={wireframe}
                snap={snap}
                editable={canEdit}
                onSelect={setSelected}
                onTransform={(value) =>
                  change(updateNode(doc, selected, value, loaded.baseline))
                }
              />
            </div>
            <SceneInspector
              loaded={loaded}
              document={doc}
              selected={selected}
              inspection={asset?.inspection}
              editable={canEdit}
              vertex={vertex}
              onVertexChange={setVertex}
              onChange={change}
            />
          </div>
          <p className="type-caption">
            {asset?.filename} · {asset?.inspection.vertices}{" "}
            {t("atelier3d.vertices")} · {asset?.sha256.slice(0, 12)}
          </p>
        </>
      )}
      <GenderPanel
        search={client.search}
        ids={ids}
        onSources={(next) => {
          if (!canEdit) return;
          setIds(next);
          setConfirmed(null);
          setDirty(true);
          setPaused(false);
        }}
        evidence={evidence}
        selected={effectiveConfirmed}
        onConfirm={(id) => {
          setConfirmed(id);
          setConfirmedHash(evidence?.hash ?? null);
          setDirty(true);
          setPaused(false);
        }}
        disabled={!canEdit}
      />
      {!effectiveConfirmed && <p>{t("atelier3d.gender.exportPending")}</p>}
      {scene && (
        <section className={styles.evidence}>
          <h2 className="type-h3">{t("atelier3d.history")}</h2>
          {scene.history.map((v) => (
            <div className={styles.toolbar} key={v.id}>
              <span>
                {t("atelier3d.version", { number: v.sequence })} · {v.author}
              </span>
              <Button
                disabled={!canEdit || dirty}
                onClick={() => void restore(v)}
              >
                {t("atelier3d.restore")}
              </Button>
            </div>
          ))}
        </section>
      )}
      {scene?.manageGuests && <GuestPanel client={client} />}
      <Dialog
        open={confirmReload}
        title={t("atelier3d.reload")}
        onClose={() => setConfirmReload(false)}
      >
        <p>{t("atelier3d.discardWarning")}</p>
        <Button
          onClick={() => {
            setConfirmReload(false);
            void reload();
          }}
        >
          {t("atelier3d.discard")}
        </Button>
      </Dialog>
    </div>
  );
}
