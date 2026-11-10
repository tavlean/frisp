// The intro group has no index of its own anymore (the lab layout's tab bar is
// the switcher), so this route just forwards to the first variant.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export function load(): never {
  redirect(307, resolve('/lab/intro/billboard'));
}
