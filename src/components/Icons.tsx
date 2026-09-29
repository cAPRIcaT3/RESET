import type { CSSProperties } from 'react';
type IconName = 'window' | 'sound' | 'muted' | 'pause' | 'refresh' | 'view' | 'close' | 'play';
export function Icon({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) {
  const paths: Record<IconName, React.ReactNode> = {
    window: <><path d="M4 21V5l16-2v18H4Z"/><path d="M11 4v17M4 12h16"/></>,
    sound: <><path d="m11 5-5 4H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></>,
    muted: <><path d="m11 5-5 4H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/></>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M20 12a8 8 0 1 0-2.4 5.7M20 7l-2.4-.7"/></>,
    view: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    play: <path d="m8 5 11 7-11 7V5Z"/>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}
