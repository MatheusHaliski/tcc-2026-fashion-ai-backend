package br.com.fashionai.application.challenge;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.repository.*;

import static br.com.fashionai.application.service.ChallengeService.CONCLUIDO;

/**
 * Entradas (looks inscritos) de um desafio, como a página do desafio as mostra. Puro sobre os repositórios recebidos:
 * {@link ChallengeService} continua dono da transação e de quem pode ver o desafio.
 */
public final class ChallengeEntries {
    private final ChallengeEventRepository evidence;
    private final ChallengeVoteRepository votes;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final UserRepository users;

    public ChallengeEntries(ChallengeEventRepository evidence, ChallengeVoteRepository votes, SchemeRepository schemes,
                     SchemeItemRepository schemeItems, UserRepository users) {
        this.evidence = evidence;
        this.votes = votes;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.users = users;
    }

    public List<Map<String, Object>> list(CurrentUser viewer, ChallengeInstance i, boolean blind) {
        List<Map<String, Object>> out = new ArrayList<>();
        Map<UUID, Long> voteCount = CONCLUIDO.equals(i.getState()) ? votes.findByInstanceId(i.getId()).stream()
                .collect(Collectors.groupingBy(ChallengeVote::getEntrySchemeId, Collectors.counting())) : Map.of();
        for (ChallengeEvent e : evidence.findByInstanceId(i.getId())) {
            if (!"LOOK_ENTRY".equals(e.getEvidenceType())) {
                continue;
            }
            Scheme s = schemes.findById(e.getRefId()).orElse(null);
            if (s == null) {
                continue;
            }
            List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("entryId", s.getId());
            m.put("coverImageUrl", s.getCoverImageUrl());
            m.put("title", blind ? Msg.t("challenge.look", (out.size() + 1)) : s.getTitle());
            m.put("pieces", items.stream().map(si -> {
                Map<String, Object> pm = new LinkedHashMap<>();
                pm.put("imageUrl", si.getWardrobeItem().getImageUrl());
                pm.put("category", si.getWardrobeItem().getCategory());
                if (!blind) {
                    pm.put("name", si.getWardrobeItem().getName());
                    pm.put("brand", si.getWardrobeItem().getBrandName());
                }
                return pm;
            }).toList());
            m.put("author", blind ? null : users.findById(e.getUserId()).map(User::getUsername).orElse("—"));
            m.put("mine", e.getUserId().equals(viewer.id()));
            m.put("votedByMe", votes.existsByInstanceIdAndVoterUserIdAndEntrySchemeId(i.getId(), viewer.id(), s.getId()));
            if (!voteCount.isEmpty()) {
                m.put("votes", voteCount.getOrDefault(s.getId(), 0L));
            }
            out.add(m);
        }
        return out;
    }
}
