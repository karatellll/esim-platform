import { forwardRef } from 'react';
import { ScrollView as NativeScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { View } from './Surface';
import { hasRoundedCorners, type CornerStyle } from './squircle';

export type ScrollView = NativeScrollView;
export const ScrollView = forwardRef<NativeScrollView, ScrollViewProps>(function ScrollView({ contentContainerStyle, children, ...props }, ref) {
  const content = StyleSheet.flatten(contentContainerStyle) ?? {};
  if (!hasRoundedCorners(content as CornerStyle)) return <NativeScrollView {...props} ref={ref} contentContainerStyle={contentContainerStyle}>{children}</NativeScrollView>;
  return <NativeScrollView {...props} ref={ref} contentContainerStyle={{ flexGrow: 1 }}><View style={[{ alignSelf: 'stretch' }, content]}>{children}</View></NativeScrollView>;
});
