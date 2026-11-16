# The Docker route for the Rust codecs. Both images are pinned by digest,
# because a tag can be repointed. The defaults (rust 1.47.0, emsdk 2.0.8) are
# what built the committed hqx and rotate artifacts. oxipng and resize were
# built natively with the dated nightly in their rust-toolchain files and with
# emsdk 3.1.0's clang; the "Toolchain per artifact" table in
# docs/codec-provenance.md is the record for every artifact.
ARG RUST_IMG=rust:1.47.0@sha256:48f4b36c3f3492b82a5e14b2fc991d3163c1d2ce18ac1f0561e9657103192713
ARG EMSDK_IMG=emscripten/emsdk:2.0.8@sha256:68672cb7faba80d4bb3d93d7f3df9f7543b2b91878bd673f0057a49485ceb1f4

FROM $EMSDK_IMG AS wasm-tools
WORKDIR /opt/wasm-tools
RUN wget -qO wasm-pack.tar.gz https://github.com/rustwasm/wasm-pack/releases/download/v0.12.1/wasm-pack-v0.12.1-x86_64-unknown-linux-musl.tar.gz \
 && echo "7339ba3ad776bd5fc04dd5d6b9babe952648050a54226c08206fab4ffeec621f  wasm-pack.tar.gz" | sha256sum -c - \
 && tar -xzf wasm-pack.tar.gz --strip 1 \
 && rm wasm-pack.tar.gz

FROM $RUST_IMG AS rust
ARG RUST_IMG
RUN rustup target add wasm32-unknown-unknown
RUN case $RUST_IMG in rustlang/rust@*) rustup component add rust-src; esac
COPY --from=wasm-tools /emsdk/upstream/bin/wasm-opt /emsdk/upstream/bin/clang /usr/local/bin/
COPY --from=wasm-tools /emsdk/upstream/lib/ /usr/local/lib/
COPY --from=wasm-tools /emsdk/upstream/emscripten/system/include/libc/ /wasm32/include/
COPY --from=wasm-tools /emsdk/upstream/emscripten/system/lib/libc/musl/arch/emscripten/bits/ /wasm32/include/bits/
COPY --from=wasm-tools /opt/wasm-tools/wasm-pack /usr/local/cargo/bin/

ENV CPATH="/wasm32/include"
WORKDIR /src
CMD ["sh", "-c", "rm -rf pkg && wasm-pack build --target web -- --verbose --locked && rm pkg/.gitignore"]
