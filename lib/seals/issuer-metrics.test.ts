/**
 * Regressão da auditoria: a aba Métricas do emissor mostrava os nomes técnicos em inglês e maiúsculas
 * ("PENDING REVIEW", "CONVERSION SEAL TO REDEMPTION") e números crus.
 */
import { describe, expect, it } from "vitest";
import { label } from "@/lib/api/taxonomy";
import { issuerMetricLabel, issuerMetricValue } from "./issuer-metrics";

describe("métricas do emissor de selos", () => {
  it("cada métrica do servidor tem nome em português", () => {
    expect(issuerMetricLabel("pendingReview")).toBe("Aguardando sua revisão");
    expect(issuerMetricLabel("conversionSealToRedemption")).toBe("Selos que viraram resgate");
    for (const k of ["suggested", "accepted", "approved", "activeSeals", "redemptions"]) {
      expect(issuerMetricLabel(k)).not.toMatch(/issuerMetrics\.|[A-Z]{3,}/);
    }
  });

  it("métrica desconhecida continua legível e os números saem no formato do idioma", () => {
    expect(issuerMetricLabel("novaMetrica")).toBe("nova metrica");
    expect(issuerMetricValue("conversionSealToRedemption", 33.3)).toBe("33,3%");
    expect(issuerMetricValue("approved", 1200)).toBe("1.200");
    expect(issuerMetricValue("x", "texto")).toBe("texto");
  });

  it("nível do selo aparece com cedilha (era \"Peca\")", () => {
    expect(label("peca")).toBe("Peça");
    expect(label("perfil")).toBe("Perfil");
  });
});
