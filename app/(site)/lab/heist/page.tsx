import { notFound } from "next/navigation";
import HeistLab from "@/components/lab/heist-lab";

/** Laboratório do MET Gala Heist v2 jogável (deck de exemplo, ?debug=planta, ?at=salao|cofre…, ?q=low). Só em desenvolvimento. */
export default function HeistLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <HeistLab />;
}
