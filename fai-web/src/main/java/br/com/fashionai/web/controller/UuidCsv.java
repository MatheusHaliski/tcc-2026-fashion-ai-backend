package br.com.fashionai.web.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Lista de ids em CSV vinda da query string ({@code ids=a,b,c}), lida do mesmo jeito pelo Hype em lote e pelos selos das
 * peças: espaços em volta são aparados, id malformado é ignorado (o lote continua), ausente vira lista vazia e a leitura
 * para ao atingir o tamanho máximo do lote do serviço.
 */
final class UuidCsv {
    private UuidCsv() {
    }

    static List<UUID> parse(String csv, int max) {
        List<UUID> out = new ArrayList<>();
        if (csv == null) {
            return out;
        }
        for (String part : csv.split(",")) {
            try {
                out.add(UUID.fromString(part.trim()));
            } catch (IllegalArgumentException ignored) {
                // id malformado: ignorado (o lote continua)
            }
            if (out.size() >= max) {
                break;
            }
        }
        return out;
    }
}
