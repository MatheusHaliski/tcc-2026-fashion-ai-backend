package br.com.fashionai.application.identity;

public interface PasswordHasherPort {
    String hash(String rawPassword);

    boolean matches(String rawPassword, String encodedPassword);
}
