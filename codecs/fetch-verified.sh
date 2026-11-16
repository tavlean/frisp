#!/bin/sh
# Download a source tarball and keep it only if its SHA-256 matches the pin.
#
#   fetch-verified.sh <url> <sha256> <output-file>
#
# Every codec Makefile fetches its tarballs through this script, so a changed
# upstream archive or a tampered download fails the build instead of being
# compiled into a shipped .wasm. The pins and how each was checked are in
# docs/codec-provenance.md. Runs on macOS (shasum) and Linux (sha256sum).
set -eu

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <url> <sha256> <output-file>" >&2
  exit 2
fi
url=$1
expected=$2
out=$3
part="$out.part"

mkdir -p "$(dirname "$out")"
rm -f "$part"
curl -fsSL "$url" -o "$part"

if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$part" | cut -d ' ' -f 1)
else
  actual=$(shasum -a 256 "$part" | cut -d ' ' -f 1)
fi

if [ "$actual" != "$expected" ]; then
  rm -f "$part"
  echo "SHA-256 mismatch for $url" >&2
  echo "  expected $expected" >&2
  echo "  actual   $actual" >&2
  exit 1
fi
mv "$part" "$out"
