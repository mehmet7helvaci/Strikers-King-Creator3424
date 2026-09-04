# Proje Kuralları (Rules)

## 3. Hata Yönetimi ve Kendi Kendini Düzeltme
- **Kör Düzeltme Yapma:** Bir hata bildirildiğinde ezbere kod üretme; hatanın kök nedenini (IP çakışması, eksik kütüphane, port kapalı olması, yanlış sözdizimi) açıkla ve yalnızca ilgili bloğu onar.
- **Bağlantı ve Ağ Kontrolleri:** Mobil veya ağ haberleşmesi içeren işlemlerde (Socket, WebSocket, HTTP API vb.) IP adresi, port, güvenlik duvarı (Firewall) ve aynı Wi-Fi ağı gereksinimlerini en başta hazırla ve kullanıcıya kontrol ettir.

## 4. Token ve Dosya Optimizasyonu
- Yalnızca üzerinde çalışılan dosyalara odaklan; gereksiz dizin taraması yapma.
- Kodun tamamını tekrar tekrar yazdırma; sadece güncellenen fonksiyonu veya dosyayı değiştir.
