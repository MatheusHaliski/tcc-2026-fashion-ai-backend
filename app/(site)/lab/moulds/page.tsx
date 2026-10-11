import { notFound } from "next/navigation";
import MouldsLab from "@/components/lab/moulds-lab";
export default function MouldsPage() {
  if (process.env.NODE_ENV === "production" && process.env.AVATAR_LAB !== "true") notFound();
  return <MouldsLab />;
}
