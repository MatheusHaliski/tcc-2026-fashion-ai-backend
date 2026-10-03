package br.com.fashionai.application.service;

import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Cadastro de marca → e-mail a cada administrador de DEV_GATE_ALLOWED_EMAILS, com o link da fila de aprovação. */
class IssuerReviewServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final BrandProfileRepository brands = mock(BrandProfileRepository.class);
    private final CelebrityProfileRepository celebrities = mock(CelebrityProfileRepository.class);
    private final EmailSenderPort email = mock(EmailSenderPort.class);
    private final SideEffectRunner sideEffects = mock(SideEffectRunner.class);

    private IssuerReviewService service(String admins) {
        IssuerReviewService s = new IssuerReviewService(users, brands, celebrities, email, sideEffects, admins, "https://fashionai.app/");
        s.setMailExecutor(Runnable::run);
        return s;
    }

    @Test
    void listaDeAdminsVemDaVariavelDoGateSemDuplicarNemAceitarLixo() {
        assertEquals(List.of("a@x.com", "b@y.org"), IssuerReviewService.parse(" a@x.com, B@Y.org ;a@x.com, nao-e-email "));
        assertTrue(IssuerReviewService.parse("").isEmpty());
    }

    @Test
    void cadastroDeMarcaAvisaCadaAdministradorComOLinkDaFila() {
        UUID id = UUID.randomUUID();
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername("zara_br");
        u.setDisplayName("Zara Brasil");
        u.setProfileType(ProfileType.MARCA);
        BrandProfile bp = new BrandProfile();
        bp.setBrandName("Zara");
        bp.setApprovalStatus(ApprovalStatus.PENDENTE);
        when(users.findById(id)).thenReturn(Optional.of(u));
        when(brands.findByOwnerId(id)).thenReturn(Optional.of(bp));

        service("admin1@fai.com,admin2@fai.com").notifyAdmins(id);

        verify(email).send(eq("admin1@fai.com"), contains("Zara"), contains("https://fashionai.app/admin/users?tab=approvals"), eq("SYSTEM"));
        verify(email).send(eq("admin2@fai.com"), anyString(), contains("@zara_br"), eq("SYSTEM"));
    }

    @Test
    void semAdministradoresConfiguradosNadaEhEnviado() {
        service("").submitted(UUID.randomUUID());
        verify(email, never()).send(anyString(), anyString(), anyString(), anyString());
    }
}
