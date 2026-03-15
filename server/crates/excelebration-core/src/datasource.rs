use anyhow::Result;
use arrow_array::RecordBatch;
use arrow_schema::SchemaRef;
use std::future::Future;

/// Trait that users implement to connect Excelebration to their data source.
///
/// The boundary type is Arrow `RecordBatch` — Excelebration handles
/// WebTransport + Arrow IPC serialization; you handle data access.
///
/// The returned `RecordBatch` values should conform to the schema returned by
/// [`schema()`]. Excelebration manages row tracking internally via `_rowId`.
pub trait DataSource: Send + Sync + 'static {
    /// The Arrow schema for rows served by this data source.
    fn schema(&self) -> SchemaRef;

    /// Fetch a batch of rows starting at `offset`, up to `limit` rows.
    ///
    /// Return a `RecordBatch` conforming to [`schema()`].
    /// Return `None` when there are no more rows.
    ///
    /// The server calls this repeatedly with increasing offsets to stream
    /// data to the client in batches, so the first batch arrives immediately.
    fn fetch_batch(
        &self,
        offset: usize,
        limit: usize,
    ) -> impl Future<Output = Result<Option<RecordBatch>>> + Send;

    /// Apply upserts. `batch` conforms to [`schema()`] plus a `_rowId` column (Utf8)
    /// prepended by the framework.
    /// Return the `_rowId` values that were successfully applied.
    fn upsert(&self, batch: RecordBatch) -> impl Future<Output = Result<Vec<String>>> + Send;

    /// Delete rows. `row_ids` contains the `_rowId` values from the client.
    /// Return the `_rowId` values that were successfully deleted.
    fn delete(&self, row_ids: Vec<String>) -> impl Future<Output = Result<Vec<String>>> + Send;
}
