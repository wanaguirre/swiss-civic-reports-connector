import { createHash } from 'node:crypto';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
type Node = DefaultTreeAdapterMap['node'];
const all = (n: Node): Node[] => [n, ...('childNodes' in n ? n.childNodes.flatMap(all) : [])];
const changed = () =>
  new Error('The municipal Weblication form has changed. Preparation is paused.');
/** Inspect the whole selected form without executing scripts or retaining session tokens. */
export function inspectWeblicationForm(html: string, selector: string, fingerprint: string) {
  try {
    if (Buffer.byteLength(html) > 1_000_000) throw changed();
    const forms = all(parse(html)).filter(
      (n) =>
        'tagName' in n &&
        n.tagName === 'form' &&
        all(n).some(
          (x) => 'tagName' in x && x.attrs.some((a) => a.name === 'name' && a.value === selector),
        ),
    );
    if (forms.length !== 1 || !('attrs' in forms[0])) throw changed();
    const action = forms[0].attrs.find((a) => a.name === 'action')?.value ?? '';
    if (!/^\/weblication\/grid5\/tmpHTTP\/wForm-cached-\d+-nsid-[a-z0-9]+\.php$/.test(action))
      throw changed();
    const semantic = all(forms[0])
      .map((n) => {
        if ('tagName' in n)
          return [
            n.tagName,
            n.attrs
              .map((a) => [
                a.name,
                n.tagName === 'form' && a.name === 'action'
                  ? '<generated-local-action>'
                  : n.tagName === 'input' &&
                      n.attrs.some((x) => x.name === 'name' && x.value === 'wFormToken') &&
                      a.name === 'value'
                    ? '<session-token>'
                    : a.value,
              ])
              .sort(([a], [b]) => a.localeCompare(b)),
          ];
        if ('value' in n) return n.value.replace(/\s+/g, ' ').trim();
        return null;
      })
      .filter((x) => x !== '' && x !== null);
    if (createHash('sha256').update(JSON.stringify(semantic)).digest('hex') !== fingerprint)
      throw changed();
    return true;
  } catch {
    throw changed();
  }
}
