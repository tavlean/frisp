#include <emscripten/bind.h>

#include <algorithm>
#include <cstdint>
#include <string>

#include "lib/jxl/color_encoding_internal.h"
#include "lib/jxl/image.h"
#include "lib/jxl/image_bundle.h"
#include "lib/jxl/image_metadata.h"
#include "ssimulacra2.h"

using namespace emscripten;

// Below this the metric's multiscale downsampling has nothing left to compare;
// the reference CLI rejects the same sizes.
static const int kMinSide = 8;
static const double kFailure = -1000.0;

// One RGBA8 buffer (sRGB, straight alpha) as an ImageBundle, the input type
// ComputeSSIMULACRA2 declares. Colour conversion (sRGB to linear to XYB) is
// the library's job; this only unpacks bytes to floats in [0, 1].
static void FillBundle(const uint8_t* rgba, int width, int height,
                       bool with_alpha, jxl::ImageBundle* bundle) {
  jxl::Image3F color(width, height);
  jxl::ImageF alpha(with_alpha ? width : 0, with_alpha ? height : 0);
  for (int y = 0; y < height; ++y) {
    float* r = color.PlaneRow(0, y);
    float* g = color.PlaneRow(1, y);
    float* b = color.PlaneRow(2, y);
    float* a = with_alpha ? alpha.Row(y) : nullptr;
    const uint8_t* px = rgba + static_cast<size_t>(y) * width * 4;
    for (int x = 0; x < width; ++x, px += 4) {
      r[x] = px[0] / 255.0f;
      g[x] = px[1] / 255.0f;
      b[x] = px[2] / 255.0f;
      if (a) a[x] = px[3] / 255.0f;
    }
  }
  bundle->SetFromImage(std::move(color), jxl::ColorEncoding::SRGB());
  if (with_alpha) bundle->SetAlpha(std::move(alpha), false);
}

static bool HasTransparency(const std::string& rgba) {
  for (size_t i = 3; i < rgba.size(); i += 4) {
    if (static_cast<uint8_t>(rgba[i]) != 255) return true;
  }
  return false;
}

// The SSIMULACRA2 score of `dist` against `ref`: 100 is mathematically
// lossless, 90 visually lossless, 70 high quality. Returns -1000 for inputs
// the metric cannot judge (size mismatch, a side under 8 pixels). With any
// transparency in either image, both are blended onto a dark and a bright
// background and the worse score wins, exactly as the reference CLI
// (ssimulacra2_main.cc) does, so a codec cannot hide damage behind alpha.
double score(std::string ref, std::string dist, int width, int height) {
  const size_t bytes = static_cast<size_t>(width) * height * 4;
  if (width < kMinSide || height < kMinSide || ref.size() != bytes ||
      dist.size() != bytes) {
    return kFailure;
  }
  const bool with_alpha = HasTransparency(ref) || HasTransparency(dist);

  jxl::ImageMetadata metadata;
  metadata.SetUintSamples(8);
  metadata.color_encoding = jxl::ColorEncoding::SRGB();
  if (with_alpha) metadata.SetAlphaBits(8);

  jxl::ImageBundle orig(&metadata);
  jxl::ImageBundle distorted(&metadata);
  FillBundle(reinterpret_cast<const uint8_t*>(ref.data()), width, height,
             with_alpha, &orig);
  FillBundle(reinterpret_cast<const uint8_t*>(dist.data()), width, height,
             with_alpha, &distorted);

  if (!with_alpha) return ComputeSSIMULACRA2(orig, distorted).Score();
  return std::min(ComputeSSIMULACRA2(orig, distorted, 0.1f).Score(),
                  ComputeSSIMULACRA2(orig, distorted, 0.9f).Score());
}

EMSCRIPTEN_BINDINGS(my_module) { function("score", &score); }
