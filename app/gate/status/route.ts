import { NextResponse, type NextRequest } from "next/server";
import { GATE_GOOGLE_COOKIE, gateConfig, verifyValue } from "@/lib/gate/token";

/** O que a tela do gate precisa saber: qual é o 1º fator e se ele já foi concluído (sem revelar configuração). */
export async function GET(req: NextRequest) {
  const cfg = await gateConfig();
  const email = cfg.google ? await verifyValue("g1", req.cookies.get(GATE_GOOGLE_COOKIE)?.value, cfg.secret) : null;
  return NextResponse.json({ mode: cfg.google ? "google" : "user", googleDone: !!email, email }, { headers: { "Cache-Control": "no-store" } });
}
