package br.com.fashionai.application.ports;
import java.util.Map;
/** Authenticated private worker must segment, verify the garment, animate and QA the clip. */
public interface AuraMotionPort {
 boolean available();
 String submit(String idempotencyKey,byte[] person,byte[] garment,String motionTemplate,Map<String,Object> context);
 Result poll(String providerJobId);
 void cancel(String providerJobId);
 record Result(String status,byte[] mp4,double durationSeconds,double fps,boolean personDetected,
               boolean garmentMatched,boolean temporalQualityPassed,String failureCode) {}
}
