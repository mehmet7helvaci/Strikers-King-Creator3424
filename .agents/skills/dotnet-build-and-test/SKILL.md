---
name: dotnet-build-and-test
description: Projenin derleme bütünlüğünü doğrular ve test suitini koşturur.
---

# TAKIM SEÇME UYGULAMASI - dotnet-build-and-test Skill

Bu beceri, ajanın TAKIM SEÇME UYGULAMASI projesinde doğrulama adımlarını otomatik yürütmesini sağlar.

## Çalıştırma Adımları:
1. Projeyi derle:
   ```powershell
   dotnet build
   ```
2. Testleri çalıştır:
   ```powershell
   dotnet test
   ```
3. Herhangi bir derleme veya test hatasında hatanın satır numarasını inceleyip düzelt.
