package br.com.fashionai.application.marketplace;

import java.util.List;

public record StorePage(List<PhysicalStoreView> stores, boolean hasNext) {}
