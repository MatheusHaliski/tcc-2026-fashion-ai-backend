package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Real Hibernate + JDBC regression: a public search must not decrypt somebody else's private account columns. */
class SearchPeopleProjectionJpaTest {
    private static SessionFactory factory;
    private static final List<String> statements = new ArrayList<>();
    private static String previousKey;

    @BeforeAll
    static void startDatabase() {
        previousKey = System.getProperty("DATA_ENCRYPTION_KEY");
        if (previousKey == null && System.getenv("DATA_ENCRYPTION_KEY") == null)
            System.setProperty("DATA_ENCRYPTION_KEY", Base64.getEncoder().encodeToString(new byte[32]));
        factory = new Configuration().addAnnotatedClass(User.class)
                .setProperty("hibernate.connection.driver_class", "org.h2.Driver")
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:public_profiles;DB_CLOSE_DELAY=-1;MODE=MySQL")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("hibernate.type.preferred_uuid_jdbc_type", "CHAR")
                .setStatementInspector(sql -> { statements.add(sql); return sql; })
                .buildSessionFactory();
    }

    @AfterAll
    static void closeDatabase() {
        if (factory != null) factory.close();
        if (previousKey == null) System.clearProperty("DATA_ENCRYPTION_KEY");
        else System.setProperty("DATA_ENCRYPTION_KEY", previousKey);
    }

    @Test
    void publicProjectionDoesNotHydrateUnreadablePrivateAttributes() {
        UUID id;
        try (EntityManager em = factory.createEntityManager()) {
            em.getTransaction().begin();
            User person = new User("ana_public_search", "Ana Pública", "private@example.invalid", "unique-hash", "password-hash", ProfileType.PESSOAL);
            person.setStatus(AccountStatus.ACTIVE);
            person.setProfileVisibility(Visibility.PUBLIC);
            person.setBio("Perfil público");
            person.markCreatedAt(Instant.now());
            em.persist(person);
            em.flush();
            id = person.getId();
            // Simulate one legacy private attribute encrypted with an unavailable key, without altering public fields.
            em.createNativeQuery("update users set email_ciphertext = 'enc:v1:broken:broken' where id = ?1")
                    .setParameter(1, id.toString()).executeUpdate();
            em.getTransaction().commit();
        }
        try (EntityManager em = factory.createEntityManager()) {
            statements.clear();
            UserRepository users = new JpaRepositoryFactory(em).getRepository(UserRepository.class);
            var results = users.searchPersonalProfiles("ana_public", false, List.of(new UUID(0, 0)), PageRequest.of(0, 24));
            assertThat(results).hasSize(1);
            assertThat(results.getFirst().getId()).isEqualTo(id);
            assertThat(results.getFirst().getDisplayName()).isEqualTo("Ana Pública");
            assertThat(results.getFirst().getBio()).isEqualTo("Perfil público");
            assertThat(results.getFirst().getProfileVisibility()).isEqualTo(Visibility.PUBLIC);
            assertThat(String.join("\n", statements)).doesNotContain("email_ciphertext", "phone_ciphertext", "birth_date_ciphertext", "password_hash");
            // Control: the old select-entity path really fails on precisely the same row.
            assertThatThrownBy(() -> em.find(User.class, id)).hasStackTraceContaining("Unable to decrypt sensitive attribute");
        }
    }
}
