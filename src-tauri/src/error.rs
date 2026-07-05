use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(String),

    #[error("Path does not exist: {0}")]
    PathDoesNotExist(String),

    #[allow(dead_code)] // Phase 4
    #[error("{0}")]
    Other(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}
