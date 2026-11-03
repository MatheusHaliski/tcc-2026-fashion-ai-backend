package br.com.fashionai.application.service;

import br.com.fashionai.application.service.CopilotService.Intent;

import java.util.Locale;

import static br.com.fashionai.application.service.CopilotPieceVocabulary.COLOR_WORDS;
import static br.com.fashionai.application.service.CopilotPieceVocabulary.MATERIAL_WORDS;
import static br.com.fashionai.application.service.CopilotPieceVocabulary.TYPE_WORDS;
import static br.com.fashionai.application.service.CopilotText.mentions;
import static br.com.fashionai.application.service.CopilotText.startsWithWord;

/**
 * Roteador de intenções do Copilot: regras tentadas em ordem sobre a mensagem (a primeira que casa decide), com
 * o vocabulário de peça ({@link CopilotPieceVocabulary}) e o de moda/clima/fundo ({@link CopilotLexicon}) para LOOKS.
 */
final class CopilotIntents {
    /** Pergunta sobre relevância das próprias peças/looks ("qual peça está em alta?", "tenho peça rara?"). */
    static final java.util.regex.Pattern HYPE_QUESTION = java.util.regex.Pattern.compile(
            ".*\\b(qual|quais|tenho|minhas?|meus?|which|what|do i|my|cu[aá]l|cu[aá]les|tengo|mis?)\\b.*\\b(hype|em alta|relevan\\w*|tend[eê]nc\\w*|trend\\w*|"
                    + "crescend\\w*|subindo|voltando|rar[ao]s?|raridade|rare|rarest|exclusiv\\w*|popular\\w*|viral|bombando|potencial|growing|rising|creciendo|volviendo)\\b.*");
    /** Pedido para montar algo continua sendo LOOKS, mesmo citando tendência ("monte um look em alta"). */
    static final java.util.regex.Pattern BUILD_REQUEST = java.util.regex.Pattern.compile(
            ".*\\b(monte|montar|monta|sugira|sugere|crie|criar|gere|gerar|build|suggest|create|make me|arma|sugiere|crea)\\b.*");

    private CopilotIntents() {
    }

    static Intent intent(String m) {
        String t = m == null ? "" : m.toLowerCase(Locale.ROOT);
        if (t.matches(".*(onde est|onde fica|cadê|cade |onde guardei|onde deixei|where is|where are|where's|where did i|dónde est|donde est|dónde guard|donde guard).*")) {
            return Intent.WHERE_IS;
        }
        if (HYPE_QUESTION.matcher(t).matches() && !BUILD_REQUEST.matcher(t).matches()) {
            return Intent.HYPE;
        }
        if (t.matches(".*(não uso|nao uso|esquecid|parad[ao]s?|há muito tempo|ha muito tempo|nunca usei|haven't worn|never worn|not worn|forgotten|unused|long time|no uso|olvidad|nunca usé|nunca use|mucho tiempo|redescobert|rediscover|redescubr).*")) {
            return Intent.FORGOTTEN;
        }
        if (t.matches(".*(melhorar (o |meu )?invent|inventory score|como melhorar|minha utiliza|meu score|improve (my )?invent|my utilization|my score|mejorar (el |mi )?invent|mi utiliza|mi puntuaci).*")) {
            return Intent.IMPROVE_INVENTORY;
        }
        if (t.matches(".*(diferente|fora do comum|ousad|sair da rotina|nunca combinei|different|out of the ordinary|bold|break the routine|never combined|diferente|fuera de lo común|atrevid|salir de la rutina|nunca combiné).*")) {
            return Intent.DIFFERENT;
        }
        if (t.matches(".*(comprar|o que falta|falta no meu|diagnóstic|diagnostic|lacuna|buy|what's missing|what is missing|missing from my|gap|qué falta|que falta|falta en mi|diagnóstico|brecha).*")) {
            return Intent.DIAGNOSIS;
        }
        if (t.matches(".*(look|vestir|visto|usar hoje|sugest|montar|combina|roupa para|frio|calor|trabalho|festa|faculdade|academia|fundo|background|aura|material|conjunto).*")
                || hasPieceConstraints(t) || CopilotLexicon.signalsLook(t)) {
            return Intent.LOOKS;
        }
        return Intent.GENERAL;
    }

    static boolean hasPieceConstraints(String message) {
        return COLOR_WORDS.keySet().stream().anyMatch(k -> startsWithWord(message, k))
                || TYPE_WORDS.keySet().stream().anyMatch(k -> startsWithWord(message, k))
                || MATERIAL_WORDS.keySet().stream().anyMatch(k -> mentions(message, k))
                || (message != null && message.toLowerCase(Locale.ROOT).contains("lã"));
    }
}
