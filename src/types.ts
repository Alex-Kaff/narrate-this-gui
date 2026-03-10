export interface Provider {
  id: string;
  name: string;
  type: "tts_elevenlabs" | "tts_openai" | "llm" | "pexels";
  api_key?: string;
  base_url?: string;
  model?: string;
  voice_id?: string;
  model_id?: string;
  voice?: string;
  speed?: number;
}

export interface ContentConfig {
  type: "url" | "text";
  url?: string;
  text?: string;
}

export interface TtsConfig {
  type: "elevenlabs" | "openai";
  api_key: string;
  // ElevenLabs
  voice_id?: string;
  model_id?: string;
  // OpenAI
  base_url?: string;
  model?: string;
  voice?: string;
  // Shared
  speed?: number;
}

export interface EnhancementConfig {
  api_key: string;
  base_url?: string;
  model?: string;
  instructions: string;
}

export interface LocalMediaFile {
  path: string;
  description: string;
}

export interface PexelsFallback {
  api_key: string;
}

export interface MediaConfig {
  type: "pexels" | "local";
  // Pexels
  api_key?: string;
  llm_api_key?: string;
  llm_base_url?: string;
  llm_model?: string;
  // Local
  files?: LocalMediaFile[];
  pexels_fallback?: PexelsFallback;
}

export interface OutputConfig {
  video_path: string;
  audio_dir?: string;
}

export interface GenerateConfig {
  content: ContentConfig;
  tts: TtsConfig;
  enhancement?: EnhancementConfig;
  media?: MediaConfig;
  output: OutputConfig;
}

export interface PipelineEvent {
  stage: string;
  message: string;
}

export interface GenerationRecord {
  path: string;
  created_at: string;
  title: string;
}

export interface SavedConfig {
  providers: Provider[];
  generations: GenerationRecord[];
  default_audio_dir?: string;
}
