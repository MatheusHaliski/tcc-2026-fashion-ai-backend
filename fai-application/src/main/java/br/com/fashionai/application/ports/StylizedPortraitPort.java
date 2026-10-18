package br.com.fashionai.application.ports;
import java.util.Map;
/** Retrato estilizado do Avatar na GPU (SDXL + InstantID, worker privado): entra a foto do rosto, volta o retrato e a semelhança medida. */
public interface StylizedPortraitPort {
 boolean available();
 Map<String,Object> stylizedPortrait(byte[] person,int seed);
}
