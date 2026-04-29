export const LUMINO_MODELS = [
  {
    id: "xiaomi/mimo-v2-pro",
    label: "MiMo v2 Pro",
    description: "Best quality for full website generation (OpenRouter)",
  },
  {
    id: "moonshotai/kimi-k2.5",
    label: "Kimi K2.5",
    description: "Fast iteration for rapid drafts (OpenRouter)",
  },
] as const;

export type LuminoModelId = (typeof LUMINO_MODELS)[number]["id"];

export const DEFAULT_LUMINO_MODEL: LuminoModelId = "xiaomi/mimo-v2-pro";

export const isLuminoModel = (value: string): value is LuminoModelId =>
  LUMINO_MODELS.some((model) => model.id === value);
