use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct ConfigDb {
    conn: Mutex<Connection>,
}

impl ConfigDb {
    pub fn open(app_data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("failed to create app data dir: {e}"))?;

        let db_path = app_data_dir.join("settings.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("failed to open settings db: {e}"))?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
            [],
        )
        .map_err(|e| format!("failed to create config table: {e}"))?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn get(&self, key: &str) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT value FROM config WHERE key = ?1", [key], |row| {
            row.get(0)
        })
        .ok()
    }

    pub fn set(&self, key: &str, value: &str) {
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute(
            "INSERT INTO config (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            [key, value],
        );
    }

    pub fn load_all(&self) -> SavedConfig {
        let json = self.get("app_config").unwrap_or_default();
        serde_json::from_str(&json).unwrap_or_default()
    }

    pub fn save_all(&self, config: &SavedConfig) {
        if let Ok(json) = serde_json::to_string(config) {
            self.set("app_config", &json);
        }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub provider_type: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub voice_id: Option<String>,
    pub model_id: Option<String>,
    pub voice: Option<String>,
    pub speed: Option<f64>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct GenerationRecord {
    pub path: String,
    pub created_at: String,
    pub title: String,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct SavedConfig {
    #[serde(default)]
    pub providers: Vec<Provider>,
    #[serde(default)]
    pub generations: Vec<GenerationRecord>,
    pub default_audio_dir: Option<String>,
}
