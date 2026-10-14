// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, renderApp, screen } from "@/test-utils/render";
import { AuraHype } from "./aura-hype";
afterEach(cleanup);
it("shows the real score and chosen effect", () => {
  const { container } = renderApp(<AuraHype mode="DOTS" state={{ kind: "available", score: 73, level: "HOT", direction: null, stale: false }} />);
  expect(screen.getByText("HYPE 73")).toBeTruthy();
  expect(container.querySelector('[data-effect="DOTS"]')).toBeTruthy();
});
it("never invents a zero score when unavailable", () => {
  renderApp(<AuraHype state={{ kind: "not_calculated" }} />);
  expect(screen.getByText("AURA ativa · aguardando cálculo do Hype")).toBeTruthy();
  expect(screen.queryByText(/0\/100/)).toBeNull();
});
it("uses only the global score on the photo, without a game attribute table", () => {
  const { container } = renderApp(<AuraHype mode="SCANNER" state={{ kind: "available", score: 84, level: "HOT", direction: null, stale: false }} />);
  expect(container.querySelector('.aura-hype-total .led-number')?.textContent).toBe('84');
  expect(container.textContent).not.toContain('/100');
  expect(container.querySelector('dl')).toBeNull();
  expect(container.querySelector('.fgc')).toBeNull();
});
