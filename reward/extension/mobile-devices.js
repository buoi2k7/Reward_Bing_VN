// mobile-devices.js — Pool đa dạng UA thật cho mobile search phase
// Nguồn: tổng hợp từ Rewards-Search-Automator + bổ sung iPhone 16 series
// Mỗi lần mobile search, random pick 1 device từ danh sách này

const MOBILE_DEVICES = [
  // ============ iPHONE 16 SERIES (2024) ============
  {
    name: 'iPhone 16',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    width: 390, height: 844, deviceScaleFactor: 3
  },
  {
    name: 'iPhone 16 Plus',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    width: 430, height: 932, deviceScaleFactor: 3
  },
  {
    name: 'iPhone 16 Pro',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    width: 402, height: 874, deviceScaleFactor: 3
  },
  {
    name: 'iPhone 16 Pro Max',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    width: 440, height: 956, deviceScaleFactor: 3
  },
  // ============ iPHONE 15 SERIES ============
  {
    name: 'iPhone 15',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    width: 393, height: 852, deviceScaleFactor: 3
  },
  {
    name: 'iPhone 15 Plus',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    width: 430, height: 932, deviceScaleFactor: 3
  },
  {
    name: 'iPhone 15 Pro',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    width: 393, height: 852, deviceScaleFactor: 3
  },
  {
    name: 'iPhone 15 Pro Max',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    width: 430, height: 932, deviceScaleFactor: 3
  },
  // ============ iPHONE 14 SERIES ============
  {
    name: 'iPhone 14',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    width: 390, height: 844, deviceScaleFactor: 3
  },
  {
    name: 'iPhone 14 Pro Max',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    width: 430, height: 932, deviceScaleFactor: 3
  },
  // ============ SAMSUNG GALAXY S25 SERIES (2025) ============
  {
    name: 'Samsung Galaxy S25',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S931B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    width: 360, height: 780, deviceScaleFactor: 3
  },
  {
    name: 'Samsung Galaxy S25+',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S936B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    width: 390, height: 844, deviceScaleFactor: 3
  },
  {
    name: 'Samsung Galaxy S25 Ultra',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S938B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    width: 412, height: 898, deviceScaleFactor: 3.5
  },
  // ============ SAMSUNG GALAXY S24 SERIES (2024) ============
  {
    name: 'Samsung Galaxy S24',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 360, height: 780, deviceScaleFactor: 3
  },
  {
    name: 'Samsung Galaxy S24+',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S926B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 390, height: 844, deviceScaleFactor: 3
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    width: 412, height: 898, deviceScaleFactor: 3.5
  },
  // ============ SAMSUNG GALAXY S23 SERIES ============
  {
    name: 'Samsung Galaxy S23',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    width: 375, height: 812, deviceScaleFactor: 3
  },
  {
    name: 'Samsung Galaxy S23+',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S916B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    width: 414, height: 896, deviceScaleFactor: 3
  },
  {
    name: 'Samsung Galaxy S23 Ultra',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    width: 428, height: 926, deviceScaleFactor: 3
  },
  // ============ SAMSUNG GALAXY S22 SERIES ============
  {
    name: 'Samsung Galaxy S22',
    userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
    width: 375, height: 812, deviceScaleFactor: 3
  },
  {
    name: 'Samsung Galaxy S22 Ultra',
    userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
    width: 428, height: 926, deviceScaleFactor: 3
  },
  // ============ SAMSUNG GALAXY A SERIES ============
  {
    name: 'Samsung Galaxy A55',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A556B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 390, height: 844, deviceScaleFactor: 3
  },
  {
    name: 'Samsung Galaxy A54',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    width: 390, height: 844, deviceScaleFactor: 3
  },
  // ============ GOOGLE PIXEL SERIES ============
  {
    name: 'Google Pixel 9',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    width: 402, height: 874, deviceScaleFactor: 2.625
  },
  {
    name: 'Google Pixel 9 Pro',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    width: 412, height: 892, deviceScaleFactor: 2.625
  },
  {
    name: 'Google Pixel 8',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 412, height: 915, deviceScaleFactor: 2.625
  },
  {
    name: 'Google Pixel 8 Pro',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 412, height: 892, deviceScaleFactor: 2.625
  },
  {
    name: 'Google Pixel 7',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    width: 412, height: 915, deviceScaleFactor: 2.625
  },
  // ============ ONEPLUS SERIES ============
  {
    name: 'OnePlus 12',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; CPH2573) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 412, height: 919, deviceScaleFactor: 3
  },
  {
    name: 'OnePlus 11',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; CPH2447) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    width: 412, height: 919, deviceScaleFactor: 3
  },
  {
    name: 'OnePlus 11R',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; CPH2487) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    width: 412, height: 919, deviceScaleFactor: 3
  },
  // ============ XIAOMI SERIES ============
  {
    name: 'Xiaomi 14',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; 23127PN0CC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 393, height: 875, deviceScaleFactor: 3
  },
  {
    name: 'Xiaomi 14 Ultra',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; 24030PN60G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 412, height: 912, deviceScaleFactor: 3
  },
  {
    name: 'Xiaomi 13',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; 2211133C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    width: 393, height: 875, deviceScaleFactor: 3
  },
  {
    name: 'Xiaomi 13 Pro',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; 2210132C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    width: 412, height: 919, deviceScaleFactor: 3
  },
  {
    name: 'Redmi Note 13 Pro',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; 23090RA98G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    width: 393, height: 875, deviceScaleFactor: 3
  },
  // ============ OPPO / REALME ============
  {
    name: 'OPPO Find X7',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; CPH2599) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 412, height: 919, deviceScaleFactor: 3
  },
  {
    name: 'OPPO Reno 11',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; CPH2599) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 390, height: 844, deviceScaleFactor: 3
  },
  {
    name: 'Realme GT 6',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; RMX3851) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 412, height: 919, deviceScaleFactor: 3
  },
  {
    name: 'Realme 12 Pro+',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; RMX3840) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 390, height: 844, deviceScaleFactor: 3
  },
  // ============ VIVO SERIES ============
  {
    name: 'Vivo X100 Pro',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; V2324A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 412, height: 919, deviceScaleFactor: 3
  },
  {
    name: 'Vivo V29',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; V2250) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 390, height: 844, deviceScaleFactor: 3
  },
  // ============ HUAWEI ============
  {
    name: 'Huawei Pura 70 Pro',
    userAgent: 'Mozilla/5.0 (Linux; Android 12; ALN-AL00) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    width: 393, height: 875, deviceScaleFactor: 3
  },
  // ============ ASUS ROG ============
  {
    name: 'ASUS ROG Phone 8',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; ASUS_AI2401_D) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    width: 412, height: 915, deviceScaleFactor: 3
  },
];

/**
 * Trả về 1 device ngẫu nhiên từ MOBILE_DEVICES pool
 * Loại trừ device vừa dùng để tránh lặp lại
 */
let _lastDeviceIndex = -1;

function getRandomMobileDevice() {
  let idx;
  do {
    idx = Math.floor(Math.random() * MOBILE_DEVICES.length);
  } while (idx === _lastDeviceIndex && MOBILE_DEVICES.length > 1);
  _lastDeviceIndex = idx;
  return MOBILE_DEVICES[idx];
}
