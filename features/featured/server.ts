/**
 * 서버 전용 get_featured 읽기. 한 요청 안에서 메인·위 센터 띠가 같이 불러도 DB 는 한 번만 부른다(React cache).
 */
import { cache } from "react";
import { createClient } from "@/shared/lib/supabase/server";
import { loadFeatured } from "./api";

export const getFeatured = cache(async () => loadFeatured(await createClient()));
