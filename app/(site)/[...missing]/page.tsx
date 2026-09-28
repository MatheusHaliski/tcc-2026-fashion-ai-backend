import { notFound } from "next/navigation";

/**
 * Qualquer endereço sem rota cai aqui e mostra o 404 do app (app/(site)/not-found.tsx) dentro do layout do app, que é
 * renderizado por requisição. O 404 automático do Next é estático (gerado no build) e sairia sem o nonce da CSP: o
 * navegador bloquearia os scripts e a página ficaria em branco.
 */
export default function Missing() {
  notFound();
}
