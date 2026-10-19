package br.com.fashionai.application.ports;
import java.util.Map;
/** Private numerical worker; no implicit fallback to a certified anatomical result. */
public interface AnatomicalTryOnPort {
 boolean available();
 Map<String,Object> probePerson(byte[] person);
 Map<String,Object> render(String garmentId,byte[] garment,byte[] person,String category,Map<String,Object> bodyEvidence,boolean mirror);
}
