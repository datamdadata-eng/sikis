/**
 * Borç / düşüm kayıtlarında kişi adını tekilleştirir (ör. MIRAN vs MİRAN aynı kişi).
 * Türkçe büyük harf + Latin İ (U+0130) ile ASCII I birleşimi.
 */
export function canonicalPersonKey(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFC")
    .toLocaleUpperCase("tr-TR")
    .replace(/\u0130/g, "I");
}
