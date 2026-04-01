use anyhow::Result;
use arrow_array::RecordBatch;
use arrow_schema::SchemaRef;
use std::future::Future;

/// Trait that users implement to connect Excelebration to their data source.
///
/// The boundary type is Arrow `RecordBatch` — Excelebration handles
/// WebTransport + Arrow IPC serialization; you handle data access.
pub trait DataSource: Send + Sync + 'static {
    /// User-defined per-request context (search conditions, auth info, etc.).
    /// Use `()` if no context is needed.
    type Context: Send + Sync + 'static;

    /// The Arrow schema for rows served by this data source.
    fn schema(&self) -> SchemaRef;

    /// Fetch a batch of rows starting at `offset`, up to `limit` rows.
    ///
    /// Return a `RecordBatch` conforming to [`schema()`].
    /// Return `None` when there are no more rows.
    fn fetch_batch(
        &self,
        ctx: &Self::Context,
        offset: usize,
        limit: usize,
    ) -> impl Future<Output = Result<Option<RecordBatch>>> + Send;

    /// Apply upserts. `batch` conforms to [`schema()`] plus a `_rowId` column (Utf8)
    /// prepended by the framework.
    /// Return the `_rowId` values that were successfully applied.
    fn upsert(
        &self,
        ctx: &Self::Context,
        batch: RecordBatch,
    ) -> impl Future<Output = Result<Vec<String>>> + Send;

    /// Delete rows. `row_ids` contains the `_rowId` values from the client.
    /// Return the `_rowId` values that were successfully deleted.
    fn delete(
        &self,
        ctx: &Self::Context,
        row_ids: Vec<String>,
    ) -> impl Future<Output = Result<Vec<String>>> + Send;
}
