import { Platform, StyleSheet as NativeStyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

// Figma: SF Pro Text Regular/Medium/Semibold and SF Pro Display Heavy.
// iOS supplies SF Pro with optical sizing. Other platforms retain a system fallback
// when SF Pro is not installed; Apple font binaries are not bundled with the app.
export const fonts = {
  text: Platform.select({ ios: 'System', android: 'sans-serif', default: '"SF Pro Text", -apple-system, BlinkMacSystemFont, system-ui, sans-serif' })!,
  display: Platform.select({ ios: 'System', android: 'sans-serif', default: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif' })!,
  accent: 'InterTightBlack',
} as const;

type DesignStyle = ViewStyle & TextStyle & ImageStyle;
export function typography(style: TextStyle): TextStyle {
  const size = style.fontSize;
  const accent = style.fontFamily === fonts.accent;
  return {
    fontFamily: accent ? fonts.accent : style.fontFamily === fonts.display || (size ?? 14) >= 20 ? fonts.display : fonts.text,
    includeFontPadding: false,
    ...(size !== undefined && style.letterSpacing === undefined ? { letterSpacing: size * (size >= 20 ? -0.02 : -0.004) } : {}),
    ...(style.fontWeight === '900' && !accent ? { fontWeight: '800' } : {}),
  };
}

export function continuousCorners(style: ViewStyle): ViewStyle {
  // Radius values stay in styles; Surface draws the same SVG on every platform.
  return Object.keys(style).some(key => /^border.*Radius$/.test(key)) && Platform.OS !== 'web' ? { borderCurve: 'circular' } : {};
}

// Keep RN's normal API and styles immutable; no global monkey-patching.
export const StyleSheet = {
  ...NativeStyleSheet,
  create<T extends NativeStyleSheet.NamedStyles<T> | NativeStyleSheet.NamedStyles<any>>(styles: T): T {
    const result = Object.fromEntries(Object.entries(styles).map(([name, source]) => {
      const style = source as DesignStyle;
      const { borderCurve, ...base } = style;
      return [name, {
        ...base,
        ...(Platform.OS !== 'web' && borderCurve ? { borderCurve } : {}),
        ...continuousCorners(style),
        ...(style.fontSize !== undefined || style.fontFamily !== undefined ? typography(style) : {}),
      }];
    }));
    return NativeStyleSheet.create(result) as T;
  },
};
