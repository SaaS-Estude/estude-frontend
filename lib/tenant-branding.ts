// RGB channels preserve Tailwind opacity modifiers. Metadata is never CSS code.
export function tenantPalette(value: string): Record<string, string> {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#2269ef";
  const base = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const weights: Record<string, number> = {
    50: 0.96,
    100: 0.9,
    200: 0.77,
    300: 0.58,
    400: 0.32,
    500: 0.12,
    600: 0,
    700: -0.15,
    800: -0.3,
    900: -0.45,
  };
  return Object.fromEntries(
    Object.entries(weights).map(([shade, weight]) => [
      shade,
      base
        .map((c) =>
          Math.round(weight >= 0 ? c + (255 - c) * weight : c * (1 + weight)),
        )
        .join(" "),
    ]),
  );
}


// Next can replace favicon links during navigation. Keep every icon for this
// document on the current school's same-origin image, and restore on cleanup.
export function applyTenantFavicon(url: string): () => void {
  const previous = new Map<HTMLLinkElement, {href: string | null; type: string | null; sizes: string | null}>();
  let created: HTMLLinkElement | null = null;
  function update() {
    const icons = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    if (!icons.length) {
      if (!created) { created = document.createElement("link"); created.rel = "icon"; }
      if (!created.isConnected) document.head.appendChild(created);
      icons.push(created);
    }
    for (const icon of icons) {
      if (!previous.has(icon)) previous.set(icon, {href:icon.getAttribute("href"),type:icon.getAttribute("type"),sizes:icon.getAttribute("sizes")});
      if (icon.getAttribute("href") !== url) icon.setAttribute("href", url);
      if (icon.getAttribute("type") !== "image/png") icon.setAttribute("type", "image/png");
      if (icon.hasAttribute("sizes")) icon.removeAttribute("sizes");
    }
  }
  update();
  const observer = new MutationObserver(update);
  observer.observe(document.head, {childList:true,subtree:true,attributes:true,attributeFilter:["href","rel","type","sizes"]});
  return () => {
    observer.disconnect();
    for (const [icon, attributes] of previous) {
      if (icon === created) { icon.remove(); continue; }
      for (const [key,value] of Object.entries(attributes)) {
        if (value === null) icon.removeAttribute(key);
        else icon.setAttribute(key,value);
      }
    }
  };
}
