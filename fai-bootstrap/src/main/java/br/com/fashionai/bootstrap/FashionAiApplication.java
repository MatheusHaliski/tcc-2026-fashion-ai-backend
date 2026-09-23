package br.com.fashionai.bootstrap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "br.com.fashionai")
@EnableScheduling
public class FashionAiApplication {
    public static void main(String[] args) {
        SpringApplication.run(FashionAiApplication.class, args);
    }
}
