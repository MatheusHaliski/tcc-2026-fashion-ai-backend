package br.com.fashionai.application.security;

/** Ator da requisição corrente (id do usuário ou "system") para o @CreatedBy/@LastModifiedBy das entidades (RNF5). */
public final class RequestActor {
    private static final ThreadLocal<String> ACTOR = new ThreadLocal<>();

    private RequestActor() {
    }

    public static void set(String actor) {
        ACTOR.set(actor);
    }

    public static void clear() {
        ACTOR.remove();
    }

    public static String current() {
        String a = ACTOR.get();
        return a == null || a.isBlank() ? "system" : a;
    }
}
