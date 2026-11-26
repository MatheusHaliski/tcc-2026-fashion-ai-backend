package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dExecucao;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dNucleos;
import br.com.fashionai.application.flair3d.Flair3dTinta;
import br.com.fashionai.application.flair3d.Flair3dZonas;
import br.com.fashionai.application.flair3d.Resultado;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.zonas;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Auditoria dos jogos de zonas (Clube do Coração, Favorite Singer, Piloto Favorito e Super-Herói), por partidas
 * simuladas só com o que a tela oferece: as 10 cores e os 4 acabamentos de lib/flair/nucleos/palette.ts. Aqui não há
 * cartas: a conta da pessoa não muda nada, então "vencível" quer dizer que a paleta da tela chega a 100 em toda rodada.
 */
class AtelieZonasPartidasTest {
    /** As amostras da tela (palette.ts) e a família que o servidor tem de ler em cada uma. */
    static final Map<String, String> PALETA = paleta();
    static final List<String> ACABAMENTOS = List.of("FOSCO", "BRILHANTE", "METALICO", "ESPELHADO");
    static final String PRETO = "#151515";
    static final String BRANCO = "#F5F4F0";
    static final String AZUL = "#1E4FBF";
    static final String AMARELO = "#F2C230";
    static final String VERDE = "#1F9A4B";
    static final String ROSA = "#E64C93";
    static final String ROXO = "#7A3FC4";
    static final String VERMELHO = "#C8283A";
    static final String DOURADO = "#C9A227";

    /** Cada rodada com nota e a pintura de quem leu o objetivo, só com a paleta da tela. */
    static final Map<String, Entrega> JOGANDO_BEM = jogandoBem();

    private static Map<String, String> paleta() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put(PRETO, "Preto");
        m.put(BRANCO, "Branco");
        m.put(AZUL, "Azul");
        m.put(AMARELO, "Amarelo");
        m.put(VERDE, "Verde");
        m.put(ROSA, "Rosa");
        m.put(ROXO, "Roxo");
        m.put(VERMELHO, "Vermelho");
        m.put("#B9BEC6", "Cinza");
        m.put(DOURADO, "Amarelo");
        return m;
    }

    private static Map<String, Entrega> jogandoBem() {
        Map<String, Entrega> m = new LinkedHashMap<>();
        m.put("CLUBE_CORACAO/CLUBE_ATLANTICO", zonas(null, "FRENTE=" + AZUL, "COSTAS=" + AZUL, "MANGAS=" + BRANCO, "GOLA=" + BRANCO));
        m.put("CLUBE_CORACAO/CLUBE_AURORA", zonas(null, "FRENTE=" + VERMELHO, "COSTAS=" + VERMELHO, "MANGAS=" + PRETO, "GOLA=" + PRETO));
        m.put("CLUBE_CORACAO/UNIFORME_ESPORTS", zonas(null, "FRENTE=" + ROXO, "COSTAS=" + ROXO, "MANGAS=" + PRETO, "GOLA=" + AMARELO));
        m.put("FAVORITE_SINGER/ERA_NEON", zonas(null, "FRENTE=" + ROSA, "COSTAS=" + ROSA, "MANGAS=" + ROXO, "GOLA=" + ROSA + "/METALICO"));
        m.put("FAVORITE_SINGER/ERA_ACUSTICA", zonas(null, "FRENTE=" + BRANCO, "COSTAS=" + BRANCO, "MANGAS=" + BRANCO, "GOLA=" + DOURADO));
        m.put("FAVORITE_SINGER/JAQUETA_DA_BANDA", zonas(null, "CORPO=" + PRETO, "MANGAS=" + VERMELHO, "FERRAGENS=" + VERMELHO + "/METALICO", "GOLA=" + PRETO));
        m.put("PILOTO_FAVORITO/EQUIPE_AURORA", zonas(null, "TOPO=" + AMARELO, "LATERAIS=" + AMARELO, "FAIXA_VISEIRA=" + VERDE, "VISEIRA=" + PRETO + "/ESPELHADO"));
        m.put("PILOTO_FAVORITO/MACACAO_BOREAL", zonas(null, "TRONCO=" + AZUL, "MANGAS=" + BRANCO, "PERNAS=" + BRANCO, "GOLA=" + BRANCO, "CINTO=" + VERMELHO));
        m.put("PILOTO_FAVORITO/TENIS_DOS_SONHOS", zonas(null, "CABEDAL=" + AZUL + "/ESPELHADO", "SOLA=" + BRANCO, "CADARCO=" + BRANCO));
        m.put("SUPER_HEROI/ARMADURA", zonas("EMBLEMA_RAIO", "PEITO=" + AZUL + "/METALICO", "CAPA=" + VERMELHO, "BRACOS=" + AZUL, "PERNAS=" + AZUL));
        m.put("SUPER_HEROI/TRAJE_COLANTE", zonas("EMBLEMA_ASA", "PEITO=" + VERMELHO, "CAPA=" + AZUL, "BRACOS=" + AZUL, "PERNAS=" + AZUL));
        m.put("SUPER_HEROI/VIGILANTE_DA_NOITE", zonas("EMBLEMA_ESTRELA", "PEITO=" + AMARELO, "CAPA=" + PRETO, "BRACOS=" + PRETO, "PERNAS=" + PRETO));
        return m;
    }

    /**
     * O núcleo de cada jogo de zonas sem a execução no percurso: aqui se audita a nota da pintura. Na partida, o núcleo
     * registrado ({@link Flair3dNucleos}) é o {@link Flair3dExecucao} sobre este, que pede os botões depois do look.
     */
    static final Map<String, Flair3dNucleo> PINTURA = Map.of("CLUBE_CORACAO", new ClubeCoracaoNucleo(), "FAVORITE_SINGER",
            new FavoriteSingerNucleo(), "PILOTO_FAVORITO", new PilotoFavoritoNucleo(), "SUPER_HEROI", new SuperHeroiNucleo());

    static Flair3dNucleo jogo(String chave) {
        return PINTURA.get(chave.split("/")[0]);
    }

    static Resultado jogar(String chave, Entrega entrega) {
        return jogo(chave).pontuar(entrega, new Contexto(Map.of(), null, null).naRodada(chave.split("/")[1]));
    }

    /** Pintura ao acaso de todas as zonas da rodada, com a paleta da tela, tirada da semente. */
    static Entrega aoAcaso(String chave, long semente) {
        Random r = new Random(semente);
        List<String> cores = List.copyOf(PALETA.keySet());
        Map<String, Entrega.Zona> z = new LinkedHashMap<>();
        for (String zona : jogo(chave).definicao().naRodada(chave.split("/")[1]).zonas()) {
            z.put(zona, new Entrega.Zona(cores.get(r.nextInt(cores.size())), ACABAMENTOS.get(r.nextInt(ACABAMENTOS.size()))));
        }
        List<String> opcoes = jogo(chave).definicao().opcoes();
        return new Entrega(null, z, null, opcoes.isEmpty() ? null : opcoes.get(r.nextInt(opcoes.size())));
    }

    @Test
    void cadaAmostraDaTelaCaiNaFamiliaQueAsRegrasEsperam() {
        PALETA.forEach((hex, familia) -> assertThat(Flair3dZonas.familia(new Entrega.Zona(hex, "FOSCO"))).as(hex).isEqualTo(familia));
    }

    @Test
    void todaRodadaComNotaChegaACemSoComAPaletaDaTela() {
        // todas as rodadas com nota dos quatro jogos estão na lista (nenhuma fica sem prova)
        long comNota = List.of("CLUBE_CORACAO", "FAVORITE_SINGER", "PILOTO_FAVORITO", "SUPER_HEROI").stream()
                .flatMap(c -> Flair3dNucleos.porCodigo(c).orElseThrow().definicao().rodadas().stream())
                .filter(r -> r.objetivo().regras().stream().anyMatch(x -> x.pontos() > 0)).count();
        assertThat(JOGANDO_BEM).hasSize((int) comNota);
        JOGANDO_BEM.forEach((chave, entrega) -> {
            Resultado r = jogar(chave, entrega);
            assertThat(r.pontos()).as(chave).isEqualTo(100);
            assertThat(r.estrelas()).as(chave).isEqualTo(3);
            assertThat(r.resultado()).as(chave).isIn("APROVADO", "CONCLUIDO");
            assertThat(r.eventos()).as(chave).isEmpty();
            // a conta fecha: a nota é a soma das regras, sem desconto escondido
            assertThat(r.regras().stream().mapToDouble(Resultado.RegraResultado::pontos).sum()).as(chave).isEqualTo(100.0);
        });
    }

    @Test
    void naPartidaAPinturaComNotaPedeAExecucaoEQuemExecutaBemFicaComANotaDaPintura() {
        JOGANDO_BEM.forEach((chave, entrega) -> {
            Flair3dNucleo registrado = Flair3dNucleos.porCodigo(chave.split("/")[0]).orElseThrow();
            Contexto naRodada = new Contexto(Map.of(), null, null).naRodada(chave.split("/")[1]);
            Resultado pedido = registrado.pontuar(entrega, naRodada);
            assertThat(pedido.status()).as(chave).isEqualTo(Resultado.EM_ACAO);
            Andamento comToques = naRodada.andamento().com(Flair3dFixtures.perfeita(pedido));
            Resultado fim = registrado.pontuar(entrega, naRodada.comAndamento(comToques));
            assertThat(fim.fecha()).as(chave).isTrue();
            assertThat(fim.pontos()).as(chave).isEqualTo(100);
            assertThat(fim.regras()).as(chave).extracting(Resultado.RegraResultado::codigo).endsWith("EXECUCAO");
        });
    }

    @Test
    void pintarAoAcasoEmVinteSementesNaoPassaSozinho() {
        for (String chave : JOGANDO_BEM.keySet()) {
            int soma = 0;
            int cem = 0;
            for (long semente = 1; semente <= 20; semente++) {
                Resultado r = jogar(chave, aoAcaso(chave, semente));
                assertThat(r.regras().stream().mapToDouble(Resultado.RegraResultado::pontos).sum()).as(chave).isEqualTo((double) r.pontos());
                soma += r.pontos();
                cem += r.pontos() == 100 ? 1 : 0;
            }
            // a rodada pede decisão: o acaso fica abaixo de quem lê o objetivo (100 em todas) e quase nunca chega a 100
            assertThat(soma / 20.0).as(chave).isLessThan(60);
            assertThat(cem).as(chave).isLessThanOrEqualTo(1);
        }
    }

    @Test
    void osClubesConcluemComAsCoresDaTelaEAsCoresErradasFicamPelaMetade() {
        Entrega atlantico = JOGANDO_BEM.get("CLUBE_CORACAO/CLUBE_ATLANTICO");
        Resultado errado = jogar("CLUBE_CORACAO/CLUBE_AURORA", atlantico);
        assertThat(errado.resultado()).isEqualTo("INCOMPLETO");
        assertThat(errado.pontos()).isEqualTo(50);
    }

    @Test
    void aTintaTemOrcamentoEASobraViraFolegoDaExecucao() {
        Flair3dNucleo armadura = Flair3dNucleos.porCodigo("SUPER_HEROI").orElseThrow();
        Contexto naRodada = new Contexto(Map.of(), null, null).naRodada("ARMADURA");
        // peito metálico (3 latas) e três zonas foscas (3): 6 das 8 latas; sobram 2, que viram 10 de vida na execução
        Resultado pedido = armadura.pontuar(JOGANDO_BEM.get("SUPER_HEROI/ARMADURA"), naRodada);
        assertThat(pedido.eventos()).contains(new Resultado.Evento("TINTA", Map.of("orcamento", 8, "gasto", 6, "sobra", 2)));
        assertThat(pedido.eventos()).filteredOn(e -> e.codigo().equals("EXECUCAO_PEDIDA")).extracting(Resultado.Evento::valor)
                .first().asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP).containsEntry("recurso", "VIDA").containsEntry("reserva", 70);
        // tudo metálico passa do orçamento (12 latas de 8): a peça não sai do ateliê
        Entrega cara = zonas("EMBLEMA_RAIO", "PEITO=" + AZUL + "/METALICO", "CAPA=" + VERMELHO + "/METALICO", "BRACOS=" + AZUL + "/METALICO", "PERNAS=" + AZUL + "/METALICO");
        Resultado semTinta = armadura.pontuar(cara, naRodada);
        assertThat(semTinta.resultado()).isEqualTo(Flair3dTinta.SEM_TINTA);
        assertThat(semTinta.fecha()).isTrue();
        assertThat(semTinta.pontos()).isLessThanOrEqualTo(Flair3dExecucao.NOTA_DE_QUEM_ESGOTOU);
        // a prévia mostra o orçamento enquanto a pessoa pinta
        assertThat(armadura.previa(cara, naRodada).eventos()).contains(new Resultado.Evento("TINTA", Map.of("orcamento", 8, "gasto", 12, "sobra", 0)));
        // e o fôlego que a pintura deixa para a fase de uso (a roda de recursos): 60 de vida + 40 das latas − 30 gastos
        assertThat(armadura.previa(JOGANDO_BEM.get("SUPER_HEROI/ARMADURA"), naRodada).eventos()).filteredOn(e -> e.codigo().equals("DESGASTE"))
                .extracting(Resultado.Evento::valor).first().asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("recurso", "VIDA").containsEntry("reserva", 100).containsEntry("restante", 70);
        assertThat(armadura.previa(cara, naRodada).eventos()).filteredOn(e -> e.codigo().equals("DESGASTE"))
                .extracting(Resultado.Evento::valor).first().asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP).containsEntry("restante", 0);
    }

    @Test
    void pecaPelaMetadeNaoEhAprovadaComTresEstrelasEOResultadoDizQuantasZonasFaltaram() {
        // antes: capa preta e peito amarelo davam 100 no Vigilante, com braços e pernas sem pintar
        Resultado vigilante = jogar("SUPER_HEROI/VIGILANTE_DA_NOITE", zonas("EMBLEMA_RAIO", "CAPA=" + PRETO, "PEITO=" + AMARELO));
        assertThat(vigilante.pontos()).isEqualTo(50);
        assertThat(vigilante.resultado()).isEqualTo("REPROVADO");
        assertThat(vigilante.eventos()).containsExactly(new Resultado.Evento("ZONAS_SEM_PINTAR", Map.of("faltam", 2L, "total", 4)));
        // antes: uma zona rosa metálica dava 75 na Era Neon; uma sola branca espelhada, 75 no Tênis dos Sonhos
        assertThat(jogar("FAVORITE_SINGER/ERA_NEON", zonas(null, "FRENTE=" + ROSA + "/METALICO")).pontos()).isEqualTo(25);
        assertThat(jogar("PILOTO_FAVORITO/TENIS_DOS_SONHOS", zonas(null, "SOLA=" + BRANCO + "/ESPELHADO")).pontos()).isEqualTo(50);
        assertThat(jogar("FAVORITE_SINGER/ERA_ACUSTICA", zonas(null, "FRENTE=" + BRANCO)).pontos()).isZero();
        // peça incompleta nunca leva 3 estrelas, em nenhuma rodada
        for (String chave : JOGANDO_BEM.keySet()) {
            Map<String, Entrega.Zona> z = new LinkedHashMap<>(JOGANDO_BEM.get(chave).zonas());
            z.remove(z.keySet().iterator().next());
            Resultado r = jogar(chave, new Entrega(null, z, null, JOGANDO_BEM.get(chave).resposta()));
            assertThat(r.estrelas()).as(chave).isLessThan(3);
            assertThat(r.eventos()).as(chave).anyMatch(e -> e.codigo().equals("ZONAS_SEM_PINTAR"));
        }
    }

    @Test
    void acabamentoSemCorNaoContaComoZonaPintada() {
        Map<String, Entrega.Zona> z = new LinkedHashMap<>(JOGANDO_BEM.get("PILOTO_FAVORITO/EQUIPE_AURORA").zonas());
        z.put("VISEIRA", new Entrega.Zona(null, "ESPELHADO"));
        Resultado r = jogar("PILOTO_FAVORITO/EQUIPE_AURORA", new Entrega(null, z, null, null));
        assertThat(r.pontos()).isEqualTo(75);
        assertThat(r.eventos()).anyMatch(e -> e.codigo().equals("ZONAS_SEM_PINTAR"));
    }

    @Test
    void oEmblemaSoPontuaQuandoEhUmDosEmblemasPropriosEEhPedidoNasTresRodadas() {
        Entrega armadura = JOGANDO_BEM.get("SUPER_HEROI/ARMADURA");
        // antes: entregar sem emblema (ou com um código qualquer) dava os 25 da regra do emblema
        assertThat(jogar("SUPER_HEROI/ARMADURA", new Entrega(null, armadura.zonas(), null, null)).pontos()).isEqualTo(75);
        assertThat(jogar("SUPER_HEROI/ARMADURA", new Entrega(null, armadura.zonas(), null, "EMBLEMA_MORCEGO")).pontos()).isEqualTo(75);
        assertThat(jogar("SUPER_HEROI/ARMADURA", new Entrega(null, null, null, "EMBLEMA_RAIO")).pontos()).isEqualTo(25);
        Definicao d = new SuperHeroiNucleo().definicao();
        assertThat(d.rodadas()).allMatch(r -> r.opcoes().equals(SuperHeroiNucleo.OPCOES));
    }
}
