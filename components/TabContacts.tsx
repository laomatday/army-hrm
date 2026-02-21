
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DashboardData, Employee } from '../types';
import { getShortName, triggerHaptic } from '../utils/helpers';
import Avatar from './Avatar';
import ModalHeader from './ModalHeader';

interface Props {
  data: DashboardData | null;
  resetTrigger?: number;
  searchTrigger?: number; // Header Search Trigger
  onClose: () => void;
  setIsNavVisible?: (visible: boolean) => void;
  setIsHeaderVisible?: (visible: boolean) => void;
}

const TabContacts: React.FC<Props> = ({ data, resetTrigger = 0, searchTrigger = 0, onClose, setIsNavVisible, setIsHeaderVisible }) => {
  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Employee | null>(null);
  
  const [cachedContacts, setCachedContacts] = useState<Employee[]>(() => {
      try {
          const cached = localStorage.getItem('army_contacts_cache');
          return cached ? JSON.parse(cached) : [];
      } catch (e) {
          console.error("Failed to load contacts cache", e);
          return [];
      }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const lastScrollY = useRef(0);
  
  // Ref for Swipe Detection
  const touchStart = useRef<{x: number, y: number} | null>(null);
  const touchEnd = useRef<{x: number, y: number} | null>(null);

  // TRIGGER SEARCH FROM HEADER
  useEffect(() => {
      if (searchTrigger > 0) {
          handleStartSearch();
      }
  }, [searchTrigger]);

  // RESET VIEW WHEN BOTTOM NAV CLICKED
  useEffect(() => {
      if (resetTrigger > 0) {
          if (selectedContact) {
              // If resetting via tab click, we need to respect history history to avoid double back
              if (window.history.state && window.history.state.view === 'contact-detail') {
                  window.history.back();
              } else {
                  setSelectedContact(null);
              }
          }
          if (isSearching) {
              setIsSearching(false);
              setTerm('');
          }
          if (setIsHeaderVisible) setIsHeaderVisible(true);
      }
  }, [resetTrigger]);

  // Ensure nav is visible when closing detail or opening tab
  useEffect(() => {
      if (!selectedContact && setIsNavVisible) {
          setIsNavVisible(true);
      }
  }, [selectedContact, setIsNavVisible]);

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          if (setIsHeaderVisible) setIsHeaderVisible(true);
      };
  }, []);

  // HISTORY HANDLING FOR BACK BUTTON
  const handleOpenContact = (c: Employee) => {
      triggerHaptic('light');
      window.history.pushState({ view: 'contact-detail', id: c.employee_id }, '');
      setSelectedContact(c);
      if (setIsHeaderVisible) setIsHeaderVisible(false);
  };

  const handleCloseContact = () => {
      triggerHaptic('light');
      if (window.history.state && window.history.state.view === 'contact-detail') {
          window.history.back();
      } else {
          setSelectedContact(null);
          if (setIsHeaderVisible) setIsHeaderVisible(true);
      }
  };

  useEffect(() => {
      const handlePopState = (event: PopStateEvent) => {
          // If we popped a state, it means we are going back
          if (selectedContact) {
              setSelectedContact(null);
              if (setIsHeaderVisible) setIsHeaderVisible(true);
          }
          if (isSearching && !selectedContact) {
              setIsSearching(false);
              setTerm('');
          }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedContact, isSearching, setIsHeaderVisible]);

  useEffect(() => {
      if (data?.contacts && data.contacts.length > 0) {
          try {
              localStorage.setItem('army_contacts_cache', JSON.stringify(data.contacts));
              setCachedContacts(data.contacts); 
          } catch (e) {
              console.error("Failed to save contacts cache", e);
          }
      }
  }, [data?.contacts]);

  useEffect(() => {
      const handler = setTimeout(() => {
          setDebouncedTerm(term);
      }, 300);
      return () => clearTimeout(handler);
  }, [term]);

  const contacts = (data?.contacts && data.contacts.length > 0) ? data.contacts : cachedContacts;

  useEffect(() => {
      if (isSearching && inputRef.current && !selectedContact) {
         const timer = setTimeout(() => {
             inputRef.current?.focus();
         }, 150);
         return () => clearTimeout(timer);
      }
  }, [isSearching, selectedContact]);

  const locationsMap = useMemo(() => {
      const map: Record<string, string> = {};
      if (data?.locations) {
          data.locations.forEach(l => map[l.center_id] = l.location_name);
      }
      return map;
  }, [data?.locations]);

  const empNameMap = useMemo(() => {
      const map: Record<string, string> = {};
      contacts.forEach(c => map[c.employee_id] = c.name);
      return map;
  }, [contacts]);

  const filtered = useMemo(() => {
      if (!debouncedTerm) return [];
      const normTerm = debouncedTerm.toLowerCase();
      return contacts.filter(c => 
             c.name.toLowerCase().includes(normTerm) || 
             String(c.phone).includes(normTerm) ||
             (c.department && c.department.toLowerCase().includes(normTerm))
      );
  }, [contacts, debouncedTerm]);

  const groupedContacts = useMemo(() => {
      const groups: Record<string, Employee[]> = {};
      contacts.forEach(c => {
          const centerName = locationsMap[c.center_id] || c.center_id || 'Khác';
          let teamName = 'Ban Quản Lý';
          if (c.direct_manager_id && empNameMap[c.direct_manager_id]) {
              const mgrName = getShortName(empNameMap[c.direct_manager_id]);
              teamName = `Team ${mgrName}`;
          } else if (c.role === 'Staff') {
               teamName = 'Nhân viên';
          }
          const key = `${centerName} • ${teamName}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(c);
      });
      return groups;
  }, [contacts, locationsMap, empNameMap]);

  const sortedGroups = Object.keys(groupedContacts).sort();

  const handleStartSearch = () => {
      triggerHaptic('light');
      setIsSearching(true);
      window.history.pushState({ search: true }, '');
  };

  const handleCancelSearch = () => {
      triggerHaptic('light');
      if (window.history.state && window.history.state.search) {
          window.history.back();
      } else {
          setIsSearching(false);
          setTerm('');
      }
  };

  // --- SCROLL HANDLER FOR DETAIL VIEW ---
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (!setIsNavVisible) return;
      const currentScrollY = e.currentTarget.scrollTop;
      if (currentScrollY < 0) return;

      const diff = currentScrollY - lastScrollY.current;
      if (Math.abs(diff) < 5) return;

      if (diff > 0 && currentScrollY > 50) {
          setIsNavVisible(false);
      } else if (diff < 0) {
          setIsNavVisible(true);
      }
      lastScrollY.current = currentScrollY;
  };

  // --- SWIPE HANDLERS FOR MODAL ---
  const onTouchStart = (e: React.TouchEvent) => {
    const x = e.targetTouches[0].clientX;
    // Edge Protection
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
    
    const distanceX = touchStart.current.x - touchEnd.current.x; // dX > 0: R-to-L, dX < 0: L-to-R
    const distanceY = touchStart.current.y - touchEnd.current.y;
    
    // Check for horizontal swipe
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
         // Only allow Left-to-Right swipe (Back gesture) to close
         if (distanceX < -60) {
             handleCloseContact();
         }
    }
  };

  // --- REUSABLE ROW COMPONENT FOR MODAL ---
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
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base flex-shrink-0 shadow-sm border border-white/50 dark:border-slate-700/50 ${colorClass}`}>
                <i className={`fa-solid ${icon}`}></i>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-base font-semibold text-slate-800 dark:text-white truncate">{value}</p>
            </div>
            {isLink && (
                <div className="text-slate-300 dark:text-slate-600">
                    <i className="fa-solid fa-chevron-right text-xs"></i>
                </div>
            )}
          </>
      );

      if (isLink && href) {
          return <a href={href} className="flex items-center gap-4 p-4 active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors no-underline group">{Content}</a>;
      }
      
      return <div className="flex items-center gap-4 p-4">{Content}</div>;
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-50 dark:bg-slate-900 font-sans transition-colors duration-300">
        
        {/* CONTENT LIST with Global Header Padding */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32 pt-28">
            
            {/* SEARCH BAR (INLINE) */}
            {isSearching && (
                <div className="mb-4 animate-fade-in z-20">
                    <div className="flex items-center gap-3">
                        <div className="relative group flex-1">
                            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-lg"></i>
                            <input 
                                ref={inputRef}
                                autoFocus={true}
                                type="text"
                                inputMode="search"
                                enterKeyHint="search"
                                className="w-full h-12 bg-white dark:bg-slate-800 rounded-2xl pl-12 pr-10 text-base font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/20 border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
                                placeholder="Tìm kiếm..."
                                value={term}
                                onChange={e => setTerm(e.target.value)}
                            />
                            {term && (
                            <button onClick={() => setTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-[10px] active:bg-slate-300 dark:active:bg-slate-600">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                            )}
                        </div>
                        <button 
                            onClick={handleCancelSearch}
                            className="text-sm font-bold text-slate-500 dark:text-slate-400 active:text-slate-800 dark:active:text-white px-2 py-2"
                        >
                            Hủy
                        </button>
                    </div>
                </div>
            )}
            
            {isSearching && term ? (
                <div className="mt-2 animate-fade-in">
                    {/* Search Results - Using List Style */}
                    <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700">
                        {term !== debouncedTerm ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600 opacity-60">
                                <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-3"></i>
                                <p className="text-sm font-semibold">Đang tìm kiếm...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600 opacity-60">
                                <i className="fa-solid fa-magnifying-glass-minus text-4xl mb-3"></i>
                                <p className="text-sm font-semibold">Không tìm thấy kết quả</p>
                            </div>
                        ) : (
                            filtered.map(c => (
                                <div key={c.employee_id} 
                                    onClick={() => handleOpenContact(c)}
                                    className="flex items-center gap-4 p-4 active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors cursor-pointer group"
                                >
                                    <Avatar 
                                        src={c.face_ref_url} 
                                        name={c.name} 
                                        className="w-10 h-10 rounded-2xl" 
                                        textSize="text-xs"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">{c.name}</h4>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {c.department && (
                                                <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-extrabold border border-blue-100 dark:border-blue-900/30 uppercase tracking-wide truncate max-w-[100px]">
                                                    {c.department}
                                                </span>
                                            )}
                                            {c.position && (
                                                <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-[10px] font-extrabold border border-purple-100 dark:border-purple-900/30 uppercase tracking-wide truncate max-w-[100px]">
                                                    {c.position}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                                        <i className="fa-solid fa-chevron-right text-xs"></i>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                /* Default Grouped View - SETTINGS STYLE LISTS */
                <div className="pb-4">
                    {sortedGroups.map((groupKey, index) => (
                        <div key={groupKey} className="space-y-3 animate-slide-up mb-6">
                            {/* Header matched to SettingsModal */}
                            <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase ml-2 tracking-widest flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-user-group text-[10px]"></i>
                                    <span>{groupKey}</span>
                                </div>
                                <span className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded text-[10px] tabular-nums">{groupedContacts[groupKey].length}</span>
                            </h3>
                            
                            <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700">
                                {groupedContacts[groupKey].map(c => (
                                    <div key={c.employee_id} 
                                        onClick={() => handleOpenContact(c)}
                                        className="flex items-center gap-4 p-4 active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors cursor-pointer group"
                                    >
                                        <Avatar 
                                            src={c.face_ref_url} 
                                            name={c.name} 
                                            className="w-10 h-10 rounded-2xl" 
                                            textSize="text-xs"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-base font-bold text-slate-800 dark:text-white truncate leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{c.name}</h4>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {c.department && (
                                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-extrabold border border-blue-100 dark:border-blue-900/30 uppercase tracking-wide truncate max-w-[120px]">
                                                        {c.department}
                                                    </span>
                                                )}
                                                {c.position && (
                                                    <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-[10px] font-extrabold border border-purple-100 dark:border-purple-900/30 uppercase tracking-wide truncate max-w-[120px]">
                                                        {c.position}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                                            <i className="fa-solid fa-chevron-right text-xs"></i>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* FLOATING ACTION BUTTON */}
        {!isSearching && (
            <button 
                onClick={handleStartSearch}
                className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-5 w-12 h-12 bg-emerald-600 rounded-full shadow-xl shadow-emerald-500/30 flex items-center justify-center text-white text-xl active:scale-90 transition-all z-50 hover:bg-emerald-500 ring-4 ring-white dark:ring-slate-800"
            >
                <i className="fa-solid fa-magnifying-glass"></i>
            </button>
        )}

        {/* CONTACT DETAIL MODAL - Updated to Match TabProfile */}
        {selectedContact && (
            <div 
                className="fixed inset-0 z-[90] bg-slate-50 dark:bg-slate-900 flex flex-col animate-slide-up transition-colors duration-300"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                 {/* HEADER - No Background, No Text, Correct Height */}
                 <div className="fixed top-0 left-0 w-full z-[95]">
                     <ModalHeader 
                        onClose={handleCloseContact}
                        bgClass="bg-transparent border-none shadow-none"
                     />
                 </div>

                 {/* SCROLLABLE CONTENT */}
                 <div 
                    className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32 pt-14"
                    onScroll={handleScroll}
                 >
                      <div className="animate-fade-in mt-4">
                          {/* Profile Header Card */}
                          <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 shadow-sm border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden mb-6 transition-colors">
                               <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 rounded-t-[32px] transition-colors duration-500"></div>
                               
                               <div className="relative z-10 flex flex-col items-center">
                                   <div className="w-28 h-28 rounded-full p-1.5 bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 mb-4 mt-2 relative group transition-colors">
                                       <Avatar 
                                          src={selectedContact.face_ref_url} 
                                          name={selectedContact.name} 
                                          className="w-full h-full"
                                          textSize="text-3xl"
                                       />
                                   </div>
                                   <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">{selectedContact.name}</h2>
                                   
                                   <div className="mt-3 flex gap-2 flex-wrap justify-center">
                                       <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wide">{selectedContact.department}</span>
                                       <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/30 rounded-lg text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wide">{selectedContact.position}</span>
                                   </div>
                               </div>
                          </div>

                          {/* WORK INFO GROUP */}
                          <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase mb-2 ml-2 tracking-widest flex items-center gap-2">
                              <i className="fa-solid fa-briefcase text-[10px]"></i> Công việc
                          </h3>
                          <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700 mb-6">
                              <ContactDetailRow 
                                  icon="fa-location-dot" 
                                  colorClass="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                  label="Văn phòng"
                                  value={locationsMap[selectedContact.center_id] || selectedContact.center_id}
                              />
                              <ContactDetailRow 
                                  icon="fa-building-user" 
                                  colorClass="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                  label="Phòng ban"
                                  value={selectedContact.department}
                              />
                              {selectedContact.direct_manager_id && empNameMap[selectedContact.direct_manager_id] && (
                                  <ContactDetailRow 
                                      icon="fa-user-tie" 
                                      colorClass="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                                      label="Quản lý trực tiếp"
                                      value={empNameMap[selectedContact.direct_manager_id]}
                                  />
                              )}
                          </div>

                          {/* CONTACT INFO GROUP (Clickable) */}
                          <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase mb-2 ml-2 tracking-widest flex items-center gap-2">
                              <i className="fa-solid fa-address-book text-[10px]"></i> Liên hệ
                          </h3>
                          <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700 mb-8">
                              <ContactDetailRow 
                                  icon="fa-envelope" 
                                  colorClass="bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                                  label="Email"
                                  value={selectedContact.email}
                                  isLink
                                  href={`mailto:${selectedContact.email}`}
                              />
                              <ContactDetailRow 
                                  icon="fa-phone" 
                                  colorClass="bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
                                  label="Số điện thoại"
                                  value={String(selectedContact.phone)}
                                  isLink
                                  href={`tel:${selectedContact.phone}`}
                              />
                          </div>
                      </div>
                 </div>
            </div>
        )}
    </div>
  );
};
export default TabContacts;
