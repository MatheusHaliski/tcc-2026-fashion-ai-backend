package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.DataExportRequest;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ConsentPurpose;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.DataExportRequestRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Conta e LGPD (RF3): dados da conta, troca de e-mail confirmada por código no novo endereço, privacidade do perfil,
 * consentimentos por finalidade (reconhecimento facial nunca), exportação dos dados em JSON (só o dono baixa, com
 * validade), e a exclusão com 30 dias para desistir e anonimização irreversível no fim.
 */
class AccountServiceTest {
    private Kit kit;
    private World world;
    private AccountService account;
    private CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        MediaStoragePort storage = kit.dep(MediaStoragePort.class);
        when(storage.put(anyString(), any(), anyString())).thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "application/json"));
        when(storage.get(anyString())).thenReturn("{}".getBytes());
        account = kit.build(AccountService.class);
        ana = Kit.as(world.me);
    }

    @Test
    void dadosDaContaComConsentimentos() {
        Map<String, Object> me = account.me(ana);
        assertThat(me).containsKeys("user", "email", "consents", "defaultSchemeVisibility");
        assertThat((List<?>) me.get("consents")).hasSize(AccountService.PURPOSES.size());
        User marca = Kit.user("marca");
        marca.setProfileType(ProfileType.MARCA);
        kit.dep(UserRepository.class).save(marca);
        BrandProfile bp = new BrandProfile();
        bp.setOwner(marca);
        bp.setBrandName("Marca");
        bp.setSlug("marca");
        kit.dep(BrandProfileRepository.class).save(bp);
        assertThat(account.me(Kit.as(marca))).containsKey("brandProfile");
        assertThatThrownBy(() -> account.me(Kit.as(Kit.user("fantasma")))).isInstanceOf(ApiException.class);
    }

    @Test
    void trocaDeEmailConfirmadaPorCodigo() {
        Map<String, Object> r = account.updateSensitive(ana, new AccountService.SensitiveUpdate("senha", "Ana.Nova@Example.com", "(11) 99999-0000",
                "1995-04-02", true));
        assertThat(r).containsKey("emailChangePending");
        assertThat((List<?>) r.get("changed")).hasSize(4);
        assertThat(world.me.getPhone()).isEqualTo("11999990000");
        assertThatThrownBy(() -> account.updateSensitive(ana, new AccountService.SensitiveUpdate("senha", "sem-arroba", null, null, null)))
                .isInstanceOf(ApiException.class);
        assertThat(account.updateSensitive(ana, new AccountService.SensitiveUpdate("senha", null, "", "", null)).get("changed").toString()).contains("phone");

        // código conhecido para a confirmação
        VerificationCode vc = new VerificationCode();
        vc.setUser(world.me);
        vc.setPurpose(VerificationPurpose.EMAIL_CHANGE);
        vc.setCodeHash(Hashing.sha256(world.me.getId() + ":" + "123456"));
        vc.setTarget("ana.nova@example.com");
        vc.setExpiresAt(Instant.now().plusSeconds(3600));
        kit.dep(VerificationCodeRepository.class).save(vc);
        MemoryRepository.<VerificationCode>rows(kit.dep(VerificationCodeRepository.class)).stream().filter(c -> c != vc).forEach(c -> c.setConsumedAt(Instant.now()));
        assertThatThrownBy(() -> account.confirmEmailChange(ana, "000000")).isInstanceOf(ApiException.class);
        assertThat(account.confirmEmailChange(ana, "123456").username()).isEqualTo("ana");
        assertThat(world.me.getEmail()).isEqualTo("ana.nova@example.com");
        assertThatThrownBy(() -> account.confirmEmailChange(ana, "123456")).isInstanceOf(ApiException.class);
    }

    @Test
    void privacidadeEConsentimentos() {
        assertThat(account.updatePrivacy(ana, Visibility.FOLLOWERS)).containsEntry("privateAccount", true);
        assertThat(account.updatePrivacy(ana, Visibility.PUBLIC)).containsEntry("privateAccount", false);
        assertThatThrownBy(() -> account.updatePrivacy(ana, null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> account.setConsent(ana, ConsentPurpose.FACIAL_RECOGNITION, true)).isInstanceOf(ApiException.class);
        ConsentPurpose any = AccountService.PURPOSES.keySet().stream().filter(p -> p != ConsentPurpose.FACIAL_RECOGNITION).findFirst().orElseThrow();
        List<Map<String, Object>> granted = account.setConsent(ana, any, true);
        assertThat(granted.stream().filter(m -> any.name().equals(m.get("purpose"))).findFirst().orElseThrow()).containsEntry("granted", true);
        List<Map<String, Object>> revoked = account.setConsent(ana, any, false);
        assertThat(revoked.stream().filter(m -> any.name().equals(m.get("purpose"))).findFirst().orElseThrow()).containsEntry("granted", false);
        assertThat(AccountService.defaultVisibility(new User())).isEqualTo(Visibility.PRIVATE);
    }

    @Test
    void exportacaoDosDadosSoParaODonoEComValidade() {
        Map<String, Object> exp = account.requestExport(ana);
        UUID id = (UUID) exp.get("id");
        assertThat((Integer) exp.get("bytes")).isGreaterThan(100);
        assertThat(account.exportsOf(ana)).hasSize(1);
        assertThat(account.downloadExport(ana, id)).isNotEmpty();
        assertThatThrownBy(() -> account.downloadExport(Kit.as(world.rival), id)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> account.downloadExport(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
        DataExportRequest req = kit.dep(DataExportRequestRepository.class).findById(id).orElseThrow();
        req.setExpiresAt(Instant.now().minusSeconds(60));
        when(kit.dep(DataExportRequestRepository.class).findByExpiresAtBeforeAndFileKeyIsNotNull(any())).thenReturn(List.of(req));
        assertThat(account.purgeExpiredExports()).isEqualTo(1);
        assertThatThrownBy(() -> account.downloadExport(ana, id)).isInstanceOf(ApiException.class);
        assertThat(AccountService.exportKey(world.me.getId(), id)).startsWith("restricted/");
    }

    @Test
    void exclusaoComPrazoParaDesistirEAnonimizacao() {
        Map<String, Object> r = account.requestDeletion(ana, "senha");
        assertThat(r).containsEntry("status", AccountStatus.DELETION_SCHEDULED);
        assertThat(account.cancelDeletion(ana)).containsEntry("status", AccountStatus.ACTIVE);
        assertThat(account.cancelDeletion(ana)).containsEntry("status", AccountStatus.ACTIVE);
        account.requestDeletion(ana, "senha");
        world.me.setDeletionScheduledFor(Instant.now().minusSeconds(60));
        when(kit.dep(UserRepository.class).findByStatus(AccountStatus.DELETION_SCHEDULED)).thenReturn(List.of(world.me));
        assertThat(account.purgeScheduledDeletions()).isEqualTo(1);
        assertThat(world.me.getUsername()).startsWith("deleted_");
        assertThat(world.me.getEmail()).endsWith("@fashionai.invalid");
        assertThat(world.looksOf(world.me)).allMatch(s -> s.getStatus() == SchemeStatus.ARCHIVED);
        verify(kit.dep(Avatar3dService.class)).deleteAllFor(world.me.getId());
        assertThat(map(Map.of("x", 1))).isNotNull();
    }
}
