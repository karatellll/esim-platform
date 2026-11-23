import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';

type Props = {
  url?: string | null;
  fallback: NonNullable<ImageProps['source']>;
  style: ImageProps['style'];
  fallbackStyle?: ImageProps['style'];
  fallbackContentFit?: ImageProps['contentFit'];
};

export function CatalogPhoto({ url, fallback, style, fallbackStyle = style, fallbackContentFit = 'cover' }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const trimmedUrl = url?.trim();
  const remoteUrl = trimmedUrl && /^https?:\/\//i.test(trimmedUrl) && trimmedUrl !== failedUrl ? trimmedUrl : null;

  return (
    <Image
      key={remoteUrl ?? 'local'}
      source={remoteUrl ? { uri: remoteUrl } : fallback}
      placeholder={remoteUrl ? fallback : undefined}
      placeholderContentFit="cover"
      style={remoteUrl ? style : fallbackStyle}
      contentFit={remoteUrl ? 'cover' : fallbackContentFit}
      onError={remoteUrl ? () => setFailedUrl(remoteUrl) : undefined}
      accessible={false}
    />
  );
}
