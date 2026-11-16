# The Docker route for the C/C++ codecs. It reproduces the native recipe that
# built the committed artifacts: same emsdk release, same flags. The toolchain
# each artifact was built with is recorded in one place, the "Toolchain per
# artifact" table in docs/codec-provenance.md; read it before rebuilding.
#
# The image is pinned by digest, because a tag can be repointed. The default is
# emsdk 3.1.0. webp and imagequant were built with emsdk 5.0.7, so build those
# with:
#   EMSDK_IMG=emscripten/emsdk:5.0.7@sha256:4e332f7343b6f66320bf72f7ecc01a3d9f3866721a13b0e5c7b96505d6ab148a ../build-cpp.sh
ARG EMSDK_IMG=emscripten/emsdk:3.1.0@sha256:a4500d8b42b09a255c9517a06b019de52334b0f05af3f0b62529f27e83ff5247
FROM $EMSDK_IMG
# Host build tools only; nothing from these packages is linked into a codec.
RUN apt-get update && apt-get install -qqy autoconf libtool pkg-config
# The same CFLAGS / CXXFLAGS / LDFLAGS as the native recipe in
# docs/codec-build-notes.md. PTHREAD_POOL_SIZE is not here: the threaded
# targets add it in their own Makefiles.
ENV CFLAGS "-O3 -flto"
ENV CXXFLAGS "${CFLAGS} -std=c++17"
ENV LDFLAGS "${CFLAGS} \
-s FILESYSTEM=0 \
-s ALLOW_MEMORY_GROWTH=1 \
-s TEXTDECODER=2 \
-s NODEJS_CATCH_EXIT=0 -s NODEJS_CATCH_REJECTION=0 \
"
# Build and cache standard libraries with these flags + Embind.
RUN emcc ${CXXFLAGS} ${LDFLAGS} --bind -xc++ /dev/null -o /dev/null
# And another set for the pthread variant.
RUN emcc ${CXXFLAGS} ${LDFLAGS} --bind -pthread -xc++ /dev/null -o /dev/null
WORKDIR /src
CMD ["sh", "-c", "emmake make -j`nproc`"]
