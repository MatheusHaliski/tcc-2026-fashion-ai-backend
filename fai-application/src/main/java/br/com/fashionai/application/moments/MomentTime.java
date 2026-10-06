package br.com.fashionai.application.moments;

import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.enums.MomentStatus;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Momentos §54 — tempo é responsabilidade do servidor. O status gravado é mantido pelo job (MomentScheduler); as consultas
 * calculam o status EFETIVO pelo relógio do servidor para não haver janela entre o início real e a próxima passada do job.
 * Contagens regressivas voltam em segundos (startsIn/endsIn) junto com {@code now}: o cliente só formata, nunca decide.
 * Dias/meses do calendário são lidos no fuso do Momento (ou no fuso pedido), nunca no fuso local do navegador.
 */
public final class MomentTime {
    private MomentTime() {
    }

    public static ZoneId zone(String id) {
        try {
            return id == null || id.isBlank() ? ZoneId.of("America/Sao_Paulo") : ZoneId.of(id);
        } catch (java.time.DateTimeException e) {
            return ZoneId.of("America/Sao_Paulo");
        }
    }

    /** Status efetivo: o gravado manda em DRAFT/ARCHIVED/CANCELLED; SCHEDULED/ACTIVE/ENDED seguem o relógio. */
    public static MomentStatus effective(Moment m, Instant now) {
        MomentStatus s = m.getStatus();
        if (s == MomentStatus.DRAFT || s == MomentStatus.ARCHIVED || s == MomentStatus.CANCELLED) {
            return s;
        }
        if (now.isBefore(m.getStartAt())) {
            return MomentStatus.SCHEDULED;
        }
        if (now.isBefore(m.getEndAt())) {
            return MomentStatus.ACTIVE;
        }
        return MomentStatus.ENDED;
    }

    public static boolean active(Moment m, Instant now) {
        return effective(m, now) == MomentStatus.ACTIVE;
    }

    public static boolean upcoming(Moment m, Instant now) {
        return effective(m, now) == MomentStatus.SCHEDULED;
    }

    public static long startsInSeconds(Moment m, Instant now) {
        return Math.max(0, Duration.between(now, m.getStartAt()).getSeconds());
    }

    public static long endsInSeconds(Moment m, Instant now) {
        return Math.max(0, Duration.between(now, m.getEndAt()).getSeconds());
    }

    /** Fração decorrida 0–1 (barra de tempo), sem passar de 1. */
    public static double elapsedFraction(Moment m, Instant now) {
        long total = Duration.between(m.getStartAt(), m.getEndAt()).getSeconds();
        if (total <= 0) {
            return 1;
        }
        long done = Duration.between(m.getStartAt(), now).getSeconds();
        return Math.max(0, Math.min(1, done / (double) total));
    }

    /** Datas locais (no fuso do Momento) para o calendário: dia inicial e final inclusivos. */
    public static LocalDate localStart(Moment m) {
        return m.getStartAt().atZone(zone(m.getTimezone())).toLocalDate();
    }

    public static LocalDate localEnd(Moment m) {
        // end_at é exclusivo (23:59:59.999 do último dia): recua um instante para cair no dia certo
        return m.getEndAt().minusSeconds(1).atZone(zone(m.getTimezone())).toLocalDate();
    }

    /** O Momento toca o mês (no fuso dele)? Usado para a visão anual/mensal. */
    public static boolean touches(Moment m, YearMonth month) {
        LocalDate a = localStart(m), b = localEnd(m);
        LocalDate ms = month.atDay(1), me = month.atEndOfMonth();
        return !a.isAfter(me) && !b.isBefore(ms);
    }

    /** Instante inicial/final de um ano civil num fuso (consulta de calendário por intervalo). */
    public static Instant yearStart(int year, ZoneId zone) {
        return LocalDate.of(year, 1, 1).atStartOfDay(zone).toInstant();
    }

    public static Instant yearEnd(int year, ZoneId zone) {
        return LocalDate.of(year + 1, 1, 1).atStartOfDay(zone).toInstant();
    }

    public static Map<String, Object> view(Moment m, Instant now) {
        Map<String, Object> t = new LinkedHashMap<>();
        MomentStatus eff = effective(m, now);
        t.put("status", eff.name());
        t.put("now", now.toString());
        t.put("startAt", m.getStartAt().toString());
        t.put("endAt", m.getEndAt().toString());
        t.put("timezone", zone(m.getTimezone()).getId());
        t.put("localStart", localStart(m).toString());
        t.put("localEnd", localEnd(m).toString());
        t.put("startsInSeconds", eff == MomentStatus.SCHEDULED ? startsInSeconds(m, now) : 0);
        t.put("endsInSeconds", eff == MomentStatus.ACTIVE ? endsInSeconds(m, now) : 0);
        t.put("elapsed", eff == MomentStatus.ACTIVE ? Math.round(elapsedFraction(m, now) * 1000) / 1000.0 : eff == MomentStatus.ENDED ? 1 : 0);
        t.put("daysLeft", eff == MomentStatus.ACTIVE ? (int) Math.ceil(endsInSeconds(m, now) / 86400.0) : null);
        return t;
    }

    public static Instant utc(LocalDate day, ZoneId zone) {
        return day.atStartOfDay(zone).toInstant();
    }

    public static ZoneOffset offsetOf(ZoneId zone, Instant at) {
        return zone.getRules().getOffset(at);
    }
}
