# Fetched through ../fetch-verified.sh; see docs/codec-provenance.md for the pin.
CODEC_URL := https://github.com/ImageOptim/libimagequant/archive/2.18.0.tar.gz
CODEC_SHA256 := 790d2593a587f9a27cec6245ee7a212b34b0aa63cac6383e550eda01236be636
CODEC_PACKAGE := node_modules/libimagequant-2.18.0.tar.gz
CODEC_DIR := node_modules/libimagequant
CODEC_OUT_RELATIVE := libimagequant.a
CODEC_OUT := $(addprefix $(CODEC_DIR)/, $(CODEC_OUT_RELATIVE))
OUT_JS := imagequant.js imagequant_node.js
OUT_WASM := $(OUT_JS:.js=.wasm)
ENVIRONMENT = worker

.PHONY: all clean

all: $(OUT_JS)

imagequant_node.js: ENVIRONMENT=node
$(OUT_JS): $(CODEC_OUT)
	$(CXX) \
		-I $(CODEC_DIR) \
		${CXXFLAGS} \
		${LDFLAGS} \
		--bind \
		-s ENVIRONMENT=$(ENVIRONMENT) \
		-s EXPORT_ES6=1 \
		-o $@ \
		$+ \
		imagequant.cpp

$(CODEC_OUT): $(CODEC_DIR)/config.mk
	$(MAKE) -C $(CODEC_DIR) $(CODEC_OUT_RELATIVE)

$(CODEC_DIR)/config.mk: $(CODEC_DIR)/configure
	cd $(CODEC_DIR) && ./configure \
		--disable-sse

$(CODEC_PACKAGE):
	../fetch-verified.sh $(CODEC_URL) $(CODEC_SHA256) $@

# Extract into an empty directory, so a pin bump never builds on top of the
# previous tree; `m` keeps the extracted files newer than the tarball.
$(CODEC_DIR)/configure: $(CODEC_PACKAGE)
	$(RM) -r $(CODEC_DIR)
	mkdir -p $(CODEC_DIR)
	tar xzm --strip 1 -C $(CODEC_DIR) -f $(CODEC_PACKAGE)

clean:
	$(RM) $(OUT_JS) $(OUT_WASM)
	$(MAKE) -C $(CODEC_DIR) clean
