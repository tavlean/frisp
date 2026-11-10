import type { HandleClientError } from '@sveltejs/kit/hooks';

// SvelteKit replaces an unexpected error's message with "Internal Error"
// before the error page and the crash panels see it. That default exists to
// keep server details private; this app has no server, and the real message
// is what makes a bug report useful. Defining the hook turns off SvelteKit's
// own logging, so the error is logged here.
export const handleError: HandleClientError = ({ error }) => {
  console.error(error);
  if (error instanceof Error && error.message) {
    return { message: error.message };
  }
};
