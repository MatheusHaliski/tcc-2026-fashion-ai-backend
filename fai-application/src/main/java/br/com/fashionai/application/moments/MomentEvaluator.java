package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentChallenge;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.moments.MomentRules.contextualHype;
import static br.com.fashionai.application.moments.MomentRules.rounded;

/** Avaliação de um look num Momento: MomentMatch, fatos verificáveis, linhas de pontos e scores. */
final class MomentEvaluator extends MomentSupport {
    MomentEvaluator(MomentContext ctx) {
        super(ctx);
    }

    record Evaluation(MomentMatch.Result match, MomentPointsPolicy.Facts facts, List<MomentPointsPolicy.Line> lines, Map<String, Object> scores) {
    }

    Evaluation evaluate(Moment m, UUID userId, Scheme s, UUID challengeId, String interpretation, boolean countingThis) {
        Instant now = now();
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
        if (items.isEmpty()) {
            throw ApiException.badRequest("LOOK_VAZIO", Msg.t("moment.o_look_precisa_de_pecas"));
        }
        List<WardrobeItem> look = items.stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).toList();
        List<MomentChallenge> cs = challenges.findByMomentIdOrderBySortOrderAsc(m.getId());
        MomentChallenge chosen = challengeId == null ? null : cs.stream().filter(c -> c.getId().equals(challengeId)).findFirst()
                .orElseThrow(() -> ApiException.notFound(Msg.t("moment.desafio")));
        MomentMatch.Subject subject = subjectOf(s, items);
        MomentMatch.Result match = MomentMatch.score(contextOf(m, chosen), subject);
        if (match != null && interpretation != null && match.interpretation() == null) {
            match = new MomentMatch.Result(match.score(), match.parts(), interpretation, match.reasons());
        }
        // fatos
        boolean wardrobeOnly = look.stream().allMatch(w -> w.getCreatedAt() != null && w.getCreatedAt().isBefore(m.getStartAt()));
        Map<UUID, LocalDate> lastDiary = new HashMap<>();
        for (PieceUsageDiaryEntry e : diary.findByUserIdAndUsedOnAfter(userId, LocalDate.now(ZoneId.of("America/Sao_Paulo")).minusYears(5))) {
            lastDiary.merge(e.getWardrobeItemId(), e.getUsedOn(), (a, b) -> a.isAfter(b) ? a : b);
        }
        List<Scheme> previous = schemes.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(x -> !x.getId().equals(s.getId()) && x.getCreatedAt() != null && x.getCreatedAt().isBefore(s.getCreatedAt() == null ? now : s.getCreatedAt())).toList();
        Map<UUID, Instant> lastInLook = new HashMap<>();
        if (!previous.isEmpty()) {
            for (SchemeItem si : schemeItems.findBySchemeIdIn(previous.stream().map(Scheme::getId).toList())) {
                if (si.getWardrobeItem() != null && si.getScheme() != null && si.getScheme().getCreatedAt() != null) {
                    lastInLook.merge(si.getWardrobeItem().getId(), si.getScheme().getCreatedAt(), (a, b) -> a.isAfter(b) ? a : b);
                }
            }
        }
        int idleDays = cs.stream().filter(c -> c.getKind() == br.com.fashionai.domain.model.enums.MomentChallengeKind.REDISCOVERY)
                .map(c -> MomentPointsPolicy.intParam(Json.map(c.getParamsJson()), "idleDays", MomentPointsPolicy.DEFAULT_IDLE_DAYS)).min(Integer::compare).orElse(MomentPointsPolicy.DEFAULT_IDLE_DAYS);
        List<UUID> rediscovered = new ArrayList<>();
        long maxIdle = 0;
        LocalDate today = now.atZone(ZoneId.of("America/Sao_Paulo")).toLocalDate();
        for (WardrobeItem w : look) {
            LocalDate last = lastDiary.get(w.getId());
            if (w.getLastWornDate() != null && (last == null || w.getLastWornDate().isAfter(last))) {
                last = w.getLastWornDate();
            }
            Instant inLook = lastInLook.get(w.getId());
            if (inLook != null) {
                LocalDate d = inLook.atZone(ZoneId.of("America/Sao_Paulo")).toLocalDate();
                if (last == null || d.isAfter(last)) {
                    last = d;
                }
            }
            if (last == null && w.getCreatedAt() != null) {
                last = w.getCreatedAt().atZone(ZoneId.of("America/Sao_Paulo")).toLocalDate();
            }
            long idle = last == null ? 0 : ChronoUnit.DAYS.between(last, today);
            if (idle >= idleDays) {
                rediscovered.add(w.getId());
                maxIdle = Math.max(maxIdle, idle);
            }
        }
        boolean remix = s.getOriginalScheme() != null && s.getOriginalScheme().getCreatedAt() != null && s.getOriginalScheme().getCreatedAt().isBefore(m.getStartAt());
        Set<String> usedBefore = previous.stream().flatMap(x -> Json.csv(x.getStyle()).stream()).map(x -> x.toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
        Set<String> newStyles = subject.styles().stream().filter(x -> !usedBefore.contains(x)).collect(Collectors.toCollection(LinkedHashSet::new));
        if (previous.isEmpty()) {
            newStyles = Set.of();   // primeiro look não "experimenta estilo novo": não há histórico para comparar
        }
        int distinctColors = (int) look.stream().map(WardrobeItem::getColor).filter(Objects::nonNull).map(c -> c.toLowerCase(Locale.ROOT)).distinct().count();
        List<MomentSubmission> mine = submissions.findByMomentIdAndUserIdAndWithdrawnFalse(m.getId(), userId);
        Map<UUID, Integer> looksPerPiece = new HashMap<>();
        look.forEach(w -> looksPerPiece.merge(w.getId(), 1, Integer::sum));
        if (!mine.isEmpty()) {
            for (SchemeItem si : schemeItems.findBySchemeIdIn(mine.stream().map(MomentSubmission::getSchemeId).toList())) {
                if (si.getWardrobeItem() != null) {
                    looksPerPiece.merge(si.getWardrobeItem().getId(), 1, Integer::sum);
                }
            }
        }
        boolean published = s.getStatus() == SchemeStatus.PUBLISHED && s.getVisibility() != Visibility.PRIVATE
                && (s.getPublishedAt() == null || !s.getPublishedAt().isBefore(m.getStartAt()));
        MomentPointsPolicy.Facts facts = new MomentPointsPolicy.Facts(match == null ? (contextOf(m, null).empty() ? 100 : null) : match.score(), published, wardrobeOnly, rediscovered, maxIdle,
                remix, newStyles, distinctColors, looksPerPiece, subject.styles(), subject.colors(), mine.size() + (countingThis ? 1 : 0));
        List<MomentPointsPolicy.Line> lines = MomentPointsPolicy.compute(m, cs, facts);
        Map<String, Object> scores = new LinkedHashMap<>();
        scores.put("moment", match == null ? null : match.score());
        Double lookHype = hypeScore(HypeEntityType.SCHEME, s.getId(), userId);
        scores.put("hype", rounded(lookHype));
        scores.put("contextualHype", contextualHype(lookHype, match == null ? null : match.score()));
        scores.put("reuse", look.isEmpty() ? null : (int) Math.round(100.0 * look.stream().filter(w -> w.getCreatedAt() != null && w.getCreatedAt().isBefore(m.getStartAt())).count() / look.size()));
        scores.put("rediscovery", look.isEmpty() ? null : (int) Math.round(100.0 * rediscovered.size() / look.size()));
        return new Evaluation(match, facts, lines, scores);
    }

    static MomentMatch.Subject subjectOf(Scheme s, List<SchemeItem> items) {
        Set<String> styles = new LinkedHashSet<>(Json.csv(s.getStyle()));
        Set<String> colors = new LinkedHashSet<>();
        Set<String> subs = new LinkedHashSet<>();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            if (w == null) {
                continue;
            }
            styles.addAll(Json.csv(w.getStyleTags()));
            colors.addAll(HypeQueryService.colorsOf(w));
            if (w.getSubcategory() != null) {
                subs.add(w.getSubcategory());
            }
        }
        return MomentMatch.subject(styles, colors, Json.csv(s.getOccasion()), subs);
    }

    static MomentMatch.Subject subjectOf(WardrobeItem w) {
        return MomentMatch.subject(Json.csv(w.getStyleTags()), HypeQueryService.colorsOf(w), Json.csv(w.getOccasionTags()),
                w.getSubcategory() == null ? List.of() : List.of(w.getSubcategory()));
    }
}
