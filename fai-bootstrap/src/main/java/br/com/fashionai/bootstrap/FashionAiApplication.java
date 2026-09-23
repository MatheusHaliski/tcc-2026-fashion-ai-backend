package br.com.fashionai.bootstrap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "br.com.fashionai")
public class FashionAiApplication {
    public static void main(String[] args) {
        SpringApplication.run(FashionAiApplication.class, args);
    }
}
