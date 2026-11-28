package br.com.fashionai.application.hype;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.fashionai.application.aura.AuraUnlockProvider;
import br.com.fashionai.application.aura.AuraUnlocks.Family;
import br.com.fashionai.application.aura.AuraUnlocks.Item;
import br.com.fashionai.application.aura.AuraUnlocks.Kind;
import br.com.fashionai.application.aura.AuraUnlocks.State;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.HypeMilestone;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.HypeMilestoneRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

/**
 * Circuito Aura (fase 1, elo 3) — os FAI Points de marco no painel "O que este card destrava". Só o dono vê (os
 * pontos são dele, inclusive com Hype pessoal). Um marco já registrado em {@code hype_milestones} aparece como
 * destravado; os demais, como o que vem a seguir. Só leitura: não credita nada e não toca no Hype.
 */
@Service
public class HypeMilestoneUnlocks implements AuraUnlockProvider {
    static final String HREF = "/points";
    private static final HypeMilestone.Kind[] LEVELS = {HypeMilestone.Kind.HOT, HypeMilestone.Kind.TRENDING, HypeMilestone.Kind.VIRAL};

    private final HypeMilestoneRepository milestones;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final HypeMilestoneRewards rewards;

    public HypeMilestoneUnlocks(HypeMilestoneRepository milestones, WardrobeItemRepository pieces, SchemeRepository schemes, HypeMilestoneRewards rewards) {
        this.milestones = milestones;
        this.pieces = pieces;
        this.schemes = schemes;
        this.rewards = rewards;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Item> items(CurrentUser viewer, HypeEntityType type, UUID id, State state) {
        if (viewer == null || !owner(viewer.id(), type, id)) {
            return List.of();
        }
        List<HypeMilestone> past = milestones.findByEntityTypeAndEntityId(type, id);
        List<Item> out = new ArrayList<>();
        for (HypeMilestone.Kind kind : LEVELS) {
            int points = rewards.pointsFor(kind);
            if (points <= 0) {
                continue;
            }
            String level = Msg.t("aura.faixa." + kind.level().name());
            boolean credited = past.stream().anyMatch(p -> p.getMilestone() == kind);
            boolean reached = HypeMilestoneNotifier.alreadyReached(past, kind);
            String detail = credited ? Msg.t("aura.unlocks.marco_creditado", level)
                    : reached ? Msg.t("aura.unlocks.marco_superado", level) : Msg.t("aura.unlocks.marco_proximo", level);
            out.add(new Item(Kind.MILESTONE_POINTS, Family.HYPE, Msg.t("aura.unlocks.marco_titulo", points), detail, HREF, kind.level(), reached));
        }
        return out;
    }

    private boolean owner(UUID viewer, HypeEntityType type, UUID id) {
        if (type == HypeEntityType.PIECE) {
            return pieces.findById(id).map(w -> w.getUser() != null && viewer.equals(w.getUser().getId())).orElse(false);
        }
        return schemes.findById(id).map(s -> s.getUser() != null && viewer.equals(s.getUser().getId())).orElse(false);
    }
}
