package br.com.fashionai.application.flair3d.makeup;

import br.com.fashionai.application.flair3d.makeup.briefs.EnsaioVeraoBrief;
import br.com.fashionai.application.flair3d.makeup.briefs.EntrevistaBrief;
import br.com.fashionai.application.flair3d.makeup.briefs.PrimeiroEncontroBrief;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** Os três briefs da base do MAKE UP, por nível. */
public final class FlairMakeUpBriefs {
    public static final List<FlairMakeUpBrief> TODOS = List.of(new EnsaioVeraoBrief(), new EntrevistaBrief(), new PrimeiroEncontroBrief());

    private FlairMakeUpBriefs() {
    }

    public static Optional<FlairMakeUpBrief> porCodigo(String codigo) {
        String c = codigo == null ? "" : codigo.trim().toUpperCase(Locale.ROOT);
        return TODOS.stream().filter(b -> b.codigo().equals(c)).findFirst();
    }
}
