// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FashionCardComponent } from "./fashion-card";
import { AuraImpersonationService } from "@/lib/aura/aura-impersonation-service";
import type { CatalogProduct } from "@/lib/api/catalog";

const product = { id: "p1", productName: "Jaqueta", imageUrl: "/a.png", fashionCard: { rarity: "RARE", auraType: "STATIC", stats: { versatility: 120, hypeIndex: 40, legacyScore: -5 } } } as unknown as CatalogProduct;

describe("Aura Impersonation", () => {
  it("service activates IMPERSONATION with rendered url and keeps original untouched", async () => {
    const out = await new AuraImpersonationService().generateImpersonationAura({ product, userImage: "x", userMediaUrl: "/u.jpg", motionTemplateId: "walk-01", powerVfx: "COSMIC_GOLD" });
    expect(out.fashionCard?.auraType).toBe("IMPERSONATION");
    expect(out.fashionCard?.impersonationData?.renderedCardMediaUrl).toContain("walk-01");
    expect(out.fashionCard?.rarity).toBe("RARE");
    expect(product.fashionCard?.auraType).toBe("STATIC");
    await expect(new AuraImpersonationService().generateImpersonationAura({ product, userImage: "x", userMediaUrl: "/u.jpg", motionTemplateId: " " })).rejects.toThrow();
  });
  it("renders loop video, badge and clamped stats for IMPERSONATION; photo otherwise", async () => {
    const imp = await new AuraImpersonationService().generateImpersonationAura({ product, userImage: "x", userMediaUrl: "/u.jpg", motionTemplateId: "walk-01" });
    const { container, unmount } = render(<FashionCardComponent product={imp} />);
    expect(container.querySelector("video")).not.toBeNull();
    expect(container.querySelector(".fashion-card-aura-oob")).not.toBeNull();
    expect(screen.getByText(/Aura Impersonation/)).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
    unmount();
    const s = render(<FashionCardComponent product={product} />);
    expect(s.container.querySelector("video")).toBeNull();
    expect(s.container.querySelector("img")).not.toBeNull();
  });
});
