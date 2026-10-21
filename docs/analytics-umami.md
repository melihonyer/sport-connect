# Ziyaret istatistiği: Umami Cloud

Kurulum 21 Ekim 2026. Yönerge: `umami-analytics` skill'i.

| | |
|---|---|
| Hesap | muuvlinkapp@gmail.com (şifre Melih'in parola yöneticisinde; buraya yazılmaz) |
| Paket | Hobby, ücretsiz: 100.000 olay/ay, 6 ay saklama |
| Bölge | AB (`cloud.umami.is/analytics/eu/...`) |
| Site kimliği | `ea1b6e5a-470c-433d-8a40-c171eb978dbb` (gizli değil) |
| Alan adı | `muuvlink.app` (`data-domains`: localhost/önizleme sayılmaz) |

## Kod

- `index.html` `<head>`: uygulama işareti + `umamiBeforeSend` süzgeci + betik.
- Süzgeç: sorgu dizesinden YALNIZ `utm_source|medium|campaign|content|term` kalır
  (`ta`, `reset_token`, `accept_invite`, `hikaye`, `src`, `fbclid` gitmez); `#` silinir;
  referrer'ın sorgusu silinir.
- Yönetim: `/admin` yolu gönderilmez ve `localStorage['umami.disabled']='1'` konur;
  `admin.html` de açılışta aynı işareti koyar → paneli açan tarayıcı sitede hiç sayılmaz.
- Uygulama: Capacitor `getPlatform()` (yoksa `?src=app` + UA) → `<html data-app-shell="ios|android">`
  → ziyaret etiketi `app-ios` / `app-android`. Masaüstünde `?src=app` denemesi etiket almaz.
- Olaylar (`analytics.js` `umamiTrack`, yalnız başarı anı, kişisel veri yok):
  `signup`, `team:create`, `event:create` (Training Agents taslağından ise `{ kaynak: "training-agents" }`),
  `event:join`, `team:join`.

## Tahmini kullanım

Ekim 2026 nginx: günde ~270 farklı ziyaretçi → ayda ~40–50 bin olay (sınırın yarısı).
Reklam günlerinde ikiye katlanabilir. %80'i geçerse Melih'e söylenir; Pro'ya geçiş onun kararı.

## Doğrulama (21 Ekim 2026)

`/?utm_source=muuvlink_test&utm_medium=kurulum` → `gateway.umami.is/api/send` 200, Realtime'da
göründü (Türkiye, Chrome, macOS). Bu deneme satırı veride kalır. `/admin` sonrası gönderim 0.

## Yasal metinler

Çerez/gizlilik/KVKK satırları Melih'in onayını bekliyor (21 Ekim 2026). Çerez Politikası'ndaki
"takip pikseli bulunmamaktadır" cümlesi Meta pikseli yüzünden zaten yanlış; birlikte düzeltilecek.
