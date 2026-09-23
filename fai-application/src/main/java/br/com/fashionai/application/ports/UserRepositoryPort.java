package br.com.fashionai.application.ports;

import br.com.fashionai.domain.model.User;

import java.util.Optional;
import java.util.UUID;

public interface UserRepositoryPort {
    boolean existsByEmailHash(String emailHash);

    Optional<User> findById(UUID userId);

    User save(User user);
}
