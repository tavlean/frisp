# mozjpeg v4.x is CMake-only (configure.ac was removed). This Makefile builds
# libjpeg.a via emcmake + the `jpeg-static` target, then links the wrapper.
# (v3.x used autotools: ./configure + .libs/libjpeg.a + rdswitch.o.)
CODEC_URL := https://github.com/mozilla/mozjpeg/archive/refs/tags/v4.1.5.tar.gz
CODEC_DIR := node_modules/mozjpeg
CODEC_BUILD_DIR := $(CODEC_DIR)/build
LIBJPEG := $(CODEC_BUILD_DIR)/libjpeg.a
# The wrapper calls mozjpeg's set_quality_ratings(), which lives in the cjpeg
# helper rdswitch.c (not libjpeg.a). v3.x autotools emitted rdswitch.o; under
# CMake-only v4 it's compiled into the cjpeg exe, so we build the object
# ourselves. Object BEFORE the archive on the link line so the archive resolves
# rdswitch's jpeg_* references.
RDSWITCH := $(CODEC_BUILD_DIR)/rdswitch.o
CODEC_OUT := $(RDSWITCH) $(LIBJPEG)
# mozjpeg has no numeric version macro of its own; the wrapper stringifies
# MOZJPEG_VERSION (it used to come from the autotools config.h). Supply it here.
MOZJPEG_VERSION := 4.1.5
ENVIRONMENT = worker

OUT_JS := enc/mozjpeg_enc.js enc/mozjpeg_node_enc.js dec/mozjpeg_node_dec.js
OUT_WASM := $(OUT_JS:.js=.wasm)

.PHONY: all clean

all: $(OUT_JS)

# Define dependencies for all variations of build artifacts.
$(filter enc/%,$(OUT_JS)): enc/mozjpeg_enc.cpp
$(filter dec/%,$(OUT_JS)): dec/mozjpeg_dec.cpp

enc/mozjpeg_node_enc.js dec/mozjpeg_node_dec.js: ENVIRONMENT = node

%.js: $(CODEC_OUT)
	$(CXX) \
		-I $(CODEC_DIR) \
		-I $(CODEC_BUILD_DIR) \
		-DMOZJPEG_VERSION=$(MOZJPEG_VERSION) \
		${CXXFLAGS} \
		${LDFLAGS} \
		--bind \
		-s ENVIRONMENT=$(ENVIRONMENT) \
		-s EXPORT_ES6=1 \
		-o $@ \
		$+

# Build libjpeg.a (static) via CMake. The flags mirror the old autotools ones:
#   --disable-shared      -> -DENABLE_SHARED=0
#   (static)              -> -DENABLE_STATIC=1
#   --without-turbojpeg   -> -DWITH_TURBOJPEG=0
#   --without-simd        -> -DWITH_SIMD=0   (x86/ARM asm won't build under emcc)
#   --without-arith-enc   -> -DWITH_ARITH_ENC=0
#   --without-arith-dec   -> -DWITH_ARITH_DEC=0
#   (drop libpng dep)     -> -DPNG_SUPPORTED=0
# CMake also generates jconfig.h / jconfigint.h into $(CODEC_BUILD_DIR) at
# configure time (jpeglib.h needs jconfig.h), hence the -I above.
# SIZE_T/UNSIGNED_LONG are pre-seeded because emsdk 3.1.0's CheckTypeSize.cmake
# mis-detects sizeof(size_t) under -flto (reads a sentinel from what is now LLVM
# bitcode -> 9; the node-emulator path returns 1). Pre-seeding 4 (wasm32 is
# ILP32) skips the broken probe so jchuff.c's word-size check passes. Fixed
# upstream in emscripten 3.1.28+.
$(LIBJPEG): $(CODEC_DIR)/CMakeLists.txt
	emcmake cmake \
		$(CMAKE_FLAGS) \
		-DCMAKE_BUILD_TYPE=Release \
		-DENABLE_SHARED=0 \
		-DENABLE_STATIC=1 \
		-DWITH_TURBOJPEG=0 \
		-DWITH_SIMD=0 \
		-DWITH_ARITH_ENC=0 \
		-DWITH_ARITH_DEC=0 \
		-DPNG_SUPPORTED=0 \
		-DSIZE_T=4 -DHAVE_SIZE_T=1 \
		-DUNSIGNED_LONG=4 -DHAVE_UNSIGNED_LONG=1 \
		-B $(CODEC_BUILD_DIR) \
		$(CODEC_DIR)
	$(MAKE) -C $(CODEC_BUILD_DIR) jpeg-static

# Compile rdswitch.c ourselves (see CODEC_OUT note). Needs the generated
# jconfig.h (build dir) + jpeglib.h/cdjpeg.h (source dir); depends on the libjpeg
# build so jconfig.h exists.
$(RDSWITCH): $(LIBJPEG)
	emcc $(CFLAGS) -I $(CODEC_DIR) -I $(CODEC_BUILD_DIR) -c $(CODEC_DIR)/rdswitch.c -o $@

$(CODEC_DIR)/CMakeLists.txt: $(CODEC_DIR)

$(CODEC_DIR):
	mkdir -p $@
	curl -sL $(CODEC_URL) | tar xz --strip 1 -C $@

clean:
	$(RM) $(OUT_JS) $(OUT_WASM)
	$(RM) -r $(CODEC_BUILD_DIR)
