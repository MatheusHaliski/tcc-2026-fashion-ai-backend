package br.com.fashionai.application.flair3d.cbc;

import br.com.fashionai.application.flair.CbcLinks;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * FLAIR Card Building Challenge — um dos cinco elencos (Strategy, docs/refactoring/gof/R90-flair3d-nucleos.md): a
 * formação (vagas com posição e coordenada), as linhas entre vagas e os requisitos (BASE_NUCLEOS.md, "FLAIR Card Building
 * Challenge"). Links e química vêm de {@link CbcLinks}; a avaliação mora em {@link FlairCbcAvaliacao}.
 */
public interface FlairCbcElenco {
    String codigo();

    List<Vaga> vagas();

    List<CbcLinks.Edge> linhas();

    /** Os requisitos da tabela do contrato. */
    List<Requisito> requisitos();

    /** Os requisitos com "todas as vagas preenchidas" (CARTAS = número de vagas) quando o elenco não pede outro número. */
    default List<Requisito> requisitosCompletos() {
        List<Requisito> out = new ArrayList<>(requisitos());
        if (out.stream().noneMatch(r -> Requisito.CARTAS.equals(r.tipo()))) {
            out.add(Requisito.de(Requisito.CARTAS, vagas().size()));
        }
        return List.copyOf(out);
    }

    /** Vaga da formação: chave, posição da carta e coordenada (coluna, linha; linha 0 é a de cima). */
    record Vaga(String chave, String posicao, int coluna, int linha) {
    }

    static CbcLinks.Edge linha(String a, String b) {
        return new CbcLinks.Edge(a, b);
    }

    /**
     * Requisito: QUIMICA (alvo 0–100), LINHAS_VERDES, LINHAS_POR (atributo: MARCA, COR, OCASIAO...), SEM_LINHA_VERMELHA
     * (vaga opcional; alvo 0), CARTAS, MARCAS (distintas) e NIVEL_CARTA (nível mínimo da carta, alvo = quantas).
     */
    record Requisito(String tipo, int alvo, String atributo, String vaga, String nivel) {
        public static final String QUIMICA = "QUIMICA";
        public static final String LINHAS_VERDES = "LINHAS_VERDES";
        public static final String LINHAS_POR = "LINHAS_POR";
        public static final String SEM_LINHA_VERMELHA = "SEM_LINHA_VERMELHA";
        public static final String CARTAS = "CARTAS";
        public static final String MARCAS = "MARCAS";
        public static final String NIVEL_CARTA = "NIVEL_CARTA";

        public static Requisito de(String tipo, int alvo) {
            return new Requisito(tipo, alvo, null, null, null);
        }

        public static Requisito linhasPor(String atributo, int alvo) {
            return new Requisito(LINHAS_POR, alvo, atributo, null, null);
        }

        public static Requisito semLinhaVermelha(String vaga) {
            return new Requisito(SEM_LINHA_VERMELHA, 0, null, vaga, null);
        }

        public static Requisito nivelCarta(String nivel, int alvo) {
            return new Requisito(NIVEL_CARTA, alvo, null, null, nivel);
        }

        /** {tipo, alvo} e só os campos usados (atributo, vaga, nivel). */
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("tipo", tipo);
            m.put("alvo", alvo);
            if (atributo != null) {
                m.put("atributo", atributo);
            }
            if (vaga != null) {
                m.put("vaga", vaga);
            }
            if (nivel != null) {
                m.put("nivel", nivel);
            }
            return m;
        }
    }
}
