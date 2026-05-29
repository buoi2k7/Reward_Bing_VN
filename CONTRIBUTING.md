# 🤝 Contributing / Đóng góp

Cảm ơn bạn quan tâm đến việc đóng góp cho **Bing Rewards Auto**! Dưới đây là hướng dẫn.

---

## 📋 Quy trình đóng góp

### 1. Fork & Clone

```bash
git clone https://github.com/<your-username>/Reward_Bing_VN.git
cd Reward_Bing_VN
```

### 2. Tạo branch mới

```bash
git checkout -b feature/ten-tinh-nang
# hoặc
git checkout -b fix/ten-bug
```

### 3. Phát triển & Test

- Load extension trong Chrome (`chrome://extensions/` → Load unpacked)
- Test trên [rewards.bing.com](https://rewards.bing.com)
- Kiểm tra console log cho lỗi

### 4. Commit

```bash
git add .
git commit -m "feat: mô tả ngắn gọn"
```

**Commit message format:**
| Prefix | Dùng khi |
|--------|----------|
| `feat:` | Thêm tính năng mới |
| `fix:` | Sửa bug |
| `docs:` | Cập nhật tài liệu |
| `style:` | Thay đổi UI/CSS |
| `refactor:` | Refactor code (không đổi behavior) |
| `perf:` | Cải thiện performance |

### 5. Push & tạo Pull Request

```bash
git push origin feature/ten-tinh-nang
```

Sau đó tạo Pull Request trên GitHub.

---

## 📐 Coding Standards

- **Language:** JavaScript ES2022+
- **Extension API:** Chrome Manifest V3
- **Indent:** 2 spaces
- **Quotes:** Single quotes `'...'`
- **Semicolons:** Yes
- **Comments:** Tiếng Việt hoặc English đều OK
- **No external dependencies** — pure vanilla JS + Chrome APIs

---

## 🐛 Báo Bug

Dùng [Issue Template](https://github.com/buoi2k7/Reward_Bing_VN/issues/new?template=bug_report.md) với thông tin:

1. Mô tả bug
2. Steps to reproduce
3. Expected vs Actual behavior
4. Chrome version
5. Console log (nếu có)

---

## 💡 Đề xuất tính năng

Dùng [Feature Request Template](https://github.com/buoi2k7/Reward_Bing_VN/issues/new?template=feature_request.md).

---

## ⚠️ Lưu ý

- Không commit file `.zip`, `_metadata/`, hay credentials
- Test kỹ trước khi tạo PR
- Mỗi PR nên focus vào 1 vấn đề/tính năng

---

Cảm ơn bạn đã đóng góp! 🙏