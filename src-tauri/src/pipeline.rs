use narrate_this::{
    AudioTrack, ContentPipeline, ContentSource, ElevenLabsConfig, ElevenLabsTts, FfmpegRenderer,
    FirecrawlScraper, FsAudioStorage, LlmMediaPlanner, MediaAsset, MediaFallback, OpenAiConfig,
    OpenAiKeywords, OpenAiTts, OpenAiTtsConfig, PexelsSearch, PipelineProgress,
    RenderConfig, StockMediaPlanner,
};
use serde::{Deserialize, Serialize};

/// Shared pipeline configuration logic extracted as a macro to work with
/// the SDK's type-state builder pattern, which produces different types
/// depending on whether `.content()` was called.
macro_rules! configure_pipeline {
    ($builder:expr, $config:expr, $source:expr, $on_progress:expr) => {{
        let builder = match &$config.tts {
            TtsConfig::ElevenLabs {
                api_key,
                voice_id,
                model_id,
                speed,
            } => {
                let mut tts_config = ElevenLabsConfig {
                    api_key: api_key.clone(),
                    timeout_secs: 3600,
                    ..Default::default()
                };
                if let Some(v) = voice_id {
                    tts_config.voice_id = v.clone();
                }
                if let Some(m) = model_id {
                    tts_config.model_id = m.clone();
                }
                if let Some(s) = speed {
                    tts_config.speed = *s;
                }
                $builder.tts(ElevenLabsTts::new(tts_config))
            }
            TtsConfig::OpenAi {
                api_key,
                base_url,
                model,
                voice,
                speed,
            } => {
                let mut tts_config = OpenAiTtsConfig {
                    api_key: api_key.clone(),
                    timeout_secs: 7200,
                    ..Default::default()
                };
                if let Some(u) = base_url {
                    tts_config.base_url = u.clone();
                }
                if let Some(m) = model {
                    tts_config.model = m.clone();
                }
                if let Some(v) = voice {
                    tts_config.voice = v.clone();
                }
                if let Some(s) = speed {
                    tts_config.speed = *s;
                }
                $builder.tts(OpenAiTts::new(tts_config))
            }
        };

        let builder = match &$config.media {
            Some(MediaConfig::Pexels {
                api_key,
                llm_api_key,
                llm_base_url,
                llm_model,
            }) => {
                let mut llm_cfg = OpenAiConfig {
                    api_key: llm_api_key.clone(),
                    timeout_secs: 600,
                    ..Default::default()
                };
                if let Some(u) = llm_base_url {
                    llm_cfg.base_url = u.clone();
                }
                if let Some(m) = llm_model {
                    llm_cfg.model = m.clone();
                }
                builder.media(StockMediaPlanner::new(
                    OpenAiKeywords::new(llm_cfg),
                    PexelsSearch::new(api_key),
                ))
            }
            Some(MediaConfig::Local {
                files,
                llm_api_key,
                llm_base_url,
                llm_model,
                pexels_fallback,
            }) => {
                let mut llm_cfg = OpenAiConfig {
                    api_key: llm_api_key.clone(),
                    timeout_secs: 600,
                    ..Default::default()
                };
                if let Some(u) = llm_base_url {
                    llm_cfg.base_url = u.clone();
                }
                if let Some(m) = llm_model {
                    llm_cfg.model = m.clone();
                }

                let assets: Vec<MediaAsset> = files
                    .iter()
                    .map(|f| MediaAsset::image(f.path.as_str(), &f.description))
                    .collect();

                let mut planner = LlmMediaPlanner::new(llm_cfg).assets(assets);

                if let Some(pf) = pexels_fallback {
                    let kw_cfg = OpenAiConfig {
                        api_key: llm_api_key.clone(),
                        base_url: llm_base_url
                            .clone()
                            .unwrap_or("https://api.openai.com".into()),
                        model: llm_model.clone().unwrap_or("gpt-4o-mini".into()),
                        timeout_secs: 600,
                        ..Default::default()
                    };
                    planner = planner
                        .stock_search(
                            OpenAiKeywords::new(kw_cfg),
                            PexelsSearch::new(&pf.api_key),
                        )
                        .fallback(MediaFallback::StockSearch);
                } else {
                    planner = planner.fallback(MediaFallback::Skip);
                }

                builder.media(planner)
            }
            None => builder,
        };

        let audio_tracks: Vec<AudioTrack> = $config
            .output
            .audio_tracks
            .as_deref()
            .unwrap_or(&[])
            .iter()
            .map(|t| {
                let mut track = AudioTrack::new(&t.path).volume(t.volume);
                if !t.loop_track {
                    track = track.no_loop();
                }
                track
            })
            .collect();

        let render_config = RenderConfig {
            output_path: $config.output.video_path.clone(),
            audio_tracks,
            ..Default::default()
        };
        let builder = builder.renderer(FfmpegRenderer::new(), render_config);

        let builder = if let Some(ref audio_dir) = $config.output.audio_dir {
            builder.audio_storage(FsAudioStorage::new(audio_dir))
        } else {
            builder
        };

        let pipeline = builder.build()?;

        let result = pipeline
            .process_with_progress($source, |progress| {
                let event = map_progress(&progress);
                $on_progress(event);
            })
            .await?;

        result
    }};
}

#[derive(Debug, Deserialize)]
pub struct GenerateConfig {
    pub content: ContentConfig,
    pub tts: TtsConfig,
    pub firecrawl: Option<FirecrawlCfg>,
    pub enhancement: Option<EnhancementConfig>,
    pub media: Option<MediaConfig>,
    pub output: OutputConfig,
}

#[derive(Debug, Deserialize)]
pub struct FirecrawlCfg {
    pub base_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ContentConfig {
    #[serde(rename = "url")]
    Url { url: String },
    #[serde(rename = "text")]
    Text { text: String },
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum TtsConfig {
    #[serde(rename = "elevenlabs")]
    ElevenLabs {
        api_key: String,
        voice_id: Option<String>,
        model_id: Option<String>,
        speed: Option<f64>,
    },
    #[serde(rename = "openai")]
    OpenAi {
        api_key: String,
        base_url: Option<String>,
        model: Option<String>,
        voice: Option<String>,
        speed: Option<f64>,
    },
}

#[derive(Debug, Deserialize)]
pub struct EnhancementConfig {
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub instructions: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum MediaConfig {
    #[serde(rename = "pexels")]
    Pexels {
        api_key: String,
        llm_api_key: String,
        llm_base_url: Option<String>,
        llm_model: Option<String>,
    },
    #[serde(rename = "local")]
    Local {
        files: Vec<LocalMediaFile>,
        llm_api_key: String,
        llm_base_url: Option<String>,
        llm_model: Option<String>,
        pexels_fallback: Option<PexelsFallback>,
    },
}

#[derive(Debug, Deserialize)]
pub struct LocalMediaFile {
    pub path: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
pub struct PexelsFallback {
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PipelineEvent {
    pub stage: String,
    pub message: String,
}

fn map_progress(progress: &PipelineProgress) -> PipelineEvent {
    match progress {
        PipelineProgress::NarrationStarted => PipelineEvent {
            stage: "narration".into(),
            message: "Generating narration...".into(),
        },
        PipelineProgress::NarrationComplete { narration_len } => PipelineEvent {
            stage: "narration".into(),
            message: format!("Narration complete ({narration_len} chars)"),
        },
        PipelineProgress::TtsStarted => PipelineEvent {
            stage: "tts".into(),
            message: "Synthesizing speech...".into(),
        },
        PipelineProgress::TtsComplete {
            audio_bytes,
            caption_count,
        } => PipelineEvent {
            stage: "tts".into(),
            message: format!(
                "TTS complete ({} KB, {caption_count} captions)",
                audio_bytes / 1024
            ),
        },
        PipelineProgress::MediaSearchStarted { chunk_count } => PipelineEvent {
            stage: "media".into(),
            message: format!("Searching media for {chunk_count} chunks..."),
        },
        PipelineProgress::MediaSegmentFound { index, .. } => PipelineEvent {
            stage: "media".into(),
            message: format!("Found media for chunk {index}"),
        },
        PipelineProgress::MediaSearchComplete { segment_count } => PipelineEvent {
            stage: "media".into(),
            message: format!("Media search complete ({segment_count} segments)"),
        },
        PipelineProgress::RenderStarted => PipelineEvent {
            stage: "render".into(),
            message: "Rendering video...".into(),
        },
        PipelineProgress::RenderComplete { path } => PipelineEvent {
            stage: "render".into(),
            message: format!("Video saved to {path}"),
        },
        PipelineProgress::AudioStorageStarted => PipelineEvent {
            stage: "audio".into(),
            message: "Saving audio...".into(),
        },
        PipelineProgress::AudioStored { path } => PipelineEvent {
            stage: "audio".into(),
            message: format!("Audio saved to {path}"),
        },
        _ => PipelineEvent {
            stage: "unknown".into(),
            message: format!("{progress:?}"),
        },
    }
}

pub async fn run(
    config: GenerateConfig,
    on_progress: impl Fn(PipelineEvent) + Send + Sync + 'static,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let source = match &config.content {
        ContentConfig::Url { url } => ContentSource::ArticleUrl {
            url: url.clone(),
            title: None,
        },
        ContentConfig::Text { text } => ContentSource::Text(text.clone()),
    };

    let result = if let Some(ref fc) = config.firecrawl {
        let builder = ContentPipeline::builder()
            .content(FirecrawlScraper::new(&fc.base_url));
        configure_pipeline!(builder, config, source, on_progress)
    } else {
        let builder = ContentPipeline::builder();
        configure_pipeline!(builder, config, source, on_progress)
    };

    let video_path = result.video_path.unwrap_or_default();
    Ok(video_path)
}

#[derive(Debug, Deserialize)]
pub struct AudioTrackCfg {
    pub path: String,
    pub volume: f32,
    pub loop_track: bool,
}

#[derive(Debug, Deserialize)]
pub struct OutputConfig {
    pub video_path: String,
    pub audio_dir: Option<String>,
    pub audio_tracks: Option<Vec<AudioTrackCfg>>,
}
