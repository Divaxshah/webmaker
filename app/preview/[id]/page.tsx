import type { Metadata } from "next";
import { retrievePreview } from "@/lib/preview-store";
import type { GeneratedProject } from "@/lib/types";
import { PreviewEmbed } from "@/components/preview/PreviewEmbed";
import { ClientPreviewFallback } from "@/components/preview/ClientPreviewFallback";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const project = (await retrievePreview(id)) as GeneratedProject | null;
    const title = project?.title ?? "Webmaker Preview";
    return {
      title,
      description: project?.summary ?? "A shared Webmaker project preview.",
    };
  } catch {
    return { title: "Webmaker Preview", description: "A shared Webmaker project preview." };
  }
}

export default async function PreviewPage({ params }: Props) {
  let id: string;
  let project: GeneratedProject | null;

  try {
    const resolved = await params;
    id = resolved.id;
    project = (await retrievePreview(id)) as GeneratedProject | null;
  } catch {
    return (
      <ClientPreviewFallback id="" />
    );
  }

  if (!project || !project.files || typeof project.title !== "string") {
    return <ClientPreviewFallback id={id} />;
  }

  return <PreviewEmbed project={project} />;
}
