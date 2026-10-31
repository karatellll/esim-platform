import { getSvgPath } from 'figma-squircle';

// Figma defines 0.6 as the iOS continuous corner contour.
export const CORNER_SMOOTHING = 0.6;
export type CornerStyle = {
  borderRadius?: number | string;
  borderTopLeftRadius?: number | string;
  borderTopRightRadius?: number | string;
  borderBottomRightRadius?: number | string;
  borderBottomLeftRadius?: number | string;
  width?: unknown;
  height?: unknown;
};
export type Corners = { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
const radius = (value: number | string | undefined, size: number): number => {
  const parsed = typeof value === 'number' ? value : value?.endsWith('%') ? parseFloat(value) * size / 100 : 0;
  return Number.isFinite(parsed) ? Math.max(0, parsed ?? 0) : 0;
};
export function getCorners(style: CornerStyle, width: number, height: number): Corners {
  const limit = Math.min(width, height) / 2;
  const corner = (value: number | string | undefined) => Math.min(limit, radius(value ?? style.borderRadius, Math.min(width, height)));
  return { topLeft: corner(style.borderTopLeftRadius), topRight: corner(style.borderTopRightRadius), bottomRight: corner(style.borderBottomRightRadius), bottomLeft: corner(style.borderBottomLeftRadius) };
}
export function hasRoundedCorners(style: CornerStyle): boolean {
  return [style.borderRadius, style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].some(value => typeof value === 'number' ? value > 0 : typeof value === 'string' && parseFloat(value) > 0);
}
export function isRoundShape(style: CornerStyle, width: number, height: number): boolean {
  if (typeof style.borderRadius === 'number' && style.borderRadius >= 999) return true;
  if (style.borderRadius === '50%' || style.borderRadius === '100%') return true;
  if (!width || width !== height) return false;
  const corners = Object.values(getCorners(style, width, height));
  return corners.every(value => value === width / 2);
}
export function getSurfacePath(width: number, height: number, style: CornerStyle, inset = 0): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || inset < 0 || inset * 2 >= Math.min(width, height)) return '';
  const corners = getCorners(style, width, height);
  return getSvgPath({
    width: width - inset * 2, height: height - inset * 2,
    topLeftCornerRadius: Math.max(0, corners.topLeft - inset),
    topRightCornerRadius: Math.max(0, corners.topRight - inset),
    bottomRightCornerRadius: Math.max(0, corners.bottomRight - inset),
    bottomLeftCornerRadius: Math.max(0, corners.bottomLeft - inset),
    cornerSmoothing: CORNER_SMOOTHING,
    preserveSmoothing: true,
  });
}
