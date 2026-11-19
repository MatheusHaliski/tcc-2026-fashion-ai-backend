package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.enums.DailyLookAudience;
import br.com.fashionai.domain.model.enums.DailyLookPurpose;

/**
 * Look do Dia Vivido F1 — o que a pessoa conta ao registrar o Look do Dia ("Hoje eu vesti isso para…"). Tudo opcional.
 * Latitude/longitude/cidade só servem para congelar a marca de clima do dia (WeatherService); nada é guardado da posição.
 */
public record DailyLookContext(DailyLookPurpose purpose, String purposeNote, DailyLookAudience audience,
                               Double latitude, Double longitude, String city) {
    public static final int NOTE_MAX = 140;

    /** Nota aparada ao tamanho da coluna; nula quando vazia. */
    public String note() {
        if (purposeNote == null || purposeNote.isBlank()) {
            return null;
        }
        String s = purposeNote.strip();
        return s.length() > NOTE_MAX ? s.substring(0, NOTE_MAX) : s;
    }

    /** Verdadeiro quando a pessoa não contou nada (o registro fica como antes, só com as marcas do calendário). */
    public boolean empty() {
        return purpose == null && note() == null && audience == null;
    }
}
