import { forwardRef } from 'react';
import { Text as NativeText, TextInput as NativeTextInput, StyleSheet, type TextProps, type TextInputProps, type ViewStyle } from 'react-native';
import { typography } from './design';
import { View } from './Surface';
import { hasRoundedCorners, type CornerStyle } from './squircle';
import { splitTextBox } from './textBox';

export type Text = NativeText;
export const Text = forwardRef<NativeText, TextProps>(function Text({ style, ...props }, ref) {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.backgroundColor && hasRoundedCorners(flat as CornerStyle)) {
    const { box, text } = splitTextBox(flat);
    return <View style={box}><NativeText {...props} ref={ref} style={[text, typography(flat)]} /></View>;
  }
  return <NativeText {...props} ref={ref} style={[style, typography(flat)]} />;
});
export type TextInput = NativeTextInput;
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const flat = StyleSheet.flatten(style) ?? {};
  if (!hasRoundedCorners(flat as CornerStyle)) return <NativeTextInput {...props} ref={ref} style={[style, typography(flat)]} />;
  const { box, text } = splitTextBox(flat);
  const padding: ViewStyle = {};
  for (const key of Object.keys(box)) if (key.startsWith('padding')) {
    (padding as Record<string, unknown>)[key] = (box as Record<string, unknown>)[key];
    delete (box as Record<string, unknown>)[key];
  }
  return <View style={[{ flexDirection: 'row', alignItems: 'stretch' }, box]} testID={props.testID ? `${props.testID}-surface` : undefined}>
    <NativeTextInput {...props} ref={ref} style={[{ flex: 1, minWidth: 0 }, text, padding, { backgroundColor: 'transparent', borderWidth: 0 }, typography(flat)]} />
  </View>;
});
