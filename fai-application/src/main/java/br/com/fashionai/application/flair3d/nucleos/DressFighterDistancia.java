package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.Lutador;

import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.FORTE;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.GOLPE_BASICO;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.RAPIDO;

/**
 * A distância no ringue e a leitura do golpe (reauditoria de 25/11/2026: "andar no ringue não muda nada; a leitura mostra
 * o golpe exato, e a resposta ótima é uma consulta de tabela"). A pessoa circula entre os lances e, ao jogar a carta, a
 * tela manda a faixa em que a lutadora está ({@value #ALVO_PERTO} ou {@value #ALVO_LONGE}; o servidor só aceita essas duas,
 * sem nada vale perto, como nas lutas de antes):
 * <ul>
 *   <li>o golpe forte e o básico só acertam de perto; de longe, o rápido chega com metade da força; o especial e o
 *   contra-ataque, de qualquer distância;</li>
 *   <li>quem recua (longe) escapa do golpe rápido da oponente; o forte, que avança, pega do mesmo jeito.</li>
 * </ul>
 * A leitura do próximo golpe só é exata para quem é tão veloz quanto a oponente; o look mais lento lê só se ela vai
 * atacar ou defender. Puro.
 */
final class DressFighterDistancia {
    static final String ALVO_PERTO = "DISTANCIA:PERTO";
    static final String ALVO_LONGE = "DISTANCIA:LONGE";
    static final String PERTO = "PERTO";
    static final String LONGE = "LONGE";
    /** A leitura parcial: só se a oponente vai atacar ou defender. */
    static final String ATAQUE = "ATAQUE";
    static final String DEFESA = "DEFESA";

    private DressFighterDistancia() {
    }

    /** A faixa do lance pelo alvo do acionamento: sem alvo, perto; outro valor é recusado (422). */
    static boolean longe(String alvo) {
        if (alvo == null || ALVO_PERTO.equals(alvo)) {
            return false;
        }
        if (ALVO_LONGE.equals(alvo)) {
            return true;
        }
        throw Flair3dErros.invalido("ACAO_INVALIDA", "acao_invalida");
    }

    /** O golpe da pessoa chega à oponente desta distância? O forte e o básico só de perto. */
    static boolean alcanca(String golpe, boolean longe) {
        return !longe || !(FORTE.equals(golpe) || GOLPE_BASICO.equals(golpe));
    }

    /** Quanto (em %) do golpe chega desta distância: de longe, o rápido chega com metade da força. */
    static int forca(String golpe, boolean longe) {
        if (!alcanca(golpe, longe)) {
            return 0;
        }
        return longe && RAPIDO.equals(golpe) ? 50 : 100;
    }

    /** O golpe da oponente pega a pessoa? Quem recuou escapa do rápido. */
    static boolean pega(String golpeDela, boolean longe) {
        return !longe || !RAPIDO.equals(golpeDela);
    }

    /** O que a pessoa lê do próximo golpe: exato com velocidade igual ou maior; senão, só ataque ou defesa. */
    static String leitura(String proximo, Lutador voce, Lutador oponente) {
        if (proximo == null || voce.velocidade() >= oponente.velocidade()) {
            return proximo;
        }
        return DressFighterGolpes.ataca(proximo) ? ATAQUE : DEFESA;
    }
}
