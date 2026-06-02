#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "lib/jxl/base/thread_pool_internal.h"
#include "lib/jxl/enc_external_image.h"
#include "lib/jxl/enc_file.h"
#include "lib/jxl/enc_color_management.h"

using namespace emscripten;

struct JXLOptions {
  int effort;
  float quality;
  bool progressive;
  int epf;
  bool lossyPalette;
  size_t decodingSpeedTier;
  float photonNoiseIso;
  bool lossyModular;
};

val encode(std::string image, int width, int height, JXLOptions options) {
  jxl::CompressParams cparams;
  jxl::PassesEncoderState passes_enc_state;
  jxl::CodecInOut io;
  jxl::PaddedBytes bytes;
  jxl::ImageBundle* main = &io.Main();
  jxl::ThreadPoolInternal* pool_ptr = nullptr;
#ifdef __EMSCRIPTEN_PTHREADS__
  jxl::ThreadPoolInternal pool;
  pool_ptr = &pool;
#endif

  size_t st = 10 - options.effort;
  cparams.speed_tier = jxl::SpeedTier(st);

  cparams.epf = options.epf;
  cparams.decoding_speed_tier = options.decodingSpeedTier;
  cparams.photon_noise_iso = options.photonNoiseIso;

  if (options.lossyPalette) {
    cparams.lossy_palette = true;
    cparams.palette_colors = 0;
    cparams.options.predictor = jxl::Predictor::Zero;
    // Near-lossless assumes -R 0
    cparams.responsive = 0;
    cparams.modular_mode = true;
  }

  float quality = options.quality;

  // Quality settings roughly match libjpeg qualities. libjxl v0.8 drives BOTH
  // VarDCT and modular modes from butteraugli_distance (lower = better quality);
  // the old modular-only `quality_pair` field was removed, so map quality ->
  // distance for both. quality == 100 -> distance 0 == lossless.
  if (quality >= 100) {
    cparams.butteraugli_distance = 0.0f;
  } else if (quality >= 30) {
    cparams.butteraugli_distance = 0.1 + (100 - quality) * 0.09;
  } else {
    cparams.butteraugli_distance = 6.4 + pow(2.5, (30 - quality) / 5.0f) / 6.25f;
  }
  cparams.modular_mode = (options.lossyModular || quality == 100);

  if (options.progressive) {
    cparams.qprogressive_mode = true;
    cparams.responsive = 1;
    if (!cparams.modular_mode) {
      cparams.progressive_dc = 1;
    }
  }

  if (cparams.modular_mode) {
    // Lossless modular (distance 0) keeps exact RGB (no XYB); lossy uses XYB.
    if (cparams.butteraugli_distance != 0.0f) {
      cparams.color_transform = jxl::ColorTransform::kXYB;
    } else {
      cparams.color_transform = jxl::ColorTransform::kNone;
    }
  }

  io.metadata.m.SetAlphaBits(8);
  if (!io.metadata.size.Set(width, height)) {
    return val::null();
  }

  // libjxl v0.8 ConvertFromExternal takes a JxlPixelFormat instead of the old
  // has_alpha/endianness/float_in args. 4 channels = RGBA (alpha comes from the
  // SetAlphaBits(8) above); UINT8 little-endian matches the input buffer.
  JxlPixelFormat format = {/*num_channels=*/4, /*data_type=*/JXL_TYPE_UINT8,
                           /*endianness=*/JXL_LITTLE_ENDIAN, /*align=*/0};
  auto result = jxl::ConvertFromExternal(
      jxl::Span<const uint8_t>(reinterpret_cast<const uint8_t*>(image.data()), image.size()), width,
      height, jxl::ColorEncoding::SRGB(/*is_gray=*/false), /*bits_per_sample=*/8, format, pool_ptr,
      main);

  if (!result) {
    return val::null();
  }

  auto js_result = val::null();
  if (EncodeFile(cparams, &io, &passes_enc_state, &bytes, jxl::GetJxlCms(), /*aux=*/nullptr,
                 pool_ptr)) {
    // Resolve the Uint8Array constructor at call time rather than via a
    // namespace-scope `thread_local val::global(...)`: in this large module on
    // emcc 3.1.0 the static-init handle can be created before the JS runtime is
    // ready, yielding an invalid emval handle that throws when `.new_` is used.
    js_result = val::global("Uint8Array").new_(typed_memory_view(bytes.size(), bytes.data()));
  }

  return js_result;
}

EMSCRIPTEN_BINDINGS(my_module) {
  value_object<JXLOptions>("JXLOptions")
      .field("effort", &JXLOptions::effort)
      .field("quality", &JXLOptions::quality)
      .field("progressive", &JXLOptions::progressive)
      .field("lossyPalette", &JXLOptions::lossyPalette)
      .field("decodingSpeedTier", &JXLOptions::decodingSpeedTier)
      .field("photonNoiseIso", &JXLOptions::photonNoiseIso)
      .field("lossyModular", &JXLOptions::lossyModular)
      .field("epf", &JXLOptions::epf);

  function("encode", &encode);
}
