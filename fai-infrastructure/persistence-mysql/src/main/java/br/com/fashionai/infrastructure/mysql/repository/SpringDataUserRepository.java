package br.com.fashionai.infrastructure.mysql.repository;

import br.com.fashionai.domain.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SpringDataUserRepository extends JpaRepository<User, UUID> {
    boolean existsByEmailHash(String emailHash);

    Optional<User> findByEmailHash(String emailHash);
}
