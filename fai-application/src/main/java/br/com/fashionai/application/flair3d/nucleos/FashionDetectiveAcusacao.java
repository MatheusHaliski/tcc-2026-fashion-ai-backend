package br.com.fashionai.application.flair3d.nucleos;

/**
 * A acusação do caso "A Coleção Maré" (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md, seção 9): a pessoa aponta um
 * suspeito pelo número (2 a 9) e o servidor decide o final. Quem é o culpado só existe aqui: o cliente recebe o final
 * depois de acusar, nunca antes. A acusação abre com {@value #PISTAS_PARA_ACUSAR} pistas achadas (ou com o tempo
 * esgotado). Nenhum final é beco sem saída: o suspeito errado na primeira tentativa volta à passarela para uma nova
 * acusação; na segunda, a verdade é revelada. Ser pega sem vida fecha o caso em derrota ({@link Final#CAPTURADO}).
 */
public final class FashionDetectiveAcusacao {
    public static final int PRIMEIRO_SUSPEITO = 2;
    public static final int ULTIMO_SUSPEITO = 9;
    public static final int TOTAL_DE_PISTAS = 12;
    /** Pistas para o final completo. */
    public static final int PISTAS_DO_FINAL_COMPLETO = 8;
    /** Pistas achadas para a acusação abrir (reauditoria de 25/11/2026): antes disso, só com o tempo esgotado. */
    public static final int PISTAS_PARA_ACUSAR = 6;
    /** O culpado (Bento Varela, nº 2 do elenco). */
    private static final int CULPADO = 2;

    public enum Final {
        /** culpado certo com provas bastantes: a cadeia inteira na cutscene */
        COMPLETO,
        /** culpado certo com poucas provas: ele nega e sai; a autoria fica em dúvida */
        PARCIAL,
        /** suspeito errado na primeira tentativa: o álibi aparece e a pessoa acusa de novo */
        ERRADO_REVER,
        /** suspeito errado na segunda tentativa: Iolanda revela a verdade */
        ERRADO_REVELA,
        /** a detetive foi pega sem nenhuma marca de vida: o caso fecha sem acusação, em derrota */
        CAPTURADO
    }

    private FashionDetectiveAcusacao() {
    }

    /**
     * O final da acusação.
     *
     * @param suspeito  número do suspeito apontado (2 a 9)
     * @param pistas    quantas das doze pistas a pessoa achou
     * @param tentativa 1 na primeira acusação, 2 na revisão
     */
    public static Final decidir(int suspeito, int pistas, int tentativa) {
        if (suspeito < PRIMEIRO_SUSPEITO || suspeito > ULTIMO_SUSPEITO) {
            throw new IllegalArgumentException("suspeito fora do quadro: " + suspeito);
        }
        if (pistas < 0 || pistas > TOTAL_DE_PISTAS) {
            throw new IllegalArgumentException("pistas fora do caso: " + pistas);
        }
        if (suspeito == CULPADO) {
            return pistas >= PISTAS_DO_FINAL_COMPLETO ? Final.COMPLETO : Final.PARCIAL;
        }
        return tentativa <= 1 ? Final.ERRADO_REVER : Final.ERRADO_REVELA;
    }

    /** O final fecha a partida? (só a revisão do suspeito errado deixa a acusação aberta) */
    public static boolean encerra(Final f) {
        return f != Final.ERRADO_REVER;
    }
}
