package br.com.fashionai.web.controller;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DnaControllerRaceTest {
    @Test
    void quemPerdeADisputaDaCriacaoLeDeNovoEmVezDeReceberConflito() {
        AtomicInteger calls = new AtomicInteger();
        Map<String, Object> overview = CreateOnRead.retryOnRace(() -> {
            if (calls.incrementAndGet() == 1) {
                throw new DataIntegrityViolationException("Duplicate entry for key 'style_dna.user_id'");
            }
            return Map.<String, Object>of("generated", true);
        });

        assertThat(overview).containsEntry("generated", true);
        assertThat(calls.get()).isEqualTo(2);
    }

    @Test
    void outroErroNaoERepetido() {
        AtomicInteger calls = new AtomicInteger();
        assertThatThrownBy(() -> CreateOnRead.retryOnRace(() -> {
            calls.incrementAndGet();
            throw new IllegalStateException("falha");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(calls.get()).isEqualTo(1);
    }
}
