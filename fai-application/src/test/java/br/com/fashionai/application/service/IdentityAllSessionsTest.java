package br.com.fashionai.application.service;
import br.com.fashionai.domain.model.RefreshToken;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.RefreshTokenRepository;
import org.junit.jupiter.api.Test;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;
class IdentityAllSessionsTest {
 @Test void logoutDeTodosInvalidaFamiliaAtualEOutroDispositivoSemAfetarOutroUsuario() throws Exception {
   UUID owner = UUID.randomUUID(), current = UUID.randomUUID(), other = UUID.randomUUID(), stranger = UUID.randomUUID();
   User user = new User(); user.assignId(owner);
   RefreshToken a = new RefreshToken(); a.setUser(user); a.setFamilyId(current); a.setExpiresAt(Instant.now().plusSeconds(3600));
   RefreshToken b = new RefreshToken(); b.setUser(user); b.setFamilyId(other); b.setExpiresAt(Instant.now().plusSeconds(3600));
   RefreshToken c = new RefreshToken(); c.setFamilyId(stranger); c.setExpiresAt(Instant.now().plusSeconds(3600));
   RefreshTokenRepository repository = mock(RefreshTokenRepository.class);
   when(repository.findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(eq(owner),any())).thenReturn(List.of(a,b));
   when(repository.findByFamilyId(current)).thenReturn(List.of(a)); when(repository.findByFamilyId(other)).thenReturn(List.of(b)); when(repository.findByFamilyId(stranger)).thenReturn(List.of(c));
   IdentityService service = mock(IdentityService.class,CALLS_REAL_METHODS);
   Field field = IdentityService.class.getDeclaredField("refreshTokens"); field.setAccessible(true); field.set(service,repository);
   assertThat(service.sessionActive(current)).isTrue(); assertThat(service.sessionActive(other)).isTrue();
   assertThat(service.revokeOtherSessions(owner,null)).isEqualTo(2);
   assertThat(service.sessionActive(current)).isFalse(); assertThat(service.sessionActive(other)).isFalse(); assertThat(service.sessionActive(stranger)).isTrue();
 }
}
