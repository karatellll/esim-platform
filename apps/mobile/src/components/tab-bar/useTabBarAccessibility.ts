import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useTabBarAccessibility() {
  // Avoid an unsolicited animation before the OS preference has been read.
  const [reduceMotion, setReduceMotion] = useState(true);
  const [reduceTransparency, setReduceTransparency] = useState(Platform.OS === 'ios');

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    const transparency = Platform.OS === 'ios'
      ? AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency) : null;
    if (Platform.OS === 'ios') {
      void AccessibilityInfo.isReduceTransparencyEnabled().then(value => {
        if (mounted) setReduceTransparency(value);
      }).catch(() => {});
    }
    const media = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.matchMedia?.('(prefers-reduced-transparency: reduce)') : null;
    const updateTransparency = () => setReduceTransparency(media?.matches ?? false);
    if (media) {
      updateTransparency();
      media.addEventListener('change', updateTransparency);
    }

    return () => {
      mounted = false;
      motion?.remove();
      transparency?.remove();
      media?.removeEventListener('change', updateTransparency);
    };
  }, []);

  return { reduceMotion, reduceTransparency };
}
