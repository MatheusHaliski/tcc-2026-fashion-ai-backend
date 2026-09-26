import { notFound } from "next/navigation";
import AvatarLab from "@/components/avatar3d/lab";

/** Laboratório do Avatar 3D (RF40): valida o pipeline com fotos de teste autorizadas. Só em desenvolvimento. */
export default function AvatarLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <AvatarLab />;
}
