package br.com.fashionai.application.flair3d.cbc;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** O catálogo de elencos oficiais, em dificuldade crescente (os cinco elencos de linhas e química foram retirados). */
public final class FlairCbcElencos {
    public static final List<FlairCbcElenco> TODOS = List.of();

    private FlairCbcElencos() {
    }

    public static Optional<FlairCbcElenco> porCodigo(String codigo) {
        String c = codigo == null ? "" : codigo.trim().toUpperCase(Locale.ROOT);
        return TODOS.stream().filter(e -> e.codigo().equals(c)).findFirst();
    }
}
