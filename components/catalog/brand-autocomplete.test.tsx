// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen } from "@/test-utils/render";
import { BrandAutocomplete } from "./brand-autocomplete";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("keeps the brand editor usable when legacy drafts omit the brand", () => {
  const onChange = vi.fn(); mockApi();
  renderApp(<BrandAutocomplete value={undefined} onChange={onChange} />);
  const input = screen.getByRole("combobox") as HTMLInputElement;
  expect(input.value).toBe("");
  fireEvent.change(input, { target: { value: "Adidas" } });
  expect(onChange).toHaveBeenCalledWith("Adidas", null);
});
