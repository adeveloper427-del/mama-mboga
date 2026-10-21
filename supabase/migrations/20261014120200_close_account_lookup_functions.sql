-- These let an unauthenticated caller map phone numbers to emails and test
-- whether an account exists. Login is by email; duplicates surface at sign-up.
revoke execute on function public.email_for_login(text) from anon, authenticated;
revoke execute on function public.signup_conflict(text, text) from anon, authenticated;
