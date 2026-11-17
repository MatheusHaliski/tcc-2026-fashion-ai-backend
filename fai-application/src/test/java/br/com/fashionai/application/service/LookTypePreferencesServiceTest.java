package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.TipoLook;
import br.com.fashionai.domain.repository.TipoLookRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LookTypePreferencesServiceTest {
    private Kit kit;
    private World world;
    private LookTypePreferencesService service;
    private CurrentUser user;
    private TipoLook type;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        user = Kit.as(world.me);
        service = kit.build(LookTypePreferencesService.class);
        type = new TipoLook();
        type.setCodigo("FEMININO");
        type.setNome("Feminino do catálogo");
        kit.dep(TipoLookRepository.class).save(type);
    }

    @Test
    void defaultIsDisabledAndCanBeSavedAndCleared() {
        assertThat(service.get(user)).containsEntry("tipoLook", null);
        service.update(user, type.getId());
        assertThat(service.defaultType(user.id())).isSameAs(type);
        assertThat(service.get(user).get("tipoLook")).isNotNull();
        service.update(user, null);
        assertThat(service.defaultType(user.id())).isNull();
    }

    @Test
    void unknownTypeDoesNotReplaceExistingPreference() {
        service.update(user, type.getId());
        assertThatThrownBy(() -> service.update(user, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThat(service.defaultType(user.id())).isSameAs(type);
    }

    @Test
    void preferenceIsScopedToAuthenticatedUser() {
        service.update(user, type.getId());
        var other = world.person("outra", 0);
        assertThat(service.defaultType(other.getId())).isNull();
        assertThat(service.defaultType(user.id())).isSameAs(type);
    }
}
