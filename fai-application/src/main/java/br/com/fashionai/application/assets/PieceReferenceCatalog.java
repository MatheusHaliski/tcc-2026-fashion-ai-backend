package br.com.fashionai.application.assets;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.SubtypeReferences;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * RF4 — referências visuais dos subtipos ({@code /public/assets_pecas}), carregadas uma vez na primeira análise e
 * guardadas em memória (silhuetas + folhas de contato). Sem a pasta pública (ambiente sem assets), fica vazio e a
 * detecção do subtipo segue só com a IA.
 */
@Component
public class PieceReferenceCatalog {
    private static final Logger log = LoggerFactory.getLogger(PieceReferenceCatalog.class);

    private final AssetCatalogService assets;
    private volatile SubtypeReferences references;

    public PieceReferenceCatalog(AssetCatalogService assets) {
        this.assets = assets;
    }

    public SubtypeReferences get() {
        SubtypeReferences r = references;
        if (r == null) {
            synchronized (this) {
                if (references == null) {
                    references = load();
                }
                r = references;
            }
        }
        return r;
    }

    private SubtypeReferences load() {
        long started = System.nanoTime();
        List<SubtypeReferences.Reference> out = new ArrayList<>();
        for (Map.Entry<String, String[]> e : assets.pieceReferenceImages().entrySet()) {
            Optional<Path> file = assets.publicFile(e.getValue()[1]);
            if (file.isEmpty()) {
                continue;
            }
            try {
                out.add(SubtypeReferences.reference(e.getKey(), e.getValue()[0], ImageOps.decode(Files.readAllBytes(file.get()))));
            } catch (Exception ex) {
                log.warn("Referência do subtipo {} ilegível: {}", e.getKey(), ex.getMessage());
            }
        }
        log.info("Referências de subtipo carregadas: {} em {} ms", out.size(), (System.nanoTime() - started) / 1_000_000);
        return new SubtypeReferences(out);
    }
}
