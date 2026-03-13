import type { Metadata } from "next";
import { retrievePreview } from "@/lib/preview-store";
import type { GeneratedProject } from "@/lib/types";
import { PreviewEmbed } from "@/components/preview/PreviewEmbed";

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
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="text-center">
          <p className="text-4xl font-bold text-zinc-200 mb-3">404</p>
          <p className="text-sm">Preview not found or has expired.</p>
        </div>
      </div>
    );
  }

  return <PreviewEmbed project={project} />;
}
