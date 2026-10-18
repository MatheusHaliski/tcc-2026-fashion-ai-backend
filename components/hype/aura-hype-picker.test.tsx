// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { HYPE_PRESETS } from "@/lib/hype/aura-hype-presets";
import { AuraHypePicker } from "./aura-hype-picker";

afterEach(cleanup);

it("previews each AURA Hype model with its own live effect, without repeating empty attributes", () => {
  const onChange = vi.fn();
  renderApp(<AuraHypePicker value={null} onChange={onChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Explorar 40 modelos Hype" }));

  expect(document.querySelectorAll(".aura-hype-preset")).toHaveLength(HYPE_PRESETS.length);
  const effects = [...document.querySelectorAll(".aura-hype-preset .aura-hype")];
  expect(effects).toHaveLength(HYPE_PRESETS.length);
  expect(new Set(effects.map((e) => e.getAttribute("data-preset"))).size).toBe(HYPE_PRESETS.length);
  expect(document.querySelector(".aura-hype-preset .fashion-hype-matrix")).toBeNull();
  expect(screen.getByText(/score e atributos reais quando disponíveis/i)).toBeTruthy();

  fireEvent.click(document.querySelector(".aura-hype-preset")!);
  expect(onChange).toHaveBeenCalledWith(HYPE_PRESETS[0].id);
  expect(screen.queryByRole("dialog")).toBeNull();
});
