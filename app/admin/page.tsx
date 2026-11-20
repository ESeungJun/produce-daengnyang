/** 관리자 화면(/admin, #6). 조립은 features/admin/AdminPage. 관리자가 아니면 없는 주소처럼 404. */
import type { Metadata } from "next";
import { AdminPage } from "@/features/admin/AdminPage";

export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminPage />;
}
