// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { HYPE_PRESETS } from "@/lib/hype/aura-hype-presets";
import { AuraHypePicker } from "./aura-hype-picker";

afterEach(cleanup);

it("previews each AURA Hype model as a full card with its own effect, colors and attribute layout", () => {
  const onChange = vi.fn();
  renderApp(<AuraHypePicker value={null} onChange={onChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Explorar 40 modelos Hype" }));

  const presets = [...document.querySelectorAll<HTMLElement>(".aura-hype-preset")];
  expect(presets).toHaveLength(HYPE_PRESETS.length);
  expect(document.querySelector('[data-preset-kind="static"]')).toBeTruthy();
  expect(document.querySelector('[data-preset-kind="dynamic"]')).toBeTruthy();
  expect(document.querySelectorAll('.aura-hype-preset-band')).toHaveLength(2);
  const effects = [...document.querySelectorAll(".aura-hype-preset .aura-hype")];
  expect(new Set(effects.map((e) => e.getAttribute("data-preset"))).size).toBe(HYPE_PRESETS.length);
  expect(new Set(presets.map((p) => p.style.getPropertyValue("--hype-ink"))).size).toBeGreaterThan(1);
  const layouts = new Set([...document.querySelectorAll(".aura-hype-preset .fashion-hype-matrix")].map((m) => m.getAttribute("data-layout")));
  expect(layouts.size).toBeGreaterThan(1);
  // valores de exemplo só na prévia, marcados como exemplo
  expect(document.querySelector('.aura-hype-preset .fashion-hype-matrix')?.getAttribute("data-sample")).toBe("true");

  fireEvent.click(presets[0]);
  expect(onChange).toHaveBeenCalledWith(HYPE_PRESETS[0].id);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("locks card levels above Comum until the FAI XP level reaches Studio (Rara) and Loft (Lendária, Collab)", async () => {
  loggedAs(undefined, { "GET /api/me/aura-permissions": { currentTier: "STUDIO", auras: {} } });
  renderApp(<AuraHypePicker inline value={null} onChange={vi.fn()} />);
  const level = (tier: string) => document.querySelector<HTMLButtonElement>(`.fashion-hype-level-preview[data-fashion-level="${tier}"]`)!;
  await waitFor(() => expect(level("RARE").disabled).toBe(false));
  expect(level("COMMON").disabled).toBe(false);
  expect(level("LEGENDARY").disabled).toBe(true);
  expect(level("COLLAB_DROP").disabled).toBe(true);
  expect(level("LEGENDARY").textContent).toContain("Requer nível Loft");
});
