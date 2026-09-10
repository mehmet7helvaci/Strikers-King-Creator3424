# Testing & Verification Mandates for TAKIM SEÇME UYGULAMASI

## Designated Test Framework: MSTest / xUnit (.NET)
## Mandatory Verification Command: `dotnet test`

### Test Directives
- **Test-Driven Verification**: Yeni bir mantık parçası eklendiğinde veya bir hata düzeltildiğinde doğrulaması test senaryosu ile yapılmalıdır.
- **Mandatory Command Execution**: Değişiklik sonrası terminalde `dotnet test` çalıştırılmalı ve testlerin yeşil yandığı doğrulanmalıdır.
- **Edge Case Coverage**: Yalnızca pozitif senaryo değil; null/boş girdiler, zaman aşımı (timeout) ve ağ hataları da test edilmelidir.
