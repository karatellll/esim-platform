import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps, type ViewStyle } from 'react-native';

export const modalDragStyle = Platform.OS === 'web' ? { touchAction: 'none' } as ViewStyle : undefined;

type Options = {
  waitForShow?: boolean;
  centered?: boolean;
  canDismiss?: () => boolean;
  onDismissStart?: () => void;
};

export function useModalSwipe(onClose: () => void, {
  waitForShow = false, centered = false, canDismiss = () => true, onDismissStart,
}: Options = {}) {
  const { height } = useWindowDimensions();
  const [offset] = useState(() => new Animated.Value(height));
  const [opacity] = useState(() => new Animated.Value(0));
  const panelLayout = useRef({ height: 0, y: 0 });
  const viewportHeight = useRef(height);
  viewportHeight.current = height;
  const closing = useRef(false);
  const shown = useRef(false);
  const pullingFromTop = useRef(false);
  const callbacks = useRef({ onClose, canDismiss, onDismissStart });
  callbacks.current = { onClose, canDismiss, onDismissStart };

  const animate = useCallback((value: Animated.Value, toValue: number, duration: number) => (
    Animated.timing(value, { toValue, duration, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' })
  ), []);

  useEffect(() => () => { offset.stopAnimation(); opacity.stopAnimation(); }, [offset, opacity]);

  const onShow = useCallback(() => {
    if (shown.current) return;
    shown.current = true;
    const { height: panelHeight, y } = panelLayout.current;
    offset.setValue(centered ? viewportHeight.current - y : panelHeight || viewportHeight.current);
    animate(offset, 0, 300).start();
    animate(opacity, 1, 230).start();
  }, [animate, centered, offset, opacity]);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    panelLayout.current = event.nativeEvent.layout;
    if (!waitForShow && panelLayout.current.height > 0) onShow();
  }, [onShow, waitForShow]);

  const canStartSwipe = useCallback(() => shown.current && !closing.current && callbacks.current.canDismiss(), []);
  const reset = useCallback(() => {
    animate(offset, 0, 180).start();
    animate(opacity, 1, 180).start();
  }, [animate, offset, opacity]);
  const dismiss = useCallback((distance: number) => {
    if (!canStartSwipe()) return;
    closing.current = true;
    callbacks.current.onDismissStart?.();
    animate(opacity, 0, 180).start();
    animate(offset, Math.max(viewportHeight.current, distance), 220).start(({ finished }) => {
      if (finished && callbacks.current.canDismiss()) callbacks.current.onClose();
      else {
        closing.current = false;
        if (finished) reset();
      }
    });
  }, [animate, canStartSwipe, offset, opacity, reset]);

  const { panHandlers } = useMemo(() => {
    let dragBeforeGrant = { x: 0, y: 0 };
    const clearDrag = () => { dragBeforeGrant = { x: 0, y: 0 }; };
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: (event) => {
        if (event.nativeEvent.touches.length === 1) clearDrag();
        return false;
      },
      onStartShouldSetPanResponder: (event) => Platform.OS === 'ios' && !centered &&
        canStartSwipe() && event.nativeEvent.touches.length === 1,
      onMoveShouldSetPanResponderCapture: (event, { dx, dy, numberActiveTouches }) => {
        const touches = event?.nativeEvent.touches.length ?? numberActiveTouches;
        if (!canStartSwipe() || touches !== 1 || dy <= 8 || dy <= Math.abs(dx)) return false;
        // PanResponder resets dy when the native view hands over the gesture.
        dragBeforeGrant = { x: dx, y: dy };
        return true;
      },
      onPanResponderReject: clearDrag,
      onPanResponderGrant: () => { offset.stopAnimation(); opacity.stopAnimation(); },
      onPanResponderMove: (_event, { dx = 0, dy }) => {
        const vertical = dragBeforeGrant.y + dy;
        const distance = vertical > Math.abs(dragBeforeGrant.x + dx) ? vertical : 0;
        offset.setValue(distance);
        opacity.setValue(Math.max(0, 1 - distance / Math.max(200, (panelLayout.current.height || viewportHeight.current) / 2)));
      },
      onPanResponderRelease: (_event, { dx = 0, dy, vy }) => {
        const distance = dragBeforeGrant.y + dy;
        const horizontal = Math.abs(dragBeforeGrant.x + dx);
        clearDrag();
        if (closing.current) return;
        if (!canStartSwipe() || distance <= horizontal || (distance < 90 && !(distance > 24 && vy > 0.65))) {
          reset();
          return;
        }
        dismiss(distance);
      },
      onPanResponderTerminate: () => { clearDrag(); if (!closing.current) reset(); },
    });
  }, [canStartSwipe, centered, dismiss, offset, opacity, reset]);

  // On iOS the native scroll view owns drags inside its content. Use its
  // pull past the top at release as a second way to dismiss the sheet.
  const scrollTopOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    event.nativeEvent.contentOffset.y + event.nativeEvent.contentInset.top;
  const scrollProps: ScrollViewProps = Platform.OS === 'ios' ? {
    bounces: true,
    alwaysBounceVertical: true,
    onScrollBeginDrag: event => { pullingFromTop.current = canStartSwipe() && scrollTopOffset(event) <= 1; },
    onScrollEndDrag: event => {
      const fromTop = pullingFromTop.current;
      pullingFromTop.current = false;
      if (fromTop && scrollTopOffset(event) <= -44) dismiss(0);
    },
  } : {};

  return { panHandlers: { ...panHandlers, collapsable: false }, scrollProps, onLayout, onShow, panelStyle: { transform: [{ translateY: offset }] }, backdropStyle: { opacity } };
}
