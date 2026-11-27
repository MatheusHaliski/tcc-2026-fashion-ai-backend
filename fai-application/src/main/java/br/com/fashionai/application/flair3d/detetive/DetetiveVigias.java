package br.com.fashionai.application.flair3d.detetive;

import br.com.fashionai.application.flair3d.detetive.DetetiveSala.Ponto;
import br.com.fashionai.application.flair3d.detetive.DetetiveSala.Vigia;

/**
 * Onde cada vigia está e o que ele vê (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md, seção 6): a cada passo da
 * pessoa o vigia anda um ponto da ronda e olha para o próximo; o cone de visão tem {@link #ALCANCE} metros e meia
 * abertura de {@link #MEIA_ABERTURA} graus. Quem guarda uma porta ({@code barra}) não vigia: só barra a passagem. Quem
 * está no esconderijo não é visto. Puro.
 */
public final class DetetiveVigias {
    public static final double ALCANCE = 3.8;
    public static final double MEIA_ABERTURA = 30;

    private DetetiveVigias() {
    }

    /** O ponto do vigia no passo dado. */
    public static Ponto onde(DetetiveSala sala, Vigia v, int passo) {
        return v.ronda().get(Math.floorMod(passo, v.ronda().size()));
    }

    /** Para onde o vigia olha no passo dado, em graus (0 = +z, 90 = +x). */
    public static double olhar(DetetiveSala sala, Vigia v, int passo) {
        if (v.ronda().size() < 2) {
            return v.olhar();
        }
        Ponto a = onde(sala, v, passo);
        Ponto b = onde(sala, v, passo + 1);
        return Math.toDegrees(Math.atan2(b.x() - a.x(), b.z() - a.z()));
    }

    /** O ponto está no cone de visão do vigia (ou é o próprio ponto dele)? */
    public static boolean noCone(DetetiveSala sala, Vigia v, int passo, Ponto p) {
        return noCone(sala, v, passo, p, ALCANCE);
    }

    /** Com o alcance do cone que o look da detetive deixa (DetetiveDoLook). */
    public static boolean noCone(DetetiveSala sala, Vigia v, int passo, Ponto p, double alcance) {
        Ponto g = onde(sala, v, passo);
        double dx = p.x() - g.x();
        double dz = p.z() - g.z();
        double dist = Math.hypot(dx, dz);
        if (dist < 0.01) {
            return true;
        }
        if (dist > alcance) {
            return false;
        }
        double angulo = Math.toDegrees(Math.atan2(dx, dz));
        double diferenca = Math.abs(((angulo - olhar(sala, v, passo)) % 360 + 540) % 360 - 180);
        return diferenca <= MEIA_ABERTURA;
    }

    /** O vigia vê a pessoa neste passo? (vigia de porta não vigia; quem está escondido não é visto) */
    public static boolean ve(DetetiveSala sala, Vigia v, int passo, Ponto p, boolean escondido) {
        return ve(sala, v, passo, p, escondido, ALCANCE);
    }

    public static boolean ve(DetetiveSala sala, Vigia v, int passo, Ponto p, boolean escondido, double alcance) {
        return v.barra() == null && !escondido && noCone(sala, v, passo, p, alcance);
    }

    /** O ponto é vizinho do vigia (perto o bastante para o bolso ou o confronto)? */
    public static boolean aoLado(DetetiveSala sala, Vigia v, int passo, Ponto p) {
        return DetetiveSala.distancia(onde(sala, v, passo), p) <= DetetiveSala.PASSO;
    }
}
