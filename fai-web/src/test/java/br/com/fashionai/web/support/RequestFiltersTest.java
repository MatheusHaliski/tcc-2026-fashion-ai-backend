package br.com.fashionai.web.support;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServlet;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Filtros de idioma e correlation id, e a leitura segura de uploads. */
class RequestFiltersTest {

    @Test
    void idiomaEscolheOPrimeiroSuportadoOuPtBr() {
        assertThat(RequestLocaleFilter.pick(null)).isEqualTo(Msg.PT_BR);
        assertThat(RequestLocaleFilter.pick(" ")).isEqualTo(Msg.PT_BR);
        assertThat(RequestLocaleFilter.pick("de-DE,en;q=0.8").getLanguage()).isEqualTo("en");
        assertThat(RequestLocaleFilter.pick("es-AR").getLanguage()).isEqualTo("es");
        assertThat(RequestLocaleFilter.pick("fr, de")).isEqualTo(Msg.PT_BR);
        assertThat(RequestLocaleFilter.pick(";;;q=x")).isEqualTo(Msg.PT_BR);
    }

    @Test
    void filtroDeIdiomaPublicaOLocaleDuranteARequisicaoEDevolveContentLanguage() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/x");
        req.addHeader("Accept-Language", "en-US");
        MockHttpServletResponse res = new MockHttpServletResponse();
        AtomicReference<Locale> during = new AtomicReference<>();
        new RequestLocaleFilter().doFilter(req, res, new MockFilterChain(new HttpServlet() {
            @Override
            protected void service(jakarta.servlet.http.HttpServletRequest r, jakarta.servlet.http.HttpServletResponse s) {
                during.set(LocaleContextHolder.getLocale());
            }
        }));
        assertThat(during.get().getLanguage()).isEqualTo("en");
        assertThat(res.getHeader("Content-Language")).startsWith("en");
    }

    private static ObjectProvider<ClientIpResolver> provider(ClientIpResolver r) {
        return new ObjectProvider<>() {
            @Override
            public ClientIpResolver getObject(Object... args) {
                return r;
            }

            @Override
            public ClientIpResolver getIfAvailable() {
                return r;
            }

            @Override
            public ClientIpResolver getIfUnique() {
                return r;
            }

            @Override
            public ClientIpResolver getObject() {
                return r;
            }
        };
    }

    @Test
    void correlationIdDoClienteValidoEhMantidoEInvalidoTrocado() throws Exception {
        CorrelationIdFilter filter = new CorrelationIdFilter(provider(new ClientIpResolver("", "X-Real-IP")));
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/x");
        req.addHeader(CorrelationIdFilter.HEADER, "abc-12345");
        req.setRemoteAddr("10.0.0.9");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, new MockFilterChain());
        assertThat(res.getHeader(CorrelationIdFilter.HEADER)).isEqualTo("abc-12345");
        assertThat(CorrelationIdFilter.correlationId(req)).isEqualTo("abc-12345");
        assertThat(CorrelationIdFilter.clientIp(req)).isEqualTo("10.0.0.9");

        CorrelationIdFilter semIp = new CorrelationIdFilter(provider(null));
        MockHttpServletRequest bad = new MockHttpServletRequest("GET", "/api/x");
        bad.addHeader(CorrelationIdFilter.HEADER, "curto");
        MockHttpServletResponse res2 = new MockHttpServletResponse();
        semIp.doFilter(bad, res2, new MockFilterChain());
        assertThat(res2.getHeader(CorrelationIdFilter.HEADER)).hasSize(36).isNotEqualTo("curto");
        assertThat(CorrelationIdFilter.correlationId(new MockHttpServletRequest())).isNull();
    }

    @Test
    void uploadsRecusamVazioFormatoEArquivoIlegivel() {
        assertThatThrownBy(() -> Uploads.image(null)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.code()).isEqualTo("ARQUIVO_VAZIO"));
        assertThatThrownBy(() -> Uploads.image(new MockMultipartFile("f", new byte[0])))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("ARQUIVO_VAZIO"));
        assertThatThrownBy(() -> Uploads.image(new MockMultipartFile("f", "a", null, new byte[]{1})))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("FORMATO_NAO_SUPORTADO"));
        MultipartFile broken = new MockMultipartFile("f", "a.png", "IMAGE/PNG", new byte[]{1}) {
            @Override
            public byte[] getBytes() throws IOException {
                throw new IOException("disco");
            }
        };
        assertThatThrownBy(() -> Uploads.image(broken)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.code()).isEqualTo("ARQUIVO_ILEGIVEL"));
        assertThat(Uploads.image(new MockMultipartFile("f", "a.webp", "image/webp", new byte[]{9}))).containsExactly(9);
        assertThatThrownBy(() -> Uploads.images(null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> Uploads.images(List.of())).isInstanceOf(ApiException.class);
        assertThat(Uploads.mime(null)).isEqualTo("image/jpeg");
        assertThat(Uploads.mime(new MockMultipartFile("f", "a", null, new byte[]{1}))).isEqualTo("image/jpeg");
        assertThat(Uploads.mime(new MockMultipartFile("f", "a", "image/png", new byte[]{1}))).isEqualTo("image/png");
    }
}
