import { notFound } from "next/navigation";
import HumanLab from "@/components/avatar3d/human-lab";

/** Laboratório do corpo humano do Avatar 3D (esqueleto, pose, rosto, cabelo, roupas). Só em desenvolvimento. */
export default function HumanLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <HumanLab />;
}
