package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF12 — o que uma foto "é" para os filtros e os insights de Minhas Fotos: a foto em si não tem ocasião, estilo nem
 * cor; eles vêm da peça (RF4) ou do look (RF5) de que a foto faz parte. Tudo aqui é calculado localmente, sem enviar
 * dados para fora.
 */
public final class PhotoInsights {
    private PhotoInsights() {
    }

    /** Dados da foto usados pelos filtros e pelo modo comparação (ocasião, estilo, cor, mês, assunto). */
    record Subject(String kind, UUID id, String title, boolean activeImage, List<String> occasion, List<String> style,
                   String color, String category) {
        static final Subject NONE = new Subject(null, null, null, false, List.of(), List.of(), null, null);
    }

    /** Filtro da galeria (RF12): origem, ocasião, estilo, cor, mês da publicação (AAAA-MM) e período (dias). */
    public record Filter(PhotoOrigin origin, String occasion, String style, String color, String month, Integer days) {
        boolean empty() {
            return origin == null && blank(occasion) && blank(style) && blank(color) && blank(month) && (days == null || days <= 0);
        }
    }

    static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    static String month(Photo p, ZoneId zone) {
        return YearMonth.from(p.getCreatedAt().atZone(zone)).toString();
    }

    static Subject subjectOf(Photo p, Map<UUID, WardrobeItem> pieces, Map<UUID, Scheme> schemes) {
        UUID src = p.getSourceEntityId();
        if (src == null) {
            return Subject.NONE;
        }
        WardrobeItem w = pieces.get(src);
        if (w != null) {
            boolean active = w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED && p.getPublicUrl() != null
                    && (p.getPublicUrl().equals(w.getImageUrl()) || p.getPublicUrl().equals(w.getOriginalImageUrl()));
            return new Subject("PIECE", w.getId(), w.getName(), active, Json.csv(w.getOccasionTags()), Json.csv(w.getStyleTags()),
                    w.getColor(), w.getCategory());
        }
        Scheme s = schemes.get(src);
        if (s != null) {
            return new Subject("SCHEME", s.getId(), s.getTitle(), p.getPublicUrl() != null && p.getPublicUrl().equals(s.getCoverImageUrl()),
                    Json.csv(s.getOccasion()), Json.csv(s.getStyle()), null, null);
        }
        return Subject.NONE;
    }

    static boolean matches(Photo p, Subject s, Filter f, ZoneId zone, Instant now) {
        if (f.origin() != null && p.getOrigin() != f.origin()) {
            return false;
        }
        if (!blank(f.occasion()) && !s.occasion().contains(f.occasion())) {
            return false;
        }
        if (!blank(f.style()) && !s.style().contains(f.style())) {
            return false;
        }
        if (!blank(f.color()) && !f.color().equalsIgnoreCase(s.color())) {
            return false;
        }
        if (!blank(f.month()) && !f.month().equals(month(p, zone))) {
            return false;
        }
        return f.days() == null || f.days() <= 0 || !p.getCreatedAt().isBefore(now.minus(f.days(), ChronoUnit.DAYS));
    }

    /** Contagens por ocasião, estilo, cor e mês — só os valores presentes viram opções dos segment pickers. */
    static Map<String, Object> facets(Collection<Photo> photos, Map<UUID, Subject> subjects, ZoneId zone) {
        Map<String, Long> occasion = new LinkedHashMap<>();
        Map<String, Long> style = new LinkedHashMap<>();
        Map<String, Long> color = new LinkedHashMap<>();
        Map<String, Long> months = new LinkedHashMap<>();
        Map<String, Long> origin = new LinkedHashMap<>();
        for (Photo p : photos) {
            Subject s = subjects.getOrDefault(p.getId(), Subject.NONE);
            s.occasion().forEach(o -> occasion.merge(o, 1L, Long::sum));
            s.style().forEach(o -> style.merge(o, 1L, Long::sum));
            if (s.color() != null) {
                color.merge(s.color(), 1L, Long::sum);
            }
            months.merge(month(p, zone), 1L, Long::sum);
            origin.merge(p.getOrigin().name(), 1L, Long::sum);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("occasion", sorted(occasion));
        out.put("style", sorted(style));
        out.put("color", sorted(color));
        out.put("month", months.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByKey().reversed())
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new)));
        out.put("origin", origin);
        return out;
    }

    static Map<String, Long> sorted(Map<String, Long> m) {
        return m.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));
    }

    static Map<String, Object> view(Photo p, Subject s, ZoneId zone) {
        Map<String, Object> m = new LinkedHashMap<>();
        Views.PhotoView v = Views.photo(p);
        m.put("id", v.id());
        m.put("origin", v.origin());
        m.put("sourceEntityId", v.sourceEntityId());
        m.put("url", v.url());
        m.put("thumbnailUrl", v.thumbnailUrl());
        m.put("mimeType", v.mimeType());
        m.put("width", v.width());
        m.put("height", v.height());
        m.put("bytes", v.bytes());
        m.put("keyMoment", v.keyMoment());
        m.put("editedFromPhotoId", v.editedFromPhotoId());
        m.put("createdAt", v.createdAt());
        m.put("month", month(p, zone));
        if (s.kind() != null) {
            Map<String, Object> subject = new LinkedHashMap<>();
            subject.put("kind", s.kind());
            subject.put("id", s.id());
            subject.put("title", s.title());
            subject.put("activeImage", s.activeImage());
            subject.put("occasion", s.occasion());
            subject.put("style", s.style());
            subject.put("color", s.color());
            subject.put("category", s.category());
            m.put("subject", subject);
        }
        return m;
    }

    /** Frases dos insights (locais): o que mais aparece nas fotos, por cor, ocasião e estilo, e o ritmo dos últimos meses. */
    static List<String> sentences(Map<String, Long> color, Map<String, Long> occasion, Map<String, Long> style,
                                  Map<String, Long> months, int total, java.util.function.Function<String, String> label) {
        List<String> out = new ArrayList<>();
        if (total == 0) {
            return out;
        }
        top(color).ifPresent(e -> out.add(br.com.fashionai.application.common.Msg.t("photo.insight_cor", label.apply(e.getKey()), pct(e.getValue(), color))));
        top(occasion).ifPresent(e -> out.add(br.com.fashionai.application.common.Msg.t("photo.insight_ocasiao", label.apply(e.getKey()), pct(e.getValue(), occasion))));
        top(style).ifPresent(e -> out.add(br.com.fashionai.application.common.Msg.t("photo.insight_estilo", label.apply(e.getKey()), pct(e.getValue(), style))));
        if (months.size() >= 2) {
            List<Map.Entry<String, Long>> byMonth = new ArrayList<>(months.entrySet());
            byMonth.sort(Map.Entry.comparingByKey());
            Map.Entry<String, Long> last = byMonth.get(byMonth.size() - 1);
            Map.Entry<String, Long> prev = byMonth.get(byMonth.size() - 2);
            out.add(br.com.fashionai.application.common.Msg.t(last.getValue() >= prev.getValue() ? "photo.insight_ritmo_sobe" : "photo.insight_ritmo_desce",
                    last.getValue(), last.getKey(), prev.getValue(), prev.getKey()));
        }
        return out;
    }

    private static java.util.Optional<Map.Entry<String, Long>> top(Map<String, Long> m) {
        return m.entrySet().stream().max(Map.Entry.comparingByValue());
    }

    private static long pct(long v, Map<String, Long> m) {
        long sum = m.values().stream().mapToLong(Long::longValue).sum();
        return sum == 0 ? 0 : Math.round(100.0 * v / sum);
    }

    static Set<UUID> ids(Collection<Photo> photos, Set<PhotoOrigin> origins) {
        return photos.stream().filter(p -> origins.contains(p.getOrigin())).map(Photo::getSourceEntityId)
                .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
    }

    static String lower(String s) {
        return s == null ? null : s.toLowerCase(Locale.ROOT);
    }
}
