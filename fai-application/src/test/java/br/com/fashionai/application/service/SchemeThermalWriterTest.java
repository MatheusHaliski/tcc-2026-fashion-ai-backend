package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.NivelTermico;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.repository.NivelTermicoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Nível térmico do look: ID nulo mantém, limpar remove, ID novo precisa existir e estar ativo; o nível antigo inativo continua. */
class SchemeThermalWriterTest {
    private final NivelTermicoRepository niveis = mock(NivelTermicoRepository.class);
    private final SchemeThermalWriter writer = new SchemeThermalWriter(niveis);

    private static NivelTermico nivel(String codigo, boolean ativo) {
        NivelTermico n = new NivelTermico();
        ReflectionTestUtils.setField(n, "id", UUID.randomUUID());
        n.setCodigo(codigo);
        n.setNome(codigo);
        n.setAtivo(ativo);
        return n;
    }

    @Test
    void idNovoAtivoEntraIdNuloMantemELimparRemove() {
        NivelTermico leve = nivel("LEVE", true);
        when(niveis.findById(leve.getId())).thenReturn(Optional.of(leve));
        Scheme look = new Scheme();
        writer.apply(look, leve.getId(), false);
        assertThat(look.getNivelTermico()).isSameAs(leve);
        writer.apply(look, null, false);
        assertThat(look.getNivelTermico()).isSameAs(leve);
        writer.apply(look, null, true);
        assertThat(look.getNivelTermico()).isNull();
    }

    @Test
    void opcaoInativaNovaRecusadaMasAAnteriorDoLookContinua() {
        NivelTermico antigo = nivel("INTENSO", false);
        Scheme look = new Scheme();
        look.setNivelTermico(antigo);
        writer.apply(look, antigo.getId(), false);
        assertThat(look.getNivelTermico()).isSameAs(antigo);
        verify(niveis, never()).findById(any());

        NivelTermico inativo = nivel("MODERADO", false);
        when(niveis.findById(inativo.getId())).thenReturn(Optional.of(inativo));
        ApiException e = catchThrowableOfType(() -> writer.apply(look, inativo.getId(), false), ApiException.class);
        assertThat(e.code()).isEqualTo("NIVEL_TERMICO_INATIVO");
        assertThat(look.getNivelTermico()).isSameAs(antigo);
    }

    @Test
    void idInexistenteOuIdComLimparSaoInvalidos() {
        UUID nenhum = UUID.randomUUID();
        when(niveis.findById(nenhum)).thenReturn(Optional.empty());
        assertThat(catchThrowableOfType(() -> writer.apply(new Scheme(), nenhum, false), ApiException.class).code()).isEqualTo("NIVEL_TERMICO_INVALIDO");
        assertThat(catchThrowableOfType(() -> writer.apply(new Scheme(), nenhum, true), ApiException.class).code()).isEqualTo("NIVEL_TERMICO_INVALIDO");
    }

    @Test
    void criterioDaRecomendacaoDevolveOCodigoSoDeNivelAtivo() {
        assertThat(writer.activeCode(null)).isNull();
        NivelTermico intenso = nivel("INTENSO", true);
        NivelTermico velho = nivel("MODERADO", false);
        when(niveis.findById(intenso.getId())).thenReturn(Optional.of(intenso));
        when(niveis.findById(velho.getId())).thenReturn(Optional.of(velho));
        assertThat(writer.activeCode(intenso.getId())).isEqualTo("INTENSO");
        assertThat(catchThrowableOfType(() -> writer.activeCode(velho.getId()), ApiException.class).code()).isEqualTo("NIVEL_TERMICO_INATIVO");
    }
}
