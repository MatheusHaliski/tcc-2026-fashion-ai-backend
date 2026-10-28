import { notFound } from "next/navigation";
import HeistGenteLab from "@/components/lab/heist-gente-lab";

/** Laboratório das pessoas do MET Gala Heist v2 (multidão, gestos, troca de roupa, queda, tiro). Só em desenvolvimento. */
export default function HeistGenteLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <HeistGenteLab />;
}
