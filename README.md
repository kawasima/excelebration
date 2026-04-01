# Excelebration

A high-performance data synchronization layer between browser-based grids and arbitrary data sources, using **WebTransport** and **Apache Arrow IPC** for fast binary streaming.

Excelebration provides both a **React client library** and a **Rust server library**. You define your data schema and implement a simple trait — Excelebration handles the transport, serialization, virtual scrolling, undo/redo, and real-time sync.

## Architecture

```text
┌──────────────────────────┐          ┌──────────────────────────┐
│   Client (React)         │          │   Server (Rust)          │
│                          │          │                          │
│  SheetProvider           │  Arrow   │  excelebration-server    │
│    └─ SheetGrid          │◄─IPC──► │    └─ WebTransport       │
│    └─ SheetToolbar       │  over    │    └─ Arrow serializer   │
│    └─ SheetStatusBar     │  QUIC    │                          │
│                          │          │  Your DataSource impl    │
│  Zod schema → columns   │          │    └─ fetch_batch()      │
│  Virtual scrolling       │          │    └─ upsert()           │
│  Undo/Redo               │          │    └─ delete()           │
└──────────────────────────┘          └──────────────────────────┘
```

## Project Structure

```text
excelebration/
  client/                          # npm package: "excelebration"
    src/
      components/                  # SheetProvider, SheetGrid, etc.
      hooks/                       # useSheet, useServerLoad, etc.
      core/                        # reducer, arrowSync, validation
  server/                          # Rust workspace
    crates/
      excelebration-core/          # DataSource trait + convert helpers
      excelebration-server/        # WebTransport server (generic)
  examples/
    employees-server/              # Rust: sample DataSource implementation
    employees-frontend/            # React: sample app using the library
```

## Quick Start

### Server

Implement the `DataSource` trait for your data source:

```rust
use excelebration_core::DataSource;
use arrow_array::RecordBatch;
use arrow_schema::{DataType, Field, Schema, SchemaRef};
use std::sync::Arc;

struct MySource { /* your DB pool, API client, etc. */ }

/// Per-request context extracted from URL query params and headers.
/// Use `()` if no context is needed.
struct MyContext {
    user_id: String,
    search_filter: Option<String>,
}

impl DataSource for MySource {
    type Context = MyContext;

    fn schema(&self) -> SchemaRef {
        Arc::new(Schema::new(vec![
            Field::new("id", DataType::Int32, false),
            Field::new("name", DataType::Utf8, false),
            Field::new("email", DataType::Utf8, true),
        ]))
    }

    async fn fetch_batch(
        &self,
        ctx: &MyContext,
        offset: usize,
        limit: usize,
    ) -> anyhow::Result<Option<RecordBatch>> {
        // Build WHERE clause from ctx, then SELECT ... LIMIT limit OFFSET offset
        // Return None when no more rows
    }

    async fn upsert(&self, ctx: &MyContext, batch: RecordBatch) -> anyhow::Result<Vec<String>> {
        // Apply inserts/updates, return accepted _rowId values
    }

    async fn delete(&self, ctx: &MyContext, row_ids: Vec<String>) -> anyhow::Result<Vec<String>> {
        // Delete rows, return accepted _rowId values
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let source = Arc::new(MySource { /* ... */ });
    excelebration_server::run(
        "0.0.0.0:4433".parse()?,
        source,
        |req_info| {
            // Extract context from request URL and headers.
            // Return Err to reject the connection (401).
            let user_id = req_info.headers.get("x-user-id")
                .and_then(|v| v.to_str().ok())
                .ok_or_else(|| anyhow::anyhow!("missing x-user-id header"))?
                .to_string();
            let search_filter = req_info.url.query_pairs()
                .find(|(k, _)| k == "filter")
                .map(|(_, v)| v.to_string());
            Ok(MyContext { user_id, search_filter })
        },
        |fp| println!("Certificate fingerprint: {}", fp.hex),
    ).await
}
```

### Client

```tsx
import { SheetProvider, SheetGrid, SheetToolbar, SheetStatusBar } from 'excelebration'
import * as z from 'zod'

const schema = z.object({
  id: z.number().meta({ label: 'ID', width: 60 }),
  name: z.string().min(1).meta({ label: 'Name', width: 150 }),
  email: z.email().optional().meta({ label: 'Email', width: 200 }),
})

function App() {
  return (
    <SheetProvider
      schema={schema}
      primaryKey="id"
      serverUrl="https://localhost:4433"
      certFingerprint={certFingerprint}
    >
      <SheetToolbar />
      <SheetGrid />
      <SheetStatusBar />
    </SheetProvider>
  )
}
```

## Features

### Client Library (`excelebration`)

- **Virtual scrolling** — renders only visible rows for 10,000+ row datasets
- **Zod-based schema** — column types, labels, widths, and validation from a single Zod object
- **Undo/Redo** — command-pattern based, tracks all cell edits
- **Keyboard navigation** — arrow keys, Tab, Enter, Escape
- **Clipboard** — copy/paste TSV (compatible with Excel and Google Sheets)
- **Filtering and sorting** — per-column text filters and locale-aware sort
- **Cell merging** — merge selected cells
- **Frozen columns** — pin left columns during horizontal scroll
- **Dirty tracking** — tracks new, modified, and deleted rows for sync
- **Arrow IPC sync** — binary serialization over WebTransport for minimal overhead

### Server Library (`excelebration-server`)

- **`DataSource` trait** — implement `schema()`, `fetch_batch()`, `upsert()`, `delete()`
- **Per-request `Context`** — extract search conditions and auth info from URL/headers; reject unauthorized connections
- **Arrow `RecordBatch` boundary** — no intermediate structs; work directly with columnar data
- **WebTransport (QUIC)** — multiplexed, low-latency streaming
- **Automatic TLS** — self-signed ECDSA P-256 certificates with auto-renewal
- **Batch streaming** — paginated `fetch_batch(offset, limit)` streams rows incrementally
- **Convert helpers** — `rows_to_batch()` / `batch_to_rows()` for `HashMap<String, Value>` interop

## Running the Example

```bash
# 1. Start the server
cd examples/employees-server
cargo run

# 2. Start the frontend (in another terminal)
cd examples/employees-frontend
npm install
npm run dev
```

The server prints `CERT_FINGERPRINT=...` on startup and writes it to `examples/employees-frontend/.env.local` automatically.

## License

MIT
