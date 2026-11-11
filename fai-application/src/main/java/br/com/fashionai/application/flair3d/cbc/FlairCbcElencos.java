package br.com.fashionai.application.flair3d.cbc;

import br.com.fashionai.application.flair3d.cbc.elencos.CasaMarcaElenco;
import br.com.fashionai.application.flair3d.cbc.elencos.LendarioElenco;
import br.com.fashionai.application.flair3d.cbc.elencos.NoiteEstreiaElenco;
import br.com.fashionai.application.flair3d.cbc.elencos.PaletaAtelieElenco;
import br.com.fashionai.application.flair3d.cbc.elencos.PrimeiroElenco;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** Os cinco elencos oficiais, em dificuldade crescente. */
public final class FlairCbcElencos {
    public static final List<FlairCbcElenco> TODOS = List.of(new PrimeiroElenco(), new PaletaAtelieElenco(), new CasaMarcaElenco(),
            new NoiteEstreiaElenco(), new LendarioElenco());

    private FlairCbcElencos() {
    }

    public static Optional<FlairCbcElenco> porCodigo(String codigo) {
        String c = codigo == null ? "" : codigo.trim().toUpperCase(Locale.ROOT);
        return TODOS.stream().filter(e -> e.codigo().equals(c)).findFirst();
    }
}
