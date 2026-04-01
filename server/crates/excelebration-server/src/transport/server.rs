use anyhow::{Context, Result};
use excelebration_core::DataSource;
use rcgen::{CertificateParams, DistinguishedName, DnValue, KeyPair, PKCS_ECDSA_P256_SHA256};
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use std::net::SocketAddr;
use std::path::Path;
use std::sync::Arc;
use tracing::{info, warn};
use web_transport_quinn::ServerBuilder;

const BASE64_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn base64_encode(input: &[u8]) -> String {
    let mut out = String::new();
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        out.push(BASE64_CHARS[b0 >> 2] as char);
        out.push(BASE64_CHARS[((b0 & 3) << 4) | (b1 >> 4)] as char);
        if chunk.len() > 1 {
            out.push(BASE64_CHARS[((b1 & 0xf) << 2) | (b2 >> 6)] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(BASE64_CHARS[b2 & 0x3f] as char);
        } else {
            out.push('=');
        }
    }
    out
}

struct CertInfo {
    cert_der: Vec<u8>,
    key_der: Vec<u8>,
}

/// Load existing cert/key or generate a new one (ECDSA P-256, 13-day validity).
fn load_or_generate_cert(hosts: &[String]) -> Result<CertInfo> {
    let cert_path = Path::new("cert.der");
    let key_path = Path::new("key.der");

    if cert_path.exists() && key_path.exists() {
        let cert_bytes = std::fs::read(cert_path)?;
        let key_bytes = std::fs::read(key_path)?;

        if let Ok((_, cert)) = x509_parser::parse_x509_certificate(&cert_bytes) {
            let not_after = cert.validity().not_after.timestamp();
            let now = time::OffsetDateTime::now_utc().unix_timestamp();
            if not_after - now > 86400 {
                info!(
                    "Reusing existing certificate (expires in {} days)",
                    (not_after - now) / 86400
                );
                return Ok(CertInfo {
                    cert_der: cert_bytes,
                    key_der: key_bytes,
                });
            }
            info!("Certificate expires soon, regenerating...");
        }
    }

    generate_cert(hosts, cert_path, key_path)
}

fn generate_cert(hosts: &[String], cert_path: &Path, key_path: &Path) -> Result<CertInfo> {
    let key_pair =
        KeyPair::generate_for(&PKCS_ECDSA_P256_SHA256).context("generate ECDSA P-256 key")?;

    let mut params = CertificateParams::new(hosts.to_vec())?;
    let now_utc = time::OffsetDateTime::now_utc();
    let expire_utc = now_utc + time::Duration::days(13);
    params.not_before =
        rcgen::date_time_ymd(now_utc.year(), now_utc.month() as u8, now_utc.day());
    params.not_after = rcgen::date_time_ymd(
        expire_utc.year(),
        expire_utc.month() as u8,
        expire_utc.day(),
    );
    params.distinguished_name = {
        let mut dn = DistinguishedName::new();
        dn.push(
            rcgen::DnType::CommonName,
            DnValue::PrintableString("excelebration".try_into()?),
        );
        dn
    };

    let cert = params.self_signed(&key_pair).context("self-sign cert")?;
    let cert_der = cert.der().to_vec();
    let key_der = key_pair.serialize_der();

    std::fs::write(cert_path, &cert_der)?;
    std::fs::write(key_path, &key_der)?;
    info!(
        "Generated new certificate, saved to {:?} / {:?}",
        cert_path, key_path
    );

    Ok(CertInfo { cert_der, key_der })
}

/// Certificate fingerprint information returned after server setup.
pub struct CertFingerprint {
    pub hex: String,
    pub base64: String,
}

/// Start the Excelebration WebTransport server with the given `DataSource`.
///
/// - `extract_context`: Called for each incoming connection to produce a
///   `D::Context` from the request URL and headers. Return `Err` to reject.
/// - `on_ready`: Called once with the certificate fingerprint before accepting connections.
pub async fn run<D, F>(
    addr: SocketAddr,
    source: Arc<D>,
    extract_context: F,
    on_ready: impl FnOnce(&CertFingerprint),
) -> Result<()>
where
    D: DataSource,
    F: Fn(&excelebration_core::RequestInfo) -> Result<D::Context> + Send + Sync + 'static,
{
    let hosts: Vec<String> = std::env::var("CERT_HOSTS")
        .unwrap_or_else(|_| "localhost".to_string())
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();
    info!("Certificate SANs: {:?}", hosts);

    let info = load_or_generate_cert(&hosts)?;

    let digest = ring::digest::digest(&ring::digest::SHA256, &info.cert_der);
    let digest_bytes = digest.as_ref();
    let fingerprint = CertFingerprint {
        hex: digest_bytes
            .iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(":"),
        base64: base64_encode(digest_bytes),
    };

    on_ready(&fingerprint);

    let cert_der = CertificateDer::from(info.cert_der);
    let key_der =
        PrivateKeyDer::try_from(info.key_der).map_err(|e| anyhow::anyhow!("key error: {e}"))?;

    let mut server = ServerBuilder::new()
        .with_addr(addr)
        .with_certificate(vec![cert_der], key_der)?;

    info!("WebTransport server listening on {}", addr);

    let extract_context = Arc::new(extract_context);

    while let Some(request) = server.accept().await {
        let path = request.url.path().to_string();
        info!("WebTransport request: {}", path);

        // Build RequestInfo from the incoming connection
        let req_info = excelebration_core::RequestInfo {
            url: request.url.clone(),
            headers: request.headers.clone(),
        };

        let ctx = match (extract_context)(&req_info) {
            Ok(ctx) => Arc::new(ctx),
            Err(e) => {
                warn!("Context extraction failed: {e:#}");
                let _ = request.reject(http::StatusCode::UNAUTHORIZED).await;
                continue;
            }
        };

        let source = source.clone();
        tokio::spawn(async move {
            match path.as_str() {
                "/api/rows" => {
                    let session = match request.ok().await {
                        Ok(s) => s,
                        Err(e) => {
                            warn!("Session accept error: {e:#}");
                            return;
                        }
                    };
                    if let Err(e) = super::rows::handle_get_rows(session, source.as_ref(), ctx.as_ref()).await {
                        warn!("handle_get_rows error: {e:#}");
                    }
                }
                "/api/sync" => {
                    let session = match request.ok().await {
                        Ok(s) => s,
                        Err(e) => {
                            warn!("Session accept error: {e:#}");
                            return;
                        }
                    };
                    if let Err(e) = super::sync::handle_sync(session, source.as_ref(), ctx.as_ref()).await {
                        warn!("handle_sync error: {e:#}");
                    }
                }
                _ => {
                    warn!("Unknown path: {}", path);
                    let _ = request.reject(http::StatusCode::NOT_FOUND).await;
                }
            }
        });
    }
    Ok(())
}
