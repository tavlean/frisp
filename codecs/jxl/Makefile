CODEC_URL = https://github.com/libjxl/libjxl.git
# v0.12.0. The encoder wrapper is written against libjxl's PUBLIC JxlEncoder* C
# API, so the internal-header constraint that pinned us to 0.8.x is gone (v0.9.0
# deleted enc_file.h / enc_color_management.h / EncodeFile / GetJxlCms). Adds the
# 0.11.1 / 0.11.2 CVE fixes on top of the 0.8.x ones. Note that 0.12 spends more
# bits than 0.8.5 for the same butteraugli distance; see codec-provenance.md.
#
# Pinned by commit SHA through ../fetch-git.sh, because a tag can be moved.
# a7a9c787 is the commit the v0.12.0 tag points to; the submodules (brotli,
# highway, skcms and the rest) are pinned by that commit's gitlinks.
CODEC_VERSION = v0.12.0
CODEC_COMMIT = a7a9c787341cf703dede03c2009fa460cae5e5df
# Written only after a verified fetch, and named after the commit, so a tree
# from another pin or a failed fetch is never built.
CODEC_STAMP = $(CODEC_DIR)/.commit-$(CODEC_COMMIT)
CODEC_DIR = node_modules/jxl
CODEC_BUILD_ROOT := $(CODEC_DIR)/build
CODEC_MT_BUILD_DIR := $(CODEC_BUILD_ROOT)/mt
CODEC_MT_SIMD_BUILD_DIR := $(CODEC_BUILD_ROOT)/mt-simd
ENVIRONMENT = worker

OUT_JS = enc/jxl_enc.js enc/jxl_enc_mt.js enc/jxl_enc_mt_simd.js dec/jxl_dec.js enc/jxl_node_enc.js dec/jxl_node_dec.js
OUT_WASM = $(OUT_JS:.js=.wasm)
OUT_WORKER = $(OUT_JS:.js=.worker.js)

.PHONY: all clean

all: $(OUT_JS)

# Define dependencies for all variations of build artifacts.
$(filter enc/%,$(OUT_JS)): enc/jxl_enc.cpp
$(filter dec/%,$(OUT_JS)): dec/jxl_dec.cpp

enc/jxl_node_enc.js dec/jxl_node_dec.js: ENVIRONMENT = node

# For single-threaded build, we compile with threads enabled, but then just don't use them nor link them in.
enc/jxl_enc.js enc/jxl_node_enc.js enc/jxl_enc_mt.js dec/jxl_dec.js dec/jxl_node_dec.js: CODEC_BUILD_DIR:=$(CODEC_MT_BUILD_DIR)
enc/jxl_enc_mt_simd.js: CODEC_BUILD_DIR:=$(CODEC_MT_SIMD_BUILD_DIR)

enc/jxl_node_enc.js dec/jxl_node_dec.js enc/jxl_enc.js dec/jxl_dec.js: $(CODEC_MT_BUILD_DIR)/lib/libjxl.a
enc/jxl_enc_mt.js: $(CODEC_MT_BUILD_DIR)/lib/libjxl.a $(CODEC_MT_BUILD_DIR)/lib/libjxl_threads.a
enc/jxl_enc_mt_simd.js: $(CODEC_MT_SIMD_BUILD_DIR)/lib/libjxl.a $(CODEC_MT_SIMD_BUILD_DIR)/lib/libjxl_threads.a

# Disable errors on deprecated SIMD intrinsics.
# JPEG-XL & Highway need to catch up, once they do, we can remove this suppression.
export CXXFLAGS += -Wno-deprecated-declarations

# Compile multithreaded wrappers with -pthread, and pre-spawn a pthread pool
# (PTHREAD_POOL_SIZE). Without a pre-spawned pool Emscripten creates pthreads
# on-demand during the encode, but the encode runs synchronously in a worker and
# blocks on Atomics.wait — so it can never process the new worker's `loaded`
# message and deadlocks. Pre-spawning at init makes the pool ready before the
# blocking encode. Sized to the runtime core count.
enc/jxl_enc_mt.js enc/jxl_enc_mt_simd.js: CXXFLAGS+=-pthread -sPTHREAD_POOL_SIZE=navigator.hardwareConcurrency

$(OUT_JS):
	$(CXX) \
		$(CXXFLAGS) \
		$(LDFLAGS) \
		-I $(CODEC_DIR)/lib/include \
		-I $(CODEC_BUILD_DIR)/lib/include \
		-I $(CODEC_DIR)/third_party/skcms \
		--bind \
		-s ENVIRONMENT=$(ENVIRONMENT) \
		-s EXPORT_ES6=1 \
		-o $@ \
		$+ \
		$(CODEC_BUILD_DIR)/lib/libjxl_cms.a \
		$(CODEC_BUILD_DIR)/third_party/brotli/libbrotlidec.a \
		$(CODEC_BUILD_DIR)/third_party/brotli/libbrotlienc.a \
		$(CODEC_BUILD_DIR)/third_party/brotli/libbrotlicommon.a \
		$(CODEC_BUILD_DIR)/third_party/highway/libhwy.a

# v0.12.0 renamed the static targets: `jxl-static` / `jxl_threads-static` became
# plain `jxl` / `jxl_threads` (BUILD_SHARED_LIBS=0 makes them archives), and the
# colour-management code moved out of libjxl.a into its own libjxl_cms.a, which
# `make jxl` builds as a link dependency. libjxl_cms.a is also where skcms now
# lives (v0.8.x's JPEGXL_BUNDLE_SKCMS option is gone), so the decoder's skcms
# calls resolve from it and the hand-compiled libskcms.a is no longer built.
%/lib/libjxl.a: %/Makefile
	$(MAKE) -C $(<D) jxl

%/lib/libjxl_threads.a: %/Makefile
	$(MAKE) -C $(<D) jxl_threads

# Enable SIMD on a SIMD build.
$(CODEC_MT_SIMD_BUILD_DIR)/Makefile: CXXFLAGS+=-msimd128

%/Makefile: $(CODEC_STAMP)
	emcmake cmake \
	$(CMAKE_FLAGS) \
	-DBUILD_SHARED_LIBS=0 \
	-DJPEGXL_ENABLE_BENCHMARK=0 \
	-DJPEGXL_ENABLE_EXAMPLES=0 \
	-DBUILD_TESTING=0 \
	-DCMAKE_CROSSCOMPILING_EMULATOR=node \
	-B $(@D) \
	$(<D)

$(CODEC_STAMP):
	../fetch-git.sh $(CODEC_URL) $(CODEC_COMMIT) $(@D) --submodules
	touch $@

# CODEC_BUILD_DIR is target-specific, so it is empty here; the line that used it
# expanded to `make -C  clean` and aborted before either real build dir was
# cleaned. The two build dirs below are the only ones that exist.
clean:
	$(RM) $(OUT_JS) $(OUT_WASM) $(OUT_WORKER)
	$(MAKE) -C $(CODEC_MT_BUILD_DIR) clean
	$(MAKE) -C $(CODEC_MT_SIMD_BUILD_DIR) clean
