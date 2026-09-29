import { notFound } from "next/navigation";
import BodyLab from "@/components/avatar3d/body-lab";

/** Laboratório do corpo do Avatar 3D: mede fotos de teste e compara o manequim antigo com o novo. Só em desenvolvimento. */
export default function BodyLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <BodyLab />;
}
