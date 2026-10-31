import MaskedView from '@react-native-masked-view/masked-view';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export function ContentMask({ width, height, path, children }: PropsWithChildren<{ width: number; height: number; path: string }>) {
  return <MaskedView androidRenderingMode="software" style={styles.content}
    maskElement={path ? <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}><Path d={path} fill="black" /></Svg> : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'black' }]} />}>
    {children}
  </MaskedView>;
}
const styles = StyleSheet.create({ content: { flexGrow: 1, flexShrink: 1, alignSelf: 'stretch' } });
