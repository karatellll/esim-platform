import type { PropsWithChildren, ReactNode } from 'react';
import { Modal, type StyleProp, type ViewStyle } from 'react-native';
import { modalDragStyle, useModalSwipe } from '../hooks/useModalSwipe';
import { AnimatedView, View } from '../ui/Surface';
import { StyleSheet } from '../ui/design';
import { GlassActionButton } from './GlassActionButton';

type Props = PropsWithChildren<{
  onClose: () => void;
  title: ReactNode;
  style: StyleProp<ViewStyle>;
  padding?: number;
  backdropColor?: string;
  closeTestID?: string;
}>;

export function SwipeDialog({ children, onClose, title, style, padding = 24, backdropColor = 'rgba(0,0,0,0.65)', closeTestID }: Props) {
  const swipe = useModalSwipe(onClose, { waitForShow: true, centered: true });
  return <Modal visible transparent animationType="none" onRequestClose={onClose} onShow={swipe.onShow}>
    <View style={[styles.overlay, { padding }]}>
      <AnimatedView pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor }, swipe.backdropStyle]} />
      <AnimatedView {...swipe.panHandlers} onLayout={swipe.onLayout} style={[style, swipe.panelStyle, modalDragStyle]} accessibilityViewIsModal>
        <View style={styles.header}>
          <View style={styles.title}>{title}</View>
          <GlassActionButton action="close" onPress={onClose} testID={closeTestID} />
        </View>
        {children}
      </AnimatedView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
});
