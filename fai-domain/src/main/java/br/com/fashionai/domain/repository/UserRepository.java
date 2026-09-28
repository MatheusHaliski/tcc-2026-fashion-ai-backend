package br.com.fashionai.domain.repository;

import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Repositório Spring Data de User (MySQL — fonte da verdade). */
public interface UserRepository extends JpaRepository<User, UUID> {
    boolean existsByEmailHash(String emailHash);

    Optional<User> findByEmailHash(String emailHash);

    Optional<User> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByAvatarUrlEndingWithOrCoverUrlEndingWith(String avatarSuffix, String coverSuffix);

    List<User> findByProfileTypeAndStatusOrderByCreatedAtDesc(ProfileType profileType, AccountStatus status);

    List<User> findTop50ByProfileTypeOrderByCreatedAtDesc(ProfileType profileType);

    List<User> findByStatus(AccountStatus status);

    @Query("select u from User u where lower(u.username) like lower(concat('%', :term, '%'))") List<User> searchByUsername(@Param("term") String term, Pageable pageable);

    long countByCountry(String country);

    @Query("select u.country, count(u) from User u where u.country is not null group by u.country") List<Object[]> countByCountryGrouped();
}
