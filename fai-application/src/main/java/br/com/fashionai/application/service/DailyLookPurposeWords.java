package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.enums.DailyLookPurpose;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Look do Dia Vivido F1 — palavras do plano da semana (rótulo do evento, ocasião) que apontam para um propósito.
 * Determinístico e sem IA: o Copilot só sugere; quem confirma é a pessoa. Acentos e caixa não importam.
 */
final class DailyLookPurposeWords {
    private static final Map<String, DailyLookPurpose> WORDS = new LinkedHashMap<>();

    static {
        put(DailyLookPurpose.PRIMEIRO_DIA, "primeiro dia", "first day", "primer dia");
        put(DailyLookPurpose.ENTREVISTA, "entrevista", "interview", "processo seletivo");
        put(DailyLookPurpose.APRESENTACAO, "apresentacao", "presentation", "palestra", "pitch", "defesa", "banca");
        put(DailyLookPurpose.CERIMONIA, "casamento", "formatura", "cerimonia", "batizado", "wedding", "ceremony", "graduation", "formal");
        put(DailyLookPurpose.FESTA, "festa", "aniversario", "balada", "show", "party", "birthday", "fiesta", "concert");
        put(DailyLookPurpose.VIAGEM, "viagem", "aeroporto", "travel", "trip", "viaje");
        put(DailyLookPurpose.CONSULTA, "consulta", "medico", "dentista", "exame", "hospital", "doctor", "appointment");
        put(DailyLookPurpose.ENCONTRO, "encontro", "jantar", "date", "cita", "dinner");
        put(DailyLookPurpose.ESTUDO, "aula", "prova", "faculdade", "escola", "estudo", "class", "exam", "school", "university", "clase");
        put(DailyLookPurpose.HOME_OFFICE, "home office", "remoto", "remote", "teletrabalho");
        put(DailyLookPurpose.TRABALHO_PRESENCIAL, "trabalho", "escritorio", "reuniao", "cliente", "work", "office", "meeting", "business", "trabajo", "oficina");
        put(DailyLookPurpose.LAZER, "passeio", "parque", "praia", "academia", "treino", "casual", "sport", "sports", "leisure", "lazer", "weekend", "fim de semana");
        put(DailyLookPurpose.DESCANSO, "descanso", "folga", "em casa", "rest", "day off", "descanso");
    }

    private DailyLookPurposeWords() {
    }

    /** Propósito cuja palavra aparece no texto (a mais específica primeiro); vazio quando nenhuma aparece. */
    static Optional<DailyLookPurpose> from(String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        String plain = plain(text);
        return WORDS.entrySet().stream().filter(e -> plain.contains(e.getKey())).map(Map.Entry::getValue).findFirst();
    }

    static String plain(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replace('_', ' ');
    }

    private static void put(DailyLookPurpose p, String... words) {
        for (String w : words) {
            WORDS.putIfAbsent(w, p);
        }
    }
}
