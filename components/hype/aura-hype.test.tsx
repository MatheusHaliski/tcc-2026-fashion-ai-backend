// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, renderApp, screen } from "@/test-utils/render";
import { AuraHype } from "./aura-hype";
afterEach(cleanup);
it("shows the real score and chosen effect", () => {
  const { container } = renderApp(<AuraHype mode="DOTS" state={{ kind: "available", score: 73, level: "HOT", direction: null, stale: false }} />);
  expect(screen.getByText("HYPE 73/100")).toBeTruthy();
  expect(container.querySelector('[data-effect="DOTS"]')).toBeTruthy();
});
it("never invents a zero score when unavailable", () => {
  renderApp(<AuraHype state={{ kind: "not_calculated" }} />);
  expect(screen.getByText("Hype ainda indisponível")).toBeTruthy();
  expect(screen.queryByText(/0\/100/)).toBeNull();
});
