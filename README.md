
# Army HRM V2026 - Hệ thống Quản lý Nhân sự & Chấm công Thông minh

![Army HRM Logo](https://firebasestorage.googleapis.com/v0/b/army-hrm-70615.firebasestorage.app/o/logo%2Flogo_white.png?alt=media)

**Army HRM V2026** là giải pháp quản lý nhân sự toàn diện, được thiết kế theo tư duy **Mobile-First** (ưu tiên di động) và vận hành dưới dạng **Progressive Web App (PWA)**. Hệ thống cung cấp giải pháp chấm công hiện đại kết hợp định vị GPS và xác thực khuôn mặt (Face ID), cùng với hệ thống quản trị dữ liệu (CMS) mạnh mẽ dành cho doanh nghiệp.

---

## 🌟 Tính năng nổi bật

### 📱 Dành cho Nhân viên (Mobile App)

Giao diện được tối ưu hóa cho trải nghiệm di động, hỗ trợ cảm ứng vuốt (Swipe), Dark Mode và Haptic Feedback.

#### 1. Chấm công thông minh (Smart Attendance)
*   **Định vị GPS (Geofencing):** Chỉ cho phép chấm công khi nhân viên nằm trong bán kính cho phép của văn phòng/chi nhánh.
*   **Xác thực khuôn mặt (Face ID):** Yêu cầu chụp ảnh Selfie khi Check-in để xác thực danh tính, ngăn chặn gian lận.
*   **Tính toán thời gian thực:** Hệ thống tự động xác định ca làm việc, tính toán phút đi trễ, về sớm hoặc tăng ca ngay lập tức.
*   **Chế độ Tạm dừng (Pause/Resume):** Cho phép nhân viên tạm dừng ca làm việc (nghỉ trưa, việc riêng) để tính chính xác giờ làm thực tế (Net Hours).

#### 2. Quản lý Đơn từ & Giải trình
*   **Tạo đề xuất:** Gửi đơn xin nghỉ phép, nghỉ ốm, công tác, hoặc làm việc tại nhà (WFH) chỉ với vài thao tác.
*   **Giải trình công:** Gửi giải trình khi quên chấm công hoặc đi trễ/về sớm để quản lý phê duyệt.
*   **Theo dõi trạng thái:** Xem lịch sử đơn từ và trạng thái phê duyệt (Chờ duyệt/Đã duyệt/Từ chối) trực quan.

#### 3. Báo cáo & Thống kê
*   **Dashboard tổng quan:** Xem nhanh số ngày công, số phút đi trễ, và số lỗi chấm công trong tháng.
*   **Lịch sử chi tiết:** Xem nhật ký chấm công dưới dạng Danh sách (List) hoặc Lịch (Calendar) theo tuần/tháng.
*   **Quỹ phép:** Theo dõi số ngày phép năm còn lại.

#### 4. Tiện ích khác
*   **Danh bạ nội bộ:** Tra cứu thông tin đồng nghiệp, gọi điện hoặc gửi email nhanh.
*   **Thông báo (Notifications):** Nhận thông báo đẩy (Push Notification) khi đơn được duyệt hoặc có thông báo từ hệ thống.
*   **Bảo mật thiết bị (Trusted Device):** Mỗi tài khoản chỉ được phép đăng nhập trên một thiết bị duy nhất để đảm bảo an toàn dữ liệu.

---

### 🖥️ Dành cho Quản trị viên (Admin Portal)

Giao diện Desktop chuyên dụng để quản lý dữ liệu tập trung.

#### 1. Quản trị Dữ liệu (CMS)
*   **CRUD toàn diện:** Quản lý danh sách Nhân viên, Chấm công, Đơn từ, Địa điểm, Ca làm việc.
*   **Import/Export Excel:** Hỗ trợ nhập liệu hàng loạt từ file Excel và xuất báo cáo chấm công ra file `.xlsx` để tính lương.
*   **Xử lý hàng loạt:** Xóa hoặc cập nhật nhiều bản ghi cùng lúc.

#### 2. Cấu hình Hệ thống Linh hoạt
*   **Địa điểm (Locations):** Thiết lập tọa độ (Lat/Lng) và bán kính cho phép chấm công cho từng văn phòng.
*   **Ca làm việc (Shifts):** Cấu hình giờ vào/ra, giờ nghỉ trưa, điểm gãy ca linh hoạt.
*   **Ngày lễ (Holidays):** Thiết lập các ngày nghỉ lễ để hệ thống tự động tính công.
*   **Tham số hệ thống:** Cấu hình thời gian cho phép đi muộn (Tolerance), số công chuẩn, ngày chốt công.

#### 3. Phê duyệt & Thống kê
*   **Duyệt đơn tập trung:** Xem và xử lý tất cả các đơn xin nghỉ, giải trình từ nhân viên.
*   **Chốt công tháng:** Tính toán tự động bảng công tổng hợp (Monthly Stats) bao gồm: Công thực tế, Công nghỉ phép, Phạt đi trễ...

---

## 🛠️ Công nghệ sử dụng

Dự án được xây dựng trên nền tảng công nghệ web hiện đại nhất năm 2024-2025:

*   **Frontend Core:** React 19, TypeScript
*   **Styling:** Tailwind CSS (Responsive, Dark Mode)
*   **Backend (Serverless):** Google Firebase
    *   **Firestore:** Cơ sở dữ liệu NoSQL thời gian thực.
    *   **Authentication:** Quản lý xác thực người dùng.
    *   **Storage:** Lưu trữ hình ảnh chấm công và Avatar.
    *   **Cloud Messaging (FCM):** Thông báo đẩy đa nền tảng.
*   **Utilities:**
    *   `xlsx`: Xử lý file Excel.
    *   `react-native-webview` (Optional): Đóng gói thành Native App.

---

## ⚙️ Cài đặt và Triển khai

### Yêu cầu tiên quyết
*   Node.js (v18 trở lên).
*   Tài khoản Google Firebase.

### 1. Clone dự án
```bash
git clone https://github.com/your-repo/army-hrm.git
cd army-hrm
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình Môi trường (.env)
Tạo file `.env` tại thư mục gốc và điền thông tin cấu hình Firebase của bạn:

```env
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

### 4. Cấu hình Firestore Indexes
Để các tính năng sắp xếp và lọc hoạt động chính xác, bạn cần tạo các **Composite Indexes** trong Firestore Console:

*   **Collection: `attendance`**
    *   Fields: `employee_id` (Ascending) + `date` (Ascending)
    *   Fields: `employee_id` (Ascending) + `timestamp` (Descending)
*   **Collection: `leave_requests`**
    *   Fields: `employee_id` (Ascending) + `created_at` (Descending)
*   **Collection: `explanations`**
    *   Fields: `employee_id` (Ascending) + `created_at` (Descending)

### 5. Chạy ứng dụng (Development)
```bash
npm run dev
# Mở trình duyệt tại: http://localhost:5173
```

---

## 📖 Hướng dẫn sử dụng

### 1. Đăng nhập
*   **Tài khoản:** Sử dụng Mã nhân viên (VD: `NV001`) hoặc Email đã đăng ký.
*   **Mật khẩu:** Mặc định được cấp bởi Admin.
*   *Lưu ý:* Lần đầu đăng nhập, thiết bị sẽ được ghi nhận là "Thiết bị tin cậy". Bạn không thể đăng nhập trên thiết bị khác trừ khi Admin reset.

### 2. Chấm công (User)
1.  Tại màn hình **Home**, nhấn nút **"Chấm công"**.
2.  Trình duyệt sẽ yêu cầu quyền truy cập **Vị trí** và **Camera**. Hãy chọn "Cho phép".
3.  Đưa khuôn mặt vào khung hình và hệ thống sẽ tự động chụp ảnh + ghi nhận vị trí.
4.  Nhận thông báo thành công (Kèm thông tin Ca làm việc, Trạng thái đi trễ/đúng giờ).

### 3. Quản trị (Admin)
1.  Đăng nhập bằng tài khoản có quyền `Admin`.
2.  Tại màn hình chọn chế độ, chọn **"Quản trị Dữ liệu"**.
3.  Sử dụng menu bên trái để truy cập các bảng dữ liệu.
4.  Sử dụng nút **"Import"** để nạp danh sách nhân viên từ Excel mẫu.
5.  Sử dụng nút **"Export"** tại bảng *Attendance* hoặc *Monthly Stats* để xuất báo cáo lương.

---

## 🔒 Chính sách bảo mật & Quyền riêng tư

*   **Dữ liệu vị trí:** Chỉ được thu thập tại thời điểm người dùng nhấn nút Chấm công (Check-in/Out). Ứng dụng không theo dõi vị trí nền.
*   **Dữ liệu hình ảnh:** Ảnh chấm công được lưu trữ riêng tư trên Firebase Storage và chỉ Admin/Manager có quyền xem để đối soát.
*   **Mật khẩu:** Được mã hóa (Hash) trước khi lưu trữ và so sánh.

---

© 2026 Army HRM Enterprise. Phiên bản v2026.2.0.
