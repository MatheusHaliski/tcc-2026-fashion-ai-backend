package br.com.fashionai.application.service;

import br.com.fashionai.application.service.InventoryScoreService.Dimension;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Planilha de um cálculo do Inventory Score (§3–§4): os dados da janela carregados uma vez (peças, looks, diário) e o
 * que cada dimensão deixa para as seguintes e para as métricas, na ordem C, D, U, V, O, R, I.
 */
final class InventoryScoreSheet {
    UUID userId;
    LocalDate today;
    LocalDate since;
    List<WardrobeItem> all;
    List<WardrobeItem> a;
    int n;
    Map<UUID, WardrobeItem> byId;
    List<Scheme> allSchemes;
    Map<UUID, Scheme> schemeById;
    Map<UUID, List<UUID>> schemePieces;
    Instant survival;
    Instant sinceInstant;
    List<List<UUID>> windowLooks;
    Map<UUID, TreeSet<LocalDate>> usage;
    Map<UUID, TreeSet<LocalDate>> usageAll;
    Map<String, Integer> dims;
    Map<String, Object> metrics;
    List<Dimension> explain;

    // saídas das dimensões, lidas pelas seguintes e pelas métricas
    Set<String> discoveredKeys;
    InventoryComboCounter.Combos combos;
    List<WardrobeItem> exposed;
    long usedInWindow;
    List<WardrobeItem> forgottenNow;
    Map<UUID, Long> appearances;
    Set<UUID> f;
    Set<UUID> rescued;
    Map<UUID, Long> rescueGap;
}
