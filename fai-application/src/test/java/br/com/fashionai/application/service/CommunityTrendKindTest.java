package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CommunityTrend;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.CommunityTrendRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Exercício 17 — tipo de dinâmica da Trend: os cinco códigos, a recusa do que não é código (400 TREND_INVALIDA), a
 * lista que só consulta publicadas na janela (rascunho de ninguém entra) e a publicação que paga uma vez só.
 */
class CommunityTrendKindTest {
    private CommunityTrendRepository repository;
    private FaiPointsService points;
    private CommunityTrendService service;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        repository = mock(CommunityTrendRepository.class);
        UserRepository users = mock(UserRepository.class);
        points = mock(FaiPointsService.class);
        service = new CommunityTrendService(repository, users, mock(Guard.class), points);
        ana = pessoa(users, "ana");
        bia = pessoa(users, "bia");
        when(repository.save(any())).thenAnswer(inv -> {
            CommunityTrend t = inv.getArgument(0);
            if (t.getId() == null) {
                t.assignId(UUID.randomUUID());
            }
            return t;
        });
    }

    private static CurrentUser pessoa(UserRepository users, String username) {
        CurrentUser u = new CurrentUser(UUID.randomUUID(), username, "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, "127.0.0.1", "test");
        User row = new User();
        row.assignId(u.id());
        row.setUsername(username);
        when(users.lockById(u.id())).thenReturn(Optional.of(row));
        when(users.findById(u.id())).thenReturn(Optional.of(row));
        return u;
    }

    private static CommunityTrendService.Create form(String kind) {
        return new CommunityTrendService.Create("Azul em comum", "Uma composição por pessoa", kind, 7);
    }

    @Test
    void osCincoCodigosSaoOsDoEnunciadoEALeituraDevolveOCodigoGravado() {
        assertThat(CommunityTrendService.KINDS).containsExactly("PASSA_O_LOOK", "COR_EM_COMUM", "REINTERPRETACAO", "PECA_ASSINATURA", "DUETO_CRIATIVO");
        Map<String, Object> rascunho = service.create(ana, form("COR_EM_COMUM"));
        assertThat(rascunho).containsEntry("kind", "COR_EM_COMUM").containsEntry("status", "DRAFT").containsEntry("publishedAt", null);
        verifyNoInteractions(points);                                     // criar ou escolher a dinâmica não dá prêmio
    }

    @Test
    void oQueNaoEhUmDosCodigosVolta400SemGravar() {
        for (String kind : new String[] {null, "", "cor_em_comum", "COR EM COMUM", "TREND", "Cor em comum"}) {
            ApiException e = catchThrowableOfType(() -> service.create(ana, form(kind)), ApiException.class);
            assertThat(e).as("kind=%s", kind).isNotNull();
            assertThat(e.status()).isEqualTo(400);
            assertThat(e.code()).isEqualTo("TREND_INVALIDA");
        }
        assertThat(catchThrowableOfType(() -> service.list("TREND", 0, 12), ApiException.class).code()).isEqualTo("TREND_INVALIDA");
        verify(repository, never()).save(any());
    }

    @Test
    void aListaSoConsultaPublicadasNaJanelaComOuSemFiltroEInformaOsCodigos() {
        CommunityTrend publicada = new CommunityTrend();
        publicada.assignId(UUID.randomUUID());
        publicada.setAuthorId(bia.id());
        publicada.setKind("COR_EM_COMUM");
        publicada.setStatus("PUBLISHED");
        publicada.setPublishedAt(Instant.now());
        when(repository.findByStatusAndKindAndEndsAtAfter(eq("PUBLISHED"), eq("COR_EM_COMUM"), any(Instant.class), any())).thenReturn(new PageImpl<>(List.of(publicada)));
        when(repository.findByStatusAndEndsAtAfter(eq("PUBLISHED"), any(Instant.class), any())).thenReturn(new PageImpl<>(List.of(publicada)));
        Map<String, Object> filtrada = service.list("COR_EM_COMUM", 0, 12);
        assertThat((List<?>) filtrada.get("items")).singleElement().satisfies(item -> assertThat((Map<?, ?>) item).extracting("kind", "status").containsExactly("COR_EM_COMUM", "PUBLISHED"));
        assertThat(filtrada).containsEntry("kinds", CommunityTrendService.KINDS).containsEntry("total", 1L);
        service.list(" ", 0, 12);
        // nunca outro status: rascunho (de quem for) não entra na lista da comunidade
        verify(repository, never()).findByStatusAndKindAndEndsAtAfter(org.mockito.ArgumentMatchers.argThat(s -> !"PUBLISHED".equals(s)), anyString(), any(), any());
        verify(repository, never()).findByStatusAndEndsAtAfter(org.mockito.ArgumentMatchers.argThat(s -> !"PUBLISHED".equals(s)), any(), any());
    }

    @Test
    void publicarDeNovoNaoPagaDuasVezesEOutraPessoaNaoPublicaORascunhoAlheio() {
        UUID id = (UUID) service.create(ana, form("DUETO_CRIATIVO")).get("id");
        CommunityTrend gravada = new CommunityTrend();
        gravada.assignId(id);
        gravada.setAuthorId(ana.id());
        gravada.setKind("DUETO_CRIATIVO");
        gravada.setDurationDays(7);
        when(repository.lockById(id)).thenReturn(Optional.of(gravada));
        when(points.award(ana.id(), "TREND_PUBLISHED", "TREND", id.toString(), null)).thenReturn(new FaiPointsService.Award(true, 20, false, "20 Points", FaiPointsService.Level.ESTREIA, false));
        assertThat(catchThrowableOfType(() -> service.publish(bia, id), ApiException.class).status()).isEqualTo(404);
        assertThat(gravada.getStatus()).isEqualTo("DRAFT");
        assertThat(service.publish(ana, id)).containsEntry("awardedPoints", 20).containsEntry("alreadyPublished", false);
        assertThat(service.publish(ana, id)).containsEntry("awardedPoints", 0).containsEntry("alreadyPublished", true);
        verify(points, times(1)).award(any(), anyString(), anyString(), anyString(), any());
        assertThat(gravada.getKind()).isEqualTo("DUETO_CRIATIVO");        // publicar não troca a dinâmica
    }
}
