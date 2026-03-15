use crate::arrow_util::reader::parse_sync_payload;
use anyhow::Result;
use arrow_array::builder::StringBuilder;
use arrow_array::Array;
use arrow_ipc::writer::StreamWriter;
use arrow_schema::{DataType, Field, Schema};
use excelebration_core::DataSource;
use std::sync::Arc;
use tracing::info;
use web_transport_quinn::Session;

pub async fn handle_sync<D: DataSource>(session: Session, source: &D) -> Result<()> {
    info!("DoPut /api/sync — waiting for client stream");

    let (mut send, mut recv) = session.accept_bi().await?;

    let mut data = Vec::new();
    let mut tmp = [0u8; 8192];
    loop {
        match recv.read(&mut tmp).await? {
            Some(n) => data.extend_from_slice(&tmp[..n]),
            None => break,
        }
    }
    info!("Received {} bytes from client", data.len());

    let payload = parse_sync_payload(&data)?;
    let has_upserts = payload.upsert_batch.is_some();
    let delete_count = payload.deletes.len();
    info!(
        "Parsed upserts={}, deletes={}",
        if has_upserts { "yes" } else { "no" },
        delete_count
    );

    let mut accepted_ids: Vec<String> = Vec::new();

    if let Some(batch) = payload.upsert_batch {
        match source.upsert(batch).await {
            Ok(ids) => accepted_ids.extend(ids),
            Err(e) => tracing::warn!("upsert failed: {e:#}"),
        }
    }

    if !payload.deletes.is_empty() {
        match source.delete(payload.deletes).await {
            Ok(ids) => accepted_ids.extend(ids),
            Err(e) => tracing::warn!("delete failed: {e:#}"),
        }
    }

    let response = serialize_accepted(&accepted_ids)?;
    let len = response.len() as u32;
    send.write_all(&len.to_be_bytes()).await?;
    send.write_all(&response).await?;
    send.finish()?;

    info!("Sync complete, accepted {} rows", accepted_ids.len());
    session.closed().await;
    Ok(())
}

fn serialize_accepted(row_ids: &[String]) -> Result<Vec<u8>> {
    let schema = Arc::new(Schema::new(vec![Field::new(
        "_rowId",
        DataType::Utf8,
        false,
    )]));

    let mut builder = StringBuilder::new();
    for id in row_ids {
        builder.append_value(id);
    }
    let arr = Arc::new(builder.finish()) as Arc<dyn Array>;
    let batch = arrow_array::RecordBatch::try_new(schema.clone(), vec![arr])?;

    let mut buf = Vec::new();
    let mut writer = StreamWriter::try_new(&mut buf, &schema)?;
    writer.write(&batch)?;
    writer.finish()?;
    Ok(buf)
}
