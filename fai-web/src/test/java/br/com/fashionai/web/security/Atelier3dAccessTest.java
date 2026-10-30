package br.com.fashionai.web.security;

import br.com.fashionai.application.atelier3d.Atelier3dService;
import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.web.atelier3d.Atelier3dController;
import br.com.fashionai.web.config.SecurityConfig;
import br.com.fashionai.web.error.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.*;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import java.util.UUID;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(Atelier3dController.class)
@Import({Atelier3dController.class,SecurityConfig.class,FashionAuthorization.class,AuditAccessDeniedHandler.class,AuditAuthenticationEntryPoint.class,ErrorWriter.class,GlobalExceptionHandler.class})
class Atelier3dAccessTest {
 @Autowired MockMvc mvc;
 String id=UUID.randomUUID().toString();
 @Test void ordinaryProjectsAndFilesRemainPrivate() throws Exception {
  for(String path:new String[]{"/api/atelier/projects/"+id+"/scene","/api/atelier/projects/"+id+"/scene/assets/"+id,"/api/atelier/guest/"+id+"/guests"})mvc.perform(get(path)).andExpect(status().isUnauthorized());
  mvc.perform(delete("/api/atelier/guest/"+id+"/assets/"+id)).andExpect(status().isUnauthorized());
 }
 @Test void exactGuestRouteStillRequiresCapabilityAndDoesNotCacheSource() throws Exception {
  String path="/api/atelier/guest/"+id+"/assets/"+id;
  mvc.perform(get(path).header("X-Atelier-Guest","wrong")).andExpect(status().isUnauthorized());
  mvc.perform(get(path).header("X-Atelier-Guest","valid-test-capability")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(header().string("X-Content-Type-Options","nosniff")).andExpect(content().contentType("model/gltf-binary"));
 }
 @SpringBootConfiguration @EnableAutoConfiguration
 static class TestApplication {
  @Bean Atelier3dService service(){return new Atelier3dService(null,null,null,null,null,null){
   @Override public byte[] guestContent(UUID invite,String token,UUID asset){if(!"valid-test-capability".equals(token))throw ApiException.unauthorized("Convite inválido");return new byte[]{1,2,3};}
  };}
  @Bean CatalogService catalog(){return new CatalogService(null,null,null,null,null,null,null,null,null,null);}
  @Bean AuditService auditService(){return event->{};}
  @Bean JwtDecoder decoder(){return token->{throw new UnsupportedOperationException();};}
 }
}
