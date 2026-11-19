"use client";
/**
 * 노출 기록. 감싼 영역이 화면에 절반 이상 처음 보이면 한 번만 view 를 남긴다(이동률의 분모).
 * 화면 밖에 그려지기만 한 것은 세지 않는다. 같은 사람·날은 DB 가 한 번만 센다.
 * 감쌀 수 없는 곳(자식 선택자로 꾸민 지면 등)은 useImpression 으로 그 요소의 ref 에 바로 단다.
 */
import { useEffect, useRef, type RefObject } from "react";
import { trackSns, type SnsPlace } from "./track";

export function useImpression(ref: RefObject<HTMLElement | null>, ids: string[], place: SnsPlace) {
  const key = ids.join(",");
  useEffect(() => {
    const el = ref.current;
    if (!el || !key) return;
    const io = new IntersectionObserver(
      (entries) => {
        // isIntersecting 은 1px 만 걸쳐도 true 라 비율을 직접 본다. 화면보다 두 배 넘게 큰 영역은 0.5 에 못 닿으니 화면을 절반 넘게 채우면 센다.
        const seen = entries.some((e) => e.isIntersecting && (e.intersectionRatio >= 0.5 || (e.rootBounds != null && e.intersectionRect.height >= e.rootBounds.height * 0.5)));
        if (seen) {
          trackSns(key.split(","), "view", place);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, key, place]);
}

export function Impression({ ids, place, className, children }: { ids: string[]; place: SnsPlace; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useImpression(ref, ids, place);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
