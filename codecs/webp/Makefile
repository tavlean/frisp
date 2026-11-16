# Fetched through ../fetch-verified.sh; see docs/codec-provenance.md for the pin.
CODEC_URL = https://github.com/webmproject/libwebp/archive/refs/tags/v1.6.0.tar.gz
CODEC_SHA256 = 93a852c2b3efafee3723efd4636de855b46f9fe1efddd607e1f42f60fc8f2136
CODEC_PACKAGE = node_modules/libwebp-1.6.0.tar.gz
CODEC_DIR = node_modules/libwebp
CODEC_BUILD_ROOT := $(CODEC_DIR)/build
CODEC_BASELINE_BUILD_DIR := $(CODEC_BUILD_ROOT)/baseline
CODEC_SIMD_BUILD_DIR := $(CODEC_BUILD_ROOT)/simd
ENVIRONMENT = worker

OUT_JS = enc/webp_enc.js enc/webp_enc_simd.js dec/webp_dec.js enc/webp_node_enc.js dec/webp_node_dec.js
OUT_WASM := $(OUT_JS:.js=.wasm)

.PHONY: all clean

all: $(OUT_JS)

# Define dependencies for all variations of build artifacts.
$(filter enc/%,$(OUT_JS)): enc/webp_enc.o
$(filter dec/%,$(OUT_JS)): dec/webp_dec.o
enc/webp_node_enc.js dec/webp_node_dec.js: ENVIRONMENT = node
enc/webp_node_enc.js dec/webp_node_dec.js: $(CODEC_BASELINE_BUILD_DIR)/libwebp.a
enc/webp_enc.js dec/webp_dec.js: $(CODEC_BASELINE_BUILD_DIR)/libwebp.a
enc/webp_enc_simd.js: $(CODEC_SIMD_BUILD_DIR)/libwebp.a
# libwebp >= 1.3.0 splits libsharpyuv into its own archive. Link it AFTER
# libwebp.a (which references SharpYuv* symbols); it is built by the same cmake
# build, so it already exists once libwebp.a is built.
enc/webp_node_enc.js dec/webp_node_dec.js: $(CODEC_BASELINE_BUILD_DIR)/libsharpyuv.a
enc/webp_enc.js dec/webp_dec.js: $(CODEC_BASELINE_BUILD_DIR)/libsharpyuv.a
enc/webp_enc_simd.js: $(CODEC_SIMD_BUILD_DIR)/libsharpyuv.a

$(OUT_JS):
	$(LD) \
		$(LDFLAGS) \
		--bind \
		-s ENVIRONMENT=$(ENVIRONMENT) \
		-s EXPORT_ES6=1 \
		-o $@ \
		$+

%.o: %.cpp $(CODEC_DIR)/CMakeLists.txt
	$(CXX) -c \
		$(CXXFLAGS) \
		-I $(CODEC_DIR) \
		-o $@ \
		$<

%/libwebp.a: %/Makefile
	$(MAKE) -C $(@D)

# libsharpyuv.a is produced as a byproduct of the libwebp.a cmake build.
%/libsharpyuv.a: %/libwebp.a ;

# Enable SIMD on a SIMD build.
$(CODEC_SIMD_BUILD_DIR)/Makefile: CMAKE_FLAGS+=-DWEBP_ENABLE_SIMD=1

%/Makefile: $(CODEC_DIR)/CMakeLists.txt
	emcmake cmake \
		$(CMAKE_FLAGS) \
		-DCMAKE_DISABLE_FIND_PACKAGE_Threads=1 \
		-DWEBP_BUILD_ANIM_UTILS=0 \
		-DWEBP_BUILD_CWEBP=0 \
		-DWEBP_BUILD_DWEBP=0 \
		-DWEBP_BUILD_GIF2WEBP=0 \
		-DWEBP_BUILD_IMG2WEBP=0 \
		-DWEBP_BUILD_VWEBP=0 \
		-DWEBP_BUILD_WEBPINFO=0 \
		-DWEBP_BUILD_WEBPMUX=0 \
		-DWEBP_BUILD_EXTRAS=0 \
		-B $(@D) \
		$(<D)

$(CODEC_PACKAGE):
	../fetch-verified.sh $(CODEC_URL) $(CODEC_SHA256) $@

$(CODEC_DIR)/CMakeLists.txt: $(CODEC_PACKAGE)
	mkdir -p $(CODEC_DIR)
	tar xz --strip 1 -C $(CODEC_DIR) -f $(CODEC_PACKAGE)

clean:
	$(RM) $(OUT_JS) $(OUT_WASM)
	$(MAKE) -C $(CODEC_BASELINE_BUILD_DIR) clean
	$(MAKE) -C $(CODEC_SIMD_BUILD_DIR) clean
