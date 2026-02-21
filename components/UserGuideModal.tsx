
import React, { useState, useRef, useEffect } from 'react';
import { useScrollControl } from '../hooks/useScrollControl';
import { triggerHaptic } from '../utils/helpers';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  setIsNavVisible?: (visible: boolean) => void;
}

const UserGuideModal: React.FC<Props> = ({ isOpen, onClose, setIsNavVisible }) => {
  const [activeTab, setActiveTab] = useState(0);
  const { handleScroll } = useScrollControl(setIsNavVisible);

  // --- LOGIC: Kiểm tra đã xem chưa ---
  useEffect(() => {
    if (isOpen) {
        const hasSeen = localStorage.getItem('army_guide_seen_v2026');
        if (hasSeen === 'true') {
            onClose();
        }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && setIsNavVisible) {
      setIsNavVisible(false);
    }
  }, [isOpen, setIsNavVisible]);

  // --- ACTIONS ---
  const handleCloseAndSave = () => {
      triggerHaptic('medium');
      localStorage.setItem('army_guide_seen_v2026', 'true');
      onClose();
  };

  const handleChangeTab = (index: number) => {
      triggerHaptic('light');
      setActiveTab(index);
  };

  const sections = [
    {
      title: "Chấm công 4.0",
      subtitle: "Attendance 4.0 - Smart & Secure",
      icon: "fa-qrcode",
      color: "from-emerald-400 to-emerald-600",
      bgLight: "bg-emerald-50",
      bgDark: "dark:bg-emerald-950/20",
      illustration: (
        <div className="relative w-full aspect-square max-w-[140px] mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-emerald-500/20 rounded-full animate-spin-slow"></div>
            
            <div className="relative z-10 w-24 h-38 bg-slate-900 rounded-[1.8rem] border-[3px] border-slate-800 shadow-2xl flex flex-col items-center p-2 overflow-hidden">
                <div className="w-8 h-1 bg-slate-800 rounded-full mb-3 mt-0.5"></div>
                <div className="w-full h-full border border-dashed border-emerald-500/40 rounded-xl flex items-center justify-center relative overflow-hidden bg-emerald-500/5">
                    <div className="flex flex-col items-center gap-1.5">
                        <i className="fa-solid fa-face-viewfinder text-2xl text-emerald-400 animate-pulse"></i>
                        <span className="text-[5px] font-bold text-emerald-400/70 tracking-tighter uppercase">Scanning</span>
                    </div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-scan"></div>
                </div>
            </div>

            <div className="absolute top-1 -right-1 w-10 h-10 bg-white dark:bg-slate-800 rounded-lg shadow-xl flex items-center justify-center border border-emerald-100 dark:border-emerald-800/50 rotate-12 animate-bounce-slow">
                <i className="fa-solid fa-location-dot text-base text-rose-500"></i>
            </div>
            <div className="absolute bottom-4 -left-3 w-9 h-9 bg-white dark:bg-slate-800 rounded-lg shadow-xl flex items-center justify-center border border-emerald-100 dark:border-emerald-800/50 -rotate-12 animate-float">
                <i className="fa-solid fa-wifi text-sm text-emerald-500"></i>
            </div>
        </div>
      ),
      steps: [
        { icon: "fa-location-dot", title: "Geofencing", text: "Hệ thống tự động xác thực vị trí GPS trong bán kính văn phòng." },
        { icon: "fa-user-check", title: "Face ID", text: "Chụp ảnh Selfie để đối soát khuôn mặt bằng AI, đảm bảo chính chủ." },
        { icon: "fa-bolt", title: "Kiosk Mode", text: "Quét QR tại máy tính bảng văn phòng để chấm công siêu tốc." }
      ]
    },
    {
      title: "Số hóa Đơn từ",
      subtitle: "Seamless Request Management",
      icon: "fa-paper-plane",
      color: "from-blue-400 to-blue-600",
      bgLight: "bg-blue-50",
      bgDark: "dark:bg-blue-950/20",
      illustration: (
        <div className="relative w-full aspect-square max-w-[140px] mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-200/30 dark:bg-blue-500/10 rounded-full blur-xl animate-pulse"></div>
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-20 bg-white/40 dark:bg-slate-800/40 rounded-lg border border-white/50 dark:border-slate-700/50 -rotate-6 translate-x-2 -translate-y-2 backdrop-blur-sm"></div>
            <div className="relative z-10 w-32 h-24 bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-4 flex flex-col gap-2 border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-1">
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                    </div>
                    <div className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[6px] font-black tracking-widest uppercase">Approved</div>
                </div>
                <div className="space-y-1.5">
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full"></div>
                    <div className="w-3/4 h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full"></div>
                </div>
                <div className="mt-auto flex justify-end">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30 animate-pulse">
                        <i className="fa-solid fa-signature text-xs"></i>
                    </div>
                </div>
            </div>

            <div className="absolute -top-1 right-0 text-blue-500 text-2xl animate-float-delayed">
                <i className="fa-solid fa-paper-plane"></i>
            </div>
        </div>
      ),
      steps: [
        { icon: "fa-calendar-plus", title: "Tạo đơn nhanh", text: "Nghỉ phép, Công tác, WFH... chỉ với vài thao tác vuốt chạm." },
        { icon: "fa-pen-clip", title: "Giải trình công", text: "Bổ sung dữ liệu khi quên chấm công hoặc có sai sót về giờ giấc." },
        { icon: "fa-bell", title: "Thông báo tức thì", text: "Nhận phản hồi phê duyệt từ HR/Quản lý ngay trên điện thoại." }
      ]
    },
    {
      title: "Báo cáo thông minh",
      subtitle: "Data-Driven Insights",
      icon: "fa-chart-pie",
      color: "from-violet-400 to-violet-600",
      bgLight: "bg-violet-50",
      bgDark: "dark:bg-violet-950/20",
      illustration: (
        <div className="relative w-full aspect-square max-w-[140px] mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-violet-200/30 dark:bg-violet-500/10 rounded-full blur-xl animate-pulse"></div>
            
            <div className="relative z-10 w-32 h-32 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Tháng này</p>
                        <h4 className="text-base font-black text-slate-800 dark:text-white">22.5</h4>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                        <i className="fa-solid fa-chart-line text-violet-500 text-sm"></i>
                    </div>
                </div>
                
                <div className="flex gap-1.5 items-end h-16 mb-1">
                    {[40, 70, 50, 90, 60, 85].map((h, i) => (
                        <div 
                            key={i} 
                            className="flex-1 bg-gradient-to-t from-violet-600 to-violet-400 rounded-t-sm animate-height-grow shadow-[0_0_6px_rgba(139,92,246,0.3)]" 
                            style={{height: `${h}%`, animationDelay: `${i * 0.1}s`}}
                        ></div>
                    ))}
                </div>
            </div>

            <div className="absolute -bottom-1 -left-1 w-16 h-16 bg-white dark:bg-slate-900 rounded-full shadow-xl p-1.5 border-2 border-violet-100 dark:border-violet-900 flex flex-col items-center justify-center rotate-[-10deg]">
                <div className="relative w-full h-full flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                        <circle cx="50%" cy="50%" r="40%" className="fill-none stroke-violet-100 dark:stroke-violet-900/30 stroke-[3]" />
                        <circle cx="50%" cy="50%" r="40%" className="fill-none stroke-violet-600 stroke-[3] stroke-dash-75" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-black text-violet-600">85%</span>
                    </div>
                </div>
            </div>
        </div>
      ),
      steps: [
        { icon: "fa-gauge-simple-high", title: "Dashboard", text: "Xem nhanh công chuẩn, thực tế, ngày nghỉ và quỹ phép năm." },
        { icon: "fa-clock-rotate-left", title: "Lịch sử chi tiết", text: "Minh bạch dữ liệu vào/ra kèm hình ảnh và vị trí đối soát." },
        { icon: "fa-file-export", title: "Xuất báo cáo", text: "Dễ dàng tra cứu và tải dữ liệu chấm công hàng tháng." }
      ]
    },
    {
      title: "An toàn & Bảo mật",
      subtitle: "Trusted Device Protocol",
      icon: "fa-shield-halved",
      color: "from-rose-400 to-rose-600",
      bgLight: "bg-rose-50",
      bgDark: "dark:bg-rose-950/20",
      illustration: (
        <div className="relative w-full aspect-square max-w-[140px] mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-rose-200/30 dark:bg-rose-500/10 rounded-full blur-xl animate-pulse"></div>
            
            <div className="relative z-10 w-24 h-24 bg-slate-900 rounded-[1.8rem] shadow-2xl flex items-center justify-center border-[3px] border-slate-800">
                <div className="w-14 h-14 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse">
                    <i className="fa-solid fa-shield-halved text-3xl"></i>
                </div>
                
                <div className="absolute inset-0 animate-spin-slow">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-6 bg-white dark:bg-slate-800 rounded-md shadow-lg flex items-center justify-center border border-rose-100 dark:border-rose-900/50">
                        <i className="fa-solid fa-lock text-rose-500 text-[10px]"></i>
                    </div>
                </div>
            </div>

            <div className="absolute w-36 h-36 border border-dashed border-rose-400/20 rounded-full animate-spin-slow"></div>
            <div className="absolute w-40 h-40 border border-rose-400/10 rounded-full"></div>
        </div>
      ),
      steps: [
        { icon: "fa-mobile-screen", title: "Thiết bị tin cậy", text: "Mỗi tài khoản được định danh duy nhất trên một thiết bị cá nhân." },
        { icon: "fa-fingerprint", title: "Chống giả mạo", text: "Ngăn chặn tuyệt đối Fake GPS và các ứng dụng can thiệp hệ thống." },
        { icon: "fa-key", title: "Xác thực 2 lớp", text: "Bảo vệ thông tin cá nhân và dữ liệu nhân sự của bạn an toàn." }
      ]
    }
  ];

  const touchStart = useRef<{x: number, y: number} | null>(null);
  const touchEnd = useRef<{x: number, y: number} | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const handleTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const dX = touchStart.current.x - touchEnd.current.x;
    const dY = touchStart.current.y - touchEnd.current.y;
    
    if (Math.abs(dX) > Math.abs(dY) && Math.abs(dX) > 50) {
      if (dX > 0 && activeTab < sections.length - 1) {
        handleChangeTab(activeTab + 1);
      } else if (dX < 0 && activeTab > 0) {
        handleChangeTab(activeTab - 1);
      }
    }
  };

  if (!isOpen) return null;

  const currentSection = sections[activeTab];

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex flex-col font-sans animate-slide-up overflow-hidden">
      <div 
        className="h-full flex flex-col pb-safe overflow-hidden" 
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button 
            onClick={handleCloseAndSave}
            className="absolute top-safe mt-4 right-4 z-50 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/5 backdrop-blur-md text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-black/10 transition-colors"
        >
            Bỏ qua
        </button>
        
        {/* HEADER */}
        <div className={`relative pt-12 pb-6 px-6 transition-all duration-700 ease-in-out ${currentSection.bgLight} ${currentSection.bgDark} overflow-hidden`}>
            <div className={`absolute -top-10 -left-10 w-48 h-48 rounded-full bg-gradient-to-br ${currentSection.color} opacity-10 blur-3xl animate-pulse`}></div>
            
            <div key={`illu-${activeTab}`} className="relative z-10 animate-fade-in-up">
                {currentSection.illustration}
            </div>
            
            <div key={`title-${activeTab}`} className="mt-6 text-center animate-slide-up relative z-10">
                <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight mb-2 px-4">
                    {currentSection.title}
                </h2>
                <div className={`mx-auto w-10 h-1.5 rounded-full bg-gradient-to-r ${currentSection.color} mb-3`}></div>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                    {currentSection.subtitle}
                </p>
            </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 px-8 pt-8 overflow-y-auto no-scrollbar">
            <div key={`content-${activeTab}`} className="space-y-6 pb-10">
                {currentSection.steps.map((step, idx) => (
                    <div 
                        key={idx} 
                        className="flex items-start gap-5 group animate-slide-right" 
                        style={{animationDelay: `${idx * 0.1}s`}}
                    >
                        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${currentSection.color} text-white flex items-center justify-center text-xl shadow-xl shadow-current/20 group-hover:scale-110 transition-transform flex-shrink-0`}>
                            <i className={`fa-solid ${step.icon}`}></i>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-base font-black text-slate-800 dark:text-white mb-0.5">{step.title}</h4>
                            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                                {step.text}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* FOOTER */}
        <div className="px-8 py-8 flex flex-col items-center gap-6 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800/50">
            {/* Dots */}
            <div className="flex gap-2.5">
                {sections.map((_, idx) => (
                    <button 
                        key={idx}
                        onClick={() => handleChangeTab(idx)}
                        className={`h-1.5 rounded-full transition-all duration-500 ease-out ${activeTab === idx ? `w-8 bg-gradient-to-r ${currentSection.color}` : 'w-1.5 bg-slate-300 dark:bg-slate-800'}`}
                    />
                ))}
            </div>

            {/* Navigation Buttons */}
            <div className="w-full flex gap-4">
                {activeTab > 0 && (
                    <button 
                        onClick={() => handleChangeTab(activeTab - 1)}
                        className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-white flex items-center justify-center transition-all active:scale-90 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        <i className="fa-solid fa-arrow-left text-lg"></i>
                    </button>
                )}
                
                {activeTab < sections.length - 1 ? (
                    <button 
                        onClick={() => handleChangeTab(activeTab + 1)}
                        className={`flex-1 h-14 rounded-2xl bg-gradient-to-r ${currentSection.color} text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-current/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3`}
                    >
                        Tiếp theo
                        <i className="fa-solid fa-chevron-right text-[10px]"></i>
                    </button>
                ) : (
                    <button 
                        onClick={handleCloseAndSave}
                        className="flex-1 h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        Bắt đầu ngay
                        <i className="fa-solid fa-rocket text-sm"></i>
                    </button>
                )}
            </div>
        </div>
      </div>

      <style>{`
        /* Optimization */
        .animate-scan, .animate-spin-slow, .animate-float, .animate-bounce-slow {
            will-change: transform, opacity;
        }

        @keyframes scan {
            0% { top: 0; opacity: 0; }
            10% { opacity: 1; }
            50% { top: 100%; opacity: 1; }
            90% { opacity: 1; }
            100% { top: 0; opacity: 0; }
        }
        .animate-scan {
            animation: scan 3s infinite ease-in-out;
        }
        @keyframes height-grow {
            0% { transform: scaleY(0); transform-origin: bottom; opacity: 0; }
            100% { transform: scaleY(1); transform-origin: bottom; opacity: 1; }
        }
        .animate-height-grow {
            animation: height-grow 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .animate-fade-in-up {
            animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-right {
            animation: slideRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
        }
        .animate-slide-up {
            animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideRight {
            from { opacity: 0; transform: translateX(-30px); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(100%); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(40px) scale(0.9); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-spin-slow {
            animation: spin 12s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-float {
            animation: float 4s ease-in-out infinite;
        }
        .animate-float-delayed {
            animation: float 4s ease-in-out infinite 2s;
        }
        @keyframes float {
            0%, 100% { transform: translateY(0) rotate(12deg); }
            50% { transform: translateY(-15px) rotate(15deg); }
        }
        .animate-bounce-slow {
            animation: bounceSlow 3s ease-in-out infinite;
        }
        @keyframes bounceSlow {
            0%, 100% { transform: translateY(0) rotate(12deg); }
            50% { transform: translateY(-10px) rotate(8deg); }
        }
        .stroke-dash-75 {
            stroke-dasharray: 251.2;
            stroke-dashoffset: 62.8;
        }
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default UserGuideModal;
