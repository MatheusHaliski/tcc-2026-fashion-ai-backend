package br.com.fashionai.web.controller;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Leitura de ids=a,b,c compartilhada pelo Hype em lote e pelos selos das peças (extraída no lote R60a). */
class UuidCsvTest {

    @Test
    void aparaEspacosIgnoraMalformadosEVaziosEPreservaAOrdem() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        assertThat(UuidCsv.parse(" " + b + " ,,nao-e-uuid, " + a + " ", 10)).containsExactly(b, a);
    }

    @Test
    void ausenteOuSemIdValidoViraListaVaziaMutavel() {
        assertThat(UuidCsv.parse(null, 10)).isEmpty();
        assertThat(UuidCsv.parse("", 10)).isEmpty();
        var lista = UuidCsv.parse("x,y", 10);
        lista.add(UUID.randomUUID());
        assertThat(lista).hasSize(1);
    }

    @Test
    void paraAoAtingirOMaximoContandoSoOsValidos() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        assertThat(UuidCsv.parse("x," + a + ",y," + b + "," + c, 2)).containsExactly(a, b);
    }
}
