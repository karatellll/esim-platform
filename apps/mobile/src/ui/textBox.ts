import type { TextStyle, ViewStyle } from 'react-native';

const textKeys = new Set(['color', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'fontVariant', 'letterSpacing', 'lineHeight', 'textAlign', 'textAlignVertical', 'textDecorationColor', 'textDecorationLine', 'textDecorationStyle', 'textShadowColor', 'textShadowOffset', 'textShadowRadius', 'textTransform', 'includeFontPadding', 'writingDirection', 'verticalAlign']);
export function splitTextBox(style: TextStyle): { box: ViewStyle; text: TextStyle } {
  const box: Record<string, unknown> = {}, text: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style)) (textKeys.has(key) ? text : box)[key] = value;
  return { box: box as ViewStyle, text: text as TextStyle };
}
