import React, { useRef } from 'react';
import { Employee } from '../types';
import Avatar from './Avatar';
import ModalHeader from './ModalHeader';
import { formatDateString, triggerHaptic } from '../utils/helpers';

interface Props {
  contact: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  locationsMap: Record<string, string>;
  empNameMap: Record<string, string>;
}

const ModalContactDetail: React.FC<Props> = ({ contact, isOpen, onClose, locationsMap, empNameMap }) => {
  const touchStart = useRef<{x: number, y: number} | null>(null);
  const touchEnd = useRef<{x: number, y: number} | null>(null);

  if (!contact || !isOpen) return null;

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
         if (distanceX < -60) {
             onClose();
         }
    }
  };

  const ContactDetailRow = ({ 
      icon, 
      colorClass, 
      label, 
      value, 
      isLink = false,
      href
  }: { 
      icon: string, 
      colorClass: string, 
      label: string, 
      value: string, 
      isLink?: boolean,
      href?: string
  }) => {
      const Content = (
          <>
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base flex-shrink-0 border border-white/50 dark:border-slate-700/50 shadow-sm ${colorClass}`}>
                <i className={`fa-solid ${icon}`}></i>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold truncate uppercase tracking-wider">{label}</p>
                <p className="text-[15px] font-bold text-neutral-black dark:text-neutral-white truncate mt-0.5">{value || label}</p>
            </div>
            {isLink && (
                <div className="text-slate-300 dark:text-slate-600">
                    <i className="fa-solid fa-chevron-right text-xs"></i>
                </div>
            )}
          </>
      );

      if (isLink && href) {
          return <a href={href} className="flex items-center gap-4 p-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors no-underline group">{Content}</a>;
      }
      
      return <div className="flex items-center gap-4 p-4">{Content}</div>;
  };

  return (
    <div 
        className="fixed inset-0 z-[1000] bg-slate-50 dark:bg-slate-900 flex flex-col animate-slide-up transition-colors duration-300"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
         <div className="fixed top-0 left-0 w-full z-[2005]">
             <ModalHeader 
                onClose={() => { triggerHaptic('light'); onClose(); }}
                bgClass="bg-transparent border-none"
             />
         </div>

         <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32 pt-14">
              <div className="animate-fade-in mt-4">
                  <div className="bg-neutral-white dark:bg-neutral-black rounded-[32px] p-8 border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden mb-8 transition-colors mt-4 shadow-sm">
                       <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-t-[32px] transition-colors duration-500 opacity-60"></div>
                       <div className="absolute top-0 left-0 w-full h-32 overflow-hidden pointer-events-none opacity-10">
                           <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full border-[20px] border-primary"></div>
                           <div className="absolute -bottom-10 -right-10 w-60 h-60 rounded-full border-[30px] border-primary"></div>
                       </div>
                       
                       <div className="relative z-10 flex flex-col items-center">
                           <div className="w-32 h-32 rounded-full p-1.5 bg-neutral-white dark:bg-neutral-black mb-4 mt-2 relative overflow-hidden transition-colors">
                               <Avatar 
                                  src={contact.face_ref_url} 
                                  name={contact.name} 
                                  className="w-full h-full"
                                  textSize="text-4xl"
                               />
                           </div>
                           <h2 className="text-2xl font-black text-neutral-black dark:text-neutral-white tracking-tight leading-tight">{contact.name}</h2>
                           
                           <div className="mt-3 flex gap-2 flex-wrap justify-center">
                               <span className="px-3 py-1.5 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-lg text-[10px] font-extrabold text-primary dark:text-primary uppercase tracking-wide">{contact.department}</span>
                               <span className="px-3 py-1.5 bg-secondary-purple/10 dark:bg-secondary-purple/20 border border-secondary-purple/20 dark:border-secondary-purple/30 rounded-lg text-[10px] font-extrabold text-secondary-purple dark:text-secondary-purple uppercase tracking-wide">{contact.position}</span>
                           </div>
                       </div>
                  </div>

                  <h3 className="text-xs font-black text-primary dark:text-primary uppercase mb-3 ml-2 tracking-widest flex items-center gap-2">
                      <i className="fa-solid fa-briefcase text-[10px]"></i> Thông tin công việc
                  </h3>
                  <div className="bg-neutral-white dark:bg-neutral-black/50 rounded-[24px] overflow-hidden border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700 mb-6">
                      <ContactDetailRow 
                          icon="fa-location-dot" 
                          colorClass="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary"
                          label="Văn phòng"
                          value={locationsMap[contact.center_id] || contact.center_id}
                      />
                      {contact.direct_manager_id && empNameMap[contact.direct_manager_id] && (
                          <ContactDetailRow 
                              icon="fa-user-tie" 
                              colorClass="bg-secondary-green/10 dark:bg-secondary-green/20 text-secondary-green dark:text-secondary-green"
                              label="Quản lý trực tiếp"
                              value={empNameMap[contact.direct_manager_id]}
                          />
                      )}
                  </div>

                  <h3 className="text-xs font-black text-primary dark:text-primary uppercase mb-3 ml-2 tracking-widest flex items-center gap-2">
                      <i className="fa-solid fa-address-book text-[10px]"></i> Thông tin liên hệ
                  </h3>
                  <div className="bg-neutral-white dark:bg-neutral-black/50 rounded-[24px] overflow-hidden border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700 mb-8">
                      <ContactDetailRow 
                          icon="fa-envelope" 
                          colorClass="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary"
                          label="Email"
                          value={contact.email}
                          isLink
                          href={`mailto:${contact.email}`}
                      />
                      <ContactDetailRow 
                          icon="fa-phone" 
                          colorClass="bg-secondary-green/10 dark:bg-secondary-green/20 text-secondary-green dark:text-secondary-green"
                          label="Số điện thoại"
                          value={String(contact.phone)}
                          isLink
                          href={`tel:${contact.phone}`}
                      />
                  </div>
              </div>
         </div>
    </div>
  );
};

export default ModalContactDetail;
