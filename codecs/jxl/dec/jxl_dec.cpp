#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <jxl/decode.h>

#include "skcms.h"

using namespace emscripten;

// R, G, B, A
#define COMPONENTS_PER_PIXEL 4

#ifndef JXL_DEBUG_ON_ALL_ERROR
#define JXL_DEBUG_ON_ALL_ERROR 0
#endif

#if JXL_DEBUG_ON_ALL_ERROR
#define EXPECT_TRUE(a)                                             \
  if (!(a)) {                                                      \
    fprintf(stderr, "Assertion failure (%d): %s\n", __LINE__, #a); \
    return val::null();                                            \
  }
#define EXPECT_EQ(a, b)                                                                          \
  {                                                                                              \
    int a_ = a;                                                                                  \
    int b_ = b;                                                                                  \
    if (a_ != b_) {                                                                              \
      fprintf(stderr, "Assertion failure (%d): %s (%d) != %s (%d)\n", __LINE__, #a, a_, #b, b_); \
      return val::null();                                                                        \
    }                                                                                            \
  }
#else
#define EXPECT_TRUE(a)  \
  if (!(a)) {           \
    return val::null(); \
  }

#define EXPECT_EQ(a, b) EXPECT_TRUE((a) == (b));
#endif

// True when the decoded pixels are already what ImageData holds: sRGB (or
// grey on the sRGB curve) with straight alpha. A lossless image tagged with
// an ICC profile has no encoded profile, so it returns false and keeps skcms.
// A lossy one whose ICC libjxl cannot express reports linear sRGB, and only
// the transfer function check keeps that on skcms.
static bool IsStraightSRGB(const JxlDecoder* dec, const JxlBasicInfo& info) {
  JxlColorEncoding color;
  if (info.alpha_premultiplied ||
      JxlDecoderGetColorAsEncodedProfile(dec, JXL_COLOR_PROFILE_TARGET_DATA, &color) !=
          JXL_DEC_SUCCESS) {
    return false;
  }
  bool srgb_space = color.color_space == JXL_COLOR_SPACE_GRAY ||
                    (color.color_space == JXL_COLOR_SPACE_RGB &&
                     color.primaries == JXL_PRIMARIES_SRGB);
  return srgb_space && color.white_point == JXL_WHITE_POINT_D65 &&
         color.transfer_function == JXL_TRANSFER_FUNCTION_SRGB;
}

val decode(std::string data) {
  std::unique_ptr<JxlDecoder,
                  std::integral_constant<decltype(&JxlDecoderDestroy), JxlDecoderDestroy>>
      dec(JxlDecoderCreate(nullptr));
  EXPECT_EQ(JXL_DEC_SUCCESS,
            JxlDecoderSubscribeEvents(
                dec.get(), JXL_DEC_BASIC_INFO | JXL_DEC_COLOR_ENCODING | JXL_DEC_FULL_IMAGE));

  auto next_in = (const uint8_t*)data.c_str();
  auto avail_in = data.size();
  JxlDecoderSetInput(dec.get(), next_in, avail_in);
  EXPECT_EQ(JXL_DEC_BASIC_INFO, JxlDecoderProcessInput(dec.get()));
  JxlBasicInfo info;
  EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderGetBasicInfo(dec.get(), &info));
  size_t pixel_count = info.xsize * info.ysize;
  size_t component_count = pixel_count * COMPONENTS_PER_PIXEL;

  EXPECT_EQ(JXL_DEC_COLOR_ENCODING, JxlDecoderProcessInput(dec.get()));
  static const JxlPixelFormat format = {COMPONENTS_PER_PIXEL, JXL_TYPE_FLOAT, JXL_LITTLE_ENDIAN, 0};
  size_t icc_size;
  // libjxl v0.9 dropped the unused JxlPixelFormat argument from both of these.
  EXPECT_EQ(JXL_DEC_SUCCESS,
            JxlDecoderGetICCProfileSize(dec.get(), JXL_COLOR_PROFILE_TARGET_DATA, &icc_size));
  std::vector<uint8_t> icc_profile(icc_size);
  EXPECT_EQ(JXL_DEC_SUCCESS,
            JxlDecoderGetColorAsICCProfile(dec.get(), JXL_COLOR_PROFILE_TARGET_DATA,
                                           icc_profile.data(), icc_profile.size()));

  EXPECT_EQ(JXL_DEC_NEED_IMAGE_OUT_BUFFER, JxlDecoderProcessInput(dec.get()));
  size_t buffer_size;
  EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderImageOutBufferSize(dec.get(), &format, &buffer_size));
  EXPECT_EQ(buffer_size, component_count * sizeof(float));

  auto float_pixels = std::make_unique<float[]>(component_count);
  EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderSetImageOutBuffer(dec.get(), &format, float_pixels.get(),
                                                         component_count * sizeof(float)));
  EXPECT_EQ(JXL_DEC_FULL_IMAGE, JxlDecoderProcessInput(dec.get()));

  auto byte_pixels = std::make_unique<uint8_t[]>(component_count);
  if (IsStraightSRGB(dec.get(), info)) {
    // Already sRGB, so only quantize, rounding as skcms does. Do not send it
    // through skcms: libjxl builds its sRGB ICC matrix from the chromaticities
    // and lands three fixed-point steps from the canonical values skcms
    // hard-codes, so skcms runs a real gamut conversion whose green-to-red
    // term (-0.0002) pulled 1268 dark red values under bright green down a
    // level in lossless noise-synthetic.png. Nor ask libjxl for
    // JXL_TYPE_UINT8: it adds blue-noise dither to 8-bit output, which changes
    // 6 to 22% of the values of a lossy decode, and the auto-quality scorer
    // reads those.
    for (size_t i = 0; i < component_count; i++) {
      // Written so a NaN from a crafted float image becomes 0 instead of
      // reaching the cast, where it would be undefined.
      float v = float_pixels[i];
      v = v > 0.0f ? (v < 1.0f ? v : 1.0f) : 0.0f;
      byte_pixels[i] = static_cast<uint8_t>(v * 255.0f + 0.5f);
    }
  } else {
    // Convert to sRGB.
    skcms_ICCProfile jxl_profile;
    EXPECT_TRUE(skcms_Parse(icc_profile.data(), icc_profile.size(), &jxl_profile));
    EXPECT_TRUE(skcms_Transform(
        float_pixels.get(), skcms_PixelFormat_RGBA_ffff,
        info.alpha_premultiplied ? skcms_AlphaFormat_PremulAsEncoded : skcms_AlphaFormat_Unpremul,
        &jxl_profile, byte_pixels.get(), skcms_PixelFormat_RGBA_8888, skcms_AlphaFormat_Unpremul,
        skcms_sRGB_profile(), pixel_count));
  }

  // Resolve the JS constructors at call time rather than via namespace-scope
  // `thread_local val::global(...)`: the static-init handles can be created
  // before the JS runtime is ready in this module on emcc 3.1.0, yielding an
  // invalid emval handle that throws when `.new_` is used.
  return val::global("ImageData")
      .new_(val::global("Uint8ClampedArray")
                .new_(typed_memory_view(component_count, byte_pixels.get())),
            info.xsize, info.ysize);
}

EMSCRIPTEN_BINDINGS(my_module) {
  function("decode", &decode);
}
