package br.com.fashionai.application.service;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ReactionType;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** O que quem vê já fez com a peça (curtida, reações, salvo, dono) e a contagem de reações por tipo. */
final class PieceViewerState {
    private final ReactionRepository reactions;
    private final SavedItemRepository savedItems;

    PieceViewerState(ReactionRepository reactions, SavedItemRepository savedItems) {
        this.reactions = reactions;
        this.savedItems = savedItems;
    }

    Views.ViewerState of(CurrentUser viewer, WardrobeItem w) {
        if (viewer == null) {
            return Views.ViewerState.NONE;
        }
        List<String> mine = reactions.findByActorIdAndTargetTypeAndTargetId(viewer.id(), TargetType.PIECE, w.getId()).stream()
                .map(r -> r.getReactionType().name()).toList();
        boolean saved = savedItems.findByUserIdAndTargetTypeAndTargetId(viewer.id(), TargetType.PIECE, w.getId()).isPresent();
        return new Views.ViewerState(mine.contains("LIKE"), mine.stream().filter(r -> !r.equals("LIKE")).toList(), saved,
                viewer.id().equals(w.getUser().getId()), false);
    }

    Map<String, Long> reactionCounts(TargetType type, UUID id) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (ReactionType t : ReactionType.values()) {
            m.put(t.name(), reactions.countByTargetTypeAndTargetIdAndReactionType(type, id, t));
        }
        return m;
    }
}
