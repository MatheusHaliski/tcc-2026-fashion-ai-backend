package br.com.fashionai.infrastructure.cassandra;

import com.datastax.oss.driver.api.core.CqlSessionBuilder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class CassandraCloudConfigTest {
    private final CassandraCloudConfig config = new CassandraCloudConfig();

    @Test
    void semBundleNaoMexeNoBuilder() {
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection("", "", "", "").customize(builder);
        verifyNoInteractions(builder);
    }

    @Test
    void bundleEmBase64UsaOsBytesDoZip() throws Exception {
        byte[] zip = {0x50, 0x4b, 0x03, 0x04, 1, 2, 3};
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection("", Base64.getEncoder().encodeToString(zip), "", "").customize(builder);
        ArgumentCaptor<InputStream> in = ArgumentCaptor.forClass(InputStream.class);
        verify(builder).withCloudSecureConnectBundle(in.capture());
        assertThat(in.getValue().readAllBytes()).isEqualTo(zip);
    }

    @Test
    void bundleEmArquivoUsaOCaminho(@TempDir Path dir) throws Exception {
        Path zip = Files.write(dir.resolve("secure-connect-fai.zip"), new byte[]{0x50, 0x4b});
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection(zip.toString(), "", "", "").customize(builder);
        verify(builder).withCloudSecureConnectBundle(zip);
    }

    @Test
    void credenciaisSoQuandoHaUsuario() {
        CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
        config.cassandraConnection("", "", "token", "AstraCS:abc").customize(builder);
        verify(builder).withAuthCredentials("token", "AstraCS:abc");
    }

    @Test
    void bundleEmBase64GeraUmStreamNovoPorSessao() throws Exception {
        byte[] zip = {0x50, 0x4b, 0x03, 0x04};
        var customizer = config.cassandraConnection("", Base64.getEncoder().encodeToString(zip), "", "");
        for (int i = 0; i < 2; i++) {
            CqlSessionBuilder builder = mock(CqlSessionBuilder.class);
            customizer.customize(builder);
            ArgumentCaptor<InputStream> in = ArgumentCaptor.forClass(InputStream.class);
            verify(builder).withCloudSecureConnectBundle(in.capture());
            assertThat(in.getValue().readAllBytes()).isEqualTo(zip);
        }
    }

    @Test
    void arquivoInexistenteFalhaNaSubida(@TempDir Path dir) {
        assertThatThrownBy(() -> config.cassandraConnection(dir.resolve("nao-existe.zip").toString(), "", "", ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CASSANDRA_SECURE_BUNDLE_PATH");
    }
}
