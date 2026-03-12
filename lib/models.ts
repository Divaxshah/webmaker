export const LUMINO_MODELS = [
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro Preview",
    description: "Best quality for full website generation",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
    description: "Fast iteration for rapid drafts",
  },
] as const;

export type LuminoModelId = (typeof LUMINO_MODELS)[number]["id"];

export const DEFAULT_LUMINO_MODEL: LuminoModelId = "gemini-3-flash-preview";

export const isLuminoModel = (value: string): value is LuminoModelId =>
  LUMINO_MODELS.some((model) => model.id === value);
