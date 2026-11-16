#!/bin/sh -e
# Run from a codec folder. The whole codecs/ folder is mounted, not just the
# codec, because the Makefiles fetch their sources through ../fetch-verified.sh
# and ../fetch-git.sh. EMSDK_IMG overrides the emsdk image; see cpp.Dockerfile.
if [ -n "${EMSDK_IMG:-}" ]; then
  docker build -t squoosh-cpp --build-arg "EMSDK_IMG=$EMSDK_IMG" - < ../cpp.Dockerfile
else
  docker build -t squoosh-cpp - < ../cpp.Dockerfile
fi
docker run -it --rm -v "$PWD/..":/codecs -w "/codecs/$(basename "$PWD")" squoosh-cpp "$@"
