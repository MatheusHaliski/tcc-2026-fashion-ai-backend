package br.com.fashionai.infrastructure.opensearch;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLEngine;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509ExtendedTrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.ByteArrayInputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Confiança TLS do cliente do OpenSearch, sem tocar no truststore global da JVM:
 * <ul>
 *   <li>{@link #trusting(String, boolean)} — só certificados emitidos pela(s) CA(s) do PEM (OPENSEARCH_CA_CERT_PEM),
 *       com verificação do nome do host por padrão;</li>
 *   <li>{@link #trustingAnything()} — aceita qualquer certificado (OPENSEARCH_TLS_INSECURE=true): só para a rede
 *       privada com certificado autoassinado, enquanto a CA não é configurada.</li>
 * </ul>
 */
final class OpenSearchTls {
    private OpenSearchTls() {
    }

    /** Certificados X.509 de um PEM (aceita "\n" literal, como nas variáveis de ambiente de uma linha só). */
    static List<X509Certificate> parse(String pem) {
        String text = pem == null ? "" : pem.replace("\\n", "\n").trim();
        if (!text.contains("-----BEGIN CERTIFICATE-----")) {
            throw new IllegalStateException("OPENSEARCH_CA_CERT_PEM não contém um certificado PEM (-----BEGIN CERTIFICATE-----)");
        }
        try {
            Collection<? extends java.security.cert.Certificate> all = CertificateFactory.getInstance("X.509")
                    .generateCertificates(new ByteArrayInputStream(text.getBytes(StandardCharsets.US_ASCII)));
            List<X509Certificate> certs = new ArrayList<>();
            for (java.security.cert.Certificate c : all) {
                certs.add((X509Certificate) c);
            }
            if (certs.isEmpty()) {
                throw new IllegalStateException("OPENSEARCH_CA_CERT_PEM sem certificados");
            }
            return certs;
        } catch (CertificateException ex) {
            throw new IllegalStateException("OPENSEARCH_CA_CERT_PEM inválido: " + ex.getMessage(), ex);
        }
    }

    static SSLContext trusting(String caPem, boolean verifyHostname) {
        try {
            KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());
            ks.load(null, null);
            int i = 0;
            for (X509Certificate cert : parse(caPem)) {
                ks.setCertificateEntry("opensearch-ca-" + i++, cert);
            }
            TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(ks);
            X509TrustManager pinned = null;
            for (TrustManager tm : tmf.getTrustManagers()) {
                if (tm instanceof X509TrustManager x) {
                    pinned = x;
                }
            }
            if (pinned == null) {
                throw new IllegalStateException("sem X509TrustManager na JVM");
            }
            SSLContext ctx = SSLContext.getInstance("TLS");
            // o gerenciador padrão (X509ExtendedTrustManager) já confere o nome do host; sem isso, só a cadeia até a CA
            ctx.init(null, new TrustManager[]{verifyHostname ? pinned : new ChainOnly(pinned)}, null);
            return ctx;
        } catch (GeneralSecurityException | java.io.IOException ex) {
            throw new IllegalStateException("TLS do OpenSearch: " + ex.getMessage(), ex);
        }
    }

    static SSLContext trustingAnything() {
        try {
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, new TrustManager[]{new AcceptAll()}, null);
            return ctx;
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("TLS do OpenSearch: " + ex.getMessage(), ex);
        }
    }

    /** Confere a cadeia até a CA configurada, sem conferir o nome do host (X509ExtendedTrustManager pula a identidade). */
    private static final class ChainOnly extends X509ExtendedTrustManager {
        private final X509TrustManager delegate;

        ChainOnly(X509TrustManager delegate) {
            this.delegate = delegate;
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
            delegate.checkServerTrusted(chain, authType);
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType, Socket socket) throws CertificateException {
            delegate.checkServerTrusted(chain, authType);
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType, SSLEngine engine) throws CertificateException {
            delegate.checkServerTrusted(chain, authType);
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
            throw new CertificateException("cliente TLS não é servidor");
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType, Socket socket) throws CertificateException {
            throw new CertificateException("cliente TLS não é servidor");
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType, SSLEngine engine) throws CertificateException {
            throw new CertificateException("cliente TLS não é servidor");
        }

        @Override
        public X509Certificate[] getAcceptedIssuers() {
            return delegate.getAcceptedIssuers();
        }
    }

    /** OPENSEARCH_TLS_INSECURE=true: cifra o tráfego, mas não autentica o servidor. */
    private static final class AcceptAll extends X509ExtendedTrustManager {
        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType) {
            // intencional: modo inseguro explícito (logado como WARN na subida)
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType, Socket socket) {
            // intencional: modo inseguro explícito
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType, SSLEngine engine) {
            // intencional: modo inseguro explícito
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
            throw new CertificateException("cliente TLS não é servidor");
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType, Socket socket) throws CertificateException {
            throw new CertificateException("cliente TLS não é servidor");
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType, SSLEngine engine) throws CertificateException {
            throw new CertificateException("cliente TLS não é servidor");
        }

        @Override
        public X509Certificate[] getAcceptedIssuers() {
            return new X509Certificate[0];
        }
    }
}
