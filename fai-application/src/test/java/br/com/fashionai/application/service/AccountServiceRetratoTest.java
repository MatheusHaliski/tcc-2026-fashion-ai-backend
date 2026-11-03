package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.lens.LensService;
import br.com.fashionai.application.ports.EmailSenderPort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.privacy.AccountDataCleanup;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.DataExportRequest;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.VerificationCode;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ConsentPurpose;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.VerificationPurpose;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.DataExportRequestRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.VerificationCodeRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Caracterização do R95 (sobre o AccountService original): dados da conta (pessoa e marca), dados sensíveis com troca
 * de e-mail, confirmação do novo e-mail, privacidade, consentimentos, exportação (pacote JSON, lista, download, job de
 * vencidas), exclusão agendada/cancelada e o job de anonimização — respostas, chamadas e o pacote exportado.
 */
class AccountServiceRetratoTest {
    private static final Path GOLDEN = Path.of("src/test/resources/identity/account-service-retrato.txt");

    @Test
    void retratoDaConta() throws Exception {
        Kit kit = new Kit();
        World world = new World(kit);
        Map<String, byte[]> objects = new LinkedHashMap<>();
        MediaStoragePort storage = kit.dep(MediaStoragePort.class);
        when(storage.put(anyString(), any(), anyString())).thenAnswer(i -> {
            objects.put(i.getArgument(0), i.getArgument(1));
            return new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, i.getArgument(2));
        });
        when(storage.get(anyString())).thenAnswer(i -> objects.get((String) i.getArgument(0)));
        AccountService account = kit.build(AccountService.class);
        AccountDataCleanup cleanup = Mockito.mock(AccountDataCleanup.class);
        ReflectionTestUtils.setField(account, "accountDataCleanup", List.of(cleanup));
        IdentityRetrato r = new IdentityRetrato();
        r.sizes = false;
        User me = world.me;
        me.setEmailHash(Hashing.emailHash(me.getEmail()));
        CurrentUser ana = Kit.as(me);
        Runnable calls = () -> {
            r.calls("identity", kit.dep(IdentityService.class));
            r.calls("email", kit.dep(EmailSenderPort.class));
            r.calls("notifications", kit.dep(NotificationService.class));
            r.calls("audit", kit.dep(Audit.class));
            r.calls("storage", storage);
            r.calls("avatars3d", kit.dep(Avatar3dService.class));
            r.calls("lens", kit.dep(LensService.class));
            r.calls("cleanup", cleanup);
        };

        r.step("me", () -> account.me(ana));
        User marca = Kit.user("marca");
        marca.setProfileType(ProfileType.MARCA);
        kit.dep(UserRepository.class).save(marca);
        BrandProfile bp = new BrandProfile();
        bp.setOwner(marca);
        bp.setBrandName("Marca");
        bp.setSlug("marca");
        bp.setApprovalStatus(ApprovalStatus.PENDENTE);
        kit.dep(BrandProfileRepository.class).save(bp);
        r.step("me.marca", () -> account.me(Kit.as(marca)));
        r.step("me.inexistente", () -> account.me(Kit.as(Kit.user("fantasma"))));
        calls.run();

        r.step("sensitive.tudo", () -> account.updateSensitive(ana, new AccountService.SensitiveUpdate("senha", " Ana.Nova@Example.com ",
                "(11) 99999-0000", "1995-04-02", true)));
        r.step("sensitive.emailInvalido", () -> account.updateSensitive(ana, new AccountService.SensitiveUpdate("s", "sem-arroba", null, null, null)));
        r.step("sensitive.emailEmUso", () -> account.updateSensitive(ana, new AccountService.SensitiveUpdate("s", "bia@example.com", null, null, null)));
        world.rival.setEmailHash(Hashing.emailHash(world.rival.getEmail()));
        r.step("sensitive.emailEmUso2", () -> account.updateSensitive(ana, new AccountService.SensitiveUpdate("s", "BIA@example.com", null, null, null)));
        r.step("sensitive.mesmoEmail", () -> account.updateSensitive(ana, new AccountService.SensitiveUpdate("s", "ANA@example.com", "", "", false)));
        calls.run();

        r.step("confirm.semPedido", () -> account.confirmEmailChange(Kit.as(marca), "1"));
        VerificationCode vc = new VerificationCode();
        vc.setUser(me);
        vc.setPurpose(VerificationPurpose.EMAIL_CHANGE);
        vc.setCodeHash(Hashing.sha256(me.getId() + ":" + "123456"));
        vc.setTarget("ana.nova@example.com");
        vc.setExpiresAt(Instant.now().plusSeconds(3600));
        vc.markCreatedAt(Instant.now().plusSeconds(60));
        kit.dep(VerificationCodeRepository.class).save(vc);
        r.step("confirm.errado", () -> account.confirmEmailChange(ana, "000000"));
        r.step("confirm.certo", () -> account.confirmEmailChange(ana, "123456"));
        r.line("me.email", List.of(me.getEmail(), me.isEmailVerified(), vc.getAttempts()));
        calls.run();

        r.step("privacy.nula", () -> account.updatePrivacy(ana, null));
        r.step("privacy.seguidores", () -> account.updatePrivacy(ana, Visibility.FOLLOWERS));
        r.step("privacy.publica", () -> account.updatePrivacy(ana, Visibility.PUBLIC));
        r.step("consent.facial", () -> account.setConsent(ana, ConsentPurpose.FACIAL_RECOGNITION, true));
        r.step("consent.facialNao", () -> account.setConsent(ana, ConsentPurpose.FACIAL_RECOGNITION, false));
        r.step("consent.ia", () -> account.setConsent(ana, ConsentPurpose.AI_RECOMMENDATION, true));
        r.step("consent.iaRevoga", () -> account.setConsent(ana, ConsentPurpose.AI_RECOMMENDATION, false));
        r.line("defaultVisibility", List.of(AccountService.defaultVisibility(new User()), AccountService.defaultVisibility(me)));
        calls.run();

        r.step("export", () -> account.requestExport(ana));
        UUID exportId = MemoryRepository.<DataExportRequest>rows(kit.dep(DataExportRequestRepository.class)).get(0).getId();
        byte[] stored = objects.get(AccountService.exportKey(me.getId(), exportId));
        // o pacote vem de Map.of (ordem de chaves muda a cada JVM): lido de volta e ordenado em profundidade
        r.line("export.json", sortDeep(br.com.fashionai.application.common.Json.MAPPER.readValue(stored, Object.class)));
        r.step("exportsOf", () -> account.exportsOf(ana));
        r.step("download", () -> java.util.Arrays.equals(stored, account.downloadExport(ana, exportId)));
        r.step("download.outro", () -> account.downloadExport(Kit.as(world.rival), exportId));
        r.step("download.inexistente", () -> account.downloadExport(ana, UUID.randomUUID()));
        DataExportRequest req = kit.dep(DataExportRequestRepository.class).findById(exportId).orElseThrow();
        req.setExpiresAt(Instant.now().minusSeconds(60));
        when(kit.dep(DataExportRequestRepository.class).findByExpiresAtBeforeAndFileKeyIsNotNull(any())).thenReturn(List.of(req));
        Mockito.doThrow(new IllegalStateException("x")).when(storage).delete(anyString());
        r.step("purgeExports", account::purgeExpiredExports);
        r.step("exportsOf.vencida", () -> account.exportsOf(ana));
        r.step("download.vencida", () -> account.downloadExport(ana, exportId));
        calls.run();

        r.step("cancel.semPedido", () -> account.cancelDeletion(ana));
        r.step("deletion", () -> account.requestDeletion(ana, "senha"));
        r.step("cancel", () -> account.cancelDeletion(ana));
        r.step("deletion.marca", () -> account.requestDeletion(Kit.as(marca), "senha"));
        r.step("cancel.marca", () -> account.cancelDeletion(Kit.as(marca)));
        me.setEmailVerified(false);
        r.step("deletion.naoVerificada", () -> account.requestDeletion(ana, "senha"));
        r.step("cancel.naoVerificada", () -> account.cancelDeletion(ana));
        account.requestDeletion(ana, "senha");
        me.setDeletionScheduledFor(Instant.now().minusSeconds(60));
        account.requestDeletion(Kit.as(world.rival), "senha");
        when(kit.dep(UserRepository.class).findByStatus(AccountStatus.DELETION_SCHEDULED)).thenReturn(List.of(world.rival, me));
        calls.run();
        r.step("purgeDeletions", account::purgeScheduledDeletions);
        String tag = me.getId().toString().substring(0, 8);
        r.line("me.depois", List.of(me.getUsername().replace(tag, "<tag>"), me.getDisplayName(), me.getEmail().replace(tag, "<tag>"),
                me.getStatus(), String.valueOf(me.getPhone()),
                String.valueOf(me.getAvatarUrl()), me.getEmailHash().length(), me.getPasswordHash().length()));
        r.line("looks", world.looksOf(me).stream().map(s -> s.getStatus() + "/" + s.getVisibility()).toList());
        r.line("pieces", world.piecesOf(me).stream().map(p -> p.getAvailabilityStatus() + "/" + p.getVisibility() + "/" + p.isDisponivel()).toList());
        calls.run();
        assertThat(r.text()).isEqualTo(IdentityRetrato.golden(r.text(), GOLDEN));
    }

    static Object sortDeep(Object v) {
        if (v instanceof Map<?, ?> m) {
            java.util.TreeMap<String, Object> out = new java.util.TreeMap<>();
            m.forEach((k, x) -> out.put(String.valueOf(k), sortDeep(x)));
            return out;
        }
        if (v instanceof List<?> l) {
            return l.stream().map(AccountServiceRetratoTest::sortDeep).toList();
        }
        return v;
    }
}
