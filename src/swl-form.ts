import { createHash } from 'node:crypto';

export const swlLightingFormUrl = 'https://www.swl.ch/de/swl/kundencenter/stoerung-melden';
export const swlLightingPrivacyUrl = 'https://www.swl.ch/de/datenschutzerklaerung';
export const swlLightingPageSha256 =
  '8fed5b7f5ed633ca87a05fd614e491a04dbd1c87a1757bd120f2a3e52cac5139';

const changed = () => new Error('The SWL lighting source has changed. Preparation is paused.');

/** Two independent public captures differed only in this shaped read-time value.
 * Discard it; retain every other byte, including protection and client markup.
 * This inspector does not execute code, obtain challenges or construct a payload.
 */
export function fingerprintSwlLightingPage(html: string): string {
  if (Buffer.byteLength(html) > 1_000_000) throw changed();
  const state = /(<input type="hidden" name="_csrf" value=")([A-Za-z0-9_-]{96})(")/g;
  if (
    [...html.matchAll(state)].length !== 1 ||
    [...html.matchAll(/\bname\s*=\s*["']_csrf["']/gi)].length !== 1
  )
    throw changed();
  return createHash('sha256').update(html.replace(state, '$1<read-time-csrf>$3')).digest('hex');
}

export function inspectSwlLightingPage(html: string): void {
  if (fingerprintSwlLightingPage(html) !== swlLightingPageSha256) throw changed();
}
