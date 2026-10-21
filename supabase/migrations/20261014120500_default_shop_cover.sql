alter table public.sellers alter column cover_url set default 'asset:marketStall';
update public.sellers set cover_url = 'asset:marketStall' where cover_url is null;
