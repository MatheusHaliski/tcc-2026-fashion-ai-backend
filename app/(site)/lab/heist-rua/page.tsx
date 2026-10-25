import { notFound } from "next/navigation";
import HeistRuaLab from "@/components/lab/heist-rua-lab";

/** Laboratório da cena externa do MET Gala Heist v2 (avenida, fachada, escadaria, beco). Só em desenvolvimento. */
export default function HeistRuaLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <HeistRuaLab />;
}
