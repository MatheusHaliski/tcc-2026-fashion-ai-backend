package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CommunityTrend;
import br.com.fashionai.domain.repository.CommunityTrendRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** RF32: trends publicadas pelos usuários. A publicação é a unidade de concessão, nunca modifica Hype. */
@Service
public class CommunityTrendService {
    public static final List<String> KINDS = List.of("PASSA_O_LOOK", "COR_EM_COMUM", "REINTERPRETACAO", "PECA_ASSINATURA", "DUETO_CRIATIVO");
    private final CommunityTrendRepository trends;
    private final UserRepository users;
    private final Guard guard;
    private final FaiPointsService points;
    public CommunityTrendService(CommunityTrendRepository trends, UserRepository users, Guard guard, FaiPointsService points) {
        this.trends = trends; this.users = users; this.guard = guard; this.points = points;
    }
    public record Create(String title, String description, String kind, Integer durationDays) {}
    @Transactional(readOnly = true)
    public Map<String, Object> list(String kind, int page, int size) {
        if (kind != null && !kind.isBlank() && !KINDS.contains(kind)) throw invalid("kind");
        var pageable = PageRequest.of(Math.max(0, page), Math.min(48, Math.max(1, size)), Sort.by(Sort.Direction.DESC, "publishedAt").and(Sort.by("id")));
        var data = kind == null || kind.isBlank() ? trends.findByStatusAndEndsAtAfter("PUBLISHED", Instant.now(), pageable)
            : trends.findByStatusAndKindAndEndsAtAfter("PUBLISHED", kind, Instant.now(), pageable);
        return Map.of("items", data.getContent().stream().map(this::view).toList(), "total", data.getTotalElements(), "page", pageable.getPageNumber(), "size", pageable.getPageSize(), "kinds", KINDS);
    }
    @Transactional
    public Map<String, Object> create(CurrentUser user, Create request) {
        guard.requireCanCreate(user);
        if (request == null || !KINDS.contains(request.kind())) throw invalid("kind");
        if (request.durationDays() == null || request.durationDays() < 1 || request.durationDays() > 30) throw invalid("durationDays");
        String title = InputSanitizer.moderated("title", request.title() == null ? "" : request.title(), 80);
        String description = InputSanitizer.moderated("description", request.description() == null ? "" : request.description(), 1000);
        if (title.isBlank()) throw invalid("title");
        if (description.isBlank()) throw invalid("description");
        CommunityTrend trend = new CommunityTrend(); trend.setAuthorId(user.id()); trend.setTitle(title); trend.setDescription(description);
        trend.setKind(request.kind()); trend.setDurationDays(request.durationDays());
        return view(trends.save(trend));
    }
    @Transactional
    public Map<String, Object> publish(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        // Mesmo usuário, inclusive em duas trends distintas: serializa a consulta aos limites de Points.
        users.lockById(user.id()).orElseThrow(() -> ApiException.notFound("User"));
        CommunityTrend trend = trends.lockById(id).filter(t -> user.id().equals(t.getAuthorId())).orElseThrow(() -> ApiException.notFound("Trend"));
        if ("PUBLISHED".equals(trend.getStatus())) return Map.of("trend", view(trend), "awardedPoints", 0, "alreadyPublished", true);
        if (!"DRAFT".equals(trend.getStatus())) throw invalid("status");
        Instant now = Instant.now(); trend.setPublishedAt(now); trend.setEndsAt(now.plus(trend.getDurationDays(), ChronoUnit.DAYS)); trend.setStatus("PUBLISHED");
        var award = points.award(user.id(), "TREND_PUBLISHED", "TREND", id.toString(), null);
        trend.setAwardedPoints(award.points()); trends.save(trend);
        return Map.of("trend", view(trend), "awardedPoints", award.points(), "capReached", award.capReached(), "pointsMessage", award.message(), "alreadyPublished", false);
    }
    private ApiException invalid(String field) { return ApiException.badRequest("TREND_INVALIDA", Msg.t("trend.invalid", field)); }
    private Map<String, Object> view(CommunityTrend trend) {
        Map<String,Object> out = new LinkedHashMap<>();
        out.put("id", trend.getId()); out.put("title", trend.getTitle()); out.put("description", trend.getDescription()); out.put("kind", trend.getKind());
        out.put("status", trend.getStatus()); out.put("durationDays", trend.getDurationDays()); out.put("endsAt", trend.getEndsAt()); out.put("publishedAt", trend.getPublishedAt()); out.put("awardedPoints", trend.getAwardedPoints());
        var author = users.findById(trend.getAuthorId()).orElse(null);
        out.put("author", author == null ? null : Map.of("username", author.getUsername(), "displayName", author.getDisplayName() == null ? author.getUsername() : author.getDisplayName()));
        return out;
    }
}
