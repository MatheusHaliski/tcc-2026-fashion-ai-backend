package br.com.fashionai.infrastructure.opensearch;

import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.BasicConstraints;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.GeneralName;
import org.bouncycastle.asn1.x509.GeneralNames;
import org.bouncycastle.asn1.x509.KeyUsage;
import org.bouncycastle.cert.X509v3CertificateBuilder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;

/** PKI de teste gerada em memória: uma CA e um certificado de servidor emitido por ela (nada é gravado em disco). */
final class TestPki {
    final KeyPair caKeys;
    final X509Certificate ca;

    TestPki(String cn) throws Exception {
        caKeys = rsa();
        X500Name name = new X500Name("CN=" + cn);
        X509v3CertificateBuilder b = new JcaX509v3CertificateBuilder(name, BigInteger.valueOf(System.nanoTime()), from(), to(), name, caKeys.getPublic());
        b.addExtension(Extension.basicConstraints, true, new BasicConstraints(true));
        b.addExtension(Extension.keyUsage, true, new KeyUsage(KeyUsage.keyCertSign | KeyUsage.cRLSign));
        ca = sign(b, caKeys);
    }

    /** Contexto TLS de servidor com um certificado desta CA para os nomes DNS dados. */
    SSLContext serverContext(String... dnsNames) throws Exception {
        KeyPair keys = rsa();
        GeneralName[] names = new GeneralName[dnsNames.length];
        for (int i = 0; i < dnsNames.length; i++) {
            names[i] = new GeneralName(GeneralName.dNSName, dnsNames[i]);
        }
        X509v3CertificateBuilder b = new JcaX509v3CertificateBuilder(new X500Name(ca.getSubjectX500Principal().getName()),
                BigInteger.valueOf(System.nanoTime()), from(), to(), new X500Name("CN=" + dnsNames[0]), keys.getPublic());
        b.addExtension(Extension.subjectAlternativeName, false, new GeneralNames(names));
        b.addExtension(Extension.keyUsage, true, new KeyUsage(KeyUsage.digitalSignature | KeyUsage.keyEncipherment));
        X509Certificate leaf = sign(b, caKeys);
        KeyStore ks = KeyStore.getInstance("PKCS12");
        ks.load(null, null);
        ks.setKeyEntry("server", keys.getPrivate(), "x".toCharArray(), new X509Certificate[]{leaf, ca});
        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(ks, "x".toCharArray());
        SSLContext ctx = SSLContext.getInstance("TLS");
        ctx.init(kmf.getKeyManagers(), null, null);
        return ctx;
    }

    String caPem() throws Exception {
        return "-----BEGIN CERTIFICATE-----\n" + Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(ca.getEncoded())
                + "\n-----END CERTIFICATE-----\n";
    }

    private static KeyPair rsa() throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
        g.initialize(2048);
        return g.generateKeyPair();
    }

    private static X509Certificate sign(X509v3CertificateBuilder b, KeyPair issuer) throws Exception {
        return new JcaX509CertificateConverter().getCertificate(b.build(new JcaContentSignerBuilder("SHA256withRSA").build(issuer.getPrivate())));
    }

    private static Date from() {
        return Date.from(Instant.now().minus(1, ChronoUnit.DAYS));
    }

    private static Date to() {
        return Date.from(Instant.now().plus(30, ChronoUnit.DAYS));
    }
}
