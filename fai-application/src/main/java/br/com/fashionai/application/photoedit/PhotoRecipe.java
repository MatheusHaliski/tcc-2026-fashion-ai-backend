package br.com.fashionai.application.photoedit;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * RF15 · Receita de edição não destrutiva (docs/novos-rf/RF15_Editor_Fotografia_Pecas.md §6.1): a foto original nunca
 * muda; o editor guarda a lista de operações e o servidor a reaplica, na ordem, sobre a original em resolução cheia.
 * Coordenadas sempre normalizadas (0–1) na imagem do passo em que a operação entra.
 *
 * @param target CANONICAL (foto fiel da peça: guarda-roupa, provador, 3D, IA) ou PRESENTATION (versão criativa rotulada)
 */
public record PhotoRecipe(int version, Target target, List<Op> ops) {
    public static final int CURRENT_VERSION = 1;

    public enum Target { CANONICAL, PRESENTATION }

    public enum BackgroundKind { WHITE, NEUTRAL, TRANSPARENT }

    public sealed interface Op permits Rotate90, Straighten, Perspective, Crop, Background, WhiteBalance, Tone, Heal, Sharpen, Filter {
        String name();

        /** Operações que mexem na cor ou no detalhe da peça (as demais são geometria e fundo). */
        default boolean colorOp() {
            return false;
        }
    }

    /** Giro de 90° no sentido horário, {@code turns} vezes (1–3). */
    public record Rotate90(int turns) implements Op {
        public String name() {
            return "rotate90";
        }
    }

    /** Endireitar: gira em graus e corta para o maior retângulo interno (sem cantos vazios). */
    public record Straighten(double deg) implements Op {
        public String name() {
            return "straighten";
        }
    }

    /** Perspectiva de 4 pontos: os cantos da peça (sup. esq., sup. dir., inf. dir., inf. esq.) viram um retângulo. */
    public record Perspective(double[][] quad) implements Op {
        public String name() {
            return "perspective";
        }
    }

    /** Recorte normalizado; {@code aspect} "4:5" quando travado no quadro do FashionAI. */
    public record Crop(double x, double y, double w, double h, String aspect) implements Op {
        public String name() {
            return "crop";
        }
    }

    /**
     * Fundo: recorte da peça (automático) refinado por pinceladas e recolocado sobre branco, cinza neutro ou transparente.
     * {@code shadow} SOFT = sombra de contato suave sintética (rotulada).
     */
    public record Background(BackgroundKind kind, String shadow, List<Stroke> strokes) implements Op {
        public String name() {
            return "background";
        }
    }

    /** Pincelada de refinamento da máscara: ADD devolve pixels à peça, REMOVE os manda para o fundo. */
    public record Stroke(String mode, double r, List<double[]> pts) {
    }

    /** Balanço de branco pelo conta-gotas num ponto que deveria ser neutro (branco/cinza). */
    public record WhiteBalance(double x, double y) implements Op {
        public String name() {
            return "whiteBalance";
        }

        public boolean colorOp() {
            return true;
        }
    }

    /** Tom: exposição em EV, realces, sombras, contraste e saturação (−100…100). */
    public record Tone(double exposureEv, double highlights, double shadows, double contrast, double saturation) implements Op {
        public String name() {
            return "tone";
        }

        public boolean colorOp() {
            return true;
        }
    }

    /** Retoque pontual (fiapo, poeira): cada mancha é preenchida a partir do anel em volta, sem geração. */
    public record Heal(List<double[]> spots) implements Op {
        public String name() {
            return "heal";
        }

        /** Área total retocada como fração da imagem (spots: x, y, raio relativo à largura). */
        public double area(double heightOverWidth) {
            double a = 0;
            for (double[] s : spots) {
                a += Math.PI * s[2] * s[2] / heightOverWidth;
            }
            return a;
        }
    }

    /** Nitidez leve (máscara de nitidez 3×3), 0–1. */
    public record Sharpen(double amount) implements Op {
        public String name() {
            return "sharpen";
        }

        public boolean colorOp() {
            return true;
        }
    }

    /** Filtro criativo (só na versão de apresentação): WARM, COOL, MONO, VINTAGE. */
    public record Filter(String style, double strength) implements Op {
        public String name() {
            return "filter";
        }

        public boolean colorOp() {
            return true;
        }
    }

    /** Lê a receita do JSON do editor; operação desconhecida ou malformada vira IllegalArgumentException com o motivo. */
    @SuppressWarnings("unchecked")
    public static PhotoRecipe parse(Map<String, Object> json) {
        if (json == null) {
            throw new IllegalArgumentException("RECEITA_VAZIA");
        }
        Target target;
        try {
            target = Target.valueOf(String.valueOf(json.getOrDefault("target", "CANONICAL")).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("ALVO_INVALIDO");
        }
        Object raw = json.get("ops");
        List<Op> ops = new ArrayList<>();
        if (raw instanceof List<?> list) {
            if (list.size() > 60) {
                throw new IllegalArgumentException("RECEITA_LONGA_DEMAIS");
            }
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) {
                    throw new IllegalArgumentException("OPERACAO_INVALIDA");
                }
                ops.add(op((Map<String, Object>) m));
            }
        }
        int version = json.get("version") instanceof Number n ? n.intValue() : CURRENT_VERSION;
        return new PhotoRecipe(version, target, List.copyOf(ops));
    }

    @SuppressWarnings("unchecked")
    static Op op(Map<String, Object> m) {
        String name = String.valueOf(m.get("op"));
        return switch (name) {
            case "rotate90" -> new Rotate90((int) num(m, "turns", 1));
            case "straighten" -> new Straighten(num(m, "deg", 0));
            case "perspective" -> {
                List<double[]> q = points(m.get("quad"));
                if (q.size() != 4) {
                    throw new IllegalArgumentException("PERSPECTIVA_PRECISA_DE_4_PONTOS");
                }
                yield new Perspective(q.toArray(new double[0][]));
            }
            case "crop" -> {
                Map<String, Object> r = m.get("rect") instanceof Map<?, ?> rm ? (Map<String, Object>) rm : m;
                yield new Crop(num(r, "x", 0), num(r, "y", 0), num(r, "w", 1), num(r, "h", 1),
                        m.get("aspect") == null ? null : String.valueOf(m.get("aspect")));
            }
            case "background" -> {
                BackgroundKind kind;
                try {
                    kind = BackgroundKind.valueOf(String.valueOf(m.getOrDefault("kind", "WHITE")).toUpperCase(Locale.ROOT));
                } catch (IllegalArgumentException e) {
                    throw new IllegalArgumentException("FUNDO_INVALIDO");
                }
                List<Stroke> strokes = new ArrayList<>();
                if (m.get("strokes") instanceof List<?> sl) {
                    for (Object so : sl) {
                        if (so instanceof Map<?, ?> s) {
                            Map<String, Object> sm = (Map<String, Object>) s;
                            strokes.add(new Stroke(String.valueOf(sm.getOrDefault("mode", "add")).toUpperCase(Locale.ROOT),
                                    num(sm, "r", 0.01), points(sm.get("pts"))));
                        }
                    }
                }
                yield new Background(kind, String.valueOf(m.getOrDefault("shadow", "NONE")).toUpperCase(Locale.ROOT), List.copyOf(strokes));
            }
            case "whiteBalance" -> {
                List<double[]> p = points(List.of(m.getOrDefault("sample", List.of(0.5, 0.5))));
                yield new WhiteBalance(p.get(0)[0], p.get(0)[1]);
            }
            case "tone" -> new Tone(num(m, "exposureEv", 0), num(m, "highlights", 0), num(m, "shadows", 0), num(m, "contrast", 0),
                    num(m, "saturation", 0));
            case "heal" -> {
                List<double[]> spots = new ArrayList<>();
                if (m.get("spots") instanceof List<?> sl) {
                    for (Object so : sl) {
                        if (so instanceof Map<?, ?> s) {
                            Map<String, Object> sm = (Map<String, Object>) s;
                            spots.add(new double[]{num(sm, "x", 0), num(sm, "y", 0), num(sm, "r", 0.005)});
                        }
                    }
                }
                yield new Heal(List.copyOf(spots));
            }
            case "sharpen" -> new Sharpen(num(m, "amount", 0));
            case "filter" -> new Filter(String.valueOf(m.getOrDefault("style", "WARM")).toUpperCase(Locale.ROOT), num(m, "strength", 0.5));
            default -> throw new IllegalArgumentException("OPERACAO_DESCONHECIDA:" + name);
        };
    }

    static double num(Map<String, Object> m, String key, double fallback) {
        Object v = m.get(key);
        if (v == null) {
            return fallback;
        }
        if (v instanceof Number n && Double.isFinite(n.doubleValue())) {
            return n.doubleValue();
        }
        throw new IllegalArgumentException("NUMERO_INVALIDO:" + key);
    }

    static List<double[]> points(Object raw) {
        List<double[]> out = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object p : list) {
                if (p instanceof List<?> xy && xy.size() >= 2 && xy.get(0) instanceof Number a && xy.get(1) instanceof Number b) {
                    out.add(new double[]{a.doubleValue(), b.doubleValue()});
                } else {
                    throw new IllegalArgumentException("PONTO_INVALIDO");
                }
            }
        }
        if (out.size() > 2000) {
            throw new IllegalArgumentException("PONTOS_DEMAIS");
        }
        return out;
    }
}
