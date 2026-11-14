/** Крошечный помощник для создания элементов. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, unknown>> & { cls?: string; text?: string; on?: Record<string, (e: any) => void> } = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { cls, text, on, ...rest } = props;
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  for (const [k, v] of Object.entries(on ?? {})) el.addEventListener(k, v);
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const ch of children) if (ch) el.append(ch);
  return el;
}
