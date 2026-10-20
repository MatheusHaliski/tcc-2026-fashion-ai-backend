package br.com.fashionai.application.service;

import br.com.fashionai.application.ports.ExchangeRatePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** RF23.CA13 — preços na moeda do usuário: cotação do BCE com cache, última cotação boa e taxa de reserva. */
@SuppressWarnings("unchecked")
class ExchangeRateServiceTest {
    private final ExchangeRatePort port = mock(ExchangeRatePort.class);
    private final ObjectProvider<ExchangeRatePort> provider = mock(ObjectProvider.class);
    private final MutableClock clock = new MutableClock(Instant.parse("2026-10-19T12:00:00Z"));
    private ExchangeRateService fx;

    @BeforeEach
    void setUp() {
        when(provider.getIfAvailable()).thenReturn(port);
        fx = new ExchangeRateService(provider, clock);
    }

    private void quote(String usd, String eur) {
        when(port.latest(eq("BRL"), any())).thenReturn(Optional.of(new ExchangeRatePort.Quote("BRL", LocalDate.of(2026, 10, 17),
                Map.of("USD", new BigDecimal(usd), "EUR", new BigDecimal(eur)))));
    }

    @Test
    void converteDeBrlParaUsdEEurEEntreElasPelaBase() {
        quote("0.20", "0.16");
        assertThat(fx.convert(new BigDecimal("100.00"), "BRL", "USD")).contains(new BigDecimal("20.00"));
        assertThat(fx.convert(new BigDecimal("100.00"), "brl", "eur")).contains(new BigDecimal("16.00"));
        assertThat(fx.convert(new BigDecimal("20.00"), "USD", "BRL")).contains(new BigDecimal("100.00"));
        assertThat(fx.convert(new BigDecimal("20.00"), "USD", "EUR")).contains(new BigDecimal("16.00"));
        assertThat(fx.convert(new BigDecimal("7.50"), "EUR", "EUR")).contains(new BigDecimal("7.50"));
        assertThat(fx.convert(new BigDecimal("1"), "BRL", "JPY")).isEmpty();
        Map<String, Object> view = fx.view();
        assertThat(view).containsEntry("base", "BRL").containsEntry("source", "ECB").containsEntry("date", LocalDate.of(2026, 10, 17));
    }

    @Test
    void cacheDeSeisHorasSoBuscaDeNovoQuandoVence() {
        quote("0.20", "0.16");
        fx.rates();
        clock.advance(Duration.ofHours(5));
        fx.rates();
        verify(port, times(1)).latest(eq("BRL"), any());
        clock.advance(Duration.ofHours(2));
        quote("0.25", "0.16");
        assertThat(fx.rates().rates()).containsEntry("USD", new BigDecimal("0.25"));
        verify(port, times(2)).latest(eq("BRL"), any());
    }

    @Test
    void fonteForaDoArMantemAUltimaCotacaoBoaENaoInsisteACadaRequisicao() {
        quote("0.20", "0.16");
        fx.rates();
        clock.advance(Duration.ofHours(7));
        when(port.latest(eq("BRL"), any())).thenReturn(Optional.empty());
        assertThat(fx.rates().rates()).containsEntry("USD", new BigDecimal("0.20"));
        fx.rates();
        fx.rates();
        verify(port, times(2)).latest(eq("BRL"), any());   // a 1ª busca e uma única nova tentativa
    }

    @Test
    void semNenhumaCotacaoUsaATaxaDeReservaMarcadaComoFallback() {
        when(port.latest(eq("BRL"), any())).thenReturn(Optional.empty());
        ExchangeRateService.Rates r = fx.rates();
        assertThat(r.source()).isEqualTo("FALLBACK");
        assertThat(r.rates()).containsKeys("BRL", "USD", "EUR");
        assertThat(fx.convert(new BigDecimal("100"), "BRL", "USD")).isPresent();
        when(provider.getIfAvailable()).thenReturn(null);
        assertThat(new ExchangeRateService(provider, clock).rates().source()).isEqualTo("FALLBACK");
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
