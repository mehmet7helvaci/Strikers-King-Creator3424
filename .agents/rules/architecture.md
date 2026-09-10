# Architecture & Structure Rules for TAKIM SEÇME UYGULAMASI

## Technical Domain: Windows Masaüstü & Sistem Entegrasyon Aracı (.NET WinForms/WPF)

### Core Architectural Principles
- **Separation of Concerns**: Arayüz tasarımı ile veritabanı işlemlerini birbirine karıştırma.
- **Dependency Injection**: Sınıflar (Class) birbirine doğrudan bağlanmamalı, bağımlılıklar dışarıdan verilmeli.
- **Asynchronous Programming**: Uygulamanın donmaması için dosya ve ağ işlemlerini 'async/await' ile asenkron yap.
