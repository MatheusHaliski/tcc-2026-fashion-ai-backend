import { notFound } from "next/navigation";
import SalasLab from "@/components/lab/salas-lab";

/** Laboratório das salas dos jogos FLAIR 3D: a sala sozinha, com os objetos GLB do motor Blender. Só em desenvolvimento. */
export default function SalasLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <SalasLab />;
}
