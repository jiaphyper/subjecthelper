import GroupView from "@/components/GroupView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupView id={Number(id)} />;
}
