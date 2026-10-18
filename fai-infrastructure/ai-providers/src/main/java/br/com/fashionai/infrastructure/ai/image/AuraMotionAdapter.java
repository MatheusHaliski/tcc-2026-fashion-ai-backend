package br.com.fashionai.infrastructure.ai.image;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.ports.AuraMotionPort;
import br.com.fashionai.infrastructure.platform.Http;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.util.*;
@Component
public class AuraMotionAdapter implements AuraMotionPort {
 private final String token; private final RestClient client;
 public AuraMotionAdapter(@Value("${fashionai.aura.motion-worker-url:${AURA_MOTION_WORKER_URL:}}") String url,
   @Value("${fashionai.aura.motion-worker-token:${AURA_MOTION_WORKER_TOKEN:}}") String token) {
  this.token=token==null?"":token.trim(); this.client=url==null||url.isBlank()?null:Http.client(url.trim(),30);
 }
 public boolean available(){return client!=null&&!token.isBlank();}
 @SuppressWarnings("unchecked") private Map<String,Object> exchange(String path,Map<String,Object> body){
  if(!available())throw new ApiException(503,"AURA_MOTION_NOT_CONFIGURED",Msg.t("auraMotion.notConfigured"));
  try{return client.post().uri(path).header("Authorization","Bearer "+token).body(body).exchange((req,res)->{
   if(res.getStatusCode().isError())throw new ApiException(503,"AURA_MOTION_WORKER_UNAVAILABLE",Msg.t("auraMotion.workerUnavailable"));
   byte[] bytes=res.getBody().readNBytes(20_000_001);
   if(bytes.length>20_000_000)throw new IllegalArgumentException("AURA_MOTION_RESPONSE_LIMIT");
   return Json.MAPPER.readValue(bytes,Map.class);
  });}catch(org.springframework.web.client.RestClientException error){throw new ApiException(503,"AURA_MOTION_WORKER_UNAVAILABLE",Msg.t("auraMotion.workerUnavailable"));}
 }
 public String submit(String key,byte[] person,byte[] garment,String template,Map<String,Object> context){
  var result=exchange("/v1/impersonation/jobs",Map.of("idempotencyKey",key,"personImage",Base64.getEncoder().encodeToString(person),
   "garmentImage",Base64.getEncoder().encodeToString(garment),"motionTemplateId",template,"context",context,"durationSeconds",5,"fps",24));
  Object id=result.get("jobId");if(!(id instanceof String value)||!value.matches("[A-Za-z0-9_:-]{1,200}"))throw new IllegalArgumentException("INVALID_PROVIDER_JOB");
  return (String)id;
 }
 public Result poll(String id){
  var result=exchange("/v1/impersonation/jobs/status",Map.of("jobId",id));String status=String.valueOf(result.get("status"));
  if(!Set.of("QUEUED","PROCESSING","READY","FAILED").contains(status))throw new IllegalArgumentException("INVALID_MOTION_STATUS");
  byte[] clip=null;if("READY".equals(status)){
   Object encoded=result.get("mp4Base64");if(!(encoded instanceof String s)||s.length()>19_000_000)throw new IllegalArgumentException("INVALID_VIDEO");
   clip=Base64.getDecoder().decode((String)encoded);
  }
  return new Result(status,clip,number(result.get("durationSeconds")),number(result.get("fps")),Boolean.TRUE.equals(result.get("personDetected")),
   Boolean.TRUE.equals(result.get("garmentMatched")),Boolean.TRUE.equals(result.get("temporalQualityPassed")),"AURA_MOTION_PROCESSING_FAILED");
 }
 public void cancel(String id){var result=exchange("/v1/impersonation/jobs/cancel",Map.of("jobId",id));if(!"CANCELLED".equals(result.get("status")))throw new IllegalArgumentException("CANCEL_NOT_CONFIRMED");}
 private static double number(Object value){return value instanceof Number n?n.doubleValue():0;}
}
