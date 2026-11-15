package br.com.fashionai.application.flair3d.detetive;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Uma sala do mundo do FASHION_DETECTIVE (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md): os pontos por onde a
 * pessoa anda (em metros, a sala vai de x −4 a 4 e de z −3 a 3), quais deles são esconderijo, os armários (com chave
 * e/ou pista), as saídas para as salas vizinhas, os vigias com a ronda deles e o enigma da sala. Imutável; montada por
 * {@link Construtor}. Quem anda vai de um ponto a outro a até {@link #PASSO} metros.
 */
public record DetetiveSala(String id, List<Ponto> pontos, List<Armario> armarios, List<Saida> saidas, List<Vigia> vigias,
                           Enigma enigma, String pistaDaResolucao) {
    /** Distância máxima entre dois pontos vizinhos. */
    public static final double PASSO = 3.6;

    public record Ponto(String id, double x, double z, boolean esconderijo) {
    }

    /** Armário, gaveta ou mesa: abre com carta verde; guarda uma chave, uma pista, ou as duas. */
    public record Armario(String id, String ponto, String chave, String pista) {
    }

    /** Saída para outra sala, no ponto dado. */
    public record Saida(String ponto, String para) {
    }

    /**
     * Vigia (sem arma): anda pela ronda (posições em metros, ida e volta já escritas), uma posição por passo, olhando
     * para a próxima; com uma posição só, fica parado olhando para {@code olhar} (graus, 0 = +z). {@code bolso}: a pista
     * que ele leva; {@code barra}: a sala cuja porta ele guarda até perder o confronto.
     */
    public record Vigia(String id, String papel, List<Ponto> ronda, double olhar, String bolso, String barra) {
    }

    /** Enigma de escolha: as opções (chaves de texto) e a dica depois do primeiro erro. A certa fica só no servidor. */
    public record Enigma(String id, List<String> opcoes, int certa) {
    }

    public Ponto ponto(String p) {
        return pontos.stream().filter(x -> x.id().equals(p)).findFirst().orElse(null);
    }

    public Ponto entrada() {
        return pontos.get(0);
    }

    public Optional<Saida> saidaPara(String sala) {
        return saidas.stream().filter(s -> s.para().equals(sala)).findFirst();
    }

    public Optional<Armario> armario(String a) {
        return armarios.stream().filter(x -> x.id().equals(a)).findFirst();
    }

    public Optional<Vigia> vigia(String v) {
        return vigias.stream().filter(x -> x.id().equals(v)).findFirst();
    }

    public static double distancia(Ponto a, Ponto b) {
        return Math.hypot(a.x() - b.x(), a.z() - b.z());
    }

    /** Monta uma sala ponto a ponto. */
    public static final class Construtor {
        private final String id;
        private final List<Ponto> pontos = new ArrayList<>();
        private final List<Armario> armarios = new ArrayList<>();
        private final List<Saida> saidas = new ArrayList<>();
        private final List<Vigia> vigias = new ArrayList<>();
        private Enigma enigma;
        private String pistaDaResolucao;

        public Construtor(String id) {
            this.id = id;
        }

        public Construtor ponto(String p, double x, double z) {
            pontos.add(new Ponto(p, x, z, false));
            return this;
        }

        public Construtor esconderijo(String p, double x, double z) {
            pontos.add(new Ponto(p, x, z, true));
            return this;
        }

        public Construtor armario(String a, String ponto, String chave, String pista) {
            armarios.add(new Armario(a, ponto, chave, pista));
            return this;
        }

        public Construtor saida(String ponto, String para) {
            saidas.add(new Saida(ponto, para));
            return this;
        }

        /** {@code xz}: as posições da ronda, x e z alternados. */
        public Construtor vigia(String v, String papel, double olhar, String bolso, String barra, double... xz) {
            List<Ponto> ronda = new ArrayList<>();
            for (int i = 0; i + 1 < xz.length; i += 2) {
                ronda.add(new Ponto(v + "@" + i / 2, xz[i], xz[i + 1], false));
            }
            vigias.add(new Vigia(v, papel, List.copyOf(ronda), olhar, bolso, barra));
            return this;
        }

        public Construtor enigma(String e, int certa, String... opcoes) {
            enigma = new Enigma(e, List.of(opcoes), certa);
            return this;
        }

        public Construtor resolucaoDa(String pista) {
            pistaDaResolucao = pista;
            return this;
        }

        public DetetiveSala montar() {
            return new DetetiveSala(id, List.copyOf(pontos), List.copyOf(armarios), List.copyOf(saidas), List.copyOf(vigias), enigma, pistaDaResolucao);
        }
    }
}
