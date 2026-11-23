import { Image } from 'expo-image';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from '../ui/Surface';
import type { homeLabels } from '../home/textAssets';

// Static labels retain the exact SF Pro outlines from Figma on every platform.
// Their parent buttons expose the same text through accessibilityLabel.
export function HomeDesignLabel({ artwork, style }: {
  artwork: (typeof homeLabels)[keyof typeof homeLabels];
  style?: StyleProp<ViewStyle>;
}) {
  return <View accessible={false} style={[{ width: '100%', height: artwork.height }, style]}>
    <Image source={artwork.source} contentFit="contain" accessible={false}
      style={{ position: 'absolute', left: artwork.left, top: artwork.top, width: artwork.width, height: artwork.imageHeight }} />
  </View>;
}
