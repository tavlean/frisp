# SSIMULACRA 2.1, the perceptual metric behind auto-quality. Scores only; it
# never encodes. Built from Cloudinary's standalone repo, which carries the
# metric plus the small slice of libjxl it needs (XYB conversion, gaussian
# blur, colour management). That slice is libjxl 0.8-era code, so it is paired
# with the same Highway release libjxl 0.8 vendored (1.0.2) and with lcms2,
# the colour engine the slice's enc_color_management.cc is written against
# (its skcms branch needs a header the slice does not ship).
#
# No CMake: the upstream project insists on a system Highway and lcms2 and
# builds image loaders we never call, so the needed sources are compiled
# directly. Every pin below is recorded in docs/codec-provenance.md.
CODEC_URL := https://github.com/cloudinary/ssimulacra2.git
CODEC_VERSION := 81feacf6a5b0bbd7ec11b4a881a4615033ab0b10
CODEC_DIR := node_modules/ssimulacra2

HWY_URL := https://github.com/google/highway.git
HWY_VERSION := f670ea580bb70b4113b63b9cdaa42ba9b10cd13a
HWY_DIR := node_modules/highway

LCMS_URL := https://github.com/mm2/Little-CMS.git
LCMS_VERSION := lcms2.16
LCMS_DIR := node_modules/lcms2

SRC := $(CODEC_DIR)/src
LCMS_LIB := $(LCMS_DIR)/liblcms2.a

OUT_JS := ssimulacra2.js ssimulacra2_node.js
OUT_WASM := $(OUT_JS:.js=.wasm)
ENVIRONMENT = worker

.PHONY: all clean

all: $(OUT_JS)

ssimulacra2_node.js: ENVIRONMENT = node

# Single-threaded and without -msimd128: the metric runs once per probe
# between encodes that cost far more, so it ships one variant used everywhere
# (Highway falls back to its portable EMU128 target).
#
# The source lists are globbed in the shell, not with $(wildcard): make reads
# the directories before the fetch rules populate them, so a make-time glob
# comes back empty on a clean build. include/ supplies jxl_export.h, which
# libjxl's CMake would otherwise generate.
$(OUT_JS): ssimulacra2.cpp $(SRC)/ssimulacra2.cc $(HWY_DIR)/hwy/targets.cc $(LCMS_LIB)
	$(CXX) \
		-I include \
		-I $(SRC) \
		-I $(SRC)/lib/include \
		-I $(HWY_DIR) \
		-I $(LCMS_DIR)/include \
		-DJPEGXL_ENABLE_SKCMS=0 \
		-Wno-deprecated-declarations \
		${CXXFLAGS} \
		${LDFLAGS} \
		--bind \
		-s ENVIRONMENT=$(ENVIRONMENT) \
		-s EXPORT_ES6=1 \
		-o $@ \
		ssimulacra2.cpp \
		$(SRC)/ssimulacra2.cc \
		`ls $(SRC)/lib/jxl/*.cc | grep -v '_test\.cc$$'` \
		$(SRC)/lib/jxl/base/*.cc \
		$(HWY_DIR)/hwy/targets.cc \
		$(HWY_DIR)/hwy/aligned_allocator.cc \
		$(LCMS_LIB)

# lcms2 is C; it builds into its own archive so the C++ link line stays C++.
$(LCMS_LIB): $(LCMS_DIR)/src/cmsxform.c
	cd $(LCMS_DIR) && for f in src/*.c; do \
		$(CC) -I include ${CFLAGS} -c $$f -o $${f%.c}.o || exit 1; \
	done && $(AR) rcs liblcms2.a src/*.o

$(SRC)/ssimulacra2.cc:
	$(RM) -r $(CODEC_DIR)
	git init $(CODEC_DIR)
	git -C $(CODEC_DIR) fetch $(CODEC_URL) $(CODEC_VERSION) --depth 1
	git -C $(CODEC_DIR) checkout FETCH_HEAD

$(HWY_DIR)/hwy/targets.cc:
	$(RM) -r $(HWY_DIR)
	git init $(HWY_DIR)
	git -C $(HWY_DIR) fetch $(HWY_URL) $(HWY_VERSION) --depth 1
	git -C $(HWY_DIR) checkout FETCH_HEAD

$(LCMS_DIR)/src/cmsxform.c:
	$(RM) -r $(LCMS_DIR)
	git clone --depth 1 --branch $(LCMS_VERSION) $(LCMS_URL) $(LCMS_DIR)

clean:
	$(RM) $(OUT_JS) $(OUT_WASM)
