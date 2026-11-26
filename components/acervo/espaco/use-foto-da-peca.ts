"use client";
/** ACERVO — textura da foto de uma peça na cena 3D; null enquanto carrega, quando falha ou sem foto. */
import { useEffect, useState } from "react";
import type * as THREE from "three";
import { devolverFoto, pedirFoto } from "@/lib/acervo/cena/fotos";

export function useFotoDaPeca(url?: string | null): THREE.Texture | null {
  const [textura, setTextura] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    setTextura(null);
    if (!url) return;
    const pedido = pedirFoto(url);
    if (!pedido) return;
    let viva = true;
    void pedido.then((t) => {
      if (viva) setTextura(t);
    });
    return () => {
      viva = false;
      devolverFoto(url);
    };
  }, [url]);
  return textura;
}
