# 📊 Changelog

Tất cả thay đổi đáng chú ý của project sẽ được ghi lại ở đây.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
project tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [4.1.0] - 2026-05-29

### ✨ Added
- **Ban Detection module** (`ban-detection.js`) — chẩn đoán shadow-ban qua activity counter & API response
- **API Intercept Bridge** — capture Rewards data realtime qua MAIN world content script
- **Diagnostic logging** — chi tiết breakdownText, earn parsing cho troubleshooting
- **Enhanced Points Breakdown reader** — XPath + CSS selectors + regex multi-pattern
- **Vietnamese Rewards dashboard support** — parse cả UI tiếng Việt lẫn English

### 🔧 Changed
- **Compact Runner** — bỏ wave/tier system, chạy search liên tục
- **Robust earn-breakdown parsing** — nhiều regex pattern, fallback graceful
- **Startup error handling** — improved recovery khi service worker restart
- **Field name candidates** — mở rộng counter parsing để match nhiều format hơn

### 🎨 Improved
- **Glassmorphism UI theme** — popup design hiện đại
- **Speed slider** — 6 cấp tốc độ rõ ràng với delay hiển thị realtime
- **Daily progress panel** — theo dõi điểm/search/split PC-Mobile

---

## [4.0.0] - 2026-05

### ✨ Added
- **Mobile Search** với DeclarativeNetRequest UA spoofing
- **Mobile device profiles** (`mobile-devices.js`) — database UA strings
- **Mobile fingerprint override** (`mobile-override.js`)
- **Content automation** (`content-automation.js`) — tách riêng search runner
- **MS Data Extractor** (`ms-data-extract.js` + `extract.html`)
- **Validation tool** (`validate.js` + `validate.html`)

### 🔧 Changed
- Upgrade lên **Manifest V3** (Service Worker thay background page)
- Refactor architecture: tách content scripts, intercept bridge
- Thêm `contextMenus` permission

---

## [3.x] - 2025

### ✨ Added
- Auto PC search với keyword database tiếng Việt (1000+ từ)
- Click kết quả tìm kiếm (human-like behavior)
- Points checker
- Clear Bing cache (giữ session login)
- Terminal log trong popup

### 🔧 Changed
- Cải thiện tốc độ và độ ổn định
- Thêm nhiều keywords

---

## [2.x] - 2024

### ✨ Added
- Phiên bản đầu tiên
- Auto Bing search cơ bản
- Popup UI đơn giản
- Keywords database ban đầu

---

[4.1.0]: https://github.com/buoi2k7/Reward_Bing_VN/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/buoi2k7/Reward_Bing_VN/compare/v3.0.0...v4.0.0