# ⚡ Bing Rewards Auto v4.1

> Chrome Extension tự động hóa Microsoft Rewards search — hỗ trợ PC + Mobile, ban detection, keyword database 1000+ từ tiếng Việt.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue?style=flat-square)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?style=flat-square&logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/version-4.1.0-orange?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)

---

## ✨ Features

| Feature | Mô tả |
|---------|--------|
| 🔍 **Auto PC Search** | Tự động tìm kiếm Bing trên PC (1–200 lượt), sử dụng keyword database tiếng Việt |
| 📱 **Auto Mobile Search** | Giả lập mobile UA bằng DeclarativeNetRequest + fingerprint override |
| 🛡️ **Ban Detection** | Chẩn đoán tài khoản bị hạn chế / shadow-ban qua activity counter & API |
| ⚡ **6 cấp tốc độ** | Từ "Chậm" (delay 45–55s) đến "Tối đa" (3–5s) — tùy chỉnh bằng slider |
| 📊 **Activity Scanner** | Đọc quota search PC/Mobile từ Rewards dashboard realtime |
| 📖 **Human-like Behavior** | Click kết quả tìm kiếm, đọc trang 5–12s, typo simulation |
| 📡 **API Intercept Bridge** | Content script capture dữ liệu Rewards API qua MAIN world injection |
| 🧹 **Clear Bing Cache** | Xóa cache/autocomplete Bing mà giữ nguyên session login Microsoft |
| 📅 **Daily Progress** | Theo dõi điểm kiếm được, số lượt search, split PC/Mobile trong ngày |
| 🔬 **MS Data Extractor** | Tool phụ trợ trích xuất dữ liệu Microsoft Rewards |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  Manifest V3                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐   ┌───────────────────────┐   │
│  │  Popup UI    │   │  Background Service   │   │
│  │  popup.html  │◄─►│  Worker               │   │
│  │  popup.css   │   │  background.js        │   │
│  │  popup.js    │   │                       │   │
│  └──────────────┘   └───────┬───────────────┘   │
│                             │                    │
│  ┌──────────────────────────▼────────────────┐  │
│  │         Content Scripts                    │  │
│  │  ┌─────────────────┐ ┌──────────────────┐ │  │
│  │  │ content-         │ │ content-         │ │  │
│  │  │ automation.js    │ │ intercept.js     │ │  │
│  │  │ (search runner)  │ │ (MAIN world)     │ │  │
│  │  └─────────────────┘ └────────┬─────────┘ │  │
│  │                               │            │  │
│  │  ┌────────────────────────────▼──────────┐ │  │
│  │  │ content-intercept-bridge.js           │ │  │
│  │  │ (ISOLATED world ↔ extension bridge)   │ │  │
│  │  └───────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Ban Detection │  │ DeclarativeNetRequest    │ │
│  │ ban-          │  │ rules_mobile_ua.json     │ │
│  │ detection.js  │  │ (mobile UA spoofing)     │ │
│  └──────────────┘  └──────────────────────────┘ │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ keywords-    │  │ mobile-devices.js        │ │
│  │ data.js      │  │ mobile-override.js       │ │
│  │ (1000+ từ)   │  │ api-network-handler.js   │ │
│  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
extension/
├── manifest.json                  # Extension manifest v3
├── background.js                  # Service worker — core logic & orchestrator
├── popup.html                     # Extension popup UI
├── popup.css                      # Popup styles (glassmorphism theme)
├── popup.js                       # Popup logic & event handlers
├── content-automation.js          # Content script — search automation runner
├── content-intercept.js           # Content script (MAIN world) — API interceptor
├── content-intercept-bridge.js    # Bridge: MAIN ↔ ISOLATED world messaging
├── ban-detection.js               # Ban/shadow-ban detection module
├── api-network-handler.js         # Network request handler for Rewards API
├── keywords-data.js               # Keyword database (1000+ từ tiếng Việt)
├── mobile-devices.js              # Mobile device profiles for UA spoofing
├── mobile-override.js             # Mobile fingerprint override logic
├── rules_mobile_ua.json           # DeclarativeNetRequest rules (mobile UA)
├── ms-data-extract.js             # Microsoft data extraction tool
├── extract.html                   # Data extraction UI
├── validate.js                    # Validation utilities
├── validate.html                  # Validation page
├── done.html                      # Completion page
├── done.js                        # Completion page logic
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── _metadata/                     # Chrome-generated metadata
```

---

## ⚙️ Installation

### Cách 1: Từ source code

```bash
git clone https://github.com/buoi2k7/Reward_Bing_VN.git
```

1. Mở Chrome → `chrome://extensions/`
2. Bật **Developer mode** (góc phải trên)
3. Click **"Load unpacked"** → chọn thư mục `extension/`
4. Đăng nhập [rewards.bing.com](https://rewards.bing.com) trên trình duyệt

### Cách 2: Từ file ZIP

1. Download file ZIP từ [Releases](https://github.com/buoi2k7/Reward_Bing_VN/releases)
2. Giải nén ra thư mục
3. Load unpacked như trên

---

## 🚀 Usage

### Tìm kiếm tự động
1. Click icon extension trên toolbar
2. Cấu hình số lượt search PC (mặc định 30)
3. Tùy chọn: bật **Mobile Search** + đặt số lượt mobile (mặc định 20)
4. Chọn tốc độ bằng slider (1–6)
5. Nhấn **▶ Search** → tool chạy tự động

### Kiểm tra Ban
1. Click **🛡️ Check** → tool sẽ scan activity counter và API response
2. Kết quả hiển thị trạng thái: ✅ OK / ⚠️ Warning / ❌ Banned

### Các nút khác
| Nút | Chức năng |
|-----|-----------|
| ⭐ **Points** | Kiểm tra điểm Rewards hiện tại |
| 🔄 **Reset** | Reset page & dọn tabs search cũ |
| 🗑️ **Progress** | Xóa tiến trình search đã lưu |
| 🧹 **Clear** | Xóa cache Bing (giữ session login) |

---

## ⚡ Speed Levels

| Level | Tên | Delay giữa search |
|-------|-----|-------------------|
| 1 | Chậm | 45–55s |
| 2 | Cẩn thận | 28–40s |
| 3 | Vừa | 14–24s |
| 4 | Nhanh | 8–14s |
| 5 | Rất nhanh | 5–9s |
| 6 | Tối đa | 3–5s |

---

## 🔑 Permissions

| Permission | Lý do |
|-----------|-------|
| `storage` | Lưu cấu hình, tiến trình search |
| `alarms` | Schedule & timing cho auto search |
| `tabs` | Mở/đóng tab search |
| `activeTab` | Tương tác với tab hiện tại |
| `scripting` | Inject content scripts |
| `declarativeNetRequest` | Mobile UA spoofing |
| `browsingData` | Clear cache/cookies Bing |
| `contextMenus` | Right-click menu options |

---

## 📊 Changelog

### v4.1.0 (Latest)
- ✅ Compact Runner — không wave/tier, chạy liên tục
- ✅ Robust earn-breakdown parsing (hỗ trợ Rewards dashboard tiếng Việt + English)
- ✅ Enhanced Points Breakdown reader (XPath + CSS selectors + regex multi-pattern)
- ✅ Ban Detection module — chẩn đoán shadow-ban qua activity/counter
- ✅ API Intercept Bridge — capture Rewards data realtime
- ✅ Mobile search với DeclarativeNetRequest UA spoofing
- ✅ Diagnostic logging cho troubleshooting
- ✅ Glassmorphism UI theme

---

## 🛡️ Tech Stack

![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Chrome APIs](https://img.shields.io/badge/Chrome-Extension%20APIs-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue?style=flat-square)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)

---

## ⚠️ Disclaimer

> **Tool này chỉ dùng cho mục đích học tập và nghiên cứu.**
> 
> - Người dùng tự chịu trách nhiệm khi sử dụng
> - Tác giả không chịu trách nhiệm cho bất kỳ hậu quả nào từ việc sử dụng tool
> - Hãy tuân thủ [Microsoft Services Agreement](https://www.microsoft.com/en-us/servicesagreement/) và Terms of Service của Bing
> - Sử dụng tool có thể vi phạm điều khoản dịch vụ và dẫn đến khóa tài khoản

---

## 📄 License

MIT License — xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/buoi2k7">buoi2k7</a>
</p>