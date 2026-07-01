// Hook to set the ambient aurora color based on the currently-focused media.
// This dynamically updates CSS variables on the body, causing the background
// gradient to shift hue as the user navigates between media items.

'use client';

import { useEffect } from 'react';

interface AmbientColorInput {
  /** A color string like "hsl(210, 55%, 45%)" or a hex color. If null, resets to default. */
  color: string | null | undefined;
}

// Extract the hue (0-360) and chroma (0-0.3) from an HSL string.
// Returns a fallback if parsing fails.
function parseHslToOklchHue(hsl: string): { hue: number; chroma: number } | null {
  const m = hsl.match(/hsl\(\s*(\d+)/);
  if (!m) return null;
  const hue = parseInt(m[1], 10);
  // Map HSL saturation to an oklch-ish chroma. Higher saturation = more colorful aurora.
  const satMatch = hsl.match(/hsl\(\s*\d+,\s*(\d+)/);
  const sat = satMatch ? parseInt(satMatch[1], 10) / 100 : 0.5;
  const chroma = Math.min(0.18, sat * 0.18);
  return { hue, chroma };
}

export function useAmbientColor({ color }: AmbientColorInput) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!color) {
      // Reset to default red
      body.style.setProperty('--ambient-color', '22');
      body.style.setProperty('--ambient-chroma', '0.10');
      return;
    }
    const parsed = parseHslToOklchHue(color);
    if (parsed) {
      body.style.setProperty('--ambient-color', String(parsed.hue));
      body.style.setProperty('--ambient-chroma', String(parsed.chroma));
    }
  }, [color]);
}
