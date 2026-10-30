package br.com.fashionai.application.atelier3d;

import br.com.fashionai.domain.model.AuditableEntity;
import br.com.fashionai.domain.model.atelier3d.*;
import br.com.fashionai.domain.repository.atelier3d.*;
import br.com.fashionai.domain.security.AesGcmStringConverter;
import org.hibernate.*;
import org.hibernate.cfg.Configuration;
import org.hibernate.type.Type;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class Atelier3dPersistenceTest {
 @Test void originalsAreEncryptedAndMetadataProjectionDoesNotNeedDecryption() throws Exception {
  var field=AesGcmStringConverter.class.getDeclaredField("cachedKey");field.setAccessible(true);Object previousCache=field.get(null);String previous=System.getProperty("DATA_ENCRYPTION_KEY");
  System.setProperty("DATA_ENCRYPTION_KEY",Base64.getEncoder().encodeToString(new byte[32]));field.set(null,null);
  try(var factory=new Configuration().addAnnotatedClass(DesignAsset.class).addAnnotatedClass(DesignSceneVersion.class).addAnnotatedClass(DesignGuestInvite.class)
    .setProperty("hibernate.connection.driver_class","org.h2.Driver").setProperty("hibernate.connection.url","jdbc:h2:mem:atelier3d;MODE=MySQL")
    .setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy")
    .setProperty("hibernate.type.preferred_uuid_jdbc_type","CHAR")
    .setInterceptor(new Interceptor(){@Override public boolean onPersist(Object entity,Object id,Object[] state,String[] names,Type[] types){
     if(!(entity instanceof AuditableEntity a))return false;a.markCreatedAt(Instant.now());for(int i=0;i<names.length;i++)if(names[i].equals("createdAt")||names[i].equals("updatedAt"))state[i]=Instant.now();return true;
    }}).buildSessionFactory();var em=factory.createEntityManager()){
   em.getTransaction().begin();UUID project=UUID.randomUUID();var a=new DesignAsset();a.setProjectId(project);a.setFilename("garment.glb");a.setSha256("a".repeat(64));a.setBytes(3);a.setInspectionJson("{}");a.setContentBase64("AAEC");em.persist(a);
   var version=new DesignSceneVersion();version.setProjectId(project);version.setAssetId(a.getId());version.setSequenceNumber(1);version.setAuthor("test");version.setRequestId("test-command");version.setDigest("b".repeat(64));version.setDocumentJson("{}");version.setGenderEvidenceJson("{}");em.persist(version);em.flush();em.clear();
   String stored=(String)em.createNativeQuery("select content_base64 from atelier_3d_assets where id=:id",String.class).setParameter("id",a.getId().toString()).getSingleResult();assertThat(stored).startsWith("enc:v1:").doesNotContain("AAEC");
   var repositories=new JpaRepositoryFactory(em);var assets=repositories.getRepository(DesignAssetRepository.class);assertThat(assets.findById(a.getId()).orElseThrow().getContentBase64()).isEqualTo("AAEC");
   em.clear();em.createNativeQuery("update atelier_3d_assets set content_base64='enc:v1:broken'",Integer.class).executeUpdate();
   assertThat(assets.findProjectedById(a.getId()).orElseThrow().getFilename()).isEqualTo("garment.glb");
   assertThat(repositories.getRepository(DesignSceneVersionRepository.class).findTop30ByProjectIdOrderBySequenceNumberDesc(project)).hasSize(1);
   em.getTransaction().rollback();
  }finally{if(previous==null)System.clearProperty("DATA_ENCRYPTION_KEY");else System.setProperty("DATA_ENCRYPTION_KEY",previous);field.set(null,previousCache);}
 }
}
