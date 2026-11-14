package br.com.fashionai.application.acervo;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.domain.repository.acervo.AcervoAmbienteRepository;
import br.com.fashionai.domain.repository.acervo.AcervoCompartimentoRepository;
import br.com.fashionai.domain.repository.acervo.AcervoDesejoRepository;
import br.com.fashionai.domain.repository.acervo.AcervoMovelRepository;
import br.com.fashionai.domain.repository.acervo.AcervoPecaRepository;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.Mockito.mock;

/** Bancada dos testes do ACERVO: repositórios em memória, os quatro serviços e duas pessoas (Ana e Bia). */
final class AcervoKit {
    final AcervoAmbienteRepository ambientes = MemoryRepository.of(AcervoAmbienteRepository.class);
    final AcervoMovelRepository moveis = MemoryRepository.of(AcervoMovelRepository.class);
    final AcervoCompartimentoRepository compartimentos = MemoryRepository.of(AcervoCompartimentoRepository.class);
    final AcervoPecaRepository linhas = MemoryRepository.of(AcervoPecaRepository.class);
    final AcervoDesejoRepository desejosRepo = MemoryRepository.of(AcervoDesejoRepository.class);
    final WardrobeItemRepository pecasRepo = MemoryRepository.of(WardrobeItemRepository.class);
    final SchemeRepository looksRepo = MemoryRepository.of(SchemeRepository.class);
    final SchemeItemRepository itensRepo = MemoryRepository.of(SchemeItemRepository.class);
    final UserRepository users = MemoryRepository.of(UserRepository.class);
    final Clock clock = Clock.fixed(Instant.parse("2026-11-14T12:00:00Z"), ZoneOffset.UTC);
    final AcervoAcesso acesso = new AcervoAcesso(ambientes, moveis, compartimentos, linhas, pecasRepo, mock(Guard.class));
    final AcervoEstruturaService estrutura = new AcervoEstruturaService(ambientes, moveis, compartimentos, acesso,
            new AcervoCompartimentos(compartimentos, linhas, desejosRepo));
    final AcervoPecasService pecas = new AcervoPecasService(linhas, acesso, clock);
    final AcervoConsultaService consulta = new AcervoConsultaService(acesso, desejosRepo, itensRepo, clock);
    final AcervoDesejoService desejos = new AcervoDesejoService(desejosRepo, acesso);
    final User ana = pessoa("ana");
    final User bia = pessoa("bia");

    private User pessoa(String nome) {
        User u = new User(nome, nome, nome + "@x.invalid", "h", "p", ProfileType.PESSOAL);
        u.setStatus(AccountStatus.ACTIVE);
        return users.save(u);
    }

    static CurrentUser de(User u) {
        return CurrentUser.of(u, "127.0.0.1", "test");
    }

    WardrobeItem peca(User dona, String nome, String categoria, String sub, String cor, String tamanho, String preco) {
        WardrobeItem w = new WardrobeItem();
        w.setUser(dona);
        w.setName(nome);
        w.setCategory(categoria);
        w.setSubcategory(sub);
        w.setColor(cor);
        w.setSizeLabel(tamanho);
        w.setMaterial("cotton");
        w.setImageUrl("/media/" + nome + ".png");
        w.setPrice(preco == null ? null : new BigDecimal(preco));
        return pecasRepo.save(w);
    }

    WardrobeItem usada(WardrobeItem w, int vezes, LocalDate ultima) {
        w.setWearCount(vezes);
        w.setLastWornDate(ultima);
        return pecasRepo.save(w);
    }

    Scheme look(User dona, String titulo, WardrobeItem... itens) {
        Scheme s = new Scheme();
        s.setUser(dona);
        s.setTitle(titulo);
        looksRepo.save(s);
        int ordem = 0;
        for (WardrobeItem w : itens) {
            SchemeItem item = new SchemeItem();
            item.setScheme(s);
            item.setWardrobeItem(w);
            item.setSortOrder(ordem++);
            itensRepo.save(item);
        }
        return s;
    }

    /** Cria "Closet" com "Armário 01" (1 cabideiro, 2 prateleiras, 2 gavetas) e devolve o móvel como veio da API. */
    Map<String, Object> armario(User dona) {
        Map<String, Object> closet = estrutura.criarAmbiente(de(dona), new AcervoEstruturaService.NomeForm("Closet"));
        return estrutura.criarMovel(de(dona), (UUID) closet.get("id"), movel("Armário 01", null, null, null));
    }

    static AcervoEstruturaService.MovelForm movel(String nome, Integer cabideiros, Integer prateleiras, Integer gavetas) {
        return new AcervoEstruturaService.MovelForm(nome, null, null, null, null, null, null, null, null, null, cabideiros, prateleiras, gavetas);
    }

    /** Id do n-ésimo compartimento do tipo (a partir de 0) num móvel devolvido pela API. */
    @SuppressWarnings("unchecked")
    static UUID compartimento(Map<String, Object> movel, String tipo, int n) {
        List<Map<String, Object>> lista = (List<Map<String, Object>>) movel.get("compartimentos");
        return (UUID) lista.stream().filter(c -> c.get("tipo").equals(tipo)).toList().get(n).get("id");
    }
}
