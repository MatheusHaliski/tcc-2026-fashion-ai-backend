package br.com.fashionai.application.catalog;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CatalogDesignInterpreterTest {
    private final CatalogDesignInterpreter interpreter = CatalogDesignInterpreter.get();

    @Test
    void monogramaEmTodaASuperficieCinzaEPreto() {
        DesignTraits t = interpreter.interpret("camisa calvin klein com o logo ck estampado em toda a superfície, frente e verso, cinza e preto");
        assertThat(t.pattern()).isEqualTo("ALLOVER_LOGO");
        assertThat(t.logoPlacement()).isEqualTo("ALLOVER");
        assertThat(t.sides()).containsExactlyInAnyOrder("FRONT", "BACK");
        assertThat(t.allColors()).containsExactly("gray", "black");
        assertThat(t.consumed()).contains("logo", "toda", "cinza", "preto").doesNotContain("calvin", "camisa");
    }

    @Test
    void todaAzulComUmUnicoLogoCentralBranco() {
        DesignTraits t = interpreter.interpret("camisa calvin klein toda azul com um único logo CK branco no centro");
        assertThat(t.pattern()).isEqualTo("SINGLE_LOGO");
        assertThat(t.logoPlacement()).isEqualTo("CENTER_CHEST");
        assertThat(t.baseColors()).containsExactly("blue");
        assertThat(t.printColors()).containsExactly("white");
    }

    @Test
    void outrasEstampasEPapelDasCores() {
        assertThat(interpreter.interpret("camiseta listrada azul marinho e branca").pattern()).isEqualTo("STRIPES");
        assertThat(interpreter.interpret("camiseta listrada azul marinho e branca").baseColors()).containsExactly("navy", "white");
        assertThat(interpreter.interpret("polo verde com logo pequeno no peito esquerdo").logoPlacement()).isEqualTo("LEFT_CHEST");
        assertThat(interpreter.interpret("polo verde com logo pequeno no peito esquerdo").logoSize()).isEqualTo("SMALL");
        assertThat(interpreter.interpret("moletom preto com estampa de logos espalhados").pattern()).isEqualTo("ALLOVER_LOGO");
    }

    @Test
    void semCaracteristicaNadaEInventado() {
        DesignTraits t = interpreter.interpret("air force 1");
        assertThat(t.isEmpty()).isTrue();
        assertThat(t.consumed()).isEmpty();
    }

    @Test
    void designDoProdutoPelaDescricao() {
        DesignTraits p = interpreter.ofProduct("Camiseta Logo Central", "Camiseta azul com um único logo CK branco no centro do peito.", "Blue", "blue");
        assertThat(p.pattern()).isEqualTo("SINGLE_LOGO");
        assertThat(p.baseColors()).containsExactly("blue");
        assertThat(p.printColors()).contains("white");
        assertThat(DesignTraits.fromMap(java.util.Map.of("pattern", "allover_logo", "sides", List.of("front", "back")), "CATALOG").sides())
                .isEqualTo(Set.of("FRONT", "BACK"));
    }
}
