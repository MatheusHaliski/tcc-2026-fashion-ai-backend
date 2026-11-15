package br.com.fashionai.web.controller;

import org.springframework.dao.DataIntegrityViolationException;

import java.util.function.Supplier;

/**
 * Leitura que cria o registro na primeira vez (ex.: o DNA de Estilo em {@code GET /api/me/dna}). Duas telas pedindo ao
 * mesmo tempo disputam a criação e a que perde recebia 409 por chave duplicada. Quem perde a disputa só precisa ler de
 * novo: a outra requisição já gravou o registro.
 */
final class CreateOnRead {
    private CreateOnRead() {
    }

    static <T> T retryOnRace(Supplier<T> read) {
        try {
            return read.get();
        } catch (DataIntegrityViolationException raced) {
            return read.get();
        }
    }
}
