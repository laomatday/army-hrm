
# Army HRM V2026 - Hệ thống Quản lý Nhân sự & Chấm công Thông minh

![Army HRM Logo](https://lh3.googleusercontent.com/d/1r_FuqN4QJbch0FYXAwX8efW9s0ucreiO=w500)

**Army HRM V2026** là giải pháp quản lý nhân sự toàn diện, được thiết kế theo tư duy **Mobile-First** và vận hành dưới dạng **Progressive Web App (PWA)**. Hệ thống cung cấp giải pháp chấm công hiện đại kết hợp định vị GPS và xác thực khuôn mặt (Face ID), cùng với hệ thống quản trị dữ liệu (CMS) mạnh mẽ dành cho doanh nghiệp.

---

## 🌟 Tính năng nổi bật

### 📱 Dành cho Nhân viên (Mobile App)

Giao diện được tối ưu hóa cho trải nghiệm di động, hỗ trợ cảm ứng vuốt (Swipe), Dark Mode và Haptic Feedback.

#### 1. Chấm công hiện đại (Attendance 4.0)
*   **Định vị GPS (Geofencing):** Chỉ cho phép chấm công khi nhân viên nằm trong bán kính cho phép của văn phòng/chi nhánh.
*   **Xác thực khuôn mặt (Face ID):** Chụp ảnh Selfie khi Check-in/Check-out để xác thực danh tính, ngăn chặn tuyệt đối việc chấm công hộ.
*   **Tính toán thời gian thực:** Tự động xác định ca làm việc, tính toán phút đi trễ, về sớm hoặc tăng ca ngay lập tức.
*   **Kiosk Mode (QR Scan):** Hỗ trợ chấm công thông qua việc quét mã QR trên thiết bị Kiosk đặt tại văn phòng.

#### 2. Quản lý Đơn từ & Giải trình (Số hóa 100%)
*   **Đa dạng loại đơn:** Gửi đơn xin nghỉ phép, nghỉ ốm, công tác, hoặc làm việc tại nhà (WFH) nhanh chóng.
*   **Giải trình công:** Gửi giải trình khi quên chấm công hoặc có sai sót về giờ giấc để quản lý phê duyệt trực tuyến.
*   **Theo dõi thời gian thực:** Nhận thông báo đẩy (Push Notification) ngay khi đơn được quản lý phê duyệt hoặc từ chối.

#### 3. Báo cáo & Thống kê cá nhân
*   **Dashboard trực quan:** Xem nhanh các chỉ số quan trọng: Công chuẩn, Công thực tế, Công nghỉ lễ và Phép năm.
*   **Lịch sử chi tiết:** Nhật ký chấm công đầy đủ thông tin (Giờ vào/ra, Ca, Vị trí, Ảnh đối soát) theo tháng.
*   **Quản lý Quỹ phép:** Tự động cập nhật và hiển thị số ngày phép đã dùng và còn lại.

#### 4. Tiện ích & Bảo mật
*   **Danh bạ nội bộ:** Tìm kiếm đồng nghiệp theo tên/phòng ban, hỗ trợ gọi điện hoặc gửi email tức thì.
*   **Thông báo hệ thống:** Nhận tin tức, nhắc nhở quan trọng từ bộ phận HR thông qua Push Notification.
*   **Khóa thiết bị (Trusted Device):** Mỗi tài khoản được liên kết chặt chẽ với một thiết bị duy nhất, đảm bảo tính duy nhất và bảo mật tài khoản.

---

### 🖥️ Dành cho Quản trị viên (Admin Portal)

Hệ thống quản trị mạnh mẽ giúp HR vận hành doanh nghiệp hiệu quả.

#### 1. Quản trị Dữ liệu tập trung (CMS)
*   **Quản lý Nhân sự:** Lưu trữ thông tin nhân viên, hợp đồng, chức vụ và quyền hạn.
*   **Quản lý Chấm công:** Giám sát dữ liệu chấm công thời gian thực của toàn bộ nhân viên.
*   **Quản lý Đơn từ:** Phê duyệt/Từ chối các yêu cầu nghỉ phép, giải trình công tập trung tại một màn hình.

#### 2. Cấu hình Hệ thống Linh hoạt
*   **Địa điểm (Locations):** Thiết lập tọa độ và bán kính Geofencing cho từng chi nhánh.
*   **Ca làm việc (Shifts):** Cấu hình linh hoạt giờ vào/ra, điểm gãy ca và quy tắc tính công.
*   **Ngày lễ (Holidays):** Quản lý lịch nghỉ lễ theo quy định để tự động tính công hưởng lương.
*   **Cấu hình tham số:** Thiết lập thời gian đi trễ cho phép (Tolerance), công chuẩn tháng, v.v.

#### 3. Phân tích & Xuất báo cáo
*   **Tính công tự động:** Hệ thống tự động tổng hợp bảng công tháng (Monthly Stats) chính xác đến từng phút.
*   **Xuất Excel:** Hỗ trợ xuất dữ liệu chấm công, bảng công tổng hợp ra file `.xlsx` chuyên nghiệp để làm căn cứ tính lương.
*   **Import hàng loạt:** Tiết kiệm thời gian bằng cách nhập liệu danh sách nhân viên từ file Excel.

---

## 🛠️ Công nghệ sử dụng

*   **Frontend:** React 19, TypeScript, Tailwind CSS (Mobile-First UI).
*   **Backend (Serverless):** Google Firebase (Firestore, Auth, Cloud Messaging), Google App Script.
*   **Lưu trữ Ảnh:** Google Drive.
*   **PWA:** Service Workers hỗ trợ cài đặt ứng dụng lên màn hình chính và hoạt động mượt mà.
*   **Tiện ích:** Haptic Feedback API, Geolocation API, Camera API, WebP compression.

---

## ⚙️ Cài đặt và Triển khai

1. **Cài đặt môi trường:** Node.js v18+.
2. **Cài đặt thư viện:** `npm install`.
3. **Cấu hình biến môi trường:** Tạo file `.env` với các tham số `VITE_FIREBASE_*` và `VITE_GOOGLE_SCRIPT_URL`.
4. **Firestore Indexes:** Tạo các chỉ mục phức hợp (Composite Indexes) cho `attendance`, `leave_requests`, và `explanations` theo hướng dẫn trong code.
5. **Chạy ứng dụng:** `npm run dev`.

---

## 🔒 Chính sách bảo mật & Quyền riêng tư

*   **Vị trí & Camera:** Chỉ truy cập khi người dùng thực hiện chấm công hoặc cập nhật ảnh đại diện. Dữ liệu được bảo mật trên nền tảng Google.
*   **Lưu trữ Ảnh:** Ảnh selfie chấm công và ảnh đại diện được tải lên và lưu trữ an toàn trên Google Drive cá nhân của doanh nghiệp, không phụ thuộc vào Firebase Storage.
*   **Thiết bị tin cậy:** Ngăn chặn việc sử dụng nhiều thiết bị để chấm công hộ.
*   **Quyền hạn:** Phân quyền rõ ràng (Admin, Manager, Employee) để đảm bảo an toàn dữ liệu nội bộ.

---

© 2026 Army HRM Enterprise. Phiên bản v2026.2.0.
