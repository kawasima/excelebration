use anyhow::Result;
use arrow_array::RecordBatch;
use arrow_ipc::writer::StreamWriter;
use arrow_schema::SchemaRef;

/// Serialize a `RecordBatch` into Arrow IPC stream bytes.
pub fn serialize_batch_ipc(batch: &RecordBatch, schema: &SchemaRef) -> Result<Vec<u8>> {
    let mut buf = Vec::new();
    {
        let mut writer = StreamWriter::try_new(&mut buf, schema)?;
        writer.write(batch)?;
        writer.finish()?;
    }
    Ok(buf)
}
