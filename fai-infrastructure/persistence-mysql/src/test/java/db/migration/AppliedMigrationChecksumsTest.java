package db.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Properties;
import java.util.TreeMap;
import java.util.zip.CRC32;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Uma migration já aplicada em produção não pode mudar: o Flyway compara o checksum gravado no banco com o do arquivo e,
 * se forem diferentes ("Migration checksum mismatch"), a API não sobe. Foi o que aconteceu com a V60 editada depois de
 * aplicada: todo deploy do main falhou até o arquivo voltar ao conteúdo aplicado. O lock
 * {@code flyway/applied-checksums.properties} guarda o checksum de cada migration publicada (scripts/db/flyway_checksums.py);
 * migrations novas, ainda fora do lock, ficam livres.
 */
class AppliedMigrationChecksumsTest {

    @Test
    void migrationJaPublicadaNaoMuda() throws Exception {
        Properties locked = new Properties();
        try (InputStream in = new ClassPathResource("flyway/applied-checksums.properties").getInputStream()) {
            locked.load(in);
        }
        Map<String, Integer> current = new TreeMap<>();
        for (Resource r : new PathMatchingResourcePatternResolver().getResources("classpath*:db/migration/V*__*.sql")) {
            current.put(r.getFilename(), checksum(r));
        }
        assertThat(locked).as("lock de checksums").hasSizeGreaterThan(30);
        Map<String, String> changed = new TreeMap<>();
        for (String name : locked.stringPropertyNames()) {
            Integer now = current.get(name);
            if (now == null) {
                changed.put(name, "removida (era " + locked.getProperty(name) + ")");
            } else if (now != Integer.parseInt(locked.getProperty(name))) {
                changed.put(name, "travada " + locked.getProperty(name) + ", atual " + now);
            }
        }
        assertThat(changed).as("migrations já publicadas que mudaram (desfaça e crie a próxima versão)").isEmpty();
    }

    /** O mesmo cálculo do Flyway: CRC32 de cada linha em UTF-8, sem a quebra de linha e sem BOM. */
    static int checksum(Resource resource) throws Exception {
        CRC32 crc = new CRC32();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            String line = reader.readLine();
            if (line != null && line.startsWith("﻿")) {
                line = line.substring(1);
            }
            for (; line != null; line = reader.readLine()) {
                crc.update(line.getBytes(StandardCharsets.UTF_8));
            }
        }
        return (int) crc.getValue();
    }
}
