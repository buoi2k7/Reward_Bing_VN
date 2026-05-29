/**
 * BAN DETECTION MODULE — BRC Extension
 * File: reward/extension/ban-detection.js
 *
 * NHIỆM VỤ:
 *   Phân tích response từ rewards.bing.com/api/getuserinfo
 *   và trả về trạng thái tài khoản (OK / WARN / BAN).
 *
 * TÍCH HỢP:
 *   - Import vào content-intercept-bridge.js
 *   - Gọi analyzeBanStatus(apiData) mỗi khi intercept được response
 *   - Gửi kết quả về background.js qua chrome.runtime.sendMessage
 *
 * ============================================================
 * EXPORTED FUNCTION
 * ============================================================
 *
 * analyzeBanStatus(apiData: object): BanResult
 *
 *   Params:
 *     apiData — parsed JSON từ getuserinfo API response
 *
 *   Returns BanResult {
 *     status: 'OK' | 'WARN' | 'BAN',
 *     reasons: string[],   // danh sách lý do nếu WARN/BAN
 *     signals: SignalMap,  // raw signals để debug
 *   }
 *
 * ============================================================
 * SIGNAL MAP (signals trả về trong BanResult.signals)
 * ============================================================
 *
 *   isSuspended: boolean
 *     Nguồn: apiData.userStatus?.isSuspended
 *     BAN nếu true
 *
 *   isRewardsUser: boolean
 *     Nguồn: apiData.userStatus?.isRewardsUser
 *     BAN nếu false
 *
 *   pcSearchMax: number
 *     Nguồn: apiData.counters?.pcSearch?.maxProgressCount
 *     WARN nếu < 30 (bình thường = 90)
 *     BAN  nếu === 0
 *
 *   mobileSearchMax: number
 *     Nguồn: apiData.counters?.mobileSearch?.maxProgressCount
 *     WARN nếu < 20 (bình thường = 60)
 *     BAN  nếu === 0
 *
 *   pointsNotCounting: boolean
 *     Nguồn: so sánh points trước/sau search (optional, set null nếu chưa có data)
 *     WARN nếu true sau 2+ lần liên tiếp
 *
 * ============================================================
 * LOGIC PHÂN LOẠI
 * ============================================================
 *
 *   BAN  — nếu có BẤT KỲ signal BAN nào
 *   WARN — nếu có ít nhất 1 signal WARN và không có signal BAN
 *   OK   — tất cả signals bình thường
 *
 * ============================================================
 * TÍCH HỢP VÀO content-intercept-bridge.js
 * ============================================================
 *
 *   // Thêm vào cuối đoạn intercept fetch, sau khi parse JSON:
 *   import { analyzeBanStatus } from './ban-detection.js';
 *
 *   if (url.includes('getuserinfo')) {
 *     const banResult = analyzeBanStatus(data);
 *     chrome.runtime.sendMessage({
 *       type: 'BAN_STATUS_UPDATE',
 *       result: banResult,
 *       timestamp: Date.now(),
 *     });
 *   }
 *
 * ============================================================
 * TÍCH HỢP VÀO background.js
 * ============================================================
 *
 *   chrome.runtime.onMessage.addListener((msg) => {
 *     if (msg.type === 'BAN_STATUS_UPDATE') {
 *       // Lưu vào chrome.storage.local
 *       chrome.storage.local.set({ banStatus: msg.result });
 *
 *       // Đổi icon nếu BAN/WARN
 *       if (msg.result.status === 'BAN') {
 *         chrome.action.setIcon({ path: 'icons/icon-ban.png' });
 *         chrome.action.setBadgeText({ text: '⚠' });
 *         chrome.action.setBadgeBackgroundColor({ color: '#e24b4a' });
 *       } else if (msg.result.status === 'WARN') {
 *         chrome.action.setBadgeText({ text: '!' });
 *         chrome.action.setBadgeBackgroundColor({ color: '#ef9f27' });
 *       } else {
 *         chrome.action.setBadgeText({ text: '' });
 *       }
 *     }
 *   });
 *
 * ============================================================
 * HIỂN THỊ TRONG popup.html
 * ============================================================
 *
 *   Đọc từ chrome.storage.local key 'banStatus'
 *   Render một status badge:
 *     OK   → màu xanh, text "Account OK"
 *     WARN → màu vàng, text "Cảnh báo: {reasons[0]}"
 *     BAN  → màu đỏ, text "Có thể bị ban: {reasons.join(', ')}"
 *   Hiển thị signals.pcSearchMax và signals.mobileSearchMax dạng số
 */
