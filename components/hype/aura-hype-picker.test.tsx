// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, renderApp, screen } from "@/test-utils/render";
import { HYPE_PRESETS } from "@/lib/hype/aura-hype-presets";
import { AuraHypePicker } from "./aura-hype-picker";

afterEach(cleanup);

it("previews AURA Hype presets as cards with score and Hype attributes, not fabric scans", () => {
  const onChange = vi.fn();
  renderApp(<AuraHypePicker value={null} onChange={onChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Explorar 40 modelos Hype" }));

  expect(document.querySelectorAll(".aura-hype-preset")).toHaveLength(HYPE_PRESETS.length);
  expect(screen.getAllByText("Versatilidade")).toHaveLength(HYPE_PRESETS.length);
  expect(screen.getAllByText("Legacy / longevidade")).toHaveLength(HYPE_PRESETS.length);
  expect(document.querySelector(".aura-hype")).toBeNull();
  expect(screen.getByText(/score e atributos reais quando disponíveis/i)).toBeTruthy();

  fireEvent.click(document.querySelector(".aura-hype-preset")!);
  expect(onChange).toHaveBeenCalledWith(HYPE_PRESETS[0].id);
  expect(screen.queryByRole("dialog")).toBeNull();
});
