package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.service.InstitutionalProfileEditCharacterizationTest.InstitutionalEditKit;
import br.com.fashionai.application.view.Views.ReferenceOptionView;
import br.com.fashionai.domain.model.AreaArtistica;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CategoriaMarca;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Exercícios 09 (categoria principal da marca) e 10 (área artística principal da celebridade): a opção vem de uma
 * tabela e é gravada como FK opcional no perfil da sessão. ID válido entra; omitido mantém; limpar remove; inexistente
 * e inativa são 400; a opção já gravada continua lida depois de desativada; o texto/lista legados não são convertidos.
 */
class InstitutionalReferenceChoiceTest {
    final InstitutionalEditKit kit = new InstitutionalEditKit();

    private CategoriaMarca categoria(String codigo, String nome, boolean ativo) {
        CategoriaMarca c = new CategoriaMarca();
        ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
        c.setCodigo(codigo);
        c.setNome(nome);
        c.setAtivo(ativo);
        when(kit.categorias.findById(c.getId())).thenReturn(Optional.of(c));
        return c;
    }

    private AreaArtistica area(String codigo, String nome, boolean ativo) {
        AreaArtistica a = new AreaArtistica();
        ReflectionTestUtils.setField(a, "id", UUID.randomUUID());
        a.setCodigo(codigo);
        a.setNome(nome);
        a.setAtivo(ativo);
        when(kit.areas.findById(a.getId())).thenReturn(Optional.of(a));
        return a;
    }

    private static Map<String, String> campos(String chave, String valor) {
        Map<String, String> fields = new HashMap<>();
        fields.put(chave, valor);
        return fields;
    }

    // ---------------------------------------------------------------- exercício 09

    @Test
    void marcaEscolheACategoriaEOCardDevolveCategoriaPrincipalSemConverterOTextoLegado() {
        User owner = kit.owner("maison", ProfileType.MARCA);
        BrandProfile brand = kit.brand(owner);
        brand.setFashionCategory("Prêt-à-porter");
        CategoriaMarca casual = categoria("CASUAL", "Casual", true);

        Map<String, Object> antes = kit.service.brandCard(brand);
        Map<String, Object> card = kit.service.updateBrand(kit.as(owner), campos("categoriaMarcaId", casual.getId().toString()));

        assertThat(antes).as("texto legado não vira categoria conhecida").containsEntry("category", "Prêt-à-porter")
                .containsEntry("categoriaPrincipal", null);
        assertThat(brand.getCategoriaMarca()).isSameAs(casual);
        assertThat(card).containsEntry("categoriaPrincipal", new ReferenceOptionView(casual.getId(), "CASUAL", "Casual"))
                .containsEntry("category", "Prêt-à-porter");
        assertThat(brand.getFashionCategory()).isEqualTo("Prêt-à-porter");
    }

    @Test
    void categoriaOmitidaMantemELimparExplicitoRemoveDosDoisJeitos() {
        User owner = kit.owner("maison", ProfileType.MARCA);
        BrandProfile brand = kit.brand(owner);
        CategoriaMarca luxo = categoria("LUXO", "Luxo", true);
        brand.setCategoriaMarca(luxo);

        kit.service.updateBrand(kit.as(owner), campos("bio", "Nova bio"));
        assertThat(brand.getCategoriaMarca()).as("PATCH sem o campo não mexe na categoria").isSameAs(luxo);

        assertThat(kit.service.updateBrand(kit.as(owner), campos("clearCategoriaMarca", "true"))).containsEntry("categoriaPrincipal", null);
        assertThat(brand.getCategoriaMarca()).isNull();

        brand.setCategoriaMarca(luxo);
        kit.service.updateBrand(kit.as(owner), campos("categoriaMarcaId", null));
        assertThat(brand.getCategoriaMarca()).as("chave presente com null também limpa").isNull();
    }

    @Test
    void categoriaInexistenteMalFormadaInativaOuComLimparEh400ENadaMuda() {
        User owner = kit.owner("maison", ProfileType.MARCA);
        BrandProfile brand = kit.brand(owner);
        CategoriaMarca atual = categoria("CASUAL", "Casual", true);
        brand.setCategoriaMarca(atual);
        CategoriaMarca inativa = categoria("PRAIA", "Moda praia", false);
        UUID nenhuma = UUID.randomUUID();
        when(kit.categorias.findById(nenhuma)).thenReturn(Optional.empty());
        Map<String, String> idComLimpar = campos("categoriaMarcaId", atual.getId().toString());
        idComLimpar.put("clearCategoriaMarca", "true");

        assertThat(erro(() -> kit.service.updateBrand(kit.as(owner), campos("categoriaMarcaId", nenhuma.toString()))))
                .satisfies(e -> assertThat(e.status()).isEqualTo(400)).satisfies(e -> assertThat(e.code()).isEqualTo("CATEGORIA_MARCA_INVALIDA"));
        assertThat(erro(() -> kit.service.updateBrand(kit.as(owner), campos("categoriaMarcaId", "casual"))).code()).isEqualTo("CATEGORIA_MARCA_INVALIDA");
        assertThat(erro(() -> kit.service.updateBrand(kit.as(owner), idComLimpar)).code()).isEqualTo("CATEGORIA_MARCA_INVALIDA");
        ApiException recusada = erro(() -> kit.service.updateBrand(kit.as(owner), campos("categoriaMarcaId", inativa.getId().toString())));
        assertThat(recusada.status()).isEqualTo(400);
        assertThat(recusada.code()).isEqualTo("CATEGORIA_MARCA_INATIVA");
        assertThat(recusada.details()).containsKey("categoriaMarcaId");
        assertThat(brand.getCategoriaMarca()).isSameAs(atual);
        verify(kit.brands, never()).save(any());
    }

    @Test
    void categoriaJaGravadaEDepoisDesativadaContinuaLidaEReenviarOMesmoIdNaoFalha() {
        User owner = kit.owner("maison", ProfileType.MARCA);
        BrandProfile brand = kit.brand(owner);
        CategoriaMarca antiga = categoria("ESPORTIVA", "Esportiva", false);
        brand.setCategoriaMarca(antiga);

        Map<String, Object> card = kit.service.updateBrand(kit.as(owner), campos("categoriaMarcaId", antiga.getId().toString()));

        assertThat(brand.getCategoriaMarca()).isSameAs(antiga);
        assertThat(card).containsEntry("categoriaPrincipal", new ReferenceOptionView(antiga.getId(), "ESPORTIVA", "Esportiva"));
        verify(kit.categorias, never()).findById(any());
    }

    @Test
    void aCategoriaVaiSempreParaAMarcaDaSessaoEQuemNaoEhMarcaRecebe403() {
        User dona = kit.owner("maison", ProfileType.MARCA);
        BrandProfile daDona = kit.brand(dona);
        User outra = kit.owner("outra-marca", ProfileType.MARCA);
        BrandProfile daOutra = new BrandProfile();
        daOutra.setOwner(outra);
        daOutra.setBrandName("Outra");
        daOutra.setSlug("outra");
        daOutra.setApprovalStatus(ApprovalStatus.APROVADO);
        when(kit.brands.findByOwnerId(outra.getId())).thenReturn(Optional.of(daOutra));
        User pessoa = kit.owner("ana", ProfileType.PESSOAL);
        CategoriaMarca casual = categoria("CASUAL", "Casual", true);
        Map<String, String> fields = campos("categoriaMarcaId", casual.getId().toString());
        fields.put("ownerUserId", dona.getId().toString());
        fields.put("slug", "maison");

        kit.service.updateBrand(kit.as(outra), fields);

        assertThat(daOutra.getCategoriaMarca()).isSameAs(casual);
        assertThat(daDona.getCategoriaMarca()).as("o corpo não escolhe outro perfil").isNull();
        assertThat(erro(() -> kit.service.updateBrand(kit.as(pessoa), fields)).status()).isEqualTo(403);
    }

    // ---------------------------------------------------------------- exercício 10

    @Test
    void celebridadeEscolheAAreaPrincipalSemMexerNaListaDeAreasNemNaVerificacao() {
        User owner = kit.owner("artist", ProfileType.CELEBRIDADE);
        CelebrityProfile celebrity = kit.celebrity(owner);
        celebrity.setAreasJson("[\"Cinema\",\"Música\",\"Teatro\"]");
        celebrity.setVerificationStatus(ApprovalStatus.PENDENTE);
        AreaArtistica musica = area("MUSICA", "Música", true);

        Map<String, Object> antes = kit.service.celebrityCard(celebrity);
        Map<String, Object> card = kit.service.updateCelebrity(kit.as(owner), Map.of("areaArtisticaId", musica.getId().toString()));

        assertThat(antes).as("a primeira área da lista antiga não vira principal sozinha").containsEntry("areaPrincipal", null);
        assertThat(celebrity.getAreaArtisticaPrincipal()).isSameAs(musica);
        assertThat(celebrity.getAreasJson()).isEqualTo("[\"Cinema\",\"Música\",\"Teatro\"]");
        assertThat(celebrity.getVerificationStatus()).as("área principal não concede verificação").isEqualTo(ApprovalStatus.PENDENTE);
        assertThat(card).containsEntry("areaPrincipal", new ReferenceOptionView(musica.getId(), "MUSICA", "Música"))
                .containsEntry("areas", List.of("Cinema", "Música", "Teatro")).containsEntry("status", "PENDENTE").containsEntry("verified", false);
    }

    @Test
    void areaOmitidaMantemLimparRemoveEAreaJaGravadaInativaContinua() {
        User owner = kit.owner("artist", ProfileType.CELEBRIDADE);
        CelebrityProfile celebrity = kit.celebrity(owner);
        AreaArtistica antiga = area("CINEMA", "Cinema", false);
        celebrity.setAreaArtisticaPrincipal(antiga);

        kit.service.updateCelebrity(kit.as(owner), Map.of("bio", "Atriz"));
        assertThat(celebrity.getAreaArtisticaPrincipal()).isSameAs(antiga);
        assertThat(kit.service.updateCelebrity(kit.as(owner), Map.of("areaArtisticaId", antiga.getId().toString())))
                .containsEntry("areaPrincipal", new ReferenceOptionView(antiga.getId(), "CINEMA", "Cinema"));
        verify(kit.areas, never()).findById(any());

        assertThat(kit.service.updateCelebrity(kit.as(owner), Map.of("clearAreaArtistica", true))).containsEntry("areaPrincipal", null);
        assertThat(celebrity.getAreaArtisticaPrincipal()).isNull();
    }

    @Test
    void areaInexistenteInativaOuComLimparEh400EPerfilAlheioNaoEhAlcancado() {
        User owner = kit.owner("artist", ProfileType.CELEBRIDADE);
        CelebrityProfile celebrity = kit.celebrity(owner);
        AreaArtistica inativa = area("MODA", "Moda", false);
        AreaArtistica ativa = area("MUSICA", "Música", true);
        UUID nenhuma = UUID.randomUUID();
        when(kit.areas.findById(nenhuma)).thenReturn(Optional.empty());
        User marca = kit.owner("maison", ProfileType.MARCA);

        assertThat(erro(() -> kit.service.updateCelebrity(kit.as(owner), Map.of("areaArtisticaId", nenhuma.toString()))))
                .satisfies(e -> assertThat(e.status()).isEqualTo(400)).satisfies(e -> assertThat(e.code()).isEqualTo("AREA_ARTISTICA_INVALIDA"));
        assertThat(erro(() -> kit.service.updateCelebrity(kit.as(owner), Map.of("areaArtisticaId", 42))).code()).isEqualTo("AREA_ARTISTICA_INVALIDA");
        assertThat(erro(() -> kit.service.updateCelebrity(kit.as(owner), Map.of("areaArtisticaId", ativa.getId().toString(), "clearAreaArtistica", true))).code())
                .isEqualTo("AREA_ARTISTICA_INVALIDA");
        ApiException recusada = erro(() -> kit.service.updateCelebrity(kit.as(owner), Map.of("areaArtisticaId", inativa.getId().toString())));
        assertThat(recusada.code()).isEqualTo("AREA_ARTISTICA_INATIVA");
        assertThat(recusada.details()).containsKey("areaArtisticaId");
        assertThat(celebrity.getAreaArtisticaPrincipal()).isNull();
        verify(kit.celebrities, never()).save(any());
        assertThat(erro(() -> kit.service.updateCelebrity(kit.as(marca), Map.of("areaArtisticaId", ativa.getId().toString(), "ownerUserId", owner.getId().toString()))).status())
                .isEqualTo(403);
        assertThat(celebrity.getAreaArtisticaPrincipal()).isNull();
    }

    private static ApiException erro(org.assertj.core.api.ThrowableAssert.ThrowingCallable chamada) {
        return catchThrowableOfType(chamada, ApiException.class);
    }
}
