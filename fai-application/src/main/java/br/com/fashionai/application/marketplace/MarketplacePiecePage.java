package br.com.fashionai.application.marketplace;

import java.util.List;

public record MarketplacePiecePage(List<MarketplacePieceView> pieces, boolean hasNext) {}
