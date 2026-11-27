import { notFound } from "next/navigation";
import DetetiveSalasLab from "@/components/lab/detetive-salas-lab";

/** Laboratório das nove salas do Fashion Detective (high poly e procedural lado a lado). Só em desenvolvimento. */
export default function DetetiveSalasLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <DetetiveSalasLab />;
}
