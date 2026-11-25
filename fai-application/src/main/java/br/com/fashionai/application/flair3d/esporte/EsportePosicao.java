package br.com.fashionai.application.flair3d.esporte;

/**
 * A posição da capitã na jogada (reauditoria de 25/11/2026: a capitã controlável não mudava o lance). Com a mão de
 * cartas aberta, a pessoa leva a capitã pelo campo; o acionamento traz o deslocamento dela ("POSICAO:dx,dy", em
 * unidades do campo do servidor, x para o gol adversário). O servidor lê a intenção tática: com a bola, infiltrar
 * (avançar {@value #MINIMO} ou mais) soma {@value #BOM} ao duelo; sem a bola, recompor (recuar) soma o mesmo; ir no
 * sentido contrário tira {@value #RUIM}. Deslocamento além do raio da capitã ({@value #RAIO}) não vale. Puro.
 */
final class EsportePosicao {
    static final int MINIMO = 4;
    static final int RAIO = 13;
    static final int BOM = 4;
    static final int RUIM = 2;
    static final String PREFIXO = "POSICAO:";

    private EsportePosicao() {
    }

    /** O ajuste do duelo pela posição (0 sem posição, com posição inválida ou parada). */
    static int ajuste(String alvo, boolean comABola) {
        String posicao = EsporteTempo.parte(alvo, PREFIXO);
        if (posicao == null) {
            return 0;
        }
        String[] xy = posicao.substring(PREFIXO.length()).split(",");
        double dx;
        double dy;
        try {
            dx = Double.parseDouble(xy[0]);
            dy = xy.length > 1 ? Double.parseDouble(xy[1]) : 0;
        } catch (NumberFormatException ex) {
            return 0;
        }
        if (!Double.isFinite(dx) || !Double.isFinite(dy) || Math.hypot(dx, dy) > RAIO) {
            return 0;
        }
        double rumo = comABola ? dx : -dx;
        return rumo >= MINIMO ? BOM : rumo <= -MINIMO ? -RUIM : 0;
    }
}
