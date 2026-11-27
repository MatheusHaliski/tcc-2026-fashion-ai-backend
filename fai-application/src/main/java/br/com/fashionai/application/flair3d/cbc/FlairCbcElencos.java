package br.com.fashionai.application.flair3d.cbc;

import br.com.fashionai.application.flair3d.cbc.FlairCbcElenco.Requisito;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

import static br.com.fashionai.application.flair3d.cbc.elencos.QuebraCabeca.de;
import static br.com.fashionai.application.flair3d.cbc.elencos.QuebraCabeca.repetir;

/**
 * Os elencos oficiais em quebra-cabeça, do mais simples ao mais difícil (docs/flair/cbc/CINCO_ELENCOS.md): as quatro
 * cenas da imagem composta (4 peças cada), a Celebração na Arena (6) e os cinco logos FAI (12 a 16 peças). As vagas
 * seguem a ordem das peças do desenho no front (lib/flair/elencos/quebra-cabecas.ts).
 */
public final class FlairCbcElencos {
    private static final String VERMELHO = "color:red";
    private static final String VERDE = "color:green";
    private static final String AZUL = "color:blue";
    private static final String LARANJA = "color:orange";
    private static final String PRETO = "color:black";
    private static final String ROSA = "color:pink";
    private static final String ROXO = "color:purple";
    private static final String MODERNO = "style:modern";
    private static final String FESTA = "occasion:party";
    private static final String LIVRE = "";

    public static final List<FlairCbcElenco> TODOS = List.of(
            de("DESAFIO_FOGO", List.of(Requisito.cor("red", 4)), VERMELHO, VERMELHO, VERMELHO, VERMELHO),
            de("DESAFIO_VERDE_FLORESTAL", List.of(Requisito.cor("green", 3)), VERDE, VERDE, VERDE, LIVRE),
            de("DESAFIO_AZUL_TECH", List.of(Requisito.cor("blue", 1)), AZUL, LIVRE, LIVRE, LIVRE),
            de("DESAFIO_FASHIONAI_TECH", List.of(Requisito.estilo("modern", 4)), MODERNO, MODERNO, MODERNO, MODERNO),
            de("CELEBRACAO_ARENA", List.of(Requisito.ocasiao("party", 3)), repetir(6, FESTA, LIVRE)),
            de("LOGO_QUEBRA_CABECA", List.of(Requisito.cor("orange", 6)),
                    LARANJA, LIVRE, LARANJA, LIVRE, LIVRE, LARANJA, LIVRE, LARANJA, LARANJA, LIVRE, LARANJA, LIVRE),
            de("LOGO_SETORES", List.of(Requisito.cor("black", 4), Requisito.cor("orange", 4)), repetir(12, PRETO, LARANJA, LIVRE)),
            de("LOGO_TEAL", List.of(Requisito.cor("blue", 3), Requisito.cor("green", 3)), repetir(12, AZUL, LIVRE, LIVRE, VERDE)),
            de("LOGO_CACOS", List.of(Requisito.cor("pink", 4), Requisito.cor("purple", 4)), repetir(12, ROSA, ROXO, LIVRE)),
            de("LOGO_PECAS_FALTANDO", List.of(Requisito.cor("orange", 6), Requisito.cor("black", 4), Requisito.de(Requisito.MARCAS, 3)),
                    PRETO, LARANJA, LARANJA, PRETO, LARANJA, LIVRE, LIVRE, LARANJA, LARANJA, LIVRE, LIVRE, LARANJA, PRETO, LIVRE, LIVRE, PRETO));

    private FlairCbcElencos() {
    }

    public static Optional<FlairCbcElenco> porCodigo(String codigo) {
        String c = codigo == null ? "" : codigo.trim().toUpperCase(Locale.ROOT);
        return TODOS.stream().filter(e -> e.codigo().equals(c)).findFirst();
    }
}
