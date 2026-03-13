import type { Metadata } from "next";
import { retrievePreview } from "@/lib/preview-store";
import type { GeneratedProject } from "@/lib/types";
import { PreviewEmbed } from "@/components/preview/PreviewEmbed";
import { ClientPreviewFallback } from "@/components/preview/ClientPreviewFallback";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = (await retrievePreview(id)) as GeneratedProject | null;
  const title = project?.title ?? "Webmaker Preview";
  return {
    title,
    description: project?.summary ?? "A shared Webmaker project preview.",
  };
}

export default async function PreviewPage({ params }: Props) {
  const { id } = await params;
  const project = (await retrievePreview(id)) as GeneratedProject | null;

  if (!project) {
    return <ClientPreviewFallback id={id} />;
  }

  return <PreviewEmbed project={project} />;
}
