use anyhow::{Context, Result};
use arrow_array::builder::{Float64Builder, Int32Builder, StringBuilder};
use arrow_array::{Array, RecordBatch};
use arrow_schema::{DataType, SchemaRef};
use std::collections::HashMap;
use std::sync::Arc;

/// Convert a list of row maps into an Arrow `RecordBatch`.
///
/// Each row is a `HashMap<String, serde_json::Value>`. Columns are built
/// according to the provided schema. Unsupported types are skipped.
pub fn rows_to_batch(
    schema: &SchemaRef,
    rows: &[HashMap<String, serde_json::Value>],
) -> Result<RecordBatch> {
    let mut columns: Vec<Arc<dyn Array>> = Vec::with_capacity(schema.fields().len());

    for field in schema.fields() {
        let name = field.name();
        match field.data_type() {
            DataType::Utf8 => {
                let mut builder = StringBuilder::new();
                for row in rows {
                    match row.get(name).and_then(|v| v.as_str()) {
                        Some(s) => builder.append_value(s),
                        None => {
                            if field.is_nullable() {
                                builder.append_null();
                            } else {
                                builder.append_value("");
                            }
                        }
                    }
                }
                columns.push(Arc::new(builder.finish()));
            }
            DataType::Int32 => {
                let mut builder = Int32Builder::with_capacity(rows.len());
                for row in rows {
                    match row.get(name) {
                        Some(v) if !v.is_null() => {
                            let n = v.as_i64().unwrap_or(0) as i32;
                            builder.append_value(n);
                        }
                        _ => {
                            if field.is_nullable() {
                                builder.append_null();
                            } else {
                                builder.append_value(0);
                            }
                        }
                    }
                }
                columns.push(Arc::new(builder.finish()));
            }
            DataType::Float64 => {
                let mut builder = Float64Builder::with_capacity(rows.len());
                for row in rows {
                    match row.get(name) {
                        Some(v) if !v.is_null() => {
                            let n = v.as_f64().unwrap_or(0.0);
                            builder.append_value(n);
                        }
                        _ => {
                            if field.is_nullable() {
                                builder.append_null();
                            } else {
                                builder.append_value(0.0);
                            }
                        }
                    }
                }
                columns.push(Arc::new(builder.finish()));
            }
            _ => {
                // Fallback: treat as Utf8
                let mut builder = StringBuilder::new();
                for row in rows {
                    match row.get(name) {
                        Some(serde_json::Value::String(s)) => builder.append_value(s),
                        Some(v) if !v.is_null() => builder.append_value(v.to_string()),
                        _ => builder.append_null(),
                    }
                }
                columns.push(Arc::new(builder.finish()));
            }
        }
    }

    RecordBatch::try_new(schema.clone(), columns).context("build RecordBatch from rows")
}

/// Convert an Arrow `RecordBatch` into a list of row maps.
pub fn batch_to_rows(batch: &RecordBatch) -> Vec<HashMap<String, serde_json::Value>> {
    let schema = batch.schema();
    let mut rows = Vec::with_capacity(batch.num_rows());

    for i in 0..batch.num_rows() {
        let mut map = HashMap::new();
        for (c, field) in schema.fields().iter().enumerate() {
            let col = batch.column(c);
            let val = arrow_value_to_json(col.as_ref(), i);
            map.insert(field.name().clone(), val);
        }
        rows.push(map);
    }
    rows
}

fn arrow_value_to_json(col: &dyn Array, i: usize) -> serde_json::Value {
    if col.is_null(i) {
        return serde_json::Value::Null;
    }
    if let Some(arr) = col.as_any().downcast_ref::<arrow_array::StringArray>() {
        return serde_json::Value::String(arr.value(i).to_string());
    }
    if let Some(arr) = col.as_any().downcast_ref::<arrow_array::Int32Array>() {
        return serde_json::json!(arr.value(i));
    }
    if let Some(arr) = col.as_any().downcast_ref::<arrow_array::Float64Array>() {
        return serde_json::json!(arr.value(i));
    }
    serde_json::Value::Null
}
