package br.com.fashionai.application.marketplace;

import java.util.Map;
import java.util.UUID;

public record FaiDigitalOfferForm(String code, String name, String kind, UUID productId,
                                  Map<String, Object> design, int points, Integer stock, boolean active) {}
