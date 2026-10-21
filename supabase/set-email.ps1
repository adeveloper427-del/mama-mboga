# Connects Gmail to Supabase for Mama Mboga's sign-up and password-reset codes.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File supabase\set-email.ps1
$email = (Read-Host 'Gmail address').Trim()
$secret = Read-Host 'Gmail App Password (typing is hidden)' -AsSecureString
$env:SMTP_USER = $email
$env:SMTP_PASS = ([Net.NetworkCredential]::new('', $secret).Password) -replace '\s', ''
Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
npx supabase config push
Remove-Item Env:SMTP_PASS, Env:SMTP_USER -ErrorAction SilentlyContinue
