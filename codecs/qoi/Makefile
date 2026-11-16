# Fetched through ../fetch-verified.sh; see docs/codec-provenance.md for the pin.
CODEC_URL = https://github.com/phoboslab/qoi/archive/8d35d93cdca85d2868246c2a8a80a1e2c16ba2a8.tar.gz
CODEC_SHA256 = 00f10a37021d1f75c78a94a95cf45500177b6f78e9a9b27cef49237798bd4db4
CODEC_PACKAGE = node_modules/qoi-8d35d93c.tar.gz

CODEC_DIR = node_modules/qoi
CODEC_BUILD_DIR:= $(CODEC_DIR)/build
ENVIRONMENT = worker

OUT_JS = enc/qoi_enc.js dec/qoi_dec.js
OUT_WASM := $(OUT_JS:.js=.wasm)

.PHONY: all clean

all: $(OUT_JS)

$(filter enc/%,$(OUT_JS)): enc/qoi_enc.o
$(filter dec/%,$(OUT_JS)): dec/qoi_dec.o

# ALL .js FILES
$(OUT_JS):
	$(LD) \
		$(LDFLAGS) \
		--bind \
		-s ENVIRONMENT=$(ENVIRONMENT) \
		-s EXPORT_ES6=1 \
		-o $@ \
		$+

# ALL .o FILES
%.o: %.cpp $(CODEC_DIR)/qoi.h
	$(CXX) -c \
		$(CXXFLAGS) \
		-I $(CODEC_DIR) \
		-o $@ \
		$<

# CREATE DIRECTORY
$(CODEC_PACKAGE):
	../fetch-verified.sh $(CODEC_URL) $(CODEC_SHA256) $@

# Extract into an empty directory, so a pin bump never builds on top of the
# previous tree; `m` keeps the extracted files newer than the tarball.
$(CODEC_DIR)/qoi.h: $(CODEC_PACKAGE)
	$(RM) -r $(CODEC_DIR)
	mkdir -p $(CODEC_DIR)
	tar xzm --strip 1 -C $(CODEC_DIR) -f $(CODEC_PACKAGE)

clean:
	$(RM) $(OUT_JS) $(OUT_WASM)
	$(MAKE) -C $(CODEC_DIR) clean
