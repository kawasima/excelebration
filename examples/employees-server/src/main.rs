use anyhow::Result;
use arrow_array::builder::{Float64Builder, Int32Builder, StringBuilder};
use arrow_array::{Array, RecordBatch};
use arrow_schema::{DataType, Field, Schema, SchemaRef};
use excelebration_server::DataSource;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::info;

struct EmployeeSource {
    pool: SqlitePool,
    schema: SchemaRef,
}

impl EmployeeSource {
    fn new(pool: SqlitePool) -> Self {
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Int32, false),
            Field::new("name", DataType::Utf8, false),
            Field::new("age", DataType::Float64, true),
            Field::new("dept", DataType::Utf8, true),
            Field::new("joinDate", DataType::Utf8, true),
            Field::new("email", DataType::Utf8, true),
            Field::new("note", DataType::Utf8, true),
        ]));
        Self { pool, schema }
    }
}

impl DataSource for EmployeeSource {
    fn schema(&self) -> SchemaRef {
        self.schema.clone()
    }

    async fn fetch_batch(&self, offset: usize, limit: usize) -> Result<Option<RecordBatch>> {
        let rows = sqlx::query_as::<_, (i32, String, Option<f64>, Option<String>, Option<String>, Option<String>, Option<String>)>(
            "SELECT id, name, age, dept, join_date, email, note FROM employees ORDER BY id LIMIT ? OFFSET ?"
        )
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await?;

        if rows.is_empty() {
            return Ok(None);
        }

        let mut id_b = Int32Builder::with_capacity(rows.len());
        let mut name_b = StringBuilder::new();
        let mut age_b = Float64Builder::with_capacity(rows.len());
        let mut dept_b = StringBuilder::new();
        let mut join_date_b = StringBuilder::new();
        let mut email_b = StringBuilder::new();
        let mut note_b = StringBuilder::new();

        for (id, name, age, dept, join_date, email, note) in &rows {
            id_b.append_value(*id);
            name_b.append_value(name);
            match age {
                Some(v) => age_b.append_value(*v),
                None => age_b.append_null(),
            }
            match dept {
                Some(v) => dept_b.append_value(v),
                None => dept_b.append_null(),
            }
            match join_date {
                Some(v) => join_date_b.append_value(v),
                None => join_date_b.append_null(),
            }
            match email {
                Some(v) => email_b.append_value(v),
                None => email_b.append_null(),
            }
            match note {
                Some(v) => note_b.append_value(v),
                None => note_b.append_null(),
            }
        }

        let batch = RecordBatch::try_new(
            self.schema.clone(),
            vec![
                Arc::new(id_b.finish()) as Arc<dyn Array>,
                Arc::new(name_b.finish()) as Arc<dyn Array>,
                Arc::new(age_b.finish()) as Arc<dyn Array>,
                Arc::new(dept_b.finish()) as Arc<dyn Array>,
                Arc::new(join_date_b.finish()) as Arc<dyn Array>,
                Arc::new(email_b.finish()) as Arc<dyn Array>,
                Arc::new(note_b.finish()) as Arc<dyn Array>,
            ],
        )?;
        Ok(Some(batch))
    }

    async fn upsert(&self, batch: RecordBatch) -> Result<Vec<String>> {
        let rows = excelebration_server::convert::batch_to_rows(&batch);
        let mut accepted = Vec::new();

        for row in &rows {
            // _rowId is the client-side row identifier added by the framework
            let row_id = row
                .get("_rowId")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let age: Option<f64> = row.get("age").and_then(|v| v.as_f64());
            let dept = row.get("dept").and_then(|v| v.as_str());
            let join_date = row.get("joinDate").and_then(|v| v.as_str());
            let email = row.get("email").and_then(|v| v.as_str());
            let note = row.get("note").and_then(|v| v.as_str());

            // Use id from data if present (existing row), otherwise let DB auto-increment
            let id_val = row.get("id").and_then(|v| v.as_i64()).map(|n| n as i32);

            let result = if let Some(id) = id_val {
                sqlx::query(
                    r#"
                    INSERT INTO employees (id, name, age, dept, join_date, email, note)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name      = excluded.name,
                        age       = excluded.age,
                        dept      = excluded.dept,
                        join_date = excluded.join_date,
                        email     = excluded.email,
                        note      = excluded.note
                    "#,
                )
                .bind(id)
                .bind(name)
                .bind(age)
                .bind(dept)
                .bind(join_date)
                .bind(email)
                .bind(note)
                .execute(&self.pool)
                .await
            } else {
                sqlx::query(
                    "INSERT INTO employees (name, age, dept, join_date, email, note)
                     VALUES (?, ?, ?, ?, ?, ?)",
                )
                .bind(name)
                .bind(age)
                .bind(dept)
                .bind(join_date)
                .bind(email)
                .bind(note)
                .execute(&self.pool)
                .await
            };

            match result {
                Ok(_) => accepted.push(row_id.to_string()),
                Err(e) => tracing::warn!("upsert failed for {row_id}: {e:#}"),
            }
        }

        Ok(accepted)
    }

    async fn delete(&self, row_ids: Vec<String>) -> Result<Vec<String>> {
        let mut accepted = Vec::new();
        for row_id in &row_ids {
            // row_id is the stringified `id` value when primaryKey="id" is set
            match sqlx::query("DELETE FROM employees WHERE id = ?")
                .bind(row_id)
                .execute(&self.pool)
                .await
            {
                Ok(_) => accepted.push(row_id.clone()),
                Err(e) => tracing::warn!("delete failed for {row_id}: {e:#}"),
            }
        }
        Ok(accepted)
    }
}

async fn connect(database_url: &str) -> Result<SqlitePool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS employees (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            name      TEXT    NOT NULL,
            age       REAL,
            dept      TEXT,
            join_date TEXT,
            email     TEXT,
            note      TEXT
        )
    "#,
    )
    .execute(&pool)
    .await?;
    Ok(pool)
}

fn generate_seed_data(
    count: usize,
) -> Vec<(String, f64, String, String, String, Option<String>)> {
    let last_names = [
        "田中", "山田", "佐藤", "鈴木", "高橋", "伊藤", "渡辺", "中村", "小林", "加藤",
    ];
    let first_names = [
        "太郎", "花子", "次郎", "美咲", "健太", "由美", "大輔", "真理", "翔太", "愛",
    ];
    let depts = ["営業", "開発", "総務", "人事", "経理"];

    (0..count)
        .map(|i| {
            let name = format!(
                "{}{}",
                last_names[i % last_names.len()],
                first_names[i % first_names.len()]
            );
            let age = (22 + i % 40) as f64;
            let dept = depts[i % depts.len()].to_string();
            let join_date = format!("{}-{:02}-01", 2015 + (i % 10), (i % 12) + 1);
            let email = format!("user{}@example.com", i + 1);
            let note = if i % 5 == 0 {
                Some("メモあり".to_string())
            } else {
                None
            };
            (name, age, dept, join_date, email, note)
        })
        .collect()
}

#[tokio::main]
async fn main() -> Result<()> {
    rustls::crypto::ring::default_provider()
        .install_default()
        .map_err(|_| anyhow::anyhow!("Failed to install ring CryptoProvider"))?;

    tracing_subscriber::fmt::init();

    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://excelebration.db?mode=rwc".to_string());
    info!("Connecting to database: {}", database_url);
    let pool = connect(&database_url).await?;

    // Seed DB with initial data if empty
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM employees")
        .fetch_one(&pool)
        .await?;
    if count.0 == 0 {
        info!("Seeding database with initial data...");
        let rows = generate_seed_data(100_000);
        for (name, age, dept, join_date, email, note) in &rows {
            sqlx::query(
                "INSERT INTO employees (name, age, dept, join_date, email, note)
                 VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(name)
            .bind(age)
            .bind(dept)
            .bind(join_date)
            .bind(email)
            .bind(note)
            .execute(&pool)
            .await?;
        }
        info!("Seeded {} rows", rows.len());
    }

    let source = Arc::new(EmployeeSource::new(pool));
    let addr: SocketAddr = "0.0.0.0:4433".parse()?;
    excelebration_server::run(addr, source, |fp| {
        println!("CERT_FINGERPRINT={}", fp.hex);
        println!("CERT_FINGERPRINT_B64={}", fp.base64);

        // Auto-update ../employees-frontend/.env.local
        let hosts = std::env::var("CERT_HOSTS").unwrap_or_else(|_| "localhost".to_string());
        let host = hosts.split(',').next().unwrap_or("localhost").trim();
        // Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues
        let url_host = if host == "localhost" { "127.0.0.1" } else { host };
        let env_content = format!(
            "VITE_SERVER_URL=https://{}:4433\nVITE_CERT_FINGERPRINT={}\n",
            url_host, fp.hex
        );
        let env_path = std::path::Path::new("../employees-frontend/.env.local");
        match std::fs::write(env_path, &env_content) {
            Ok(_) => info!("Updated {:?} with current fingerprint", env_path),
            Err(e) => tracing::warn!("Could not update {:?}: {e}", env_path),
        }
    })
    .await
}
