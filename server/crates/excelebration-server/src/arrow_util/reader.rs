use anyhow::{Context, Result};
use arrow_array::{Array, RecordBatch};
use arrow_ipc::reader::StreamReader;

/// Sync payload parsed from Arrow IPC bytes sent by the client.
pub struct SyncPayload {
    /// The upserted rows as a `RecordBatch` (includes `_rowId` column).
    pub upsert_batch: Option<RecordBatch>,
    /// Row IDs of rows to delete.
    pub deletes: Vec<String>,
}

/// Read length-prefixed Arrow IPC bytes from a buffer and return `SyncPayload`.
///
/// Format: `[4-byte BE length][IPC bytes]` for upserts,
///         then `[4-byte BE length][IPC bytes]` for deletes.
pub fn parse_sync_payload(data: &[u8]) -> Result<SyncPayload> {
    let mut pos = 0;

    // Read upserts batch
    let upsert_batch = if pos + 4 <= data.len() {
        let len = u32::from_be_bytes(data[pos..pos + 4].try_into()?) as usize;
        pos += 4;
        if len == 0 {
            None
        } else if pos + len <= data.len() {
            let ipc = &data[pos..pos + len];
            pos += len;
            Some(parse_record_batch(ipc).context("parse upsert IPC")?)
        } else {
            None
        }
    } else {
        None
    };

    // Read deletes batch
    let deletes = if pos + 4 <= data.len() {
        let len = u32::from_be_bytes(data[pos..pos + 4].try_into()?) as usize;
        pos += 4;
        if len == 0 {
            vec![]
        } else if pos + len <= data.len() {
            let ipc = &data[pos..pos + len];
            parse_deletes(ipc)?
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    Ok(SyncPayload {
        upsert_batch,
        deletes,
    })
}

/// Parse Arrow IPC bytes into a single `RecordBatch`.
fn parse_record_batch(ipc: &[u8]) -> Result<RecordBatch> {
    let cursor = std::io::Cursor::new(ipc);
    let mut reader = StreamReader::try_new(cursor, None).context("open IPC stream")?;

    // Take the first batch
    match reader.next() {
        Some(Ok(batch)) => Ok(batch),
        Some(Err(e)) => Err(e.into()),
        None => anyhow::bail!("empty IPC stream"),
    }
}

/// Parse Arrow IPC bytes to extract `_rowId` values for deletion.
fn parse_deletes(ipc: &[u8]) -> Result<Vec<String>> {
    let cursor = std::io::Cursor::new(ipc);
    let mut reader = StreamReader::try_new(cursor, None).context("parse deletes IPC")?;
    let schema = reader.schema();
    let id_col = schema
        .fields()
        .iter()
        .position(|f| f.name() == "_rowId")
        .unwrap_or(0);

    let mut ids = vec![];
    while let Some(Ok(batch)) = reader.next() {
        let col = batch.column(id_col);
        if let Some(arr) = col
            .as_any()
            .downcast_ref::<arrow_array::StringArray>()
        {
            for i in 0..batch.num_rows() {
                if !arr.is_null(i) {
                    ids.push(arr.value(i).to_string());
                }
            }
        }
    }
    Ok(ids)
}
