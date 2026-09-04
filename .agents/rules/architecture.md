# Architecture & Structure Rules for TAKIM SEÇME UYGULAMASI

## Architectural Principles
- **Clean Architecture & Separation of Concerns**: UI, iş mantığı (business logic) ve veri katmanları birbirinden izole edilmelidir.
- **Modularity**: Tek sorumluluk prensibine (SRP) sadık kalınmalı; fonksiyonlar ve bileşenler 100 satırı aşmayacak şekilde parçalanmalıdır.
- **Type Safety**: Tüm fonksiyon parametreleri ve dönüş tipleri açıkça belirtilmeli; `any` tipi kesinlikle yasaktır.
- **Defensive Programming**: Dış servis çağrılarında ve kullanıcı girdilerinde mutlaka hata yakalama (try/catch) ve doğrulama uygulanmalıdır.
