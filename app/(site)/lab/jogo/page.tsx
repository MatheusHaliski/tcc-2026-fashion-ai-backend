import { notFound } from "next/navigation";
import JogoLab from "@/components/lab/jogo-lab";

/** Laboratório da cena de jogo FLAIR 3D: a sala com a protagonista andando livre (WASD). Só em desenvolvimento. */
export default function JogoLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <JogoLab />;
}
