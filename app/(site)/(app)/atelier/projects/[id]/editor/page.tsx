import { RequireAuth } from "@/components/app-shell";
import { Atelier3dEditor } from "@/components/atelier3d/editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireAuth>
      <Atelier3dEditor projectId={id} />
    </RequireAuth>
  );
}
