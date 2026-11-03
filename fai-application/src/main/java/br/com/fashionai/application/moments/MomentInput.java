package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneId;
import java.util.Locale;

/** Leitura dos campos dos pedidos (data/hora no fuso do Momento e enums) com erro 400 em vez de 500. */
final class MomentInput {
    private MomentInput() {
    }

    /**
     * Data/hora do pedido → instante. Com offset ou "Z" (ISO-8601), vale o instante informado. Sem offset — o que um
     * {@code <input type="datetime-local">} envia, ex.: {@code 2026-11-09T18:30} —, é a hora de parede no fuso IANA do
     * Momento ({@code zone}); só a data vira 00:00 nesse fuso. Nunca trunca a hora nem assume o fuso do servidor.
     */
    static Instant parseInstant(String v, String field, ZoneId zone) {
        if (v == null || v.isBlank()) {
            throw ApiException.badRequest("DATA_OBRIGATORIA", Msg.t("moment.informe_a_data", field));
        }
        String s = v.trim();
        try {
            return java.time.OffsetDateTime.parse(s).toInstant();
        } catch (java.time.format.DateTimeParseException ignored) {
            // sem offset: hora de parede no fuso do Momento
        }
        try {
            return java.time.LocalDateTime.parse(s).atZone(zone).toInstant();
        } catch (java.time.format.DateTimeParseException ignored) {
            // só a data
        }
        try {
            return LocalDate.parse(s).atStartOfDay(zone).toInstant();
        } catch (java.time.format.DateTimeParseException e) {
            throw ApiException.badRequest("DATA_INVALIDA", Msg.t("moment.data_invalida", field));
        }
    }

    /** Enum do pedido sem 500: valor desconhecido vira 400 com o campo e o valor recebido. */
    static <E extends Enum<E>> E enumOf(Class<E> type, String raw, String field) {
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("VALOR_INVALIDO", Msg.t("moment.valor_invalido", field, raw));
        }
    }
}
