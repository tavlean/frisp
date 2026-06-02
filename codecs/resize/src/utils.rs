// When the `console_error_panic_hook` feature is enabled, install it once during
// init for readable panic messages in the browser console; otherwise no-op.
// (Plain #[cfg] instead of the cfg-if crate — one fewer dependency.)
#[cfg(feature = "console_error_panic_hook")]
extern crate console_error_panic_hook;

#[cfg(feature = "console_error_panic_hook")]
pub use self::console_error_panic_hook::set_once as set_panic_hook;

#[cfg(not(feature = "console_error_panic_hook"))]
#[inline]
pub fn set_panic_hook() {}
