/** 연습생 등록(/register). 조립은 features/register/RegisterPage. */
import type { Metadata } from "next";
import { RegisterPage } from "@/features/register/RegisterPage";

export const metadata: Metadata = { title: "연습생 등록", robots: { index: false } };

export default function Page() {
  return <RegisterPage />;
}
