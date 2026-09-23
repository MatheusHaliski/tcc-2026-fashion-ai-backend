package br.com.fashionai.infrastructure.mysql.repository;

import br.com.fashionai.application.ports.UserRepositoryPort;
import br.com.fashionai.domain.model.User;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public class UserRepositoryAdapter implements UserRepositoryPort {
    private final SpringDataUserRepository repository;

    public UserRepositoryAdapter(SpringDataUserRepository repository) {
        this.repository = repository;
    }

    @Override
    public boolean existsByEmailHash(String emailHash) {
        return repository.existsByEmailHash(emailHash);
    }

    @Override
    public Optional<User> findById(UUID userId) {
        return repository.findById(userId);
    }

    @Override
    public User save(User user) {
        return repository.save(user);
    }
}
