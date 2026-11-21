import { CollaboratorProfilePanel } from "../../../_components/collaborator-profile/collaborator-profile-panel";

export default async function OwnerCollaboratorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollaboratorProfilePanel collaboratorId={id} />;
}
