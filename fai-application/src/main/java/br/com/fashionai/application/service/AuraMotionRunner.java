package br.com.fashionai.application.service;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
/** Polls a bounded batch. No GPU is provisioned by this scheduler. */
@Component
public class AuraMotionRunner {
 private final AuraMotionService service;
 public AuraMotionRunner(AuraMotionService service){this.service=service;}
 @org.springframework.context.annotation.Bean("auraMotionScheduler")
 public static org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler scheduler(){
  var scheduler=new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();scheduler.setPoolSize(1);scheduler.setThreadNamePrefix("aura-motion-");return scheduler;
 }
 @Scheduled(scheduler="auraMotionScheduler",fixedDelayString="${fashionai.aura.motion-poll-ms:10000}")
 public void poll(){for(var id:service.pending())service.process(id);}
}
