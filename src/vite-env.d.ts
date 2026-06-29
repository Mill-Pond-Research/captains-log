/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GROQ_API_KEY: string;
  readonly VITE_GROQ_ENDPOINT?: string;
  readonly VITE_GROQ_MODEL?: string;
  readonly VITE_ENABLE_OFFLINE_MODE?: string;
  readonly VITE_ENABLE_CLOUD_SYNC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
