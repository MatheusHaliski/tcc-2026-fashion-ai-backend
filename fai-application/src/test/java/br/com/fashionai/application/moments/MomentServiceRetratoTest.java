package br.com.fashionai.application.moments;

import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentChallenge;
import br.com.fashionai.domain.model.MomentSubmission;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.MomentChallengeKind;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentVoteDimension;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.application.testkit.MemoryRepository;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do R81: um roteiro único passa por todos os métodos públicos do MomentService (consultas, ações,
 * comunidade, FLAIR, job e administração) e compara o retrato textual das respostas, das notificações e dos pontos com
 * o retrato gravado no código original (src/test/resources/moments/moment-service-retrato.txt).
 */
class MomentServiceRetratoTest extends MomentServiceFixture {
    private static final Path GOLDEN = Path.of("src/test/resources/moments/moment-service-retrato.txt");

    @Test
    void roteiroCompletoIgualAoRetratoDoCodigoOriginal() throws Exception {
        fixarDatas();
        MomentRetrato r = new MomentRetrato();
        Moment m = active("retrato");
        m.setInterpretationsJson("[{\"key\":\"dark\",\"styleTags\":[\"streetwear\"],\"colorTags\":[\"black\"]},{\"key\":\"soft\",\"styleTags\":[\"romantic\"],\"colorTags\":[\"pink\"]}]");
        m.setBadgeCode("MOMENT_RETRATO");
        m.setSettingsJson("{\"looksPerUser\":2,\"prizes\":[50,30,10]}");
        moments.save(m);
        MomentChallenge c = challenge(m, "STREET");
        MomentChallenge redesc = challenge(m, "REDESC");
        redesc.setKind(MomentChallengeKind.REDISCOVERY);
        redesc.setParamsJson("{\"idleDays\":5}");
        challenges.save(redesc);
        moment("futuro", NOW.plus(Duration.ofDays(3)), NOW.plus(Duration.ofDays(9)), MomentStatus.SCHEDULED);
        Scheme meu = w.looksOf(w.me).get(0);
        Scheme meu2 = w.looksOf(w.me).get(2);
        Scheme dela = w.looksOf(w.rival).get(0);
        hypeOf(meu.getId(), w.me.getId(), 62.4, true);
        hypeOf(dela.getId(), w.rival.getId(), 71.0, true);

        consultas(r, m);
        r.step("save", () -> svc.save(me, "futuro", true, meu.getId()));
        r.step("unsave", () -> svc.unsave(friend, "futuro"));
        r.step("join", () -> svc.join(me, "retrato", new MomentService.JoinRequest("discovery", true)));
        r.step("join.invalido", () -> svc.join(me, "retrato", new MomentService.JoinRequest("x", null)));
        r.step("preview", () -> svc.preview(me, "retrato", new MomentService.SubmitRequest(meu.getId(), c.getId(), "dark")));
        r.step("submit", () -> svc.submit(me, "retrato", new MomentService.SubmitRequest(meu.getId(), c.getId(), "dark")));
        r.step("submit.repetido", () -> svc.submit(me, "retrato", new MomentService.SubmitRequest(meu.getId(), null, null)));
        r.step("submit.rival", () -> svc.submit(rival, "retrato", new MomentService.SubmitRequest(dela.getId(), null, null)));
        r.step("submit.2", () -> svc.submit(me, "retrato", new MomentService.SubmitRequest(meu2.getId(), redesc.getId(), null)));
        r.calls("points.submit", points);
        r.calls("notify.submit", notifications);
        MomentSubmission daRival = MemoryRepository.<MomentSubmission>rows(subs).stream().filter(s -> s.getUserId().equals(w.rival.getId())).findFirst().orElseThrow();
        r.step("vote", () -> svc.vote(me, "retrato", new MomentService.VoteRequest(daRival.getId(), "elegant")));
        r.step("vote.friend", () -> svc.vote(friend, "retrato", new MomentService.VoteRequest(daRival.getId(), "THEME")));
        r.step("feed", () -> svc.feed(friend, "retrato"));
        r.step("leaderboard", () -> svc.leaderboard(friend, "retrato"));
        r.step("trending", () -> svc.trending(me, "retrato", 3));
        r.step("detail.depois", () -> svc.detail(me, "retrato"));
        r.step("setProfileVisibility", () -> svc.setProfileVisibility(me, "retrato", true));
        r.step("leave.concluido", () -> svc.leave(me, "retrato"));
        r.step("leave.rival", () -> svc.leave(rival, "retrato"));
        r.step("candidateLooks", () -> svc.candidateLooks(me, "retrato"));
        r.step("mine", () -> svc.mine(me));
        r.step("timeline.self", () -> svc.timeline(me, w.me.getId()));
        r.step("timeline.outro", () -> svc.timeline(friend, w.me.getId()));
        r.step("replay", () -> svc.replay(me, 2026));
        r.step("contextFor.look", () -> svc.contextFor(me, HypeEntityType.SCHEME, meu.getId()));
        r.step("contextFor.peca", () -> svc.contextFor(friend, HypeEntityType.PIECE, w.piecesOf(w.me).get(0).getId()));
        r.step("activeSummary", () -> svc.activeSummary(w.me.getId()));
        r.step("contextualHype", () -> List.of(String.valueOf(MomentService.contextualHype(60.0, 80)), String.valueOf(MomentService.contextualHype(null, 3))));
        grupo(r);
        admin(r);
        job(r);
        String atual = mascararAgoraReal(r.text());
        assertThat(atual).isEqualTo(MomentRetrato.golden(atual, GOLDEN));
    }

    private void consultas(MomentRetrato r, Moment m) {
        r.step("home.anon", () -> svc.home(null));
        r.step("home.me", () -> svc.home(me));
        r.step("nowBanner", () -> svc.nowBanner(me));
        r.step("calendar", () -> svc.calendar(me, 2026, 10, "America/Sao_Paulo"));
        r.step("calendar.ano", () -> svc.calendar(null, 2026, null, null));
        r.step("detail.antes", () -> svc.detail(me, m.getId().toString()));
        r.step("detail.inexistente", () -> svc.detail(me, "nao-existe"));
        r.step("list", () -> svc.list(me, null, null));
        r.step("list.ativos", () -> svc.list(null, "active", 2026));
        r.step("list.invalido", () -> svc.list(null, "zzz", null));
        r.step("canSee", () -> List.of(svc.canSee(null, m), svc.canSee(me, m)));
    }

    private void grupo(MomentRetrato r) {
        FlairTeam t = team("Turma", w.me, w.rival);
        MomentService.GroupMomentRequest req = new MomentService.GroupMomentRequest("Noite Neon!", " desc ", "neon", "2026-10-26T18:30",
                "2026-10-30", "America/Sao_Paulo", "public", "battle", 2, null, true, null, null, null, false,
                List.of(500, 20, -3, 9), 4, List.of("streetwear"), List.of(), List.of("party"), "regras", null);
        r.step("createGroupMoment", () -> svc.createGroupMoment(me, t.getId(), req));
        r.step("createGroupMoment.semNome", () -> svc.createGroupMoment(me, t.getId(), new MomentService.GroupMomentRequest(" ", null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null)));
        r.step("groupMoments", () -> svc.groupMoments(rival, t.getId()));
        r.step("groupMoments.fora", () -> svc.groupMoments(friend, t.getId()));
        r.calls("notify.grupo", notifications);
    }

    private void admin(MomentRetrato r) {
        MomentService.AdminChallengeRequest ch = new MomentService.AdminChallengeRequest("look preto", "Look preto", Map.of("en", "Black look"), "d",
                "color", 300, List.of("streetwear"), List.of("black"), List.of(), Map.of("min", 1), null);
        MomentService.AdminMomentRequest req = new MomentService.AdminMomentRequest(null, "Semana Fashion", Map.of("en", "Fashion Week"), "desc", null,
                "fashion_event", "cultural", null, "2026-11-01T10:00", "2026-11-08", "America/Sao_Paulo", "country", "public", "br", " ", null, " ",
                Map.of("icon", "x"), "", null, true, null, null, null, "nota", null, 300, 9.0, Map.of("a", 1), List.of("glam"), List.of("party"),
                List.of("gold"), List.of(Map.of("key", "k")), List.of("dress"), List.of("heels"), Map.of("r", 1), Map.of("allowVoting", true),
                "moment fw!", List.of(ch));
        r.step("adminSave.novo", () -> svc.adminSave(me, null, req));
        Moment criado = MemoryRepository.<Moment>rows(moments).stream().filter(x -> "Semana Fashion".equals(x.getName())).findFirst().orElseThrow();
        r.step("adminSave.semFonte", () -> svc.adminSave(me, criado.getId(), new MomentService.AdminMomentRequest(null, null, null, null, null,
                "event", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, "", "", null, null,
                null, null, null, null, null, null, null, null, null, null, null, List.of())));
        r.step("adminTransition.schedule", () -> svc.adminTransition(me, criado.getId(), "schedule"));
        r.step("adminTransition.feature", () -> svc.adminTransition(me, criado.getId(), "feature"));
        r.step("adminTransition.invalida", () -> svc.adminTransition(me, criado.getId(), "voar"));
        r.step("adminList", () -> svc.adminList(me));
        r.step("adminDetail", () -> svc.adminDetail(me, criado.getId()));
    }

    private void job(MomentRetrato r) {
        r.step("tick.agora", () -> svc.tick());
        r.calls("notify.tick", notifications);
        svc.useClock(Clock.fixed(NOW.plus(Duration.ofDays(4)), ZoneOffset.UTC));
        r.step("recordCardChallenge", () -> {
            svc.recordCardChallenge(MemoryRepository.<Moment>rows(moments).stream().filter(x -> "futuro".equals(x.getSlug())).findFirst().orElseThrow(), w.friend.getId());
            return "ok";
        });
        r.step("tick.depois", () -> svc.tick());
        r.calls("points.tick", points);
        r.calls("notify.tick.depois", notifications);
        r.step("detail.memoria", () -> svc.detail(friend, "retrato"));
        r.step("leaderboard.fim", () -> svc.leaderboard(null, "retrato"));
        r.step("timeline.fim", () -> svc.timeline(me, w.me.getId()));
        r.step("home.fim", () -> svc.home(me));
    }

    /** Peças e looks do World nascem com datas relativas ao relógio real; aqui ficam relativas ao NOW fixo. */
    private void fixarDatas() {
        for (WardrobeItem p : MemoryRepository.<WardrobeItem>rows(kit.dep(WardrobeItemRepository.class))) {
            p.markCreatedAt(NOW.minus(Duration.ofDays(40)));
        }
        int i = 0;
        for (Scheme s : MemoryRepository.<Scheme>rows(kit.dep(SchemeRepository.class))) {
            s.markCreatedAt(NOW.minus(Duration.ofDays(20)).plusSeconds(i++));
        }
    }

    /** Datas gravadas pelo relógio real (updatedAt etc., com fração de segundo) não entram no retrato. */
    private static String mascararAgoraReal(String text) {
        return text.replaceAll("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]+Z", "<agora-real>");
    }
}
