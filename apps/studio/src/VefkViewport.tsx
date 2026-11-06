import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
export type ViewportActions = { fit: () => void; zoom: (delta: number) => void };
/** One fitted viewport for source, review, geometry and canonical playback. */
export default forwardRef<ViewportActions, { aspect: number; pan: boolean; unframed?: boolean; children: ReactNode; onScale: (scale: number) => void }>(
function VefkViewport({ aspect, pan, unframed, children, onScale }, ref) {
  const viewport = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [size, setSize] = useState({ width: 600, height: 600 });
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const observer = new ResizeObserver(() => {
      const maxW = Math.max(80, element.clientWidth - 64), maxH = Math.max(80, element.clientHeight - 64);
      setSize({ width: Math.min(maxW, maxH * aspect), height: Math.min(maxH, maxW / aspect) });
    });
    observer.observe(element); return () => observer.disconnect();
  }, [aspect]);
  useEffect(() => { onScale(scale); }, [scale, onScale]);
  useImperativeHandle(ref, () => ({ fit: () => { setScale(1); viewport.current?.scrollTo(0,0); },
    zoom: delta => setScale(value => Math.min(6, Math.max(.25, Number((value + delta).toFixed(2))))) }));
  return <div ref={viewport} className={`vefk-artboard-scroll ${pan ? "is-panning" : ""} ${unframed ? "is-unframed" : ""}`}
    onWheel={event => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); setScale(value => Math.min(6, Math.max(.25, value * (event.deltaY > 0 ? .9 : 1.1)))); } }}
    onPointerDownCapture={event => {
      if ((!pan && event.button !== 1) || unframed) return;
      const el = event.currentTarget;
      gesture.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
      event.preventDefault(); event.stopPropagation(); el.setPointerCapture(event.pointerId);
    }} onPointerMoveCapture={event => {
      const start = gesture.current; if (!start) return;
      event.stopPropagation(); event.currentTarget.scrollLeft = start.left + start.x - event.clientX;
      event.currentTarget.scrollTop = start.top + start.y - event.clientY;
    }} onPointerUpCapture={event => {
      if (!gesture.current) return;
      gesture.current = null; event.stopPropagation();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }} onPointerCancel={() => { gesture.current = null; }}>
    <div className="vefk-artboard-wrap" style={unframed ? undefined : { minWidth: size.width*scale+64, minHeight: size.height*scale+64 }}>
      <div className="vefk-viewport-sheet" style={unframed ? { width: "100%", height: "100%" } : { width: size.width*scale, height: size.height*scale }}>{children}</div>
    </div>
  </div>;
});
