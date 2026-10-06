import { notFound } from "next/navigation";
import ScenesLab from "@/components/lab/scenes-lab";

/** Laboratório das cenas 3D de loja (provador, mini lojas, mini palco) com dados de exemplo. Só em desenvolvimento. */
export default function ScenesLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <ScenesLab />;
}
