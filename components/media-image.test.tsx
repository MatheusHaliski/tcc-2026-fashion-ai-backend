// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MediaImage } from "./media-image";
import { mediaUrl } from "@/lib/api/client";

describe("MediaImage recuperação da foto da peça", () => {
  it("tenta a foto principal após miniatura quebrada, elimina duplicatas e remove srcSet antigo", () => {
    const onError = vi.fn();
    const { container } = render(<MediaImage src="/media/thumb.jpg" srcSet="/media/thumb-small.jpg 320w" fallbackSources={["/media/thumb.jpg", "/media/main.jpg"]} alt="Peça" onError={onError} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(mediaUrl("/media/thumb.jpg"));
    fireEvent.error(container.querySelector("img")!);
    expect(onError).toHaveBeenCalledOnce();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(mediaUrl("/media/main.jpg"));
    expect(container.querySelector("img")?.getAttribute("srcset")).toBeNull();
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
  });
  it("reinicia a seleção quando muda a peça, sem repetir fotos que falharam", () => {
    const { container, rerender } = render(<MediaImage src="broken.jpg" fallbackSources={["original.jpg"]} alt="Peça" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("original.jpg");
    rerender(<MediaImage src="new.jpg" fallbackSources={["original.jpg"]} alt="Peça" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("new.jpg");
  });
});
