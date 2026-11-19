package br.com.fashionai.application.moments;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.MomentRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Look do Dia Vivido (docs/novos-rf/PROPOSTA_LOOK_DO_DIA_VIVIDO.md §3–§4): os Momentos de um DIA do calendário — datas
 * culturais, temporadas, eventos, desafios oficiais e de comunidade, Momentos do grupo FLAIR — e o MomentMatch de um look
 * contra cada um deles. É a ponte entre o registro do Look do Dia e o calendário de Momentos; não cria nem altera Momentos.
 *
 * <p>Depende só de repositórios (não do {@link MomentService}): o Look do Dia entra na cadeia HypeQueryService →
 * SchemeService → DailyLookService, e o MomentService depende do HypeQueryService — um bean aqui fecharia o ciclo.</p>
 */
@Service
public class MomentDays {
    /** Mesma régua de MOMENT_LOOK (MomentPointsPolicy): a partir deste match o look "conversa" com o Momento. */
    public static final int COHERENT_FROM = 40;

    private final MomentRepository moments;
    private final UserRepository users;
    private final FlairTeamMemberRepository members;

    public MomentDays(MomentRepository moments, UserRepository users, FlairTeamMemberRepository members) {
        this.moments = moments;
        this.users = users;
        this.members = members;
    }

    /** Momentos visíveis à pessoa (público no escopo dela + do grupo dela) cuja janela local inclui a data. */
    public List<Moment> on(CurrentUser viewer, LocalDate date) {
        return visibleBetween(viewer, date, date).stream().filter(m -> touches(m, date)).toList();
    }

    /** Momentos visíveis à pessoa cuja janela toca o intervalo de datas (uma consulta para o calendário inteiro). */
    public List<Moment> visibleBetween(CurrentUser viewer, LocalDate from, LocalDate to) {
        Instant start = from.minusDays(2).atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = to.plusDays(2).atStartOfDay(ZoneOffset.UTC).toInstant();
        String country = viewer == null ? null : users.findById(viewer.id()).map(User::getCountry).filter(c -> c != null && !c.isBlank()).orElse(null);
        return moments.findByStatusInAndStartAtLessThanAndEndAtGreaterThan(MomentSupport.VISIBLE, end, start).stream()
                .filter(m -> MomentRules.canSee(viewer, m, this::isMember)).filter(m -> inScope(m, country))
                .sorted(Comparator.comparing(Moment::getStartAt)).toList();
    }

    /** A data cai dentro da janela local do Momento (dias no fuso do próprio Momento). */
    public static boolean touches(Moment m, LocalDate date) {
        return !date.isBefore(MomentTime.localStart(m)) && !date.isAfter(MomentTime.localEnd(m));
    }

    /** Marca de calendário do Momento (congelada no Look do Dia): id, slug, nome, tipo e ícone do tema. */
    public static Map<String, Object> mark(Moment m) {
        Map<String, Object> mk = new LinkedHashMap<>();
        mk.put("kind", "MOMENT");
        mk.put("code", m.getSlug());
        mk.put("label", MomentViews.localized(m.getName(), m.getNamesJson()));
        mk.put("momentId", m.getId().toString());
        mk.put("type", m.getType().name());
        mk.put("nature", m.getNature().name());
        mk.put("icon", MomentViews.theme(m).get("icon"));
        return mk;
    }

    /** Coerência do look com o Momento: MomentMatch 0–100 com a interpretação e as razões; nulo sem base de tags. */
    public static Map<String, Object> match(Moment m, Scheme look, List<SchemeItem> items) {
        MomentMatch.Result r = MomentMatch.score(MomentSupport.contextOf(m, null), MomentEvaluator.subjectOf(look, items));
        Map<String, Object> row = mark(m);
        row.remove("kind");
        row.put("match", r == null ? null : r.score());
        row.put("interpretation", r == null ? null : r.interpretation());
        row.put("reasons", r == null ? List.of() : r.reasons());
        row.put("coherent", r != null && r.score() >= COHERENT_FROM);
        return row;
    }

    private boolean isMember(UUID userId, UUID teamId) {
        return members.findByUserId(userId).map(x -> x.getTeam().getId().equals(teamId)).orElse(false);
    }

    private static boolean inScope(Moment m, String country) {
        if (m.getScope() != MomentScope.COUNTRY && m.getScope() != MomentScope.REGION) {
            return true;
        }
        return country == null || m.getCountry() == null || m.getCountry().equalsIgnoreCase(country);
    }
}
