package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.AcaoDestravada;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Atributo;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.PerfilDaPeca;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.PerfilDoLook;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class Flair3dRecursoTabelaTest {
    /** Os casos de referência, compartilhados com o teste do front (lib/flair/recursos). */
    private static final Path GOLDEN = Path.of("..", "docs", "flair", "flair-3d", "fixtures", "peca-recurso-golden.json");

    private static CbcRules.Card carta(String vaga, String tier, int ovr, String sub, Set<String> materiais, Set<String> cores) {
        return new CbcRules.Card(UUID.nameUUIDFromBytes((vaga + sub).getBytes()), vaga, tier, ovr, null, "SEED", Set.of(), cores,
                Set.of(), materiais, Map.of(), null, null, null, sub);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> casos() throws Exception {
        return Json.list(Files.readString(GOLDEN));
    }

    @Test
    @SuppressWarnings("unchecked")
    void cadaPecaDosCasosDeReferenciaDaExatamenteOPerfilEsperado() throws Exception {
        List<Map<String, Object>> casos = casos();
        assertThat(casos).hasSizeGreaterThanOrEqualTo(5);
        for (Map<String, Object> caso : casos) {
            CbcRules.Card c = carta((String) caso.get("vaga"), (String) caso.get("tier"), ((Number) caso.get("ovr")).intValue(),
                    (String) caso.get("sub"), Set.copyOf((List<String>) caso.get("materials")), Set.copyOf((List<String>) caso.get("colors")));
            PerfilDaPeca p = Flair3dRecursoCalculo.daCarta(c, (String) caso.get("vaga"));
            Map<String, Object> e = (Map<String, Object>) caso.get("esperado");
            Map<String, Integer> atributos = new LinkedHashMap<>();
            ((Map<String, Object>) e.get("atributos")).forEach((k, v) -> atributos.put(k, ((Number) v).intValue()));
            String nome = (String) caso.get("nome");
            assertThat(p.atributos().entrySet().stream().collect(Collectors.toMap(x -> x.getKey().name(), Map.Entry::getValue)))
                    .as(nome).isEqualTo(atributos);
            assertThat(p.recurso().name()).as(nome).isEqualTo(e.get("recurso"));
            assertThat(p.quantidade()).as(nome).isEqualTo(((Number) e.get("quantidade")).intValue());
            assertThat(p.usos()).as(nome).isEqualTo(((Number) e.get("usos")).intValue());
            assertThat(p.acoes().stream().map(Enum::name).collect(Collectors.toSet())).as(nome).isEqualTo(Set.copyOf((List<String>) e.get("acoes")));
            assertThat(p.dominante() == null ? null : p.dominante().name()).as(nome).isEqualTo(e.get("dominante"));
        }
    }

    @Test
    void aOrdemDasEtiquetasNaoMudaOPerfil() {
        Set<String> materiais = new LinkedHashSet<>(List.of("denim", "cotton", "satin"));
        Set<String> cores = new LinkedHashSet<>(List.of("black", "red", "white"));
        Set<String> invertidos = new LinkedHashSet<>(new ArrayList<>(materiais).reversed());
        Set<String> coresInvertidas = new LinkedHashSet<>(new ArrayList<>(cores).reversed());
        PerfilDaPeca a = Flair3dRecursoCalculo.daCarta(carta("INF", "PRATA", 70, "jeans", materiais, cores), "INF");
        PerfilDaPeca b = Flair3dRecursoCalculo.daCarta(carta("INF", "PRATA", 70, "jeans", invertidos, coresInvertidas), "INF");
        assertThat(a).isEqualTo(b);
        // os atributos saem na ordem do enum, qualquer que seja a ordem das etiquetas
        assertThat(List.copyOf(a.atributos().keySet())).isEqualTo(new TreeSet<>(a.atributos().keySet()).stream().toList());
    }

    @Test
    void deltasFicamEntreMenos50E50EOFatorDoOvrEmDezPorCento() {
        CbcRules.Card exagerada = carta("CAL", "ESPECIAL", 99, "running_shoes", Set.of("mesh", "satin", "nylon"), Set.of("blue", "green"));
        PerfilDaPeca p = Flair3dRecursoCalculo.daCarta(exagerada, "CAL");
        p.atributos().values().forEach(d -> assertThat(d).isBetween(-PecaRecurso.DELTA_MAXIMO, PecaRecurso.DELTA_MAXIMO));
        assertThat(p.delta(Atributo.AGILIDADE)).isEqualTo(PecaRecurso.DELTA_MAXIMO);
        assertThat(Flair3dRecursoTabela.fatorDoOvr(0)).isEqualTo(0.9);
        assertThat(Flair3dRecursoTabela.fatorDoOvr(200)).isEqualTo(1.1);
    }

    @Test
    void noEmpateODominanteEOPrimeiroDoEnumESemAtributoNaoHaDominante() {
        // CAL dá AGILIDADE +10 e o preto, FURTIVIDADE +10: empate, vale AGILIDADE (primeiro do enum)
        PerfilDaPeca empate = Flair3dRecursoCalculo.daCarta(carta("CAL", "BRONZE", 70, "loafers", Set.of(), Set.of("black")), "CAL");
        assertThat(empate.delta(Atributo.AGILIDADE)).isEqualTo(empate.delta(Atributo.FURTIVIDADE));
        assertThat(empate.dominante()).isEqualTo(Atributo.AGILIDADE);
        PerfilDaPeca neutra = Flair3dRecursoCalculo.daCarta(carta("ACE", "BRONZE", 70, "scarf", Set.of("sequin"), Set.of()), "ACE");
        assertThat(neutra.atributos()).doesNotContainKey(Atributo.AGILIDADE);
        assertThat(neutra.dominante()).isEqualTo(Atributo.FURTIVIDADE);
    }

    @Test
    void oLookEONeutroMaisAMediaDasPecasEJuntaAsAcoes() {
        Map<String, CbcRules.Card> look = new LinkedHashMap<>();
        look.put("CAL", carta("CAL", "BRONZE", 92, "running_shoes", Set.of("mesh"), Set.of("black")));
        look.put("ACE", carta("ACE", "BRONZE", 60, "sunglasses", Set.of(), Set.of()));
        look.put("INF", null);
        PerfilDoLook p = Flair3dRecursoCalculo.doLook(look);
        assertThat(p.acoes()).containsExactlyInAnyOrder(AcaoDestravada.CORRER, AcaoDestravada.ESCONDER);
        assertThat(p.valor(Atributo.AGILIDADE)).isEqualTo(PecaRecurso.NEUTRO + 20);
        assertThat(p.valor(Atributo.CARISMA)).isEqualTo(PecaRecurso.NEUTRO);
        assertThat(Flair3dRecursoCalculo.doLook(Map.of()).valor(Atributo.FORCA)).isEqualTo(PecaRecurso.NEUTRO);
        p.atributos().values().forEach(v -> assertThat(v).isBetween(0, 100));
    }
}
