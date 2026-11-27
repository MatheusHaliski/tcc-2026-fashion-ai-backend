package br.com.fashionai.application.flair3d;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * O momento-chave da fase de uso de cada jogo de zonas (rodada zonas, 27/11/2026): o lance do gênero que pede leitura e
 * decisão com o tempo correndo. No Clube é o pênalti (o goleiro se adianta para um canto: bater no outro); no Singer, a
 * virada da música (o refrão explode ou vira balada: revelar a camada do figurino ou fechar a capa); no Piloto, o pit
 * stop (pista seca ou molhada: pneu macio ou de chuva); no Super-Herói, a ameaça (ataque aéreo ou por terra: escudo ou
 * salto). O servidor sorteia a condição da semente; as duas opções vão nos dois botões da marca (a primeira no botão do
 * lance seguro, a segunda no do ousado). A escolha certa vale {@value #PONTOS} e abre a janela das marcas seguintes em
 * {@value #EMBALO_PCT}%; a errada é erro e fecha a janela delas no mesmo tanto. Puro.
 */
public record Flair3dMomentoChave(int marca, String momento, String condicao, List<String> opcoes, String certa) {
    public static final int PONTOS = 3;
    public static final int EMBALO_PCT = 15;
    public static final String NOTA = "CHAVE";

    /** O momento de cada jogo: a marca, o nome, as duas condições e a opção certa de cada uma (na ordem das opções). */
    private record Tabela(int marca, String momento, List<String> condicoes, List<String> opcoes) {
    }

    private static final Map<String, Tabela> JOGOS = Map.of(
            // o pênalti fecha a estreia em campo: o goleiro adiantado para a esquerda pede o chute na direita
            "CLUBE_CORACAO", new Tabela(4, "PENALTI", List.of("GOLEIRO_DIREITA", "GOLEIRO_ESQUERDA"), List.of("ESQUERDA", "DIREITA")),
            "FAVORITE_SINGER", new Tabela(2, "VIRADA", List.of("REFRAO_EXPLODE", "REFRAO_BALADA"), List.of("REVELAR", "FECHAR")),
            "PILOTO_FAVORITO", new Tabela(2, "PIT_STOP", List.of("PISTA_SECA", "PISTA_MOLHADA"), List.of("MACIO", "CHUVA")),
            "SUPER_HEROI", new Tabela(3, "AMEACA", List.of("ATAQUE_AEREO", "ATAQUE_TERRESTRE"), List.of("ESCUDO", "SALTO")));

    /** O momento sorteado da partida, ou nulo fora dos jogos de zonas. */
    static Flair3dMomentoChave de(String jogo, List<String> seguros, List<String> ousados, Contexto contexto) {
        Tabela t = JOGOS.get(jogo);
        if (t == null || t.marca() >= seguros.size()) {
            return null;
        }
        int i = contexto.sorteio("momento-chave").nextInt(2);
        String certa = i == 0 ? seguros.get(t.marca()) : ousados.get(t.marca());
        return new Flair3dMomentoChave(t.marca(), t.momento(), t.condicoes().get(i), t.opcoes(), certa);
    }

    void paraTela(Map<String, Object> m) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("marca", marca);
        c.put("momento", momento);
        c.put("condicao", condicao);
        c.put("opcoes", opcoes);
        c.put("certa", certa);
        m.put("chave", c);
    }
}
