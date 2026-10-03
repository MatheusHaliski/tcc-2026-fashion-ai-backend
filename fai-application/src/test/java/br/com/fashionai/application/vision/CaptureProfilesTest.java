package br.com.fashionai.application.vision;

import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.vision.capture.CaptureProfile;
import br.com.fashionai.application.vision.capture.CaptureProfiles;
import br.com.fashionai.application.vision.spec.PhotographySpecs;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CaptureProfilesTest {
    @Test
    void todaSubcategoriaDaTaxonomiaTemPerfil() {
        Taxonomy.SUBCATEGORIES.values().forEach(subs -> subs.forEach(s ->
                assertThat(CaptureProfiles.covers(s)).as("perfil para %s", s).isTrue()));
    }

    @Test
    void todaSpecReferenciadaExisteEPrincipalTemSpec() {
        for (CaptureProfile p : CaptureProfiles.all()) {
            p.specs().values().forEach(id -> assertThat(PhotographySpecs.find(id)).as("%s → %s", p.id(), id).isPresent());
            assertThat(PhotographySpecs.find(CaptureProfiles.specFor(p, p.primaryView()))).isPresent();
            p.secondaryViews().forEach(sv -> assertThat(PhotographySpecs.find(CaptureProfiles.specFor(p, sv.view()))).isPresent());
        }
    }

    @Test
    void semSubcategoriaCaiNoPerfilDaCategoriaOuGenerico() {
        assertThat(CaptureProfiles.resolve("lower_piece", null).id()).isEqualTo("PANTS");
        assertThat(CaptureProfiles.resolve(null, null).id()).isEqualTo(CaptureProfiles.GENERIC);
        assertThat(CaptureProfiles.resolve("shoes_piece", "heels").id()).isEqualTo("HEEL");
    }
}
