package br.com.fashionai.web.config;

import br.com.fashionai.application.service.IdentityService;
import br.com.fashionai.web.error.ErrorWriter;
import br.com.fashionai.web.security.AuditAccessDeniedHandler;
import br.com.fashionai.web.security.AuditAuthenticationEntryPoint;
import br.com.fashionai.web.security.SessionActiveFilter;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Segurança da API (RNF1/RNF2): stateless, JWT RS256 próprio, papel vindo do claim "role" e
 * rotas públicas restritas a leitura de conteúdo público e autenticação. Todo 401/403 é auditado e sai em JSON.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    private static final String[] PUBLIC_GET = {
            "/actuator/health", "/actuator/info", "/actuator/prometheus", "/media/**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html",
            "/api/usernames/*/availability", "/api/preferences/options", "/api/taxonomy", "/api/assets/**",
            "/api/backgrounds/catalog", "/api/backgrounds/combination", "/api/backgrounds/recommendations",
            "/api/feed", "/api/runway", "/api/search", "/api/public-pieces",
            "/api/profiles/*", "/api/brands", "/api/celebrities", "/api/institutional/**",
            "/api/schemes/*", "/api/schemes/*/card.png", "/api/pieces/*", "/api/dna-schemes/*",
            "/api/interactions/*/*/comments", "/api/interactions/*/*/counters",
            "/api/users/*/lookbook", "/api/users/*/closet", "/api/users/*/seals", "/api/users/*/promotions",
            "/api/users/*/groupings", "/api/users/*/connections", "/api/groupings/*/schemes",
            "/api/hype/**", "/api/inventory-score/method", "/api/explorer/**", "/api/brand-logos", "/api/brand-logos/batch", "/api/studio/backdrops"
    };

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            AuditAccessDeniedHandler accessDeniedHandler,
                                            AuditAuthenticationEntryPoint authenticationEntryPoint,
                                            ObjectProvider<IdentityService> identity,
                                            ObjectProvider<ErrorWriter> errors) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, PUBLIC_GET).permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login", "/api/auth/refresh",
                                "/api/auth/password-reset/request", "/api/auth/password-reset/confirm").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/username-suggestions").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())));
        IdentityService identityService = identity.getIfAvailable();
        ErrorWriter errorWriter = errors.getIfAvailable();
        if (identityService != null && errorWriter != null) {
            http.addFilterAfter(new SessionActiveFilter(identityService, errorWriter), BearerTokenAuthenticationFilter.class);
        }
        return http.build();
    }

    static JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            String role = jwt.getClaimAsString("role");
            return role == null ? List.of() : List.of(new SimpleGrantedAuthority("ROLE_" + role));
        });
        return converter;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${fashionai.cors.allowed-origins:http://localhost:3000}") String origins) {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList());
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Correlation-Id", "Accept-Language"));
        cors.setExposedHeaders(List.of("X-Correlation-Id", "Content-Disposition"));
        cors.setAllowCredentials(true);
        cors.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return source;
    }
}
