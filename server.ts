import type { BbPluginApi } from "@get-bb/plugin-sdk";

export default function plugin(bb: BbPluginApi) {
  bb.settings.define({
    baseUrl: {
      type: "string",
      label: "Model API base URL",
      description: "OpenAI-compatible API root, including /v1. Defaults to local Ollama.",
      default: "http://127.0.0.1:11434/v1",
    },
    model: {
      type: "string",
      label: "Model",
      description: "Model name at the configured API endpoint.",
      default: "qwen3:4b-instruct-2507-q4_K_M",
    },
  });

  bb.providers.register({
    id: "necron",
    displayName: "Necron",
    icon: "Users",
    strings: {
      signInHint: "Configure an OpenAI-compatible model endpoint in Necron settings.",
      expiredHint: "Check the configured model endpoint and API key.",
      installUrl: "https://github.com/csells/necron",
      brandPrefix: "Necron ",
      planModeCopy: "Necron will discuss the plan.",
    },
    maintenance: { health: true, usage: false, installation: false },
    capabilities: {
      supportsServiceTier: false,
      supportsNativeUserQuestion: false,
      fork: "none",
      supportsManualCompaction: false,
      supportsThreadArchive: false,
      supportsThreadRename: false,
      permissionModes: ["auto"],
      reasoningLevels: ["medium"],
    },
    reasoningLevels: [{ id: "medium", label: "Default" }],
    composerActions: [],
    models: {
      fallback: [{
        id: "default",
        displayName: "Configured model",
        description: "Uses the model in Necron settings.",
        supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "Default" }],
        defaultReasoningEffort: "medium",
        isDefault: true,
      }],
    },
    env: { passthrough: ["NECRON_API_KEY", "NECRON_BASE_URL", "NECRON_MODEL"] },
    deriveProviderOptions(context) {
      return {
        baseUrl: String(context.settings.baseUrl ?? "http://127.0.0.1:11434/v1"),
        model: String(context.settings.model ?? "qwen3:4b-instruct-2507-q4_K_M"),
      };
    },
  });
}
