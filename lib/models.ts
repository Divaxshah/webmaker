export const LUMINO_MODELS = [
  {
    id: "xiaomi/mimo-v2-pro",
    label: "MiMo v2 Pro",
    description: "Best quality for full website generation (OpenRouter)",
  },
  {
    id: "minimax/minimax-m2.7",
    label: "MiniMax M2.7",
    description: "Strong reasoning; good for iterative agent turns (OpenRouter)",
  },
  {
    id: "qwen/qwen3.6-plus",
    label: "Qwen3.6 Plus",
    description: "1M context; balanced coding and UX work (OpenRouter)",
  },
  {
    id: "moonshotai/kimi-k2.6",
    label: "Kimi K2.6",
    description: "Long-horizon coding and UI/agentic tasks (OpenRouter)",
  },
] as const;

export type LuminoModelId = (typeof LUMINO_MODELS)[number]["id"];

export const DEFAULT_LUMINO_MODEL: LuminoModelId = "xiaomi/mimo-v2-pro";

export const isLuminoModel = (value: string): value is LuminoModelId =>
  LUMINO_MODELS.some((model) => model.id === value);

/** Remap removed model IDs so persisted sessions and API payloads stay valid. */
const LEGACY_LUMINO_MODEL_IDS: Partial<Record<string, LuminoModelId>> = {
  "moonshotai/kimi-k2.5": "moonshotai/kimi-k2.6",
};

export const coerceLuminoModelId = (value: string): LuminoModelId => {
  if (isLuminoModel(value)) return value;
  const mapped = LEGACY_LUMINO_MODEL_IDS[value];
  if (mapped !== undefined && isLuminoModel(mapped)) return mapped;
  return DEFAULT_LUMINO_MODEL;
};
