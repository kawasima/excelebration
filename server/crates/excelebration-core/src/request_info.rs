/// Transport-agnostic request information passed to the context extractor.
pub struct RequestInfo {
    /// The full URL of the incoming request (including path and query parameters).
    pub url: url::Url,
    /// HTTP headers from the incoming request.
    pub headers: http::HeaderMap,
}
