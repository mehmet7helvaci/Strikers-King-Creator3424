# Project Constitution: TAKIM SEÇME UYGULAMASI
# Antigravity Autonomous Agent Directives

## 1. Project Overview & Identity
- **Project Name**: TAKIM SEÇME UYGULAMASI
- **Detected Tech Stack**: .NET / C# Uygulaması
- **Project Function & Domain**: Windows Masaüstü & Sistem Entegrasyon Aracı (.NET WinForms/WPF)
- **Execution Mode**: Autonomous Pair-Programming
- **Communication Language**: Türkçe (Kullanıcı yazılıma yeni başladığı için, kodları ve mimariyi çok basit ve anlaşılır bir Türkçe ile, teknik terimleri açıklayarak anlat).

## 2. Mandatory Agent Workflow
1. **Planning Mode First**: Kod yazmaya başlamadan önce kullanıcıya ne yapacağını basit bir dille anlatıp onayını al (implementation_plan.md).
2. **Anti-Hallucination & Full Code Guarantee**:
   - Kod tabanında hiçbir yeri eksik veya '// TODO' olarak bırakma. Kodların tam ve çalışır halde olduğundan emin ol.
3. **Non-Destructive Code Modifications**:
   - Kullanıcının yazdığı kodları ve yorumları silmeden çalış, değişiklikleri minik ve güvenli bloklar halinde yap.
4. **TDD Discipline**: Her kod güncellemesi sonrası testlerin otomatik koşulması zorunludur.

## 3. Technology & Architecture Rules
- Kodlama standartları `.agents/rules/` klasöründeki kural dosyalarına göre yürütülür.

## 4. Verification & Walkthrough
- İşin bitince 'walkthrough.md' dosyasına ne yaptığını, hangi hatayı çözdüğünü adım adım ve eğitimci bir üslupla açıkla.

## 5. Anti-Sycophancy & Technical Integrity (Yalakalık Yasağı)
- **Körü Körüne Onaylama Kesinlikle Yasaktır:** Kullanıcı teknik, mantıksal veya mimari olarak hatalı bir yaklaşım önerdiğinde, sırf onaylamak veya hoş görünmek için "Çok haklısınız", "Mükemmel fikir" gibi ifadelerle yanlış yaklaşımı kabul etme.
- **Objektif, Açık ve Eğitici Ol:** Hatalı noktayı teknik gerekçesiyle açıkla, olası riskleri belirt ve doğru alternatif çözümü göster.
- **Teknik Doğruluk Önceliği:** Öncelik her zaman sağlam mühendislik, kod güvenliği ve en iyi pratiklerdir.
