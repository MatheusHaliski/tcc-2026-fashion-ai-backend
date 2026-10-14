// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LedNumber } from "./led-number";
afterEach(cleanup);
describe("score LED", () => {
  it("acende os segmentos do número real e preserva seu texto acessível", () => {
    const { container } = render(<LedNumber value={81} />);
    expect(screen.getByText('81')).toBeTruthy();
    expect(container.querySelectorAll('g')[0].querySelectorAll('.is-lit')).toHaveLength(7);
    expect(container.querySelectorAll('g')[1].querySelectorAll('.is-lit')).toHaveLength(2);
  });
  it("mantém zero legítimo e nunca converte valor ausente em zero", () => {
    const { rerender } = render(<LedNumber value={0} />);
    expect(screen.getByText('0')).toBeTruthy();
    rerender(<LedNumber value={NaN} />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });
});
