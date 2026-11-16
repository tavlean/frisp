# Every tarball is fetched through ../fetch-verified.sh and must match its
# SHA-256. The pins and how each was checked are in docs/codec-provenance.md.
# Package names carry the version so a cached tarball from an older pin is
# never reused.

# using libavif from https://github.com/AOMediaCodec/libavif
LIBAVIF_URL = https://github.com/AOMediaCodec/libavif/archive/refs/tags/v1.4.2.tar.gz
LIBAVIF_SHA256 = 2b645287340ba5a631d268b551dc2d72bd73ac33335962dd36dcdb6d8366921d
LIBAVIF_PACKAGE = node_modules/libavif-1.4.2.tar.gz

# using libaom from https://aomedia.googlesource.com/aom, via its official
# release tarball. googlesource `+archive` URLs are generated on every request
# and their bytes change between downloads, so they cannot be pinned by hash.
# The release tarball's tree is identical to the v3.12.1 `+archive` tree.
LIBAOM_URL = https://storage.googleapis.com/aom-releases/libaom-3.12.1.tar.gz
LIBAOM_SHA256 = 9e9775180dec7dfd61a79e00bda3809d43891aee6b2e331ff7f26986207ea22e
LIBAOM_PACKAGE = node_modules/libaom-3.12.1.tar.gz

export CODEC_DIR = node_modules/libavif
export BUILD_DIR = node_modules/build
export LIBAOM_DIR = node_modules/libaom

override CFLAGS += "-Wno-unused-macros"

# We must build libsharpyuv from a specific libwebp commit
# See libavif/ext/libsharpyuv.cmd for more detail
# The GitHub mirror's v1.6.0 tarball, the same one codecs/webp builds from. It
# differs from the googlesource `+archive` tree only in dotfiles and
# gradlew.bat, none of which the sharpyuv build reads.
LIBWEBP_URL_WITH_SHARPYUV = https://github.com/webmproject/libwebp/archive/refs/tags/v1.6.0.tar.gz
LIBWEBP_SHA256 = 93a852c2b3efafee3723efd4636de855b46f9fe1efddd607e1f42f60fc8f2136
LIBWEBP_PACKAGE = node_modules/libwebp-1.6.0.tar.gz
LIBWEBP_DIR := $(CODEC_DIR)/ext/libwebp
LIBSHARPYUV_ST := $(LIBWEBP_DIR)/build_st/libsharpyuv.a
LIBSHARPYUV_MT := $(LIBWEBP_DIR)/build_mt/libsharpyuv.a
export LIBSHARPYUV := $(LIBWEBP_DIR)/build/libsharpyuv.a

OUT_ENC_JS = enc/avif_enc.js
OUT_NODE_ENC_JS = enc/avif_node_enc.js
OUT_ENC_MT_JS = enc/avif_enc_mt.js
OUT_NODE_ENC_MT_JS = enc/avif_node_enc_mt.js
OUT_DEC_JS = dec/avif_dec.js
OUT_NODE_DEC_JS = dec/avif_node_dec.js

OUT_ENC_CPP = enc/avif_enc.cpp
OUT_DEC_CPP = dec/avif_dec.cpp
ENVIRONMENT = worker

HELPER_MAKEFLAGS := -f helper.Makefile

.PHONY: all clean

all: $(OUT_ENC_JS) $(OUT_DEC_JS) $(OUT_ENC_MT_JS)

# ST-Encoding
$(OUT_ENC_JS): $(OUT_ENC_CPP) $(CODEC_DIR)/CMakeLists.txt $(LIBAOM_DIR)/CMakeLists.txt $(LIBSHARPYUV_ST)
	mkdir -p $(LIBWEBP_DIR)/build && cp $(LIBSHARPYUV_ST) $(LIBSHARPYUV)
	$(MAKE) \
		$(HELPER_MAKEFLAGS) \
		OUT_JS=$@ \
		OUT_CPP=$< \
		LIBAOM_FLAGS="\
			-DCONFIG_AV1_DECODER=0 \
			-DCONFIG_MULTITHREAD=0 \
			-DCONFIG_AV1_HIGHBITDEPTH=0 \
		" \
		ENVIRONMENT=$(ENVIRONMENT) \
		LIBAVIF_FLAGS="-DAVIF_CODEC_AOM_DECODE=0 -DAVIF_LOCAL_LIBSHARPYUV=ON"

# MT-Encoding
# We need to run the ST and MT tasks sequentially to avoid conflicts with the copy of libsharpyuv in the build directory
# OUT_FLAGS pre-spawns a pthread pool (PTHREAD_POOL_SIZE). Without it Emscripten
# creates pthreads on-demand during the encode, but the encode runs synchronously
# in a worker and blocks on Atomics.wait — so it can never process the new worker's
# `loaded` message and deadlocks. Pre-spawning at init makes the pool ready before
# the blocking encode. Sized to the runtime core count.
$(OUT_ENC_MT_JS): $(OUT_ENC_CPP) $(CODEC_DIR)/CMakeLists.txt $(LIBAOM_DIR)/CMakeLists.txt $(LIBSHARPYUV_MT) | $(OUT_ENC_JS)
	mkdir -p $(LIBWEBP_DIR)/build && cp $(LIBSHARPYUV_MT) $(LIBSHARPYUV)
	$(MAKE) \
		$(HELPER_MAKEFLAGS) \
		OUT_JS=$@ \
		OUT_CPP=$< \
		LIBAOM_FLAGS="\
			-DCONFIG_AV1_DECODER=0 \
			-DCONFIG_AV1_HIGHBITDEPTH=0 \
		" \
		ENVIRONMENT=$(ENVIRONMENT) \
		LIBAVIF_FLAGS="-DAVIF_CODEC_AOM_DECODE=0 -DAVIF_LOCAL_LIBSHARPYUV=ON" \
		OUT_FLAGS="-pthread -sPTHREAD_POOL_SIZE=navigator.hardwareConcurrency"

# Decoding
$(OUT_DEC_JS): $(OUT_DEC_CPP) $(CODEC_DIR)/CMakeLists.txt $(LIBAOM_DIR)/CMakeLists.txt
	$(MAKE) \
		$(HELPER_MAKEFLAGS) \
		OUT_JS=$@ \
		OUT_CPP=$< \
		LIBAOM_FLAGS="\
			-DCONFIG_AV1_ENCODER=0 \
			-DCONFIG_MULTITHREAD=0 \
		" \
		ENVIRONMENT=$(ENVIRONMENT) \
		LIBAVIF_FLAGS="-DAVIF_CODEC_AOM_ENCODE=0"

# LIBAOM EXTRACTION SECTION

# Download the libaom tarball
$(LIBAOM_PACKAGE):
	../fetch-verified.sh $(LIBAOM_URL) $(LIBAOM_SHA256) $@

# Extract libaom from the tarball. The release tarball has a top-level
# libaom-<version>/ directory, which the old `+archive` one did not.
$(LIBAOM_DIR)/CMakeLists.txt: $(LIBAOM_PACKAGE)
	mkdir -p $(@D)
	tar xzm --strip 1 -C $(@D) -f $(LIBAOM_PACKAGE)

# LIBAVIF EXTRACTION SECTION

# Download the libavif tarball
$(LIBAVIF_PACKAGE):
	../fetch-verified.sh $(LIBAVIF_URL) $(LIBAVIF_SHA256) $@

# Extract libavif from the tarball
$(CODEC_DIR)/CMakeLists.txt: $(LIBAVIF_PACKAGE)
	mkdir -p $(@D)
	tar xzm --strip 1 -C $(@D) -f $(LIBAVIF_PACKAGE)

# Download the libwebp tarball for libsharpyuv
$(LIBWEBP_PACKAGE):
	../fetch-verified.sh $(LIBWEBP_URL_WITH_SHARPYUV) $(LIBWEBP_SHA256) $@

# Create libavif/ext/libwebp
$(LIBWEBP_DIR)/CMakeLists.txt: $(CODEC_DIR)/CMakeLists.txt $(LIBWEBP_PACKAGE)
	mkdir -p $(LIBWEBP_DIR)
	tar xzm --strip 1 -C $(LIBWEBP_DIR) -f $(LIBWEBP_PACKAGE)

# Make libsharpyuv.a for ST-Encoding
$(LIBSHARPYUV_ST): $(LIBWEBP_DIR)/CMakeLists.txt
	mkdir -p $(@D)
	emcmake cmake \
		-DWEBP_USE_THREAD=OFF \
		-DWEBP_BUILD_ANIM_UTILS=OFF \
		-DWEBP_BUILD_CWEBP=OFF \
		-DWEBP_BUILD_DWEBP=OFF \
		-DWEBP_BUILD_GIF2WEBP=OFF \
		-DWEBP_BUILD_IMG2WEBP=OFF \
		-DWEBP_BUILD_VWEBP=OFF \
		-DWEBP_BUILD_WEBPINFO=OFF \
		-DWEBP_BUILD_LIBWEBPMUX=OFF \
		-DWEBP_BUILD_WEBPMUX=OFF \
		-DWEBP_BUILD_EXTRAS=OFF \
		-DBUILD_SHARED_LIBS=OFF \
		-DCMAKE_BUILD_TYPE=Release \
		-S $(LIBWEBP_DIR) \
		-B $(@D)
	$(MAKE) -C $(@D) sharpyuv

# Make libsharpyuv.a for MT-Encoding
$(LIBSHARPYUV_MT): $(LIBWEBP_DIR)/CMakeLists.txt
	mkdir -p $(@D)
	emcmake cmake \
		-DWEBP_BUILD_ANIM_UTILS=OFF \
		-DWEBP_BUILD_CWEBP=OFF \
		-DWEBP_BUILD_DWEBP=OFF \
		-DWEBP_BUILD_GIF2WEBP=OFF \
		-DWEBP_BUILD_IMG2WEBP=OFF \
		-DWEBP_BUILD_VWEBP=OFF \
		-DWEBP_BUILD_WEBPINFO=OFF \
		-DWEBP_BUILD_LIBWEBPMUX=OFF \
		-DWEBP_BUILD_WEBPMUX=OFF \
		-DWEBP_BUILD_EXTRAS=OFF \
		-DBUILD_SHARED_LIBS=OFF \
		-DCMAKE_BUILD_TYPE=Release \
		-S $(LIBWEBP_DIR) \
		-B $(@D)
	$(MAKE) -C $(@D) sharpyuv

clean:
	$(MAKE) $(HELPER_MAKEFLAGS) OUT_JS=$(OUT_ENC_JS) clean
	$(MAKE) $(HELPER_MAKEFLAGS) OUT_JS=$(OUT_ENC_MT_JS) clean
	$(MAKE) $(HELPER_MAKEFLAGS) OUT_JS=$(OUT_ENC_NODE_JS) clean
	$(MAKE) $(HELPER_MAKEFLAGS) OUT_JS=$(OUT_ENC_NODE_MT_JS) clean
	$(MAKE) $(HELPER_MAKEFLAGS) OUT_JS=$(OUT_DEC_JS) clean
	$(MAKE) $(HELPER_MAKEFLAGS) OUT_JS=$(OUT_DEV_NODE_JS) clean
