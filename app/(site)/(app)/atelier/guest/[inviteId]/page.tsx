import { GuestEditor } from "@/components/atelier3d/guest-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ inviteId: string }>;
}) {
  const { inviteId } = await params;
  return <GuestEditor inviteId={inviteId} />;
}
