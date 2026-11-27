package br.com.fashionai.application.flair3d.cbc;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * FLAIR Card Building Challenge — um elenco em quebra-cabeça (Strategy, docs/refactoring/gof/R90-flair3d-nucleos.md): a
 * imagem do elenco é cortada em peças, uma por vaga. A carta da pessoa que cumpre o que a vaga pede ({@code pede}: cor,
 * estilo ou ocasião; vazio = qualquer carta) encaixa a peça; o deck inteiro com os requisitos completa o quebra-cabeça
 * (docs/flair/cbc/CINCO_ELENCOS.md). A avaliação mora em {@link FlairCbcAvaliacao}.
 */
public interface FlairCbcElenco {
    String codigo();

    /** As vagas na ordem das peças da imagem (leitura: da esquerda para a direita, de cima para baixo). */
    List<Vaga> vagas();

    /** Os requisitos do deck. */
    List<Requisito> requisitos();

    /** Os requisitos com "todas as vagas preenchidas" (CARTAS = número de vagas) quando o elenco não pede outro número. */
    default List<Requisito> requisitosCompletos() {
        List<Requisito> out = new ArrayList<>(requisitos());
        if (out.stream().noneMatch(r -> Requisito.CARTAS.equals(r.tipo()))) {
            out.add(Requisito.de(Requisito.CARTAS, vagas().size()));
        }
        return List.copyOf(out);
    }

    /**
     * Vaga = peça da imagem: chave, posição da carta ("ANY" = qualquer) e o que a carta precisa ter para encaixar a peça,
     * nas chaves do motor ({@code color}, {@code style}, {@code occasion}: lista de valores aceitos).
     */
    record Vaga(String chave, String posicao, Map<String, Object> pede) {
        public Vaga {
            pede = pede == null ? Map.of() : Map.copyOf(pede);
        }
    }

    /**
     * Requisito do deck: COR, ESTILO e OCASIAO (pelo menos {@code alvo} cartas com o {@code valor}), CARTAS, MARCAS
     * (distintas) e NIVEL_CARTA (nível mínimo da carta, alvo = quantas).
     */
    record Requisito(String tipo, int alvo, String valor, String nivel) {
        public static final String COR = "COR";
        public static final String ESTILO = "ESTILO";
        public static final String OCASIAO = "OCASIAO";
        public static final String CARTAS = "CARTAS";
        public static final String MARCAS = "MARCAS";
        public static final String NIVEL_CARTA = "NIVEL_CARTA";

        public static Requisito de(String tipo, int alvo) {
            return new Requisito(tipo, alvo, null, null);
        }

        public static Requisito cor(String cor, int alvo) {
            return new Requisito(COR, alvo, cor, null);
        }

        public static Requisito estilo(String estilo, int alvo) {
            return new Requisito(ESTILO, alvo, estilo, null);
        }

        public static Requisito ocasiao(String ocasiao, int alvo) {
            return new Requisito(OCASIAO, alvo, ocasiao, null);
        }

        public static Requisito nivelCarta(String nivel, int alvo) {
            return new Requisito(NIVEL_CARTA, alvo, null, nivel);
        }

        /** {tipo, alvo} e só os campos usados (valor, nivel). */
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("tipo", tipo);
            m.put("alvo", alvo);
            if (valor != null) {
                m.put("valor", valor);
            }
            if (nivel != null) {
                m.put("nivel", nivel);
            }
            return m;
        }
    }
}
