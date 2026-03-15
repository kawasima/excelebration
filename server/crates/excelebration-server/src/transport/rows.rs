use crate::arrow_util::writer::serialize_batch_ipc;
use anyhow::Result;
use excelebration_core::DataSource;
use tracing::info;

const BATCH_SIZE: usize = 5000;

pub async fn handle_get_rows<D: DataSource>(
    session: web_transport_quinn::Session,
    source: &D,
) -> Result<()> {
    let schema = source.schema();
    let mut send = session.open_uni().await?;
    let mut offset = 0;
    let mut total_rows = 0;

    loop {
        let batch = source.fetch_batch(offset, BATCH_SIZE).await?;
        match batch {
            Some(batch) if batch.num_rows() > 0 => {
                let num_rows = batch.num_rows();
                let ipc_bytes = serialize_batch_ipc(&batch, &schema)?;
                let len = ipc_bytes.len() as u32;
                send.write_all(&len.to_be_bytes()).await?;
                send.write_all(&ipc_bytes).await?;
                info!("Sent batch of {} rows ({} bytes)", num_rows, ipc_bytes.len());
                offset += num_rows;
                total_rows += num_rows;
            }
            _ => break,
        }
    }

    send.write_all(&0u32.to_be_bytes()).await?;
    send.finish()?;
    info!("Stream finished — {} rows total", total_rows);

    session.closed().await;
    Ok(())
}
