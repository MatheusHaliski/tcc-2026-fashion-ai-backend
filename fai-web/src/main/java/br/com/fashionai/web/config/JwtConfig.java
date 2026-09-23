package br.com.fashionai.web.config;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Par de chaves RSA do JWT próprio (RNF2). Em produção as chaves vêm de JWT_PRIVATE_KEY_PEM / JWT_PUBLIC_KEY_PEM;
 * sem elas (ambiente local) gera um par efêmero — os tokens deixam de valer a cada reinício.
 */
@Configuration
public class JwtConfig {
    private static final Logger log = LoggerFactory.getLogger(JwtConfig.class);

    @Bean
    RSAKey fashionJwtKey(@Value("${fashionai.jwt.private-key-pem:}") String privatePem,
                         @Value("${fashionai.jwt.public-key-pem:}") String publicPem) throws Exception {
        RSAPublicKey publicKey;
        RSAPrivateKey privateKey;
        if (isPem(privatePem) && isPem(publicPem)) {
            KeyFactory kf = KeyFactory.getInstance("RSA");
            privateKey = (RSAPrivateKey) kf.generatePrivate(new PKCS8EncodedKeySpec(decode(privatePem)));
            publicKey = (RSAPublicKey) kf.generatePublic(new X509EncodedKeySpec(decode(publicPem)));
        } else {
            log.warn("JWT_PRIVATE_KEY_PEM/JWT_PUBLIC_KEY_PEM ausentes: usando par RSA efêmero (apenas para desenvolvimento).");
            KeyPair pair = generate();
            publicKey = (RSAPublicKey) pair.getPublic();
            privateKey = (RSAPrivateKey) pair.getPrivate();
        }
        return new RSAKey.Builder(publicKey).privateKey(privateKey).keyID("fai-1").build();
    }

    @Bean
    JwtEncoder jwtEncoder(RSAKey key) {
        return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(key)));
    }

    @Bean
    JwtDecoder jwtDecoder(RSAKey key, @Value("${fashionai.jwt.issuer:fashionai}") String issuer) throws Exception {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(key.toRSAPublicKey()).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer)));
        return decoder;
    }

    private static boolean isPem(String pem) {
        return pem != null && pem.contains("-----BEGIN");
    }

    private static byte[] decode(String pem) {
        String body = pem.replaceAll("-----[A-Z ]+-----", "").replace("\\n", "").replaceAll("\\s", "");
        return Base64.getDecoder().decode(body);
    }

    private static KeyPair generate() throws NoSuchAlgorithmException {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        return generator.generateKeyPair();
    }
}
