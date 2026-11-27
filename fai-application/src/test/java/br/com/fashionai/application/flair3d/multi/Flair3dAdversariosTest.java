package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.flair.FlairDueloOponente;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SearchService;
import br.com.fashionai.domain.model.FlairProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountOrigin;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.repository.FlairProfileRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.flair3d.multi.Flair3dMultiKit.status;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Busca de adversários na rede FAI: relação (sigo, me segue, mútuos), bloqueio, a própria pessoa, conta de teste, menor
 * de 13, nível, país, ativa e deck para o jogo; conta privada aparece mas não pode ser convidada. E o duelo 2D pelo id.
 */
class Flair3dAdversariosTest {
    private Flair3dMultiKit m;
    private User anaU;
    private CurrentUser ana;
    private User bia;
    private User caio;
    private User duda;

    @BeforeEach
    void setUp() {
        m = new Flair3dMultiKit();
        anaU = m.pessoa("ana");
        ana = m.como(anaU);
        bia = m.pessoa("bia");
        caio = m.pessoa("caio");
        duda = m.pessoa("duda");
        m.segue(anaU, bia, FollowStatus.ACEITO);
        m.segue(bia, anaU, FollowStatus.ACEITO);
        m.segue(anaU, caio, FollowStatus.ACEITO);
        m.segue(duda, anaU, FollowStatus.ACEITO);
        SearchService search = m.kit.dep(SearchService.class);
        List<SearchService.PersonProfile> todos = List.of(perfil(anaU), perfil(bia), perfil(caio), perfil(duda));
        when(search.search(any(), anyString(), eq("PESSOAS"), any(), anyInt())).thenReturn(Map.of("results", todos));
    }

    private static SearchService.PersonProfile perfil(User u) {
        return new SearchService.PersonProfile(u.getId(), u.getUsername(), u.getDisplayName(), null, "PESSOAL", false, u.getCountry(), false, null,
                null, null, List.of(), "PUBLIC", true, "NENHUMA", Map.of());
    }

    @SuppressWarnings("unchecked")
    private List<String> nomes(Flair3dAdversarios.Filtros f) {
        return ((List<Map<String, Object>>) m.adversarios.buscar(ana, f).get("resultados")).stream().map(x -> (String) x.get("username")).toList();
    }

    private static Flair3dAdversarios.Filtros relacao(String r) {
        return new Flair3dAdversarios.Filtros(null, r, null, null, null, null, null, null, null);
    }

    @Test
    void filtraPorRelacaoENuncaDevolveASiMesma() {
        assertThat(nomes(relacao("TODOS"))).containsExactly("bia", "caio", "duda");
        assertThat(nomes(relacao("SIGO"))).containsExactlyInAnyOrder("bia", "caio");
        assertThat(nomes(relacao("ME_SEGUE"))).containsExactlyInAnyOrder("bia", "duda");
        assertThat(nomes(relacao("MUTUOS"))).containsExactly("bia");
        assertThat(nomes(new Flair3dAdversarios.Filtros("@CA", null, null, null, null, null, null, null, null))).containsExactly("caio");
    }

    @Test
    void bloqueioContaDeTesteEMenorDe13NaoAparecem() {
        m.segue(caio, anaU, FollowStatus.BLOQUEADO);
        duda.setAccountOrigin(AccountOrigin.TEST_SEED);
        bia.setBirthDate(java.time.LocalDate.now().minusYears(12).toString());
        assertThat(nomes(relacao("TODOS"))).isEmpty();
    }

    @Test
    void contaPrivadaApareceSemPoderSerConvidada() {
        caio.setPrivateAccount(true);
        User eva = m.pessoa("eva");
        eva.setPrivateAccount(true);
        when(m.kit.dep(SearchService.class).search(any(), anyString(), eq("PESSOAS"), any(), anyInt()))
                .thenReturn(Map.of("results", List.of(perfil(caio), perfil(eva))));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> r = (List<Map<String, Object>>) m.adversarios.buscar(ana, relacao(null)).get("resultados");
        assertThat(r).extracting(x -> x.get("username"), x -> x.get("convidavel"), x -> x.get("motivo"))
                .containsExactlyInAnyOrder(org.assertj.core.groups.Tuple.tuple("caio", true, null),
                        org.assertj.core.groups.Tuple.tuple("eva", false, "CONTA_PRIVADA"));
    }

    @Test
    void nivelPaisAtivaEDeckParaOJogo() {
        FlairProfile p = new FlairProfile();
        p.setUser(bia);
        p.setRankPoints(1600);
        m.kit.save(FlairProfileRepository.class, p);
        caio.setCountry("PT");
        duda.setLastLoginAt(Instant.now());
        m.carta(m.como(caio), "SUP");
        m.carta(m.como(caio), "INF");
        m.carta(m.como(caio), "CAL");
        assertThat(nomes(new Flair3dAdversarios.Filtros(null, null, "STYLE_MAVEN", null, null, null, null, null, null))).containsExactly("bia");
        assertThat(nomes(new Flair3dAdversarios.Filtros(null, null, null, null, "pt", null, null, null, null))).containsExactly("caio");
        assertThat(nomes(new Flair3dAdversarios.Filtros(null, null, null, null, null, null, true, null, null))).containsExactly("duda");
        assertThat(nomes(new Flair3dAdversarios.Filtros(null, null, null, null, null, null, null, "PASSARELA", true))).containsExactly("caio");
    }

    @Test
    void dueloDoFlair2dPeloIdDaBuscaComAApiAntigaCompativel() {
        FlairDueloOponente oponente = m.kit.build(FlairDueloOponente.class);
        assertThat(oponente.oponente(ana, null, "@paris_lea")).isEqualTo("@paris_lea");
        assertThat(oponente.oponente(ana, null, "CASA")).isEqualTo("CASA");
        assertThat(oponente.oponente(ana, bia.getId(), null)).isEqualTo("bia");
        assertThat(status(() -> oponente.oponente(ana, anaU.getId(), null))).isEqualTo(400);
        m.segue(caio, anaU, FollowStatus.BLOQUEADO);
        assertThat(status(() -> oponente.oponente(ana, caio.getId(), null))).isEqualTo(404);
        assertThat(m.kit.dep(UserRepository.class).findById(bia.getId())).isPresent();
    }
}
