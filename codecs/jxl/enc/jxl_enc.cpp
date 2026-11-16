#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <jxl/codestream_header.h>
#include <jxl/color_encoding.h>
#include <jxl/encode.h>
#include <jxl/encode_cxx.h>
#include <jxl/types.h>

#ifdef __EMSCRIPTEN_PTHREADS__
#include <jxl/thread_parallel_runner.h>
#include <jxl/thread_parallel_runner_cxx.h>
#endif

#include <cstdint>
#include <vector>

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

// libjxl v0.9 deleted the internal C++ encoder API this wrapper used to call
// (enc_file.h / enc_color_management.h / EncodeFile / GetJxlCms), so from
// v0.12.0 the body is written against the public JxlEncoder* C API, modelled on
// examples/encode_oneshot.cc in the libjxl tree. Only the option *mappings*
// survive from the old body; each one below is the same cparams field the old
// code wrote, reached through the public setter that libjxl's own cjxl tool
// uses for the equivalent flag. The quality->distance curve did NOT survive: it
// was rewritten for v0.12.0, see QualityToDistance.

// libjxl drives BOTH VarDCT and modular modes from butteraugli_distance (lower
// = better quality); quality == 100 -> distance 0 == lossless.
//
// This curve was designed for v0.12.0 and replaces the one carried over from
// v0.8.5. The old one was shaped around an encoder that undershot the distance
// it was asked for, so it compensated with an exponential tail that ran out to
// distance 45. v0.12.0 hits a requested distance accurately, which makes that
// compensation actively harmful, so the curve is calibrated against delivered
// SSIMULACRA2 instead: near-lossless at the top of the slider, solid web
// quality at the 75 default, visibly rough but still full-resolution at 0.
//
// Two deliberate endpoints. Slider 90 is anchored at distance 1.1 so the
// sub-1.0 region stays confined to the very top of the slider (95 and up,
// where near-lossless intent justifies it), because on flat and synthetic
// content that region buys almost no fidelity for a lot of bytes (measured:
// illustration at distance 0.5 is LARGER than at 1.0 for 0.85 SSIMULACRA2).
// And the range stops
// at 15 rather than running to the API's limit of 25, because past distance 10
// the extra range only buys artefacts; with resampling pinned below, the slider
// never enters libjxl's downsampling zone at any position.
static float QualityToDistance(float quality) {
  if (quality >= 100) {
    return 0.0f;
  }
  if (quality >= 30) {
    return 0.1f + (100.0f - quality) * 0.10f;
  }
  // Continuous at the joint: both branches give 7.1 at quality 30.
  return 7.1f + (30.0f - quality) * ((15.0f - 7.1f) / 30.0f);
}

// Drain the encoder into a JS Uint8Array, or null if it failed. Shared by both
// entrypoints and modelled on ReadCompressedOutput in libjxl's own
// lib/extras/enc/jxl.cc, which grows the buffer the same way.
static val ReadCompressedOutput(JxlEncoder* enc) {
  std::vector<uint8_t> compressed(64);
  uint8_t* next_out = compressed.data();
  size_t avail_out = compressed.size();
  JxlEncoderStatus process_result = JXL_ENC_NEED_MORE_OUTPUT;
  while (process_result == JXL_ENC_NEED_MORE_OUTPUT) {
    process_result = JxlEncoderProcessOutput(enc, &next_out, &avail_out);
    if (process_result == JXL_ENC_NEED_MORE_OUTPUT) {
      size_t offset = next_out - compressed.data();
      compressed.resize(compressed.size() * 2);
      next_out = compressed.data() + offset;
      avail_out = compressed.size() - offset;
    }
  }
  if (JXL_ENC_SUCCESS != process_result) {
    return val::null();
  }
  compressed.resize(next_out - compressed.data());

  // Resolve the Uint8Array constructor at call time rather than via a
  // namespace-scope `thread_local val::global(...)`: in this large module on
  // emcc 3.1.0 the static-init handle can be created before the JS runtime is
  // ready, yielding an invalid emval handle that throws when `.new_` is used.
  return val::global("Uint8Array").new_(typed_memory_view(compressed.size(), compressed.data()));
}

val encode(std::string image, int width, int height, JXLOptions options) {
  const float distance = QualityToDistance(options.quality);
  const bool lossless = (distance == 0.0f);

  // Declared before the encoder so it outlives it: unique_ptr members are
  // destroyed in reverse declaration order, which destroys the encoder first
  // and only then the runner it points at.
#ifdef __EMSCRIPTEN_PTHREADS__
  JxlThreadParallelRunnerPtr runner = JxlThreadParallelRunnerMake(
      nullptr, JxlThreadParallelRunnerDefaultNumWorkerThreads());
  if (!runner) {
    return val::null();
  }
#endif

  JxlEncoderPtr enc = JxlEncoderMake(nullptr);
  if (!enc) {
    return val::null();
  }

  // Single-threaded variants are built without -pthread and link no
  // libjxl_threads.a, so they must not touch the runner API at all; libjxl then
  // runs its own sequential runner.
#ifdef __EMSCRIPTEN_PTHREADS__
  if (JXL_ENC_SUCCESS != JxlEncoderSetParallelRunner(enc.get(), JxlThreadParallelRunner,
                                                     runner.get())) {
    return val::null();
  }
#endif

  JxlBasicInfo info;
  JxlEncoderInitBasicInfo(&info);
  info.xsize = width;
  info.ysize = height;
  info.num_color_channels = 3;
  info.num_extra_channels = 1;
  info.alpha_bits = 8;
  info.bits_per_sample = 8;
  // Lossless requires the original (non-XYB) profile; leaving this false makes
  // JxlEncoderSetFrameLossless fail and would silently downgrade lossless.
  info.uses_original_profile = lossless ? JXL_TRUE : JXL_FALSE;
  if (JXL_ENC_SUCCESS != JxlEncoderSetBasicInfo(enc.get(), &info)) {
    return val::null();
  }

  JxlColorEncoding color_encoding;
  JxlColorEncodingSetToSRGB(&color_encoding, /*is_gray=*/JXL_FALSE);
  if (JXL_ENC_SUCCESS != JxlEncoderSetColorEncoding(enc.get(), &color_encoding)) {
    return val::null();
  }

  JxlEncoderFrameSettings* frame_settings = JxlEncoderFrameSettingsCreate(enc.get(), nullptr);
  if (!frame_settings) {
    return val::null();
  }

  // effort -> cparams.speed_tier: the public setter applies the same
  // SpeedTier(10 - effort) the old wrapper computed by hand.
  if (JXL_ENC_SUCCESS !=
      JxlEncoderFrameSettingsSetOption(frame_settings, JXL_ENC_FRAME_SETTING_EFFORT,
                                       options.effort)) {
    return val::null();
  }
  if (JXL_ENC_SUCCESS !=
      JxlEncoderFrameSettingsSetOption(frame_settings, JXL_ENC_FRAME_SETTING_EPF, options.epf)) {
    return val::null();
  }
  if (JXL_ENC_SUCCESS !=
      JxlEncoderFrameSettingsSetOption(frame_settings, JXL_ENC_FRAME_SETTING_DECODING_SPEED,
                                       options.decodingSpeedTier)) {
    return val::null();
  }
  if (JXL_ENC_SUCCESS !=
      JxlEncoderFrameSettingsSetFloatOption(frame_settings, JXL_ENC_FRAME_SETTING_PHOTON_NOISE,
                                            options.photonNoiseIso)) {
    return val::null();
  }
  // Not an option the app exposes: it pins the encoder to the whole-image mode
  // v0.8.5 always used. v0.11 added a streaming mode that libjxl turns on by
  // default (buffering = -1) once a frame has more than 8 groups, trading
  // compression for peak memory. Measured on tests/fixtures/screenshot.png at
  // the default quality, letting it stream costs 28702 bytes against 14064 with
  // streaming off. Frisp already held whole images in memory at v0.8.5, so this
  // keeps the behaviour it had rather than adopting a new mode.
  if (JXL_ENC_SUCCESS !=
      JxlEncoderFrameSettingsSetOption(frame_settings, JXL_ENC_FRAME_SETTING_BUFFERING, 0)) {
    return val::null();
  }
  // Also not an app option, and the more important of the two pins. Left alone,
  // libjxl silently encodes at half resolution once the distance crosses a
  // threshold, and v0.9 moved that threshold from 20 down to 10 (it also
  // rescales the distance to d * 0.25 + 0.25 when it fires). The app has an
  // explicit resize control, so output resolution is the user's decision and
  // must never be a hidden consequence of the quality slider. Pinning it is
  // also just better: on tests/fixtures/screenshot.png at distance 10, letting
  // libjxl downsample gives 11161 bytes at SSIMULACRA2 8.56, while pinning full
  // resolution gives 6393 bytes at 56.80. Smaller and far better.
  if (JXL_ENC_SUCCESS !=
      JxlEncoderFrameSettingsSetOption(frame_settings, JXL_ENC_FRAME_SETTING_RESAMPLING, 1)) {
    return val::null();
  }

  if (options.lossyPalette) {
    // Near-lossless palette assumes -R 0 and the Zero predictor, as before. The
    // modular_mode this block used to set is immediately overwritten by the
    // MODULAR write below, exactly as in the v0.8.5 wrapper.
    if (JXL_ENC_SUCCESS !=
            JxlEncoderFrameSettingsSetOption(frame_settings,
                                             JXL_ENC_FRAME_SETTING_LOSSY_PALETTE, 1) ||
        JXL_ENC_SUCCESS != JxlEncoderFrameSettingsSetOption(
                               frame_settings, JXL_ENC_FRAME_SETTING_PALETTE_COLORS, 0) ||
        JXL_ENC_SUCCESS !=
            JxlEncoderFrameSettingsSetOption(frame_settings,
                                             JXL_ENC_FRAME_SETTING_MODULAR_PREDICTOR,
                                             /*jxl::Predictor::Zero=*/0) ||
        JXL_ENC_SUCCESS !=
            JxlEncoderFrameSettingsSetOption(frame_settings, JXL_ENC_FRAME_SETTING_RESPONSIVE, 0)) {
      return val::null();
    }
  }

  const bool modular = (options.lossyModular || lossless);
  if (JXL_ENC_SUCCESS != JxlEncoderFrameSettingsSetOption(
                             frame_settings, JXL_ENC_FRAME_SETTING_MODULAR, modular ? 1 : 0)) {
    return val::null();
  }

  if (options.progressive) {
    if (JXL_ENC_SUCCESS !=
            JxlEncoderFrameSettingsSetOption(frame_settings,
                                             JXL_ENC_FRAME_SETTING_QPROGRESSIVE_AC, 1) ||
        JXL_ENC_SUCCESS !=
            JxlEncoderFrameSettingsSetOption(frame_settings, JXL_ENC_FRAME_SETTING_RESPONSIVE, 1)) {
      return val::null();
    }
    if (!modular && JXL_ENC_SUCCESS !=
                        JxlEncoderFrameSettingsSetOption(
                            frame_settings, JXL_ENC_FRAME_SETTING_PROGRESSIVE_DC, 1)) {
      return val::null();
    }
  }

  if (modular) {
    // Lossless modular keeps exact RGB (kNone); lossy uses XYB. jxl::ColorTransform
    // is kXYB = 0, kNone = 1, and JXL_ENC_FRAME_SETTING_COLOR_TRANSFORM takes the
    // enum value directly.
    if (JXL_ENC_SUCCESS != JxlEncoderFrameSettingsSetOption(
                               frame_settings, JXL_ENC_FRAME_SETTING_COLOR_TRANSFORM,
                               lossless ? 1 : 0)) {
      return val::null();
    }
  }

  if (lossless) {
    if (JXL_ENC_SUCCESS != JxlEncoderSetFrameLossless(frame_settings, JXL_TRUE)) {
      return val::null();
    }
  } else if (JXL_ENC_SUCCESS != JxlEncoderSetFrameDistance(frame_settings, distance)) {
    return val::null();
  }

  // 4 channels = RGBA (alpha comes from the alpha_bits above); UINT8
  // little-endian matches the input buffer.
  JxlPixelFormat format = {/*num_channels=*/4, /*data_type=*/JXL_TYPE_UINT8,
                           /*endianness=*/JXL_LITTLE_ENDIAN, /*align=*/0};
  if (JXL_ENC_SUCCESS != JxlEncoderAddImageFrame(frame_settings, &format,
                                                 static_cast<const void*>(image.data()),
                                                 image.size())) {
    return val::null();
  }
  // Without this the ProcessOutput loop never reaches JXL_ENC_SUCCESS and the
  // encode hangs.
  JxlEncoderCloseInput(enc.get());

  return ReadCompressedOutput(enc.get());
}

// Repacks a complete JPEG FILE's existing DCT coefficients into a JXL container
// and stores the metadata that makes `djxl out.jxl back.jpg` give back the
// original file byte for byte. This is not an encode: there is no pixel data,
// no quality decision, and no generation loss, which is why it takes the file
// bytes rather than an ImageData and shares none of encode()'s option mapping.
// Returns null when libjxl cannot parse the JPEG or cannot build reconstruction
// data (CMYK, arithmetic coding, excess tail data); the caller falls back to a
// normal pixel encode.
val transcodeJPEG(std::string jpeg_bytes) {
#ifdef __EMSCRIPTEN_PTHREADS__
  JxlThreadParallelRunnerPtr runner = JxlThreadParallelRunnerMake(
      nullptr, JxlThreadParallelRunnerDefaultNumWorkerThreads());
  if (!runner) {
    return val::null();
  }
#endif

  JxlEncoderPtr enc = JxlEncoderMake(nullptr);
  if (!enc) {
    return val::null();
  }

#ifdef __EMSCRIPTEN_PTHREADS__
  if (JXL_ENC_SUCCESS != JxlEncoderSetParallelRunner(enc.get(), JxlThreadParallelRunner,
                                                     runner.get())) {
    return val::null();
  }
#endif

  // The reconstruction data rides in a `jbrd` box, which only exists in the
  // container format, so the output has to be a container rather than a bare
  // codestream. cjxl's JPEG-input path asks for this explicitly too.
  if (JXL_ENC_SUCCESS != JxlEncoderUseContainer(enc.get(), JXL_TRUE)) {
    return val::null();
  }
  // Must precede AddJPEGFrame: that is where libjxl reads the flag and builds
  // the reconstruction data. Set afterwards it is silently ignored, and the
  // output would decode correctly while no longer being reversible.
  if (JXL_ENC_SUCCESS != JxlEncoderStoreJPEGMetadata(enc.get(), JXL_TRUE)) {
    return val::null();
  }

  JxlEncoderFrameSettings* frame_settings = JxlEncoderFrameSettingsCreate(enc.get(), nullptr);
  if (!frame_settings) {
    return val::null();
  }

  // One frame option only. The JPEG supplies the basic info, the colour
  // encoding and the coefficients, so distance, effort and modular mode have
  // nothing to act on. The two pins encode() needs are no-ops here as well:
  // libjxl refuses to stream a JPEG frame whatever BUFFERING says
  // (CanDoStreamingEncoding bails on IsJPEG), and resampling belongs to the
  // pixel path it never enters.
  //
  // LF smoothing is pinned off. v0.13.0 turns it on by default for 4:4:4
  // JPEGs, and decoders before v0.13.0 wrongly apply it while rebuilding the
  // JPEG, so `djxl` 0.12 cannot get the original file back from such a JXL
  // (measured: a 4:4:4 cjpeg photo reconstructs bit-exactly from the 0.12 and
  // the smoothing-off output, and not from the 0.13 default). Off keeps every
  // transcode reversible by every libjxl decoder; 4:2:0 JPEGs are unaffected.
  if (JXL_ENC_SUCCESS !=
      JxlEncoderFrameSettingsSetOption(frame_settings, JXL_ENC_FRAME_SETTING_JPEG_RECON_LFS, 0)) {
    return val::null();
  }
  if (JXL_ENC_SUCCESS !=
      JxlEncoderAddJPEGFrame(frame_settings,
                             reinterpret_cast<const uint8_t*>(jpeg_bytes.data()),
                             jpeg_bytes.size())) {
    return val::null();
  }
  JxlEncoderCloseInput(enc.get());

  return ReadCompressedOutput(enc.get());
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
  function("transcodeJPEG", &transcodeJPEG);
}
