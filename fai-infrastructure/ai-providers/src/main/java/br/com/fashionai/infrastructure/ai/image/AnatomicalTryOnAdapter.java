package br.com.fashionai.infrastructure.ai.image;
import br.com.fashionai.application.ports.AnatomicalTryOnPort;
import br.com.fashionai.application.common.*;
import br.com.fashionai.infrastructure.platform.Http;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.util.*;
@Component
public class AnatomicalTryOnAdapter implements AnatomicalTryOnPort {
 private final String token;private final String url;private final RestClient client;
 public AnatomicalTryOnAdapter(@Value("${fashionai.vton.worker-url:${VTON_WORKER_URL:}}")String url,@Value("${fashionai.vton.worker-token:${VTON_WORKER_TOKEN:}}")String token,@Value("${fashionai.vton.worker-timeout-seconds:${VTON_WORKER_TIMEOUT_SECONDS:650}}")int timeout){if(timeout<75||timeout>650)throw new IllegalArgumentException("Invalid VTON timeout");this.url=url==null?"":url.trim();this.token=token==null?"":token.trim();this.client=this.url.isBlank()?null:Http.client(this.url,timeout);}
 public boolean available(){return client!=null&&!token.isBlank();}
 @SuppressWarnings("unchecked") private Map<String,Object> post(String path,Map<String,Object> body){
  return client.post().uri(path).header("Authorization","Bearer "+token).body(body).exchange((request,response)->{
   byte[] bytes=response.getBody().readNBytes(24_000_001);
   if(bytes.length>24_000_000)throw new ApiException(502,"VTON_RESPONSE_TOO_LARGE","Resposta do worker excedeu o limite.");
   if(response.getStatusCode().isError())throw new ApiException(response.getStatusCode().value()==422?422:503,"VTON_WORKER_REJECTED","O worker não conseguiu validar o encaixe anatômico. Nenhuma imagem foi substituída.");
   return Json.MAPPER.readValue(bytes,Map.class);
  });
 }
 public Map<String,Object> probePerson(byte[] person){
  if(!available())throw new ApiException(503,"VTON_NOT_CONFIGURED","Worker anatômico não configurado.");
  return post("/v1/body/pose",Map.of("person_image",Base64.getEncoder().encodeToString(person)));
 }
 public Map<String,Object> render(String id,byte[] garment,byte[] person,String category,Map<String,Object> evidence,boolean mirror){
  if(!available())throw new ApiException(503,"VTON_NOT_CONFIGURED","Worker anatômico não configurado.");
  post("/v1/catalog/"+id,Map.of("garment_image",Base64.getEncoder().encodeToString(garment)));
  var body=new LinkedHashMap<String,Object>();body.put("garment_id",id);body.put("person_image",Base64.getEncoder().encodeToString(person));body.put("mirror",mirror);if(category!=null)body.put("garment_category",category);if(evidence!=null&&!evidence.isEmpty())body.put("body_evidence",evidence);
  return post("/try-on",body);
 }
}
