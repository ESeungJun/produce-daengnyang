/** 로그인 이어 가기 화면(#3). 실제 동작은 MergeFlow(브라우저). 검색 엔진에 나오지 않게 한다. */
import type { Metadata } from "next";
import { Suspense } from "react";
import { MergeFlow } from "@/features/auth/MergeFlow";

export const metadata: Metadata = { title: "로그인", robots: { index: false } };

export default function MergePage() {
  return (
    <Suspense>
      <MergeFlow />
    </Suspense>
  );
}
