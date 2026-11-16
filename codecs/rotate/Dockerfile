# Not used by the current build: codecs/rotate builds through ../build-rust.sh
# and ../rust.Dockerfile. Kept pinned so that running it cannot pull an
# unverified image or WABT release.
FROM rust:1.47.0@sha256:48f4b36c3f3492b82a5e14b2fc991d3163c1d2ce18ac1f0561e9657103192713
RUN rustup target add wasm32-unknown-unknown

RUN mkdir /opt/wabt && \
 curl -fsSL -o /tmp/wabt.tar.gz https://github.com/WebAssembly/wabt/releases/download/1.0.11/wabt-1.0.11-linux.tar.gz && \
 echo "a6126f277aef7ef3dd78466db58ae11488e72cb7d762f6ffb5599c9ad4866753  /tmp/wabt.tar.gz" | sha256sum -c - && \
 tar -xzf /tmp/wabt.tar.gz -C /opt/wabt --strip 1 && \
 rm /tmp/wabt.tar.gz

ENV PATH="/opt/wabt:${PATH}"
WORKDIR /src
