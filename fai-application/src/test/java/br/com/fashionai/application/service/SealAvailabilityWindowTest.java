package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.seal.SealViews;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * Exercício 11 (prazo de disponibilidade do selo): o período de resgate é gravado como veio (instantes em UTC), início e
 * fim podem ficar vazios, fim antes do início é 400 sem mexer no que estava gravado, só o dono do selo edita, e o estado
 * que a tela mostra (agendado, aberto, encerrado) é calculado no servidor com os mesmos limites de "disponível".
 */
class SealAvailabilityWindowTest {
    private static final Instant INICIO = Instant.parse("2026-12-01T12:00:00Z");
    private static final Instant FIM = Instant.parse("2026-12-10T12:00:00Z");

    private Kit kit;
    private SealService seals;
    private User brand;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        seals = kit.build(SealService.class);
        brand = Kit.user("maison");
        brand.setProfileType(ProfileType.MARCA);
        kit.dep(UserRepository.class).save(brand);
        BrandProfile bp = new BrandProfile();
        bp.setOwner(brand);
        bp.setBrandName("Maison");
        bp.setSlug("maison");
        bp.setApprovalStatus(ApprovalStatus.APROVADO);
        kit.dep(BrandProfileRepository.class).save(bp);
    }

    private static SealService.SealForm form(Instant from, Instant until) {
        Map<String, Object> rule = new LinkedHashMap<>(Map.of("quantifier", "AT_LEAST", "count", 1, "color", "Azul"));
        Map<String, Object> manual = new LinkedHashMap<>(Map.of("generationMode", "MANUAL", "rules", List.of(rule)));
        return new SealService.SealForm("Selo de dezembro", SealTier.LOOK, null, null, null, from, until, null, SealStatus.ACTIVE, null, manual);
    }

    private Seal stored() {
        return MemoryRepository.<Seal>rows(kit.dep(SealRepository.class)).get(0);
    }

    private static String code(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
        return catchThrowableOfType(call, ApiException.class).code();
    }

    @Test
    void periodoValidoEhGravadoELidoIgualComOEstadoCalculado() {
        Map<String, Object> view = seals.createSeal(Kit.as(brand), form(INICIO, FIM));

        assertThat(stored().getAvailableFrom()).isEqualTo(INICIO);
        assertThat(stored().getAvailableUntil()).isEqualTo(FIM);
        assertThat(view).containsEntry("availableFrom", INICIO).containsEntry("availableUntil", FIM);
        assertThat(view.get("availabilityState")).isEqualTo(SealViews.availabilityState(stored(), Instant.now()));
        assertThat(seals.sealsOf(brand.getId())).singleElement().satisfies(v -> assertThat(v)
                .containsEntry("availableFrom", INICIO).containsEntry("availableUntil", FIM).containsKey("availabilityState"));
    }

    @Test
    void inicioEFimPodemFicarVaziosENuloNuncaViraData() {
        Map<String, Object> semPeriodo = seals.createSeal(Kit.as(brand), form(null, null));
        assertThat(semPeriodo).containsEntry("availableFrom", null).containsEntry("availableUntil", null)
                .containsEntry("available", true).containsEntry("availabilityState", "OPEN").containsEntry("unavailableReason", null);
        UUID id = stored().getId();

        assertThat(seals.updateSeal(Kit.as(brand), id, form(INICIO, null))).containsEntry("availableFrom", INICIO).containsEntry("availableUntil", null);
        assertThat(seals.updateSeal(Kit.as(brand), id, form(null, FIM))).containsEntry("availableFrom", null).containsEntry("availableUntil", FIM);
        assertThat(seals.updateSeal(Kit.as(brand), id, form(INICIO, INICIO))).as("fim igual ao início é aceito")
                .containsEntry("availableFrom", INICIO).containsEntry("availableUntil", INICIO);
    }

    @Test
    void fimAntesDoInicioEh400EOPeriodoGravadoNaoMuda() {
        seals.createSeal(Kit.as(brand), form(INICIO, FIM));
        UUID id = stored().getId();

        ApiException e = catchThrowableOfType(() -> seals.updateSeal(Kit.as(brand), id, form(FIM, INICIO)), ApiException.class);

        assertThat(e.status()).isEqualTo(400);
        assertThat(e.code()).isEqualTo("PERIODO_INVALIDO");
        assertThat(e.getMessage()).isEqualTo(Msg.t("common.a_disponibilidade_termina_antes_de"));
        assertThat(stored().getAvailableFrom()).isEqualTo(INICIO);
        assertThat(stored().getAvailableUntil()).isEqualTo(FIM);
        assertThat(code(() -> seals.createSeal(Kit.as(brand), form(FIM, FIM.minusMillis(1))))).isEqualTo("PERIODO_INVALIDO");
        assertThat(MemoryRepository.<Seal>rows(kit.dep(SealRepository.class))).hasSize(1);
    }

    @Test
    void soODonoDoSeloMudaADisponibilidade() {
        seals.createSeal(Kit.as(brand), form(INICIO, FIM));
        UUID id = stored().getId();
        User outra = Kit.user("outra-marca");
        outra.setProfileType(ProfileType.MARCA);
        kit.dep(UserRepository.class).save(outra);
        Guard guard = kit.dep(Guard.class);
        doThrow(ApiException.forbidden("só o dono")).when(guard).requireOwner(eq(Kit.as(outra)), eq(brand.getId()), any());

        ApiException e = catchThrowableOfType(() -> seals.updateSeal(Kit.as(outra), id, form(null, null)), ApiException.class);

        assertThat(e.status()).isEqualTo(403);
        verify(guard).requireOwner(eq(Kit.as(outra)), eq(brand.getId()), eq("seal:" + id));
        verify(guard).requireApprovedInstitutional(eq(Kit.as(outra)), eq("seals"), any());
        assertThat(stored().getAvailableFrom()).isEqualTo(INICIO);
        assertThat(stored().getAvailableUntil()).isEqualTo(FIM);
    }

    @Test
    void estadoSegueOsMesmosLimitesDeDisponivelNoInstanteExato() {
        Seal s = new Seal();
        s.setStatus(SealStatus.ACTIVE);
        s.setAvailableFrom(INICIO);
        s.setAvailableUntil(FIM);

        assertThat(estado(s, INICIO.minusMillis(1))).isEqualTo("SCHEDULED:false");
        assertThat(estado(s, INICIO)).as("o início é inclusivo").isEqualTo("OPEN:true");
        assertThat(estado(s, FIM.minusMillis(1))).isEqualTo("OPEN:true");
        assertThat(estado(s, FIM)).as("o fim é exclusivo").isEqualTo("ENDED:false");
        assertThat(SealViews.unavailableReason(s, FIM)).isEqualTo(Msg.t("seal.o_periodo_de_emissao_do"));
        assertThat(SealViews.unavailableReason(s, INICIO.minusSeconds(1))).isNotBlank();
        s.setUsageLimit(1);
        s.setUsageCount(1);
        assertThat(estado(s, INICIO)).isEqualTo("SOLD_OUT:false");
        s.setStatus(SealStatus.INACTIVE);
        assertThat(estado(s, INICIO)).isEqualTo("INACTIVE:false");
        Seal semPeriodo = new Seal();
        semPeriodo.setStatus(SealStatus.ACTIVE);
        assertThat(estado(semPeriodo, Instant.EPOCH)).isEqualTo("OPEN:true");
    }

    private static String estado(Seal s, Instant now) {
        return SealViews.availabilityState(s, now) + ":" + SealViews.available(s, now);
    }
}
