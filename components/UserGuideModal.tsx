
import React from 'react';
import BaseModal from './BaseModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const UserGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const sections = [
    {
      title: "Chấm công Hàng ngày",
      icon: "fa-qrcode",
      color: "text-emerald-500",
      content: [
        "Mở ứng dụng và nhấn vào nút 'Chấm công' lớn ở trang chủ.",
        "Quét mã QR được cung cấp tại văn phòng hoặc vị trí làm việc.",
        "Xác nhận khuôn mặt (nếu được yêu cầu) để hoàn tất vào ca.",
        "Khi kết thúc ca, thực hiện tương tự bằng cách nhấn 'Ra về'."
      ]
    },
    {
      title: "Quản lý Đề xuất",
      icon: "fa-file-signature",
      color: "text-blue-500",
      content: [
        "Chuyển sang tab 'Đề xuất' ở thanh điều hướng dưới cùng.",
        "Nhấn vào nút '+' ở góc trên để tạo đề xuất mới (Nghỉ phép, Đi muộn, v.v.).",
        "Điền đầy đủ thông tin và lý do, sau đó nhấn 'Gửi đề xuất'.",
        "Theo dõi trạng thái phê duyệt ngay tại danh sách đề xuất."
      ]
    },
    {
      title: "Xem Lịch sử & Thống kê",
      icon: "fa-clock-rotate-left",
      color: "text-purple-500",
      content: [
        "Tab 'Lịch sử' hiển thị chi tiết các lần chấm công trong tháng.",
        "Tại 'Trang chủ', bạn có thể xem nhanh các chỉ số: Công chuẩn, Công thực tế, Phép năm.",
        "Sử dụng bộ lọc tháng để xem lại dữ liệu của các tháng trước."
      ]
    },
    {
      title: "Thông tin & Cài đặt",
      icon: "fa-user-gear",
      color: "text-orange-500",
      content: [
        "Tab 'Cá nhân' cho phép bạn cập nhật ảnh đại diện và xem thông tin hợp đồng.",
        "Vào phần 'Cài đặt' (biểu tượng bánh răng) để thay đổi giao diện Tối/Sáng.",
        "Bạn cũng có thể bật/tắt thông báo đẩy tại đây."
      ]
    }
  ];

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Hướng dẫn sử dụng">
      <div className="p-4 space-y-6">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
            <h4 className="text-emerald-800 dark:text-emerald-300 font-bold mb-1 flex items-center gap-2">
                <i className="fa-solid fa-lightbulb"></i>
                Chào mừng bạn đến với Army HRM
            </h4>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium leading-relaxed">
                Ứng dụng giúp bạn quản lý công việc, chấm công và đề xuất một cách hiện đại và nhanh chóng.
            </p>
        </div>

        {sections.map((section, idx) => (
          <div key={idx} className="space-y-3">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center ${section.color} border border-slate-100 dark:border-slate-700`}>
                <i className={`fa-solid ${section.icon} text-sm`}></i>
              </div>
              {section.title}
            </h3>
            <ul className="space-y-2 ml-11">
              {section.content.map((item, i) => (
                <li key={i} className="text-sm text-slate-500 dark:text-slate-400 flex gap-3 leading-relaxed">
                  <span className="text-emerald-500 font-bold">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                Mọi thắc mắc vui lòng liên hệ bộ phận HR
            </p>
        </div>
      </div>
    </BaseModal>
  );
};

export default UserGuideModal;
