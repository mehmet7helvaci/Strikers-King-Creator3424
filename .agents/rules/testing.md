# Testing & Verification Directives

## Testing Mandates
- **TDD Approach**: Yeni bir özellik eklenmeden veya kritik bir hata düzeltilmeden önce ilgili test senaryosu kurgulanmalıdır.
- **Zero Regressions**: Yeni kod yazıldıktan sonra projedeki tüm mevcut testler çalıştırılmalı ve kırılma olmadığından emin olunmalıdır.
- **Edge Cases**: Sadece pozitif senaryolar (happy path) değil, boş değerler, null/undefined durumları ve ağ hataları da test edilmelidir.
