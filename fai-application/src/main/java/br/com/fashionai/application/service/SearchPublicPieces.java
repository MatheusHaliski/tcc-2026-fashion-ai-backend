package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SearchService.Cursor;
import br.com.fashionai.application.service.SearchService.Filters;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.PageRequest;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.SearchHype.meetsLevel;
import static br.com.fashionai.application.service.SearchHype.parseLevel;
import static br.com.fashionai.application.service.SearchMatching.matches;

/** Vitrine de Peças Públicas: janela das peças públicas mais novas, filtros em chips, faixa mínima de Hype e cursor. */
final class SearchPublicPieces {
    private final WardrobeItemRepository pieces;
    private final SearchVisibility visibility;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    SearchPublicPieces(WardrobeItemRepository pieces, SearchVisibility visibility, HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.pieces = pieces;
        this.visibility = visibility;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
    }

    Map<String, Object> publicPieces(CurrentUser viewer, Filters f, String rawCursor, int size) {
        int limit = Math.max(1, Math.min(size <= 0 ? 30 : size, 60));
        Cursor cursor = Cursor.parse(rawCursor);
        Set<UUID> blocked = visibility.blockedFor(viewer == null ? null : viewer.id());
        HypeLevel min = parseLevel(f == null ? null : f.hypeLevel());
        List<WardrobeItem> window = pieces.findAllPublic(PageRequest.of(0, 500));
        Map<UUID, HypeScoreCurrent> hype = min == null ? Map.of()
                : SearchHype.hypeRows(hypeScores, hypeConfig, HypeEntityType.PIECE, window.stream().map(WardrobeItem::getId).toList());
        List<WardrobeItem> list = window.stream()
                .filter(w -> cursor == null || cursor.before(w.getCreatedAt(), w.getId()))
                .sorted(Comparator.comparing(WardrobeItem::getCreatedAt).thenComparing(WardrobeItem::getId).reversed())
                .filter(w -> visibility.visible(viewer, w, blocked)).filter(w -> matches(f, w))
                .filter(w -> meetsLevel(hype.get(w.getId()), min, hypeConfig)).limit(limit).toList();
        String next = list.size() == limit ? new Cursor(list.get(limit - 1).getCreatedAt(), list.get(limit - 1).getId()).encode() : null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", list.stream().map(w -> Views.piece(w, null, null)).toList());
        out.put("nextCursor", next); // null na última página (RF8.CA06): o cliente para de pedir
        out.put("chips", f == null ? List.of() : f.chips());
        return out;
    }
}
