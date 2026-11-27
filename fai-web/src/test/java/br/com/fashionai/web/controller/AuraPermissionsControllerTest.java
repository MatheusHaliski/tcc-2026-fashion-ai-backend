package br.com.fashionai.web.controller;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.AuraPermissionsService;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Regressão (criadores de peça e de look): o seletor da AURA Hype lê GET /api/me/aura-permissions. Com e-mail ainda não
 * confirmado a leitura respondia 403 e o seletor ficava em "Não foi possível verificar seu nível... continuam
 * bloqueados", sem sair do erro em "Tentar novamente". Ler o próprio nível só exige a sessão.
 */
class AuraPermissionsControllerTest {
    private static <T> T stub(Class<T> type, Object answer) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (proxy, method, args) ->
                switch (method.getName()) {
                    case "lifetime" -> answer;
                    case "findByFollowerIdAndFollowingId" -> Optional.empty();
                    case "toString" -> type.getSimpleName();
                    case "hashCode" -> 0;
                    case "equals" -> proxy == args[0];
                    default -> throw new UnsupportedOperationException(method.getName());
                }));
    }

    private static AuraPermissionsController controller() {
        Guard guard = new Guard(event -> { }, stub(FollowRepository.class, null));
        return new AuraPermissionsController(new AuraPermissionsService(stub(FaiPointsLedgerEntryRepository.class, 0L)), guard);
    }

    private static CurrentUser user(boolean emailVerified, AccountStatus status) {
        return new CurrentUser(UUID.randomUUID(), "ana", "USER", ProfileType.PESSOAL, emailVerified, status, "127.0.0.1", "test");
    }

    @Test
    @SuppressWarnings("unchecked")
    void emailPendenteLeOProprioNivelEOsAcabamentosLiberados() {
        Map<String, Object> body = controller().mine(user(false, AccountStatus.PENDING_EMAIL_VERIFICATION));
        assertThat(body).containsEntry("currentTier", "ESTREIA");
        Map<String, Map<String, Object>> finishes = (Map<String, Map<String, Object>>) body.get("hypeFinishes");
        assertThat(finishes.get("COMMON")).containsEntry("allowed", true);
        // a regra de nível continua: sem FAI XP, Rara/Lendária/Collab seguem fechadas (o servidor confere ao gravar)
        assertThat(finishes.get("RARE")).containsEntry("allowed", false).containsEntry("requiredTier", "STUDIO");
        assertThat(finishes.get("LEGENDARY")).containsEntry("allowed", false);
    }

    @Test
    void semSessaoContinua401() {
        assertThatThrownBy(() -> controller().mine(null)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(401));
    }
}
