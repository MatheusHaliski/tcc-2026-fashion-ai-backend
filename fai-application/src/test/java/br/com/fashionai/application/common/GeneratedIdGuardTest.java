package br.com.fashionai.application.common;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Entidade com {@code @GeneratedValue} nunca recebe id na mão antes do {@code save()}: com id preenchido o Spring Data
 * trata a entidade como existente e faz {@code merge}; desde o Hibernate 6.6 o merge de uma linha que não existe lança
 * "Row was already updated or deleted" e marca a transação de quem chamou para rollback — mesmo com try/catch em volta.
 * Foi assim que criar peça passou a falhar (o log de inferência de IA levava a transação junto).
 */
class GeneratedIdGuardTest {
    private static final Path DOMAIN = Path.of("../fai-domain/src/main/java");
    private static final List<Path> CODE = List.of(Path.of("src/main/java"), Path.of("../fai-web/src/main/java"),
            Path.of("../fai-infrastructure/src/main/java"));
    private static final Pattern CLASS = Pattern.compile("public (?:abstract )?class (\\w+)(?: extends (\\w+))?");
    private static final Pattern NEW_VAR = Pattern.compile("\\b(\\w+) (\\w+) = new (\\w+)\\(\\)");

    @Test
    void entidadesComIdGeradoNaoRecebemIdManual() throws IOException {
        assumeTrue(Files.isDirectory(DOMAIN), "fonte do domínio fora do checkout");
        Set<String> generated = generatedIdEntities();
        assertThat(generated).contains("AiInferenceLog", "ProcessingJobLog");
        List<String> offenders = new ArrayList<>();
        for (Path root : CODE) {
            if (!Files.isDirectory(root)) {
                continue;
            }
            try (Stream<Path> files = Files.walk(root)) {
                for (Path f : files.filter(p -> p.toString().endsWith(".java")).toList()) {
                    String src = Files.readString(f);
                    Matcher m = NEW_VAR.matcher(src);
                    while (m.find()) {
                        if (generated.contains(m.group(3)) && src.contains(m.group(2) + ".setId(")) {
                            offenders.add(f.getFileName() + ": " + m.group(3) + " " + m.group(2));
                        }
                    }
                }
            }
        }
        assertThat(offenders).as("setId manual em entidade com @GeneratedValue").isEmpty();
    }

    /** Classes do domínio com {@code @GeneratedValue} no id, inclusive as que herdam o id de uma base. */
    private static Set<String> generatedIdEntities() throws IOException {
        Set<String> direct = new HashSet<>();
        List<String[]> extendsOf = new ArrayList<>();
        try (Stream<Path> files = Files.walk(DOMAIN)) {
            for (Path f : files.filter(p -> p.toString().endsWith(".java")).toList()) {
                String src = Files.readString(f);
                Matcher c = CLASS.matcher(src);
                if (!c.find()) {
                    continue;
                }
                if (src.contains("@GeneratedValue")) {
                    direct.add(c.group(1));
                } else if (c.group(2) != null) {
                    extendsOf.add(new String[]{c.group(1), c.group(2)});
                }
            }
        }
        Set<String> all = new HashSet<>(direct);
        boolean grew = true;
        while (grew) {
            grew = false;
            for (String[] e : extendsOf) {
                if (all.contains(e[1]) && all.add(e[0])) {
                    grew = true;
                }
            }
        }
        return all;
    }
}
