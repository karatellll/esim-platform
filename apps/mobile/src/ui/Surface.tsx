import { forwardRef, useCallback, useId, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable as NativePressable, StyleSheet, View as NativeView, type LayoutChangeEvent, type PressableProps, type PressableStateCallbackType, type ViewProps, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, Path } from 'react-native-svg';
import { ContentMask } from './ContentMask';
import { getSurfacePath, hasRoundedCorners, isRoundShape, type CornerStyle } from './squircle';

type Size = { width: number; height: number };
type SurfaceStyle = ViewStyle & { cornerShape?: string; clipPath?: string };
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const internalKeys = new Set([
  'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignContent', 'gap', 'rowGap', 'columnGap',
  'padding', 'paddingHorizontal', 'paddingVertical', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'paddingStart', 'paddingEnd',
]);
function useSize(onLayout: ViewProps['onLayout']) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const measure = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    onLayout?.(event);
  }, [onLayout]);
  return { size, measure };
}
function geometry(style: SurfaceStyle, measured: Size) {
  const width = measured.width || number(style.width), height = measured.height || number(style.height);
  const smooth = hasRoundedCorners(style as CornerStyle) && !isRoundShape(style as CornerStyle, width, height);
  const path = smooth ? getSurfacePath(width, height, style as CornerStyle) : '';
  return { width, height, smooth, path, nativeClip: smooth && style.overflow === 'hidden' && Platform.OS !== 'web' };
}
function rootStyle(style: SurfaceStyle, measured: Size): SurfaceStyle {
  const shape = geometry(style, measured);
  if (!shape.smooth) return style;
  const result: SurfaceStyle = { ...style, cornerShape: undefined, borderCurve: undefined };
  if (shape.path) {
    result.backgroundColor = 'transparent';
    // Native/CSS borders must not offset the SVG viewport. Preserve their
    // content inset as padding, then draw the border entirely inside the path.
    const border = number(style.borderWidth);
    const top = number(style.borderTopWidth ?? border), right = number(style.borderRightWidth ?? border);
    const bottom = number(style.borderBottomWidth ?? border), left = number(style.borderLeftWidth ?? border);
    if (!shape.nativeClip && (top || right || bottom || left)) {
      result.paddingTop = number(style.paddingTop ?? style.paddingVertical ?? style.padding) + top;
      result.paddingRight = number(style.paddingRight ?? style.paddingHorizontal ?? style.padding) + right;
      result.paddingBottom = number(style.paddingBottom ?? style.paddingVertical ?? style.padding) + bottom;
      result.paddingLeft = number(style.paddingLeft ?? style.paddingHorizontal ?? style.padding) + left;
    }
    result.borderWidth = 0; result.borderTopWidth = 0; result.borderRightWidth = 0; result.borderBottomWidth = 0; result.borderLeftWidth = 0;
    if (style.overflow === 'hidden') {
      result.borderRadius = 0; result.borderTopLeftRadius = 0; result.borderTopRightRadius = 0; result.borderBottomLeftRadius = 0; result.borderBottomRightRadius = 0;
      if (Platform.OS === 'web') result.clipPath = `path('${shape.path}')`;
    }
    // Paint the shadow from the SVG alpha contour on web. A shadow on a
    // transparent rectangular host creates the unwanted rectangular backing.
    if (Platform.OS === 'web' && typeof style.boxShadow === 'string') result.boxShadow = undefined;
  }
  if (shape.nativeClip) {
    for (const key of internalKeys) delete (result as Record<string, unknown>)[key];
    result.borderWidth = 0; result.borderTopWidth = 0; result.borderRightWidth = 0; result.borderBottomWidth = 0; result.borderLeftWidth = 0;
    result.overflow = 'visible';
  }
  return result;
}
function SurfaceContent({ style, size, children }: { style: SurfaceStyle; size: Size; children: ReactNode }) {
  const clipId = `surface-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const shape = geometry(style, size);
  if (!shape.smooth) return children;
  const strokeWidth = Math.max(0, number(style.borderWidth));
  const svgStyle: ViewStyle = { position: 'absolute', top: 0, left: 0, overflow: 'visible',
    ...(Platform.OS === 'web' && typeof style.boxShadow === 'string' ? { filter: `drop-shadow(${style.boxShadow})` } : {}) };
  const paint = shape.path ? <Svg pointerEvents="none" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined} width={shape.width} height={shape.height} viewBox={`0 0 ${shape.width} ${shape.height}`} style={svgStyle}>
    <Defs><ClipPath id={clipId}><Path d={shape.path} /></ClipPath></Defs>
    <Path testID="surface-fill" d={shape.path} fill={typeof style.backgroundColor === 'string' ? style.backgroundColor : 'none'} />
    {strokeWidth > 0 && <Path testID="surface-border" d={shape.path} fill="none" stroke={typeof style.borderColor === 'string' ? style.borderColor : 'transparent'} strokeWidth={strokeWidth * 2} clipPath={`url(#${clipId})`} />}
    {!strokeWidth && ['Top', 'Right', 'Bottom', 'Left'].map(side => {
      const width = number((style as Record<string, unknown>)[`border${side}Width`]);
      const color = (style as Record<string, unknown>)[`border${side}Color`] ?? style.borderColor;
      if (!width || typeof color !== 'string') return null;
      const path = side === 'Top' ? `M 0 0 H ${shape.width}` : side === 'Bottom' ? `M 0 ${shape.height} H ${shape.width}` : side === 'Left' ? `M 0 0 V ${shape.height}` : `M ${shape.width} 0 V ${shape.height}`;
      return <Path key={side} d={path} fill="none" stroke={color} strokeWidth={width * 2} clipPath={`url(#${clipId})`} />;
    })}
  </Svg> : null;
  if (!shape.nativeClip) return <>{paint}{children}</>;
  const inside: ViewStyle = Object.fromEntries(Object.entries(style).filter(([key]) => internalKeys.has(key) || /^border.*Width$/.test(key))) as ViewStyle;
  return <>{paint}<ContentMask width={shape.width} height={shape.height} path={shape.path}>
    <NativeView pointerEvents="box-none" style={[{ flexGrow: 1 }, inside, { borderColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent' }]}>{children}</NativeView>
  </ContentMask></>;
}
export type View = NativeView;
export const View = forwardRef<NativeView, ViewProps>(function View({ style, onLayout, children, ...props }, ref) {
  const flat = StyleSheet.flatten(style) ?? {};
  const { size, measure } = useSize(onLayout);
  return <NativeView {...props} ref={ref} style={rootStyle(flat, size)} onLayout={hasRoundedCorners(flat as CornerStyle) ? measure : onLayout}>
    <SurfaceContent style={flat} size={size}>{children}</SurfaceContent>
  </NativeView>;
});
export const Pressable = forwardRef<NativeView, PressableProps>(function Pressable({ style, onLayout, children, ...props }, ref) {
  const { size, measure } = useSize(onLayout);
  const resolve = (state: PressableStateCallbackType) => StyleSheet.flatten(typeof style === 'function' ? style(state) : style) ?? {};
  return <NativePressable {...props} ref={ref} onLayout={measure} style={state => rootStyle(resolve(state), size)}>
    {state => <SurfaceContent style={resolve(state)} size={size}>{typeof children === 'function' ? children(state) : children}</SurfaceContent>}
  </NativePressable>;
});
export const AnimatedView = Animated.createAnimatedComponent(View);
