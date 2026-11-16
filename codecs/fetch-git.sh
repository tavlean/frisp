#!/bin/sh
# Check out one exact commit of a git repository, optionally with submodules.
#
#   fetch-git.sh <repo-url> <commit-sha> <dir> [--submodules]
#
# Sources without a hashable release tarball are pinned by full commit SHA,
# never by tag or branch: a tag can be moved, a commit id cannot. Submodules
# need no pins of their own, because the pinned commit records each one's
# commit id. The directory is deleted and fetched fresh every time.
set -eu

if [ "$#" -lt 3 ] || [ "$#" -gt 4 ]; then
  echo "usage: $0 <repo-url> <commit-sha> <dir> [--submodules]" >&2
  exit 2
fi
url=$1
sha=$2
dir=$3
submodules=${4:-}

if ! printf '%s' "$sha" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "not a full commit SHA: $sha" >&2
  exit 2
fi

rm -rf "$dir"
git init -q "$dir"
git -C "$dir" fetch --depth 1 "$url" "$sha"
git -C "$dir" checkout -q FETCH_HEAD

actual=$(git -C "$dir" rev-parse HEAD)
if [ "$actual" != "$sha" ]; then
  echo "checked out $actual, expected $sha" >&2
  exit 1
fi

if [ "$submodules" = "--submodules" ]; then
  jobs=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
  git -C "$dir" submodule update --init --depth 1 --recursive --jobs "$jobs"
fi
