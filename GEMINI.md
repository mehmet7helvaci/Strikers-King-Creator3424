# Project Constitution: TAKIM SEÇME UYGULAMASI
# Antigravity Autonomous Agent Directives

## 1. Project Overview & Identity
- **Project Name**: TAKIM SEÇME UYGULAMASI
- **Detected Tech Stack**: Modern Web (HTML/JS/CSS)
- **Execution Mode**: Autonomous Pair-Programming & TDD Discipline
- **Communication Language**: Türkçe (Kullanıcı ile daima net ve profesyonel Türkçe iletişim kur).

## 2. Mandatory Agent Workflow (Planning Discipline)
1. **Planning Mode First**: Asla doğrudan dosya değiştirmeye veya kod yazmaya başlama.
   - Her işlemden önce `implementation_plan.md` hazırla ve kullanıcıdan net onay al.
2. **Anti-Hallucination & Full Code Guarantee**:
   - Kod tabanında asla `// TODO`, eksik mock veri veya tamamlanmamış fonksiyon bırakma.
   - Bilmediğin üçüncü taraf kütüphaneleri varsayma; daima resmi belgeler ve mevcut kod yapısıyla doğrula.
3. **Non-Destructive Code Modifications**:
   - Kullanıcının mevcut kodlarını ve yorum satırlarını haber vermeden silme veya geçersiz kılma.
   - Değişiklikleri minimal, modüler ve odaklı bloklar halinde uygula.

## 3. Technology & Architecture Rules
- Kodlama standartları `.agents/rules/` klasöründeki uzmanlık kural dosyalarına göre yürütülür.
- Kod yazıldıktan sonra testlerin otomatik çalıştırılması zorunludur.

## 4. Verification & Walkthrough
- Değişiklik tamamlandıktan sonra `walkthrough.md` oluşturarak yapılan yenilikleri özetle.
