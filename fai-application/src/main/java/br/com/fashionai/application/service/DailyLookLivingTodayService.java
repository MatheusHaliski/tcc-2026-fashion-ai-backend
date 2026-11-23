package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.DailyLookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Look do Dia Vivido F2 (§4.1) — "quem mais está vivendo isso hoje": pessoas que registraram o Look do Dia com o mesmo
 * propósito na mesma data. Os looks são comparáveis pela missão, não pelo estilo. Só entram looks que a pessoa pode ver;
 * propósito sensível (CUIDADO) e público "só eu" nunca entram nem geram carrossel; o número só aparece com ≥ 5 pessoas.
 */
@Service
public class DailyLookLivingTodayService {
    public static final int MIN_GROUP = 5;
    public static final int MAX_LOOKS = 12;

    private final DailyLookRepository dailyLooks;
    private final SchemeService schemes;

    public DailyLookLivingTodayService(DailyLookRepository dailyLooks, SchemeService schemes) {
        this.dailyLooks = dailyLooks;
        this.schemes = schemes;
    }

    /** GET /api/me/daily-looks/living-today — o carrossel do dia da própria pessoa (vazio sem Look do Dia ou sem propósito). */
    @Transactional(readOnly = true)
    public Map<String, Object> livingToday(CurrentUser user, LocalDate date) {
        LocalDate day = date == null ? LocalDate.now(FaiPointsService.ZONE) : date;
        Optional<DailyLook> mine = dailyLooks.findByUserIdAndLookDate(user.id(), day);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", day);
        out.put("purpose", mine.map(DailyLook::getPurpose).map(Enum::name).orElse(null));
        out.put("purposeLabel", mine.map(DailyLook::getPurpose).map(p -> Msg.t("dailyLook.purpose." + p.name())).orElse(null));
        boolean hidden = mine.isPresent() && mine.get().getPurpose() != null && !RunwayPurpose.shareable(mine.get());
        out.put("hidden", hidden);
        if (mine.isEmpty() || mine.get().getPurpose() == null || hidden) {
            out.put("count", 0);
            out.put("enough", false);
            out.put("looks", List.of());
            return out;
        }
        List<DailyLook> others = dailyLooks.findByLookDateAndPurpose(day, mine.get().getPurpose()).stream()
                .filter(dl -> !dl.getUser().getId().equals(user.id()) && dl.getUser().getStatus() == AccountStatus.ACTIVE && RunwayPurpose.shareable(dl))
                .filter(dl -> dl.getScheme().getStatus() != SchemeStatus.ARCHIVED && schemes.canView(user, dl.getScheme())).toList();
        boolean enough = others.size() >= MIN_GROUP;
        out.put("count", others.size());
        out.put("enough", enough);
        out.put("minGroup", MIN_GROUP);
        out.put("looks", enough ? others.stream().limit(MAX_LOOKS).map(DailyLookLivingTodayService::card).toList() : List.of());
        return out;
    }

    /** Card leve do carrossel: look e dono; nada da nota nem do público da outra pessoa. */
    static Map<String, Object> card(DailyLook dl) {
        User u = dl.getUser();
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("schemeId", dl.getScheme().getId());
        c.put("title", dl.getScheme().getTitle());
        c.put("coverImageUrl", dl.getScheme().getCoverImageUrl());
        c.put("worked", dl.getFeedback() == br.com.fashionai.domain.model.enums.DailyLookFeedback.ADOREI);
        c.put("owner", Map.of("id", u.getId(), "username", u.getUsername(), "displayName", u.getDisplayName() == null ? u.getUsername() : u.getDisplayName(),
                "avatarUrl", u.getAvatarUrl() == null ? "" : u.getAvatarUrl()));
        return c;
    }
}
