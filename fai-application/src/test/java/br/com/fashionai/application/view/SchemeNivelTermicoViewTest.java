package br.com.fashionai.application.view;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.NivelTermico;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Leitura do nível térmico do look (docs/banco-de-dados/solucoes/04-nivel-termico.md): o SchemeView traz id, código e
 * nome; look legado sem nível lê nulo; opção desativada continua aparecendo no look que já a usa.
 */
class SchemeNivelTermicoViewTest {
    @Test
    void lookComNivelExpoeIdCodigoENome() {
        NivelTermico nivel = nivel("MODERADO", "Moderado", true);
        Scheme look = look(nivel);
        Views.SchemeView view = Views.scheme(look, List.of(), Views.ViewerState.NONE, Map.of());
        assertThat(view.nivelTermico()).isEqualTo(new Views.ReferenceOptionView(nivel.getId(), "MODERADO", "Moderado"));
        assertThat(Json.map(Json.write(view)).get("nivelTermico"))
                .isEqualTo(Map.of("id", nivel.getId().toString(), "codigo", "MODERADO", "nome", "Moderado"));
    }

    @Test
    void lookLegadoSemNivelLeNulo() {
        assertThat(Views.scheme(look(null), List.of(), Views.ViewerState.NONE, Map.of()).nivelTermico()).isNull();
    }

    @Test
    void nivelDesativadoContinuaNoLookQueJaUsa() {
        NivelTermico inativo = nivel("INTENSO", "Intenso", false);
        assertThat(Views.scheme(look(inativo), List.of(), Views.ViewerState.NONE, Map.of()).nivelTermico().nome()).isEqualTo("Intenso");
    }

    private static NivelTermico nivel(String codigo, String nome, boolean ativo) {
        NivelTermico n = new NivelTermico();
        n.assignId(UUID.randomUUID());
        n.setCodigo(codigo);
        n.setNome(nome);
        n.setAtivo(ativo);
        return n;
    }

    private static Scheme look(NivelTermico nivel) {
        User owner = new User();
        owner.assignId(UUID.randomUUID());
        owner.setProfileType(ProfileType.PESSOAL);
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(owner);
        s.setTitle("Look de teste");
        s.setNivelTermico(nivel);
        return s;
    }
}
