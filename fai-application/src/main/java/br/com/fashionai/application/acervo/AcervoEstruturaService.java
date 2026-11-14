package br.com.fashionai.application.acervo;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.acervo.AcervoAmbiente;
import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import br.com.fashionai.domain.model.acervo.AcervoMovel;
import br.com.fashionai.domain.repository.acervo.AcervoAmbienteRepository;
import br.com.fashionai.domain.repository.acervo.AcervoCompartimentoRepository;
import br.com.fashionai.domain.repository.acervo.AcervoMovelRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * ACERVO — estrutura do guarda-roupa: criar, renomear, apagar e reordenar ambientes, móveis e compartimentos, e mudar
 * a configuração de um móvel. Apagar nunca apaga peça: o que estava dentro fica "sem lugar".
 */
@Service
@Transactional
public class AcervoEstruturaService {
    public record NomeForm(String nome) { }
    public record OrdemForm(List<UUID> ids) { }
    public record CompartimentoForm(String tipo, String nome) { }
    public record MovelForm(String nome, String modo, Integer larguraCm, Integer alturaCm, Integer profundidadeCm, String material,
                            String cor, String porta, String puxador, String puxadorAcabamento, Integer cabideiros,
                            Integer prateleiras, Integer gavetas) { }

    private final AcervoAmbienteRepository ambientes;
    private final AcervoMovelRepository moveis;
    private final AcervoCompartimentoRepository compartimentos;
    private final AcervoAcesso acesso;
    private final AcervoCompartimentos partes;

    public AcervoEstruturaService(AcervoAmbienteRepository ambientes, AcervoMovelRepository moveis,
                                  AcervoCompartimentoRepository compartimentos, AcervoAcesso acesso, AcervoCompartimentos partes) {
        this.ambientes = ambientes;
        this.moveis = moveis;
        this.compartimentos = compartimentos;
        this.acesso = acesso;
        this.partes = partes;
    }

    public Map<String, Object> criarAmbiente(CurrentUser user, NomeForm form) {
        acesso.exigir(user);
        long atuais = ambientes.countByUserId(user.id());
        AcervoRegras.limite(atuais, AcervoRegras.MAX_AMBIENTES, "ACERVO_LIMITE_AMBIENTES", "acervo.erro.limite_ambientes");
        AcervoAmbiente a = new AcervoAmbiente();
        a.setUserId(user.id());
        a.setNome(AcervoRegras.nome(form == null ? null : form.nome(), 80));
        a.setOrdem((int) atuais);
        ambientes.saveAndFlush(a);
        return AcervoViews.ambiente(a, List.of(), 0);
    }

    public Map<String, Object> renomearAmbiente(CurrentUser user, UUID id, NomeForm form) {
        AcervoAmbiente a = acesso.ambiente(user, id);
        a.setNome(AcervoRegras.nome(form == null ? null : form.nome(), 80));
        ambientes.save(a);
        return Map.of("id", a.getId(), "nome", a.getNome());
    }

    public void apagarAmbiente(CurrentUser user, UUID id) {
        AcervoAmbiente a = acesso.ambiente(user, id);
        for (AcervoMovel m : moveis.findByAmbienteIdOrderByOrdem(a.getId())) {
            apagar(m);
        }
        ambientes.delete(a);
    }

    public void ordenarAmbientes(CurrentUser user, OrdemForm form) {
        acesso.exigir(user);
        List<AcervoAmbiente> atuais = ambientes.findByUserIdOrderByOrdem(user.id());
        List<UUID> ids = ordemValida(form, atuais.stream().map(AcervoAmbiente::getId).toList());
        for (AcervoAmbiente a : atuais) {
            a.setOrdem(ids.indexOf(a.getId()));
            ambientes.save(a);
        }
    }

    public Map<String, Object> criarMovel(CurrentUser user, UUID ambienteId, MovelForm form) {
        AcervoAmbiente a = acesso.ambiente(user, ambienteId);
        if (form == null) {
            throw ApiException.badRequest("ACERVO_NOME", Msg.t("acervo.erro.nome"));
        }
        long atuais = moveis.countByAmbienteId(a.getId());
        AcervoRegras.limite(atuais, AcervoRegras.MAX_MOVEIS_POR_AMBIENTE, "ACERVO_LIMITE_MOVEIS", "acervo.erro.limite_moveis");
        AcervoMovel m = new AcervoMovel();
        m.setUserId(user.id());
        m.setAmbienteId(a.getId());
        m.setOrdem((int) atuais);
        m.setNome(AcervoRegras.nome(form.nome(), 80));
        m.setModo(AcervoRegras.opcao("modo", form.modo(), AcervoRegras.MODOS, AcervoMovel.MEU_ESPACO));
        m.setLarguraCm(AcervoRegras.medida("larguraCm", form.larguraCm(), AcervoRegras.LARGURA, 120));
        m.setAlturaCm(AcervoRegras.medida("alturaCm", form.alturaCm(), AcervoRegras.ALTURA, 220));
        m.setProfundidadeCm(AcervoRegras.medida("profundidadeCm", form.profundidadeCm(), AcervoRegras.PROFUNDIDADE, 60));
        m.setMaterial(AcervoRegras.opcao("material", form.material(), AcervoRegras.MATERIAIS, "MADEIRA"));
        m.setCor(AcervoRegras.opcao("cor", form.cor(), AcervoRegras.CORES, "NOGUEIRA"));
        m.setPorta(AcervoRegras.opcao("porta", form.porta(), AcervoRegras.PORTAS, "SEM_PORTA"));
        m.setPuxador(AcervoRegras.opcao("puxador", form.puxador(), AcervoRegras.PUXADORES, "BARRA"));
        m.setPuxadorAcabamento(AcervoRegras.opcao("puxadorAcabamento", form.puxadorAcabamento(), AcervoRegras.ACABAMENTOS, "LATAO"));
        moveis.saveAndFlush(m);
        partes.ajustar(m, AcervoCompartimento.CABIDEIRO, AcervoRegras.quantidade("cabideiros", form.cabideiros(), 1));
        partes.ajustar(m, AcervoCompartimento.PRATELEIRA, AcervoRegras.quantidade("prateleiras", form.prateleiras(), 2));
        partes.ajustar(m, AcervoCompartimento.GAVETA, AcervoRegras.quantidade("gavetas", form.gavetas(), 2));
        return movelView(m);
    }

    /** Muda o nome e a configuração; campo nulo fica como está. Reduzir a quantidade só tira compartimentos vazios. */
    public Map<String, Object> atualizarMovel(CurrentUser user, UUID id, MovelForm form) {
        AcervoMovel m = acesso.movel(user, id);
        if (form == null) {
            return movelView(m);
        }
        if (form.nome() != null) {
            m.setNome(AcervoRegras.nome(form.nome(), 80));
        }
        m.setModo(AcervoRegras.opcao("modo", form.modo(), AcervoRegras.MODOS, m.getModo()));
        m.setLarguraCm(AcervoRegras.medida("larguraCm", form.larguraCm(), AcervoRegras.LARGURA, m.getLarguraCm()));
        m.setAlturaCm(AcervoRegras.medida("alturaCm", form.alturaCm(), AcervoRegras.ALTURA, m.getAlturaCm()));
        m.setProfundidadeCm(AcervoRegras.medida("profundidadeCm", form.profundidadeCm(), AcervoRegras.PROFUNDIDADE, m.getProfundidadeCm()));
        m.setMaterial(AcervoRegras.opcao("material", form.material(), AcervoRegras.MATERIAIS, m.getMaterial()));
        m.setCor(AcervoRegras.opcao("cor", form.cor(), AcervoRegras.CORES, m.getCor()));
        m.setPorta(AcervoRegras.opcao("porta", form.porta(), AcervoRegras.PORTAS, m.getPorta()));
        m.setPuxador(AcervoRegras.opcao("puxador", form.puxador(), AcervoRegras.PUXADORES, m.getPuxador()));
        m.setPuxadorAcabamento(AcervoRegras.opcao("puxadorAcabamento", form.puxadorAcabamento(), AcervoRegras.ACABAMENTOS, m.getPuxadorAcabamento()));
        moveis.save(m);
        if (form.cabideiros() != null) {
            partes.ajustar(m, AcervoCompartimento.CABIDEIRO, AcervoRegras.quantidade("cabideiros", form.cabideiros(), 0));
        }
        if (form.prateleiras() != null) {
            partes.ajustar(m, AcervoCompartimento.PRATELEIRA, AcervoRegras.quantidade("prateleiras", form.prateleiras(), 0));
        }
        if (form.gavetas() != null) {
            partes.ajustar(m, AcervoCompartimento.GAVETA, AcervoRegras.quantidade("gavetas", form.gavetas(), 0));
        }
        return movelView(m);
    }

    public void apagarMovel(CurrentUser user, UUID id) {
        apagar(acesso.movel(user, id));
    }

    public void ordenarMoveis(CurrentUser user, UUID ambienteId, OrdemForm form) {
        AcervoAmbiente a = acesso.ambiente(user, ambienteId);
        List<AcervoMovel> atuais = moveis.findByAmbienteIdOrderByOrdem(a.getId());
        List<UUID> ids = ordemValida(form, atuais.stream().map(AcervoMovel::getId).toList());
        for (AcervoMovel m : atuais) {
            m.setOrdem(ids.indexOf(m.getId()));
            moveis.save(m);
        }
    }

    public Map<String, Object> criarCompartimento(CurrentUser user, UUID movelId, CompartimentoForm form) {
        AcervoMovel m = acesso.movel(user, movelId);
        String tipo = AcervoRegras.tipo(form == null ? null : form.tipo());
        AcervoCompartimento c = partes.criar(m, tipo, AcervoRegras.opcional(form.nome(), 80));
        return AcervoViews.compartimento(c, 0);
    }

    public Map<String, Object> renomearCompartimento(CurrentUser user, UUID id, NomeForm form) {
        AcervoCompartimento c = acesso.compartimento(user, id);
        c.setNome(AcervoRegras.nome(form == null ? null : form.nome(), 80));
        compartimentos.save(c);
        return Map.of("id", c.getId(), "nome", c.getNome());
    }

    public void apagarCompartimento(CurrentUser user, UUID id) {
        partes.apagar(acesso.compartimento(user, id));
    }

    public void ordenarCompartimentos(CurrentUser user, UUID movelId, OrdemForm form) {
        AcervoMovel m = acesso.movel(user, movelId);
        List<AcervoCompartimento> atuais = compartimentos.findByMovelIdOrderByOrdem(m.getId());
        List<UUID> ids = ordemValida(form, atuais.stream().map(AcervoCompartimento::getId).toList());
        for (AcervoCompartimento c : atuais) {
            c.setOrdem(ids.indexOf(c.getId()));
            compartimentos.save(c);
        }
    }

    private void apagar(AcervoMovel m) {
        for (AcervoCompartimento c : compartimentos.findByMovelIdOrderByOrdem(m.getId())) {
            partes.apagar(c);
        }
        moveis.delete(m);
    }

    private Map<String, Object> movelView(AcervoMovel m) {
        List<Map<String, Object>> lista = compartimentos.findByMovelIdOrderByOrdem(m.getId()).stream()
                .map(c -> AcervoViews.compartimento(c, partes.pecasEm(c)))
                .toList();
        long pecas = lista.stream().mapToLong(c -> (long) c.get("pecas")).sum();
        return AcervoViews.movel(m, lista, pecas);
    }

    /** A nova ordem tem de citar exatamente os itens que existem, cada um uma vez. */
    private static List<UUID> ordemValida(OrdemForm form, List<UUID> atuais) {
        List<UUID> ids = form == null || form.ids() == null ? List.of() : form.ids();
        if (ids.size() != atuais.size() || !ids.containsAll(atuais) || ids.stream().distinct().count() != ids.size()) {
            throw ApiException.badRequest("ACERVO_ORDEM", Msg.t("acervo.erro.ordem"));
        }
        return ids;
    }
}
