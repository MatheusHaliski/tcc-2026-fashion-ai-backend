package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonSegmentationPort;

import java.util.ServiceConfigurationError;
import java.util.ServiceLoader;

/** Argumentos e ambiente do {@link CatalogImageBatchCli}: {@code --threads}, tetos de decodificação e segmentador de pessoa. */
final class CatalogBatchArgs {
    private CatalogBatchArgs() {
    }

    /** {@code --threads N} ou {@code --threads=N}; padrão max(1, núcleos − 1); 0 = pediu ajuda. */
    static int threads(String[] args) {
        int threads = Math.max(1, Runtime.getRuntime().availableProcessors() - 1);
        for (int i = 0; i < args.length; i++) {
            String a = args[i], value;
            if (a.equals("-h") || a.equals("--help")) {
                return 0;
            } else if (a.equals("--threads")) {
                if (i + 1 >= args.length) {
                    throw new IllegalArgumentException("--threads exige um número");
                }
                value = args[++i];
            } else if (a.startsWith("--threads=")) {
                value = a.substring("--threads=".length());
            } else {
                throw new IllegalArgumentException("argumento desconhecido: " + a);
            }
            try {
                threads = Integer.parseInt(value.trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("--threads inválido: " + value);
            }
            if (threads < 1 || threads > 256) {
                throw new IllegalArgumentException("--threads deve ficar entre 1 e 256: " + value);
            }
        }
        return threads;
    }

    /** Mesmo teto de decodificação da API (IMAGE_MAX_PIXELS / IMAGE_MAX_SIDE do application.yml). */
    static long env(String name, long fallback) {
        String v = System.getenv(name);
        try {
            return v == null || v.isBlank() ? fallback : Long.parseLong(v.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    /** Segmentador de pessoa registrado por outro módulo (ServiceLoader); null quando não há nenhum no classpath. */
    static PersonSegmentationPort personSegmenter() {
        try {
            return ServiceLoader.load(PersonSegmentationPort.class).findFirst().filter(PersonSegmentationPort::available).orElse(null);
        } catch (RuntimeException | LinkageError | ServiceConfigurationError e) {
            System.err.println("catalog-batch: segmentador de pessoa indisponível: " + e);
            return null;
        }
    }
}
