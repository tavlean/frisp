/* CMake generates this header for libjxl builds (GenerateExportHeader). This
 * codec compiles the metric's libjxl slice straight into one static WASM
 * module, so nothing is exported across a library boundary and the macros are
 * empty. */
#ifndef JXL_EXPORT_H
#define JXL_EXPORT_H

#define JXL_EXPORT
#define JXL_NO_EXPORT
#define JXL_DEPRECATED

#endif /* JXL_EXPORT_H */
