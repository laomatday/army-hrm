import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Employee } from '../types';
import { getShortName, formatDateString, triggerHaptic } from '../utils/helpers';
import { updateProfileAvatar, changePassword } from '../services/api';
import Avatar from './Avatar';
import ImageCropper from './ImageCropper';
import ConfirmDialog from './ConfirmDialog';
import ModalHeader from './ModalHeader';

interface Props {
  user: Employee;
  locations: any[];
  contacts: Employee[];
  onLogout: () => void;
  onUpdate: (updatedUser: Partial<Employee>) => void;
  onClose: () => void;
  onAlert: (title: string, msg: string, type: 'success' | 'error' | 'warning') => void;
  setShowImageCropper: (show: boolean) => void;
}

const TabProfile: React.FC<Props> = ({ user, locations, contacts, onLogout, onUpdate, onClose, onAlert, setShowImageCropper }) => {
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [loadingPwd, setLoadingPwd] = useState(false);
  const [passData, setPassData] = useState({ old: '', new: '', confirm: '' });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  
  const [croppingImage, setCroppingImage] = useState<string | null>(null);

  useEffect(() => {
    setShowImageCropper(!!croppingImage);
  }, [croppingImage, setShowImageCropper]);

  const touchStart = useRef<{x: number, y: number} | null>(null);
  const touchEnd = useRef<{x: number, y: number} | null>(null);
  const minSwipeDistance = 60;

  const bgClass = 'bg-emerald-500';
  const gradientClass = 'from-emerald-500/10 to-teal-500/10';

  const managerName = useMemo(() => {
      if(!user.direct_manager_id) return null;
      const mgr = contacts.find(c => c.employee_id === user.direct_manager_id);
      return mgr ? mgr.name : user.direct_manager_id;
  }, [user.direct_manager_id, contacts]);

  const locationName = useMemo(() => {
      const loc = locations.find(l => l.center_id === user.center_id);
      return loc ? (loc.location_name || loc.name) : user.center_id;
  }, [user.center_id, locations]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      if (file.size > 10 * 1024 * 1024) { 
          onAlert("Lỗi file", "File quá lớn. Vui lòng chọn ảnh khác.", 'error');
          return;
      }

      const reader = new FileReader();
      reader.onload = () => {
          if (typeof reader.result === 'string') {
              setCroppingImage(reader.result);
          }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
  };

  const handleCropComplete = async (url: string) => {
      setUploading(true);
      try {
          const res = await updateProfileAvatar(user.employee_id, url);
          if (res.success) {
              triggerHaptic('success');
              onUpdate({ face_ref_url: url });
              onAlert("Thành công", res.message, 'success');
          } else {
              triggerHaptic('error');
              onAlert("Lỗi", res.message, 'error');
          }
      } catch (err) {
          console.error(err);
          onAlert("Lỗi", "Lỗi xử lý ảnh.", 'error');
      } finally {
          setUploading(false);
          setCroppingImage(null);
      }
  };

  const handleUpdatePassword = async () => {
      if (!passData.old || !passData.new || !passData.confirm) {
          triggerHaptic('warning');
          onAlert("Thiếu thông tin", "Vui lòng điền đầy đủ thông tin!", 'warning');
          return;
      }
      if (passData.new !== passData.confirm) {
          triggerHaptic('warning');
          onAlert("Lỗi mật khẩu", "Mật khẩu mới không khớp!", 'warning');
          return;
      }
      if (passData.new.length < 6) {
          triggerHaptic('warning');
          onAlert("Mật khẩu yếu", "Mật khẩu mới phải có ít nhất 6 ký tự.", 'warning');
          return;
      }

      setLoadingPwd(true);
      const res = await changePassword(user.employee_id, passData.old, passData.new);
      setLoadingPwd(false);

      if (res.success) {
          triggerHaptic('success');
          onAlert("Thành công", res.message, 'success');
          setShowPwdModal(false);
          setPassData({ old: '', new: '', confirm: '' });
      } else {
          triggerHaptic('error');
          onAlert("Lỗi", res.message, 'error');
      }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const x = e.targetTouches[0].clientX;
    if (x < 30 || x > window.innerWidth - 30) {
        touchStart.current = null;
        return;
    }
    touchEnd.current = null;
    touchStart.current = { x, y: e.targetTouches[0].clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
     touchEnd.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    
    const distanceX = touchStart.current.x - touchEnd.current.x;
    const distanceY = touchStart.current.y - touchEnd.current.y;
    
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
         if (distanceX > minSwipeDistance) {
             triggerHaptic('light');
             onClose();
         }
    }
  };

  const ProfileRow = ({ 
      icon, 
      colorClass, 
      label, 
      value, 
      isLink = false, 
      onClick,
      isDestructive = false
  }: { 
      icon: string, 
      colorClass: string, 
      label: string, 
      value?: string | React.ReactNode, 
      isLink?: boolean,
      onClick?: () => void,
      isDestructive?: boolean
  }) => (
      <div 
          onClick={() => { if(onClick) { triggerHaptic('light'); onClick(); } }}
          className={`flex items-center gap-4 p-4 active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors group ${onClick ? 'cursor-pointer' : ''}`}
      >
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base flex-shrink-0 border border-white/50 dark:border-slate-700/50 ${colorClass}`}>
              <i className={`fa-solid ${icon}`}></i>
          </div>
          
          <div className="flex-1 min-w-0">
              <p className={`text-base font-bold ${isDestructive ? 'text-red-500 dark:text-red-400' : 'text-slate-800 dark:text-white'} truncate`}>{label}</p>
              {value && <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5 truncate uppercase tracking-wide">{value}</p>}
          </div>

          {isLink && (
              <div className="text-slate-300 dark:text-slate-600">
                  <i className="fa-solid fa-chevron-right text-xs"></i>
              </div>
          )}
      </div>
  );

  return (
    <div 
        className="fixed inset-0 z-[30] bg-slate-50 dark:bg-slate-900 flex flex-col animate-slide-up transition-colors duration-300"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
        
        <div className="fixed top-0 left-0 w-full z-40">
            <ModalHeader 
                onClose={() => { triggerHaptic('light'); onClose(); }} 
                bgClass="bg-transparent border-none"
            />
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32 pt-14">
            <div className="animate-fade-in">
                
                <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden mb-6 transition-colors mt-4">
                    <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-br ${gradientClass} rounded-t-[32px] transition-colors duration-500`}></div>
                    
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full p-1.5 bg-white dark:bg-slate-800 mb-4 mt-2 relative overflow-hidden transition-colors">
                                <Avatar 
                                    src={user.face_ref_url} 
                                    name={user.name} 
                                    className="w-full h-full"
                                    textSize="text-4xl"
                                    onClick={() => fileInputRef.current?.click()}
                                />
                                <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                                    <i className="fa-solid fa-camera text-white text-2xl"></i>
                                </div>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleFileSelect}
                            />
                            {uploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 rounded-full">
                                    <i className="fa-solid fa-circle-notch fa-spin text-emerald-600"></i>
                                </div>
                            )}
                        </div>

                        <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">{user.name}</h2>
                        
                        <div className="flex gap-2 flex-wrap justify-center mt-3">
                            <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide">{user.department}</span>
                            <span className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/30 rounded-lg text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wide">{user.position}</span>                            
                        </div>
                    </div>
                </div>

                <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase mb-3 ml-2 tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-briefcase text-[10px]"></i>
                    Thông tin công việc
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700 mb-8">
                    <ProfileRow 
                        icon="fa-location-dot" 
                        colorClass="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                        label="Văn phòng làm việc"
                        value={locationName}
                    />
                    <ProfileRow 
                        icon="fa-user-tie" 
                        colorClass="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                        label="Quản lý trực tiếp"
                        value={managerName || "Không có"}
                    />
                    <ProfileRow 
                        icon="fa-calendar-day" 
                        colorClass="bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                        label="Ngày tham gia"
                        value={user.join_date ? formatDateString(user.join_date) : "--"}
                    />
                </div>

                <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase mb-3 ml-2 tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-address-card text-[10px]"></i>
                    Thông tin cá nhân
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700 mb-8">
                    <ProfileRow 
                        icon="fa-envelope" 
                        colorClass="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        label="Email"
                        value={user.email}
                    />
                    <ProfileRow 
                        icon="fa-phone" 
                        colorClass="bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
                        label="Số điện thoại"
                        value={String(user.phone)}
                    />
                    <ProfileRow 
                        icon="fa-fingerprint" 
                        colorClass="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                        label="Thiết bị tin cậy"
                        value={user.trusted_device_id ? "Đã kích hoạt" : "Chưa kích hoạt"}
                    />
                </div>

                <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase mb-3 ml-2 tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-user-shield text-[10px]"></i>
                    Tài khoản
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700 mb-8">
                    <ProfileRow 
                        icon="fa-key" 
                        colorClass="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                        label="Đổi mật khẩu"
                        value="Cập nhật mật khẩu mới"
                        isLink
                        onClick={() => setShowPwdModal(true)}
                    />
                    <ProfileRow 
                        icon="fa-right-from-bracket" 
                        colorClass="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                        label="Đăng xuất"
                        isDestructive
                        onClick={() => {
                            triggerHaptic('medium');
                            setShowLogoutConfirm(true);
                        }}
                    />
                </div>
                
                <div className="text-center pb-8">
                    <p className="text-[10px] font-extrabold text-slate-300 dark:text-slate-600 uppercase tracking-widest">Army HRM v2026.2.0</p>
                </div>
            </div>
        </div>

        {showPwdModal && (
            <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[32px] p-6 animate-scale-in">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100 dark:border-amber-900/30">
                            <i className="fa-solid fa-lock text-2xl"></i>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Đổi mật khẩu</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1 uppercase tracking-wide">Cập nhật mật khẩu bảo vệ tài khoản</p>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-1">Mật khẩu hiện tại</label>
                            <input 
                                type="password" 
                                className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:font-semibold"
                                placeholder="••••••••"
                                value={passData.old}
                                onChange={e => setPassData({...passData, old: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-1">Mật khẩu mới</label>
                            <input 
                                type="password" 
                                className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:font-semibold"
                                placeholder="••••••••"
                                value={passData.new}
                                onChange={e => setPassData({...passData, new: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-1">Xác nhận mật khẩu</label>
                            <input 
                                type="password" 
                                className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:font-semibold"
                                placeholder="••••••••"
                                value={passData.confirm}
                                onChange={e => setPassData({...passData, confirm: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button 
                            onClick={() => setShowPwdModal(false)}
                            className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors uppercase tracking-wide"
                        >
                            Hủy
                        </button>
                        <button 
                            onClick={handleUpdatePassword}
                            disabled={loadingPwd}
                            className="flex-1 py-3.5 bg-amber-500 text-white font-bold text-sm rounded-2xl hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 uppercase tracking-wide"
                        >
                            {loadingPwd ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Lưu thay đổi'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        <ConfirmDialog 
            isOpen={showLogoutConfirm}
            title="Đăng xuất?"
            message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này?"
            confirmLabel="Đăng xuất"
            onConfirm={onLogout}
            onCancel={() => setShowLogoutConfirm(false)}
            type="danger"
        />

        {croppingImage && (
            <ImageCropper 
                imageSrc={croppingImage} 
                userId={user.employee_id}
                onCancel={() => { setCroppingImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                onCropComplete={handleCropComplete}
            />
        )}
    </div>
  );
};

export default TabProfile;
