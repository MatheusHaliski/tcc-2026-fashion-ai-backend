// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderApp } from "@/test-utils/render";
import { tr } from "@/lib/i18n/core";
import { GarmentCreationPanel } from "./garment-creation-panel";
const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/atelier3d/garment-template", () => ({
  GARMENT_TEMPLATES: ["tee", "skirt", "trousers"],
  createGarmentTemplate: create,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("requires confirmation before replacing an unsaved draft, then uploads a GLB", async () => {
  create.mockResolvedValue(new ArrayBuffer(100));
  const upload = vi.fn().mockResolvedValue(undefined);
  renderApp(<GarmentCreationPanel editable dirty onCreate={upload} />);
  fireEvent.click(screen.getByRole("radio", { name: tr("atelier3d.create.skirt") }));
  fireEvent.click(screen.getByRole("button", { name: tr("atelier3d.create.action") }));
  expect(create).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: tr("atelier3d.create.replace") }));
  await waitFor(() => expect(upload).toHaveBeenCalledOnce());
  expect(create).toHaveBeenCalledWith("skirt", "#2867ad");
  expect(upload.mock.calls[0][0]).toBeInstanceOf(File);
  expect(upload.mock.calls[0][0].name).toBe("fai-skirt-prototype.glb");
});
it("keeps creation unavailable to a viewer", () => {
  renderApp(<GarmentCreationPanel editable={false} dirty={false} onCreate={vi.fn()} />);
  const action = screen.getByRole("button", { name: tr("atelier3d.create.action") });
  expect((action as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(action);
  expect(create).not.toHaveBeenCalled();
});
it("reports generation failures and allows retry", async () => {
  create.mockRejectedValueOnce(new Error("generation failed"));
  renderApp(<GarmentCreationPanel editable dirty={false} onCreate={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: tr("atelier3d.create.action") }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect((screen.getByRole("button", { name: tr("atelier3d.create.action") }) as HTMLButtonElement).disabled).toBe(false);
});

it("does not upload if edit permission is revoked during local generation", async () => {
  let finish!: (bytes: ArrayBuffer) => void;
  create.mockImplementationOnce(() => new Promise<ArrayBuffer>((resolve) => { finish = resolve; }));
  const upload = vi.fn();
  const view = renderApp(<GarmentCreationPanel editable dirty={false} onCreate={upload} />);
  fireEvent.click(screen.getByRole("button", { name: tr("atelier3d.create.action") }));
  view.rerender(<GarmentCreationPanel editable={false} dirty={false} onCreate={upload} />);
  await act(async () => { finish(new ArrayBuffer(100)); });
  expect(upload).not.toHaveBeenCalled();
});

it("asks for confirmation if the user starts editing while generation is pending", async () => {
  let finish!: (bytes: ArrayBuffer) => void;
  create.mockImplementationOnce(() => new Promise<ArrayBuffer>((resolve) => { finish = resolve; }));
  const upload = vi.fn();
  const view = renderApp(<GarmentCreationPanel editable dirty={false} onCreate={upload} />);
  fireEvent.click(screen.getByRole("button", { name: tr("atelier3d.create.action") }));
  view.rerender(<GarmentCreationPanel editable dirty onCreate={upload} />);
  await act(async () => { finish(new ArrayBuffer(100)); });
  expect(upload).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: tr("atelier3d.create.replace") })).toBeTruthy();
});
