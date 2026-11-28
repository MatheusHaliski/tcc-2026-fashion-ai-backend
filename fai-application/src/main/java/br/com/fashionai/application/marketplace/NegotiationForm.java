package br.com.fashionai.application.marketplace;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record NegotiationForm(UUID pieceId, UUID storeId, String recipient, Long version,
                              BigDecimal amount, String currency, String terms, Instant expiresAt) {}
