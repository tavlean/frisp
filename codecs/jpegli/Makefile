# google/jpegli has no release tags, so the source is pinned to an exact commit
# and fetched through ../fetch-git.sh, the way codecs/jxl fetches libjxl. jpegli lived inside libjxl until v0.12.0 removed it; this standalone repo
# is the only place it exists now, and the same SHA is recorded in
# docs/codec-provenance.md.
CODEC_URL := https://github.com/google/jpegli.git
CODEC_VERSION := 031a0077f5799a6041004267fc12b956c1f52a20
CODEC_DIR := node_modules/jpegli
# Written only after a verified fetch, and named after the commit, so a tree
# from another pin or a failed fetch is never built.
CODEC_STAMP := $(CODEC_DIR)/.commit-$(CODEC_VERSION)
CODEC_BUILD_DIR := $(CODEC_DIR)/build
# jpegli's encoder needs highway, which the tree vendors as a submodule and
# builds into its own archive. The jpegli-static target does not absorb it, so
# both archives go on the link line.
LIBJPEGLI := $(CODEC_BUILD_DIR)/lib/libjpegli-static.a
LIBHWY := $(CODEC_BUILD_DIR)/third_party/highway/libhwy.a
CODEC_OUT := $(LIBJPEGLI) $(LIBHWY)
ENVIRONMENT = worker

OUT_JS := enc/jpegli_enc.js enc/jpegli_node_enc.js
OUT_WASM := $(OUT_JS:.js=.wasm)

.PHONY: all clean

all: $(OUT_JS)

$(OUT_JS): enc/jpegli_enc.cpp

enc/jpegli_node_enc.js: ENVIRONMENT = node

# The wrapper includes "lib/jpegli/encode.h" by its in-tree path, so the source
# root is an include dir. jpeglib.h / jconfig.h / jmorecfg.h are copied and
# configured into the build tree at configure time (lib/jpegli.cmake), which is
# where the second -I points.
%.js: $(CODEC_OUT)
	$(CXX) \
		-I $(CODEC_DIR) \
		-I $(CODEC_BUILD_DIR)/lib/include/jpegli \
		${CXXFLAGS} \
		${LDFLAGS} \
		--bind \
		-s ENVIRONMENT=$(ENVIRONMENT) \
		-s EXPORT_ES6=1 \
		-o $@ \
		$+

# jpegli-static is EXCLUDE_FROM_ALL, so it has to be named explicitly; `make`
# with no target would build the tools instead. Everything optional is off:
#   TOOLS/DEVTOOLS/BENCHMARK/FUZZERS/JNI  -> executables we never ship
#   DOXYGEN/MANPAGES                      -> host tooling that fails to configure
#   SJPEG/OPENEXR/SKCMS/BUNDLE_LIBPNG     -> extras/ deps the encoder never calls
#   JPEGLI_LIBJPEG                        -> the libjpeg62 ABI shim, which the
#     tree already skips under Emscripten; the wrapper calls jpegli_* directly.
# WASM_THREADS defaults ON and would put -pthread on every translation unit.
# This codec ships one single-threaded variant (like mozjpeg), so it is off:
# a threaded build needs a pre-spawned pool to avoid the Atomics.wait deadlock
# documented in codec-build-notes.md, and there is no threaded artifact here.
$(LIBJPEGLI): $(CODEC_STAMP)
	emcmake cmake \
		$(CMAKE_FLAGS) \
		-DCMAKE_BUILD_TYPE=Release \
		-DBUILD_SHARED_LIBS=0 \
		-DBUILD_TESTING=0 \
		-DJPEGLI_ENABLE_WASM_THREADS=0 \
		-DJPEGLI_ENABLE_TOOLS=0 \
		-DJPEGLI_ENABLE_DEVTOOLS=0 \
		-DJPEGLI_ENABLE_BENCHMARK=0 \
		-DJPEGLI_ENABLE_FUZZERS=0 \
		-DJPEGLI_ENABLE_JNI=0 \
		-DJPEGLI_ENABLE_DOXYGEN=0 \
		-DJPEGLI_ENABLE_MANPAGES=0 \
		-DJPEGLI_ENABLE_SJPEG=0 \
		-DJPEGLI_ENABLE_OPENEXR=0 \
		-DJPEGLI_ENABLE_SKCMS=0 \
		-DJPEGLI_BUNDLE_LIBPNG=0 \
		-DJPEGLI_ENABLE_JPEGLI_LIBJPEG=0 \
		-B $(CODEC_BUILD_DIR) \
		$(CODEC_DIR)
	$(MAKE) -C $(CODEC_BUILD_DIR) jpegli-static

$(LIBHWY): $(LIBJPEGLI)
	$(MAKE) -C $(CODEC_BUILD_DIR) hwy

$(CODEC_STAMP):
	../fetch-git.sh $(CODEC_URL) $(CODEC_VERSION) $(@D) --submodules
	touch $@

clean:
	$(RM) $(OUT_JS) $(OUT_WASM)
	$(RM) -r $(CODEC_BUILD_DIR)
