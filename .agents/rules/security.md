# Security & Data Protection Rules

## Critical Security Directives
1. **Never Hardcode Secrets**: API key, JWT token, veritabanı şifresi veya özel anahtarlar kaynak koda doğrudan YAZILAMAZ. Mutlaka `.env` üzerinden okunmalıdır.
2. **Injection Defense**: Raw SQL veya doğrudan string birleştirme ile sorgu oluşturmak yasaktır. Parametrik sorgu veya güvenli ORM/Query Builder kullanılmalıdır.
3. **Sensitive Logs**: Şifreler, kullanıcı kimlik bilgileri ve gizli tokenlar konsola (`console.log`, `print`) basılamaz.
4. **Input Sanitization**: Dışarıdan gelen tüm kullanıcı verileri işlenmeden önce sıkı validasyondan geçirilmelidir.
