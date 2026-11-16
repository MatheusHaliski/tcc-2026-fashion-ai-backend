package br.com.fashionai.application.flair3d.nucleos;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * O mundo do FASHION_DETECTIVE refeito em 15/11/2026 (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md, seção 3): nove
 * salas interligadas, as portas entre elas, as cinco chaves guardadas em armários e quem abre cada porta trancada para a
 * pessoa que ficou sem carta verde (depois de uma espera no relógio da partida). Imutável; o servidor é quem diz que
 * sala está aberta.
 */
public final class FashionDetectiveMundo {
    public static final String INICIO = "ENTRADA";
    public static final String FINAL = "PASSARELA";
    /** Segundos de espera quando a porta é aberta por alguém da casa, sem carta verde. */
    public static final int ESPERA_SEM_CARTA = 60;

    public static final List<String> SALAS = List.of(
            "ENTRADA", "CLUBE", "SALAO", "CAMARIM", "ATELIE", "ARQUIVO", "SEGURANCA", "ESCRITORIO", "PASSARELA");

    /** Uma porta: liga duas salas; `chave` nula = sempre aberta; `ajuda` = quem abre sem carta. */
    public record Porta(String de, String para, String chave, String ajuda) {
        boolean liga(String sala) {
            return de.equals(sala) || para.equals(sala);
        }

        String outra(String sala) {
            return de.equals(sala) ? para : de;
        }
    }

    /** Uma chave: em que sala e em que armário ela está guardada. */
    public record Chave(String codigo, String sala, String armario) {
    }

    public static final List<Porta> PORTAS = List.of(
            new Porta("ENTRADA", "SALAO", null, null),
            new Porta("ENTRADA", "CLUBE", null, null),
            new Porta("SALAO", "CAMARIM", null, null),
            new Porta("SALAO", "SEGURANCA", "K1", "OTTO"),
            new Porta("CAMARIM", "ATELIE", "K2", "CLEO"),
            new Porta("CLUBE", "ATELIE", null, null),
            new Porta("ATELIE", "ARQUIVO", "K3", "CLEO"),
            new Porta("SALAO", "ESCRITORIO", "K4", "OTTO"),
            new Porta("ATELIE", "PASSARELA", "K5", "CLEO"));

    public static final List<Chave> CHAVES = List.of(
            new Chave("K1", "ENTRADA", "ARMARIO_DE_CASACOS"),
            new Chave("K2", "CAMARIM", "GAVETA_DA_PENTEADEIRA"),
            new Chave("K3", "SEGURANCA", "PAINEL_DE_CHAVES"),
            new Chave("K4", "CLUBE", "ARMARIO_DE_FERRAMENTAS"),
            new Chave("K5", "ESCRITORIO", "GAVETA_DA_MESA"));

    private FashionDetectiveMundo() {
    }

    /** A chave guardada no armário dado, se houver. */
    public static Optional<Chave> chaveNoArmario(String sala, String armario) {
        return CHAVES.stream().filter(c -> c.sala().equals(sala) && c.armario().equals(armario)).findFirst();
    }

    /** A porta entre duas salas vizinhas, se houver. */
    public static Optional<Porta> porta(String a, String b) {
        return PORTAS.stream().filter(p -> p.liga(a) && p.outra(a).equals(b)).findFirst();
    }

    /** A porta pode ser atravessada com as chaves dadas (ou com a ajuda de alguém da casa)? */
    public static boolean passa(Porta p, Set<String> chaves, boolean comAjuda) {
        return p.chave() == null || chaves.contains(p.chave()) || (comAjuda && p.ajuda() != null);
    }

    /**
     * As salas a que se chega a partir da entrada. Sem ajuda, cada chave pega abre as portas dela e pode revelar outras
     * chaves (`pegaChaves`); com ajuda, toda porta trancada se abre depois da espera.
     */
    public static Set<String> alcancaveis(Set<String> chaves, boolean comAjuda, boolean pegaChaves) {
        Set<String> tenho = new LinkedHashSet<>(chaves);
        Set<String> vistas = new LinkedHashSet<>();
        boolean mudou = true;
        while (mudou) {
            mudou = false;
            Deque<String> fila = new ArrayDeque<>(List.of(INICIO));
            vistas.clear();
            vistas.add(INICIO);
            while (!fila.isEmpty()) {
                String sala = fila.poll();
                for (Porta p : PORTAS) {
                    if (p.liga(sala) && passa(p, tenho, comAjuda) && vistas.add(p.outra(sala))) {
                        fila.add(p.outra(sala));
                    }
                }
            }
            if (pegaChaves) {
                for (Chave c : CHAVES) {
                    if (vistas.contains(c.sala()) && tenho.add(c.codigo())) {
                        mudou = true;
                    }
                }
            }
        }
        return vistas;
    }
}
