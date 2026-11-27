// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderApp } from "@/test-utils/render";
import { triangle } from "@/test-utils/glb-fixture";
import { disposeAsset, EMPTY_DOCUMENT, loadGlb } from "@/lib/atelier3d/document";
import { tr } from "@/lib/i18n/core";
import { SceneCommandPanel } from "./scene-command-panel";

afterEach(cleanup);

it("keeps a viewer from issuing commands and static edits blocked on deformable assets", async () => {
  const loaded = await loadGlb(triangle());
  const onChange = vi.fn();
  const props = { asset: loaded, document: EMPTY_DOCUMENT, selected: "n0", primitive: "n0.p0", onChange };
  try {
    const view = renderApp(<SceneCommandPanel {...props} editable={false} deformationBlocked={false} />);
    for (const button of screen.getAllByRole("button")) expect(button.matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: tr("atelier3d.commands.center") }));
    expect(onChange).not.toHaveBeenCalled();
    view.rerender(<SceneCommandPanel {...props} editable deformationBlocked />);
    expect(screen.getByRole("button", { name: tr("atelier3d.commands.center") }).matches(":disabled")).toBe(false);
    expect(screen.getByRole("button", { name: tr("atelier3d.commands.smooth") }).matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: tr("atelier3d.commands.applyTaper") }).matches(":disabled")).toBe(true);
  } finally { cleanup(); disposeAsset(loaded); }
});

it("commits one undoable document edit and refuses invalid taper values", async () => {
  const loaded = await loadGlb(triangle());
  const onChange = vi.fn();
  try {
    renderApp(<SceneCommandPanel asset={loaded} document={EMPTY_DOCUMENT} selected="n0" primitive="n0.p0"
      editable deformationBlocked={false} onChange={onChange} />);
    const input = screen.getByLabelText(tr("atelier3d.commands.factor"));
    fireEvent.change(input, { target: { value: "0" } });
    const apply = screen.getByRole("button", { name: tr("atelier3d.commands.applyTaper") });
    expect(apply.matches(":disabled")).toBe(true);
    fireEvent.click(apply);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "0.75" } });
    fireEvent.click(apply);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].vertices["n0.p0"]).toBeTruthy();
    expect(EMPTY_DOCUMENT.vertices).toEqual({});
    expect(screen.getByRole("status").textContent).toBe(tr("atelier3d.commands.applied"));
  } finally { cleanup(); disposeAsset(loaded); }
});

it("explains a stale mesh selection without committing a broken edit", async () => {
  const loaded = await loadGlb(triangle());
  const onChange = vi.fn();
  try {
    renderApp(<SceneCommandPanel asset={loaded} document={EMPTY_DOCUMENT} selected="n0" primitive="missing"
      editable deformationBlocked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: tr("atelier3d.commands.smooth") }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(tr("atelier3d.commands.ATELIER_COMMAND_TARGET"));
  } finally { cleanup(); disposeAsset(loaded); }
});
