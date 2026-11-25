package br.com.fashionai.application.flair3d.esporte;

import br.com.fashionai.application.flair3d.Flair3dErros;

/**
 * O tempo do chute e do desarme (reauditoria de 25/11/2026: "o duelo continua sendo carta + sorte de ±8"). Quando a
 * carta jogada chuta ou desarma, a tela abre uma barra de tempo; o acerto vai no alvo do acionamento como faixa
 * ("TEMPO:0" errou, "TEMPO:1" bom, "TEMPO:2" perfeito; o servidor só aceita esses três) e corta a parte da sorte que a
 * habilidade controla: o perfeito não deixa a sorte passar de −3 contra; o bom, de −5; quem erra a barra não tem sorte
 * acima de +3. Apertar a sorte nos dois lados (±3) foi medido e piorava o resultado de quem acertava com cartas fracas,
 * que precisam da sorte: por isso o corte é só do lado ruim. O número sorteado é o mesmo (a semente não muda de
 * ordem), então o resto da partida segue igual. Combina com a posição da capitã no mesmo alvo
 * ("POSICAO:dx,dy;TEMPO:2"). Puro.
 */
final class EsporteTempo {
    static final String PREFIXO = "TEMPO:";
    /** Sem barra (ou ação que não chuta nem desarma): a sorte inteira. */
    static final int SEM = -1;

    private EsporteTempo() {
    }

    /** A parte do alvo com o prefixo ("POSICAO:..." ou "TEMPO:..."), ou nula. */
    static String parte(String alvo, String prefixo) {
        if (alvo == null) {
            return null;
        }
        for (String p : alvo.split(";")) {
            if (p.startsWith(prefixo)) {
                return p;
            }
        }
        return null;
    }

    /** A faixa do acerto (0 a 2) ou {@link #SEM}; outro valor é recusado (422). */
    static int faixa(String alvo) {
        String p = parte(alvo, PREFIXO);
        if (p == null) {
            return SEM;
        }
        return switch (p.substring(PREFIXO.length())) {
            case "0" -> 0;
            case "1" -> 1;
            case "2" -> 2;
            default -> throw Flair3dErros.invalido("ACAO_INVALIDA", "acao_invalida");
        };
    }

    /** A sorte sorteada (de −SORTE a +SORTE) pelo acerto: perfeito, nunca abaixo de −3; bom, de −5; errou, nunca acima de +3. */
    static int sorte(int sorteada, int faixa) {
        return switch (faixa) {
            case 2 -> Math.max(sorteada, -3);
            case 1 -> Math.max(sorteada, -5);
            case 0 -> Math.min(sorteada, 3);
            default -> sorteada;
        };
    }
}
