FROM rust:1.94-slim AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/target/release/excelebration-server .
ENV CERT_HOSTS=192.168.1.8
EXPOSE 4433/udp
CMD ["./excelebration-server"]
