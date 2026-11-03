package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.ChallengeEvent;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.repository.ChallengeEventRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.application.service.MirrorService.PieceRestrictionProvider.Restriction;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.ChallengeRules.round2;
import static br.com.fashionai.application.service.ChallengeRules.runwayTheme;
import static br.com.fashionai.application.service.ChallengeRules.today;
import static br.com.fashionai.application.service.ChallengeRules.tplName;
import static br.com.fashionai.application.service.ChallengeRules.tplRule;

/**
 * Integração com o quarto (decorações, CA13), o Vista-me (restrição de peças, CA14) e o Copilot (resumo dos ativos).
 * Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeIntegrations {
    private final ChallengeEventRepository evidence;
    private final SchemeRepository schemes;
    private final WardrobeItemRepository pieces;
    private final ChallengeStore store;
    private final ChallengeProgressMeter progress;

    ChallengeIntegrations(ChallengeEventRepository evidence, SchemeRepository schemes, WardrobeItemRepository pieces, ChallengeStore store,
                          ChallengeProgressMeter progress) {
        this.evidence = evidence;
        this.schemes = schemes;
        this.pieces = pieces;
        this.store = store;
        this.progress = progress;
    }

    /** RF36.CA13 — elemento visual do desafio ativo no quarto; some quando o desafio termina. */
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> decorations(UUID userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] row : store.activeParticipations(userId)) {
            ChallengeInstance i = (ChallengeInstance) row[0];
            ChallengeParticipant p = (ChallengeParticipant) row[1];
            ChallengeTemplate t = (ChallengeTemplate) row[2];
            if (t.getRoomDecoration() == null) {
                continue;
            }
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("challengeId", i.getId());
            d.put("type", t.getRoomDecoration());
            d.put("name", tplName(t));
            Map<String, Object> params = Json.map(i.getParamsJson());
            switch (t.getRoomDecoration()) {
                case "quadro_cortica" -> {
                    List<Map<String, Object>> polaroids = evidence.findByInstanceIdAndUserId(i.getId(), userId).stream()
                            .filter(e -> "LOOK".equals(e.getEvidenceType())).map(e -> schemes.findById(e.getRefId()).orElse(null)).filter(Objects::nonNull)
                            .map(s -> Map.<String, Object>of("schemeId", s.getId(), "coverImageUrl", String.valueOf(s.getCoverImageUrl()))).toList();
                    d.put("days", t.getDurationDays());
                    d.put("polaroids", polaroids);
                }
                case "fita_alfaiate" -> {
                    Set<String> capsule = new HashSet<>(Json.strings(Json.write(params.get("piece_ids"))));
                    d.put("tapedPieceIds", pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().map(w -> w.getId().toString())
                            .filter(x -> !capsule.contains(x)).toList());
                }
                case "etiqueta_2a_chance" -> {
                    Set<UUID> rescued = evidence.findByInstanceIdAndUserId(i.getId(), userId).stream().filter(e -> "RESCUE".equals(e.getEvidenceType()))
                            .map(ChallengeEvent::getRefId).collect(Collectors.toSet());
                    d.put("taggedPieceIds", Json.strings(Json.write(Json.map(p.getPersonalGoalJson()).get("forgotten"))).stream()
                            .filter(x -> !rescued.contains(UUID.fromString(x))).toList());
                }
                case "calendario_parede" -> d.put("days", progress.progress(i, p, t).value());
                case "tema_espelho" -> d.put("theme", params.getOrDefault("theme", runwayTheme(today())));
                default -> {
                }
            }
            out.add(d);
        }
        return out;
    }

    /** RF36.CA14 — 10×10 e Temporada Cápsula restringem o Vista-me e o Copilot às peças do desafio. */
    Optional<Restriction> restriction(UUID userId) {
        for (Object[] row : store.activeParticipations(userId)) {
            ChallengeInstance i = (ChallengeInstance) row[0];
            ChallengeTemplate t = (ChallengeTemplate) row[2];
            if (t.getCode().equals("TEN_X_TEN") || t.getCode().equals("CAPSULE_SEASON")) {
                Set<UUID> allowed = Json.strings(Json.write(Json.map(i.getParamsJson()).get("piece_ids"))).stream().map(UUID::fromString)
                        .collect(Collectors.toCollection(LinkedHashSet::new));
                return Optional.of(new Restriction(tplName(t), allowed));
            }
        }
        return Optional.empty();
    }

    /** Resumo para o Copilot (RF10): desafios ativos e regras em vigor. */
    List<Map<String, Object>> activeSummary(UUID userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] row : store.activeParticipations(userId)) {
            ChallengeInstance i = (ChallengeInstance) row[0];
            ChallengeParticipant p = (ChallengeParticipant) row[1];
            ChallengeTemplate t = (ChallengeTemplate) row[2];
            out.add(Map.of("id", i.getId().toString(), "name", tplName(t), "rule", tplRule(t), "mode", i.getMode(),
                    "fraction", round2(p.getProgressFraction().doubleValue())));
        }
        return out;
    }
}
