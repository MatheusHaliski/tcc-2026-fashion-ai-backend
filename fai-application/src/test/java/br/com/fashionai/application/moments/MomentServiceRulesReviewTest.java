package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentVisibility;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Momentos — achados do review do PR: looks privados no ranking/Memória, datas e fuso, estação no admin e Hype v2. */
class MomentServiceRulesReviewTest extends MomentServiceRulesFixture {
    // ------------------------------------------------------------------ review do PR: looks privados, datas, estação

    @Test
    @SuppressWarnings("unchecked")
    void rankingPublicoNaoExpoeLookPrivado() {
        Moment m = moment("halloween-2026", MomentVisibility.PUBLIC, null, MomentStatus.ACTIVE);
        submit(m, bia, "Dark minimal", Visibility.PUBLIC, 3, 80);
        MomentSubmission secret = submit(m, carla, "Look secreto", Visibility.PRIVATE, 9, 95);
        // visitante anônimo (rota pública): só o look público, e nada do privado (título, capa, dono, ids)
        Map<String, Object> anon = service.leaderboard(null, m.getSlug());
        List<Map<String, Object>> items = (List<Map<String, Object>>) anon.get("items");
        assertThat(items).extracting(r -> r.get("title")).containsExactly("Dark minimal");
        assertThat(anon.toString()).doesNotContain("Look secreto").doesNotContain(secret.getSchemeId().toString()).doesNotContain(secret.getId().toString());
        assertThat(items.get(0).get("position")).isEqualTo(1);
        // o mesmo filtro no feed e no trending
        assertThat(service.feed(null, m.getSlug()).toString()).doesNotContain("Look secreto");
        assertThat(service.trending(null, m.getSlug(), 8).toString()).doesNotContain(secret.getSchemeId().toString());
        // a dona vê o próprio look; outra pessoa logada, não
        assertThat((List<Map<String, Object>>) service.leaderboard(carla, m.getSlug()).get("items")).extracting(r -> r.get("title")).contains("Look secreto");
        assertThat(service.leaderboard(bia, m.getSlug()).toString()).doesNotContain("Look secreto");
        // e não dá para votar (nem confirmar a existência) num look que não se pode ver
        assertThatThrownBy(() -> service.vote(bia, m.getSlug(), new MomentService.VoteRequest(secret.getId(), "theme")))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
    }

    @Test
    void memoriaDeMomentoPublicoSoDestacaLooksPublicos() {
        Moment m = moment("primavera-2025", MomentVisibility.PUBLIC, null, MomentStatus.ACTIVE);
        m.setStartAt(Instant.parse("2025-09-22T03:00:00Z"));
        m.setEndAt(Instant.parse("2025-12-21T02:59:59Z"));
        submit(m, bia, "Florais", Visibility.PUBLIC, 2, 70);
        submit(m, carla, "Look secreto", Visibility.PRIVATE, 9, 95);
        service.tick();
        assertThat(m.getStatus()).isEqualTo(MomentStatus.ENDED);
        assertThat(m.getMemoryJson()).contains("Florais").doesNotContain("Look secreto").contains("\"looks\":2");
    }

    @Test
    void momentoDeGrupoGuardaAHoraEscolhidaNoFusoDoPedido() {
        Map<String, Object> created = service.createGroupMoment(ana, teamId, new MomentService.GroupMomentRequest("Halloween Night", null, "Halloween reinterpretado",
                "2026-10-30T18:30", "2026-10-30T23:59", "America/Sao_Paulo", "GROUP", "BATTLE", 1, true, true, true, true, true, true, List.of(150, 100, 50),
                null, List.of(), List.of(), List.of(), null, null));
        Moment m = momentRows.stream().filter(x -> x.getId().equals(created.get("id"))).findFirst().orElseThrow();
        assertThat(m.getStartAt()).isEqualTo(Instant.parse("2026-10-30T21:30:00Z"));   // 18:30 em São Paulo, não 00:00
        assertThat(m.getEndAt()).isEqualTo(Instant.parse("2026-10-31T02:59:00Z"));
        assertThat(m.getTimezone()).isEqualTo("America/Sao_Paulo");
        assertThat(m.getStatus()).isEqualTo(MomentStatus.SCHEDULED);                    // ainda não começou (agora = 25/10)
        assertThat(m.getVisibility()).isEqualTo(MomentVisibility.GROUP);
    }

    @Test
    void parseDeDataHoraRespeitaOffsetOuFusoDoMomento() {
        java.time.ZoneId sp = java.time.ZoneId.of("America/Sao_Paulo");
        assertThat(MomentService.parseInstant("2026-11-09T18:30", "startAt", sp)).isEqualTo(Instant.parse("2026-11-09T21:30:00Z"));
        assertThat(MomentService.parseInstant("2026-11-09T18:30:15", "startAt", sp)).isEqualTo(Instant.parse("2026-11-09T21:30:15Z"));
        assertThat(MomentService.parseInstant("2026-11-09T18:30", "startAt", java.time.ZoneId.of("Asia/Tokyo"))).isEqualTo(Instant.parse("2026-11-09T09:30:00Z"));
        assertThat(MomentService.parseInstant("2026-11-09T18:30:00Z", "startAt", sp)).isEqualTo(Instant.parse("2026-11-09T18:30:00Z"));
        assertThat(MomentService.parseInstant("2026-11-09T18:30-03:00", "startAt", java.time.ZoneId.of("UTC"))).isEqualTo(Instant.parse("2026-11-09T21:30:00Z"));
        assertThat(MomentService.parseInstant("2026-11-09", "startAt", sp)).isEqualTo(Instant.parse("2026-11-09T03:00:00Z"));
        assertThatThrownBy(() -> MomentService.parseInstant("09/11/2026 18:30", "startAt", sp)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> MomentService.parseInstant(" ", "startAt", sp)).isInstanceOf(ApiException.class);
    }

    private MomentService.AdminMomentRequest adminRequest(String season, String start, String end, String tz) {
        return new MomentService.AdminMomentRequest(null, "Denim Week 2027", null, "Jeans que você já tem.", null, "COMMUNITY", "FASHIONAI", null,
                start, end, tz, "GLOBAL", "PUBLIC", "", "", "", season, Map.of("accent", "#2D55C9"), null, null, false, false, "", "", "", true, 20, 1.0,
                null, List.of("streetwear"), List.of(), List.of("blue"), null, null, null, null, null, "", null);
    }

    @Test
    void adminSalvaComEstacaoVaziaELimpaEstacaoExistente() {
        Map<String, Object> created = service.adminSave(admin, null, adminRequest("", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo"));
        Moment m = momentRows.stream().filter(x -> x.getId().equals(created.get("id"))).findFirst().orElseThrow();
        assertThat(m.getSeason()).isNull();
        assertThat(m.getStartAt()).isEqualTo(Instant.parse("2027-11-08T03:00:00Z"));
        service.adminSave(admin, m.getId(), adminRequest("winter", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo"));
        assertThat(m.getSeason()).isEqualTo(br.com.fashionai.domain.model.enums.Season.WINTER);
        service.adminSave(admin, m.getId(), adminRequest("", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo"));
        assertThat(m.getSeason()).isNull();
        // valor desconhecido vira 400 (antes: IllegalArgumentException → 500)
        assertThatThrownBy(() -> service.adminSave(admin, m.getId(), adminRequest("MONSOON", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo")))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(400));
    }

    @Test
    void adminEditarSemMexerNasDatasNaoDeslocaOsHorarios() {
        // o formulário devolve a hora de parede no fuso do Momento (03:00Z = 00:00 em São Paulo) junto com o fuso
        Map<String, Object> created = service.adminSave(admin, null, adminRequest("", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo"));
        Moment m = momentRows.stream().filter(x -> x.getId().equals(created.get("id"))).findFirst().orElseThrow();
        for (int i = 0; i < 3; i++) {
            service.adminSave(admin, m.getId(), adminRequest("", "2027-11-08T00:00", "2027-11-15T00:00", "America/Sao_Paulo"));
        }
        assertThat(m.getStartAt()).isEqualTo(Instant.parse("2027-11-08T03:00:00Z"));
        assertThat(m.getEndAt()).isEqualTo(Instant.parse("2027-11-15T03:00:00Z"));
        // trocar o fuso no mesmo save reinterpreta a hora de parede no fuso novo
        service.adminSave(admin, m.getId(), adminRequest("", "2027-11-08T00:00", "2027-11-15T00:00", "Europe/Lisbon"));
        assertThat(m.getStartAt()).isEqualTo(Instant.parse("2027-11-08T00:00:00Z"));
    }

    /** Hype v2 no Momento: o dono vê o próprio Hype pessoal; os demais, só o público elegível. Sem score = fora do mapa. */
    @Test
    void hypeDoMomentoNaoVazaOHypePessoal() {
        br.com.fashionai.application.hype.HypeQueryService query = org.mockito.Mockito.mock(br.com.fashionai.application.hype.HypeQueryService.class);
        MomentService withHype = new MomentService(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, query);
        UUID owner = UUID.randomUUID(), other = UUID.randomUUID(), personal = UUID.randomUUID(), open = UUID.randomUUID(), thin = UUID.randomUUID();
        org.mockito.Mockito.when(query.currentOf(org.mockito.ArgumentMatchers.eq(br.com.fashionai.domain.model.enums.HypeEntityType.SCHEME), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Map.of(personal, hypeRow(owner, 72, false), open, hypeRow(owner, 55, true), thin, hypeRow(owner, null, true)));
        List<UUID> ids = List.of(personal, open, thin);
        assertThat(withHype.hypeScores(br.com.fashionai.domain.model.enums.HypeEntityType.SCHEME, ids, owner)).containsOnly(Map.entry(personal, 72.0), Map.entry(open, 55.0));
        assertThat(withHype.hypeScores(br.com.fashionai.domain.model.enums.HypeEntityType.SCHEME, ids, other)).containsOnly(Map.entry(open, 55.0));
        assertThat(withHype.hypeScores(br.com.fashionai.domain.model.enums.HypeEntityType.SCHEME, ids, null)).containsOnly(Map.entry(open, 55.0));
    }

    private static br.com.fashionai.domain.model.HypeScoreCurrent hypeRow(UUID owner, Integer score, boolean publicEligible) {
        br.com.fashionai.domain.model.HypeScoreCurrent c = new br.com.fashionai.domain.model.HypeScoreCurrent();
        c.setOwnerId(owner);
        c.setScore(score == null ? null : java.math.BigDecimal.valueOf(score));
        c.setPublicEligible(publicEligible);
        return c;
    }
}
