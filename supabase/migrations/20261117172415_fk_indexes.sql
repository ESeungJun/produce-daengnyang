-- 외래 키 쪽 색인(Supabase 성능 점검 권고). 사용자 탈퇴(on delete cascade)·결과 조회 때 표 전체를 훑지 않게 한다.
create index comments_author_idx on public.comments (author_id);
create index entries_source_idx on public.entries (source_entry_id) where source_entry_id is not null;
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index reports_reporter_idx on public.reports (reporter_id);
create index round_results_entry_idx on public.round_results (entry_id);
