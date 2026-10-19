package br.com.fashionai.application.ports;
import java.util.Map;
/** Medidas do corpo na GPU (SAM 3D Body, worker privado): entra uma foto de corpo inteiro, voltam só proporções. */
public interface BodyMeasurementPort {
 boolean available();
 Map<String,Object> measureBody(byte[] person);
}
