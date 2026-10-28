import { notFound } from "next/navigation";
import HeistSalasLab from "@/components/lab/heist-salas-lab";

/** Laboratório do interior do MET Gala Heist v2 (salão, galeria, lounge, bastidores, labirinto, Sala das Joias…). Só em desenvolvimento. */
export default function HeistSalasLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <HeistSalasLab />;
}
