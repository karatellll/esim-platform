import LiquidGlass from 'liquid-glass-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { colors, tabBarLayout } from '../../theme';
import type { TabBarMaterialProps } from './TabBarMaterial';
import './liquid-glass.css';

const zeroPosition = { x: 0, y: 0 };

export function TabBarMaterial({ reduceTransparency, selected = false, borderRadius }: TabBarMaterialProps) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const radius = borderRadius ?? (selected ? tabBarLayout.itemRadius : tabBarLayout.borderRadius);
  const backgroundColor = reduceTransparency
    ? selected ? colors.selectedFloatingTab : colors.tabBar
    : selected ? 'rgba(255,255,255,0.1)' : colors.floatingTabBar;

  useLayoutEffect(() => {
    if (reduceTransparency || !host.current || typeof window === 'undefined') return;
    const element = host.current;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.round(rect.width), height = Math.round(rect.height);
      if (width <= 0 || height <= 0) return;
      setSize(previous => previous?.width === width && previous?.height === height
        ? previous : { width, height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [reduceTransparency]);

  return <div ref={host} aria-hidden
    data-testid={selected
      ? reduceTransparency ? 'tab-selection-opaque' : 'tab-selection-blur'
      : reduceTransparency ? 'tab-material-opaque' : 'tab-material-blur'}
    data-glass-engine={reduceTransparency ? 'opaque' : size ? 'liquid-glass-react' : 'pending'}
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: radius }}>
    {!reduceTransparency && size && <div className="tursim-liquid-glass-layers">
      <LiquidGlass key={`${size.width}x${size.height}`}
        className="tursim-liquid-glass-surface" mode="standard" padding="0"
        cornerRadius={radius} displacementScale={selected ? 0 : 40}
        blurAmount={0.125} saturation={140} aberrationIntensity={selected ? 0 : 0.5}
        elasticity={0} globalMousePos={zeroPosition} mouseOffset={zeroPosition}
        style={{ position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%', pointerEvents: 'none' }}>
        <span />
      </LiquidGlass>
    </div>}
    <div style={{ position: 'absolute', inset: 0, borderRadius: radius, backgroundColor,
      ...(!reduceTransparency && !size ? { backdropFilter: 'blur(8px) saturate(140%)',
        WebkitBackdropFilter: 'blur(8px) saturate(140%)' } : {}) }} />
  </div>;
}
