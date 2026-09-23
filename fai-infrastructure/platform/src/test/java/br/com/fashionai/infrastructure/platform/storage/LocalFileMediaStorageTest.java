package br.com.fashionai.infrastructure.platform.storage;

import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalFileMediaStorageTest {
    @Test
    void storesReadsDeletesAndResolvesKeys(@TempDir Path dir) throws Exception {
        LocalFileMediaStorage storage = new LocalFileMediaStorage(dir.toString(), "https://api.fashionai.app/");
        var stored = storage.put("pieces/u1/foto.png", new byte[]{1, 2, 3}, "image/png");
        assertThat(stored.url()).isEqualTo("https://api.fashionai.app/media/pieces/u1/foto.png");
        assertThat(stored.size()).isEqualTo(3);
        assertThat(storage.get("pieces/u1/foto.png")).containsExactly(1, 2, 3);
        assertThat(storage.keyOf(stored.url())).contains("pieces/u1/foto.png");
        assertThat(storage.keyOf("https://outro.host/x.png")).isEmpty();
        storage.delete("pieces/u1/foto.png");
        assertThatThrownBy(() -> storage.get("pieces/u1/foto.png")).isInstanceOf(ApiException.class);
    }

    @Test
    void refusesPathTraversal(@TempDir Path dir) throws Exception {
        LocalFileMediaStorage storage = new LocalFileMediaStorage(dir.toString(), "http://localhost:8080");
        assertThatThrownBy(() -> storage.put("../../etc/passwd", new byte[]{1}, "text/plain")).isInstanceOf(ApiException.class);
    }
}
