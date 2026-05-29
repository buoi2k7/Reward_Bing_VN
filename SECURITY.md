# 🔒 Security Policy

## Phiên bản được hỗ trợ

| Version | Supported |
|---------|-----------|
| 4.1.x   | ✅ Yes    |
| 4.0.x   | ⚠️ Limited |
| < 4.0   | ❌ No     |

---

## 🛡️ Báo cáo lỗ hổng bảo mật

Nếu bạn phát hiện lỗ hổng bảo mật trong extension, **KHÔNG** tạo public issue.

Thay vào đó, hãy liên hệ trực tiếp qua:

- **GitHub:** Tạo [Private Security Advisory](https://github.com/buoi2k7/Reward_Bing_VN/security/advisories/new)
- **Email:** Liên hệ qua profile GitHub của [buoi2k7](https://github.com/buoi2k7)

### Thông tin cần cung cấp:

1. Mô tả lỗ hổng
2. Steps to reproduce
3. Impact tiềm năng
4. Đề xuất fix (nếu có)

---

## 🔐 Bảo mật Extension

### Dữ liệu Extension xử lý:
- ✅ Keywords tìm kiếm (local, không gửi server nào)
- ✅ Cấu hình search (lưu `chrome.storage.local`)
- ✅ Tiến trình daily (lưu local)
- ❌ **KHÔNG** thu thập mật khẩu, token, hay thông tin cá nhân
- ❌ **KHÔNG** gửi dữ liệu đến server bên thứ 3

### Permissions giải thích:
- Tất cả permissions chỉ dùng cho chức năng automation trên `bing.com` và `rewards.microsoft.com`
- Xem chi tiết trong [README.md](extension/README.md#-permissions)

---

## ⚠️ Disclaimer

Extension này tương tác với dịch vụ Microsoft Rewards. Người dùng tự chịu trách nhiệm về việc sử dụng và tuân thủ [Microsoft Services Agreement](https://www.microsoft.com/en-us/servicesagreement/).