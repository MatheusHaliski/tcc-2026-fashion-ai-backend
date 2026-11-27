package br.com.fashionai.application.flair3d.esporte;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Onde cada jogador vai em um lance do FASHION_SPORTS e o que ele está fazendo (pedido da dona de 15/11/2026: todos os
 * jogadores que a pessoa não comanda têm movimento automático e claro). O servidor decide, a tela só desenha: cada
 * lance das modalidades de invasão (futebol e basquete) leva a lista dos jogadores com o estado e o destino no campo de
 * 100 × 60 (o gol da pessoa em x = 0).
 *
 * <p>Quem tem a bola: BOLA (quem age) e RECEBE (o alvo do passe); os companheiros dão APOIO (linha de passe ao lado),
 * fazem a CORRIDA (ataque ao espaço à frente) ou ficam na COBERTURA (atrás da bola). Quem defende: PRESSAO (o mais
 * perto vai em quem tem a bola, do lado do próprio gol), MARCA (acompanha um atacante livre), COBERTURA (fecha o meio
 * entre a bola e o gol) e RETORNO (quem ficou para trás da bola volta). O goleiro fica no GOLEIRO, na linha da bola. Nos
 * reinícios (saída de bola) todos voltam à POSICAO da formação. Ninguém termina em cima de ninguém.</p>
 */
final class EsporteCampo {
    /** Distância mínima entre dois jogadores, nas unidades do campo. */
    static final double FOLGA = 3.2;
    private static final Map<String, double[][]> FORMACAO = Map.of(
            "FUTEBOL", new double[][]{{5, 30}, {26, 16}, {26, 44}, {46, 22}, {46, 38}},
            "BASQUETE", new double[][]{{24, 30}, {40, 14}, {40, 46}});
    private static final Set<String> DEFENSIVOS = Set.of("DESARME", "DESARME_FALHO", "RECOMPOE", "RECOMPOE_FALHO", "PRESSAO", "PRESSAO_FALHA", "GOLEIRO_PRONTO");
    private static final Set<String> REINICIOS = Set.of("SAIDA", "TIRO_DE_META", "ESCANTEIO", "LATERAL");

    private static final class Jogador {
        final boolean nosso;
        final int n;
        final boolean goleiro;
        String estado;
        double x;
        double y;
        boolean fixo;

        Jogador(boolean nosso, int n, boolean goleiro, double x, double y) {
            this.nosso = nosso;
            this.n = n;
            this.goleiro = goleiro;
            this.x = x;
            this.y = y;
        }

        void vai(String novo, double nx, double ny) {
            estado = novo;
            x = nx;
            y = ny;
        }

        double ate(double[] p) {
            return Math.hypot(x - p[0], y - p[1]);
        }
    }

    private final EsporteRegras regras;
    private final boolean atacaNos;
    /** Para onde ataca quem tem a bola: +1 para o gol do adversário da pessoa, −1 para o gol da pessoa. */
    private final int dir;

    EsporteCampo(EsporteRegras regras, boolean atacaNos) {
        this.regras = regras;
        this.atacaNos = atacaNos;
        dir = atacaNos ? 1 : -1;
    }

    /** O ponto como vai no evento: inteiro quando é inteiro, com uma casa quando não é. */
    static List<Number> ponto(double[] p) {
        return List.of(numero(p[0]), numero(p[1]));
    }

    private static Number numero(double v) {
        double a = Math.round(v * 10) / 10.0;
        return a == Math.rint(a) ? (Number) (int) a : (Number) a;
    }

    private static double entre(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    /** O estado e o destino de todos os jogadores no fim do lance. */
    List<Map<String, Object>> jogadores(String tipo, boolean doNosso, boolean ok, int[] quem, double[] de, double[] para) {
        boolean chute = tipo.contains("_GOL") || tipo.contains("_DEFENDIDO") || tipo.contains("_ESPALMADO") || tipo.contains("_FORA") || tipo.contains("_NA_TRAVE");
        boolean passe = "PASSE".equals(tipo) || REINICIOS.contains(tipo);
        boolean parado = "SAIDA".equals(tipo);
        boolean perdeu = !ok && !chute && !DEFENSIVOS.contains(tipo);
        double[] bola = chute ? de : perdeu ? new double[]{de[0] + (para[0] - de[0]) * 0.45, de[1] + (para[1] - de[1]) * 0.45} : para;
        List<Jogador> todos = formacao(parado ? new double[]{50, 30} : bola);
        List<Jogador> ataque = todos.stream().filter(j -> j.nosso == atacaNos).toList();
        List<Jogador> defesa = todos.stream().filter(j -> j.nosso != atacaNos).toList();
        boolean atorAtaca = doNosso == atacaNos;
        Jogador dono = atorAtaca ? ataque.get(quem[0] - 1) : ataque.stream().filter(j -> !j.goleiro).min(Comparator.comparingDouble(j -> j.ate(bola))).orElse(ataque.get(0));
        dono.vai("BOLA", passe || chute ? de[0] : bola[0], passe || chute ? de[1] : bola[1]);
        dono.fixo = true;
        if (atorAtaca && passe && ok && quem[1] != quem[0]) {
            Jogador alvo = ataque.get(quem[1] - 1);
            alvo.vai("RECEBE", para[0], para[1]);
            alvo.fixo = true;
        }
        if (!parado) {
            atacar(ataque, bola);
            defender(defesa, ataque, atorAtaca ? 0 : quem[0], tipo, bola);
        }
        for (Jogador j : todos) {
            if (j.goleiro && j.estado == null) {
                boolean defende = j.nosso != atacaNos;
                j.vai("GOLEIRO", j.x, entre(defende && chute ? para[1] : 30 + (bola[1] - 30) * 0.3, 25, 35));
                j.fixo = true;
            } else if (j.estado == null) {
                j.estado = "POSICAO";
            }
        }
        separar(todos);
        return todos.stream().map(EsporteCampo::mapa).toList();
    }

    /** A formação dos dois times com a bola no ponto dado: sobe e desce com ela; o goleiro quase não sai. */
    private List<Jogador> formacao(double[] bola) {
        double[][] base = FORMACAO.get(regras.codigo());
        List<Jogador> todos = new ArrayList<>();
        for (boolean nosso : new boolean[]{true, false}) {
            for (int n = 1; n <= regras.jogadores(); n++) {
                double[] p = base[Math.min(base.length - 1, n - 1)];
                boolean goleiro = regras.comTrave() && n == 1;
                double x = (nosso ? p[0] : 100 - p[0]) + (bola[0] - 50) * (goleiro ? 0.06 : 0.5);
                todos.add(new Jogador(nosso, n, goleiro, entre(x, 3, 97), nosso ? p[1] : 60 - p[1]));
            }
        }
        return todos;
    }

    /** Os companheiros de quem tem a bola: o mais adiantado ataca o espaço, um dá a linha de passe, um fica atrás. */
    private void atacar(List<Jogador> ataque, double[] bola) {
        List<Jogador> livres = ataque.stream().filter(j -> j.estado == null && !j.goleiro)
                .sorted(Comparator.comparingDouble((Jogador j) -> -j.x * dir)).toList();
        String[] papeis = livres.size() == 1 ? new String[]{"APOIO"} : livres.size() == 2 ? new String[]{"CORRIDA", "COBERTURA"} : new String[]{"CORRIDA", "APOIO", "COBERTURA"};
        for (int i = 0; i < livres.size(); i++) {
            Jogador j = livres.get(i);
            int lado = j.y >= bola[1] ? 1 : -1;
            switch (papeis[Math.min(i, papeis.length - 1)]) {
                case "CORRIDA" -> j.vai("CORRIDA", entre(bola[0] + dir * 16, 8, 92), Math.abs(j.y - bola[1]) < 10 ? entre(bola[1] + lado * 12, 6, 54) : j.y);
                case "APOIO" -> {
                    double y = bola[1] + lado * 13;
                    j.vai("APOIO", entre(bola[0] + dir * 3, 6, 94), y < 6 || y > 54 ? bola[1] - lado * 13 : y);
                }
                default -> j.vai("COBERTURA", entre(bola[0] - dir * 13, 8, 92), 30 + (j.y - 30) * 0.6);
            }
        }
    }

    /**
     * Quem defende: quem age vai na bola (ou volta, se a carta é de recompor); sem ele, o mais perto pressiona. Quem ficou
     * para trás da bola retorna; os outros marcam um atacante livre ou cobrem o meio.
     */
    private void defender(List<Jogador> defesa, List<Jogador> ataque, int ator, String tipo, double[] bola) {
        boolean pressionado = false;
        if (ator > 0 && !defesa.get(ator - 1).goleiro) {
            Jogador j = defesa.get(ator - 1);
            boolean volta = tipo.startsWith("RECOMPOE");
            j.vai(volta ? "RETORNO" : "PRESSAO", entre(bola[0] + dir * FOLGA * (volta ? 2 : 1), 4, 96), entre(bola[1] + 1, 4, 56));
            j.fixo = true;
            pressionado = !volta;
        }
        List<Jogador> livres = new ArrayList<>(defesa.stream().filter(j -> j.estado == null && !j.goleiro).toList());
        if (!pressionado && !livres.isEmpty()) {
            Jogador perto = livres.stream().min(Comparator.comparingDouble(j -> j.ate(bola))).orElseThrow();
            perto.vai("PRESSAO", entre(bola[0] + dir * FOLGA, 4, 96), entre(bola[1] + 1, 4, 56));
            livres.remove(perto);
        }
        List<Jogador> soltos = new ArrayList<>(ataque.stream().filter(a -> a.estado != null && Set.of("RECEBE", "CORRIDA", "APOIO").contains(a.estado)).toList());
        for (Jogador j : livres) {
            if ((j.x - bola[0]) * dir < -2) {
                j.vai("RETORNO", entre(bola[0] + dir * 8, 6, 94), 30 + (j.y - 30) * 0.7);
            } else if (!soltos.isEmpty()) {
                Jogador a = soltos.stream().min(Comparator.comparingDouble(s -> Math.hypot(s.x - j.x, s.y - j.y))).orElseThrow();
                soltos.remove(a);
                j.vai("MARCA", entre(a.x + dir * FOLGA, 6, 94), a.y + (a.y < 30 ? 1 : -1));
            } else {
                j.vai("COBERTURA", entre(bola[0] + dir * 12, 10, 90), 30 + (bola[1] - 30) * 0.5);
            }
        }
    }

    /** Afasta quem ficou em cima de alguém; quem tem a bola, quem recebe, quem age e o goleiro não saem do lugar. */
    private static void separar(List<Jogador> todos) {
        for (int passada = 0; passada < 3; passada++) {
            for (int i = 0; i < todos.size(); i++) {
                for (int k = i + 1; k < todos.size(); k++) {
                    Jogador a = todos.get(i);
                    Jogador b = todos.get(k);
                    double d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d >= FOLGA + 0.1 || (a.fixo && b.fixo)) {
                        continue;
                    }
                    double falta = FOLGA + 0.1 - d;
                    double ux = d > 0.001 ? (b.x - a.x) / d : 0;
                    double uy = d > 0.001 ? (b.y - a.y) / d : 1;
                    double parteA = a.fixo ? 0 : b.fixo ? 1 : 0.5;
                    a.x -= ux * falta * parteA;
                    a.y -= uy * falta * parteA;
                    b.x += ux * falta * (1 - parteA);
                    b.y += uy * falta * (1 - parteA);
                }
            }
        }
        for (Jogador j : todos) {
            j.x = entre(j.x, 1, 99);
            j.y = entre(j.y, 1, 59);
        }
    }

    private static Map<String, Object> mapa(Jogador j) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("time", j.nosso ? "NOS" : "ELES");
        m.put("n", j.n);
        m.put("estado", j.estado);
        m.put("x", numero(j.x));
        m.put("y", numero(j.y));
        return m;
    }
}
