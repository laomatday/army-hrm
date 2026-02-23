import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DashboardData, Employee } from '../types';
import { getShortName, triggerHaptic } from '../utils/helpers';
import Avatar from './Avatar';
import ModalContactDetail from './ModalContactDetail';

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
  
  useEffect(() => {
      if (searchTrigger > 0) {
          handleStartSearch();
      }
  }, [searchTrigger]);

  useEffect(() => {
      if (resetTrigger > 0) {
          if (selectedContact) {
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

  useEffect(() => {
      if (!selectedContact && setIsNavVisible) {
          setIsNavVisible(true);
      }
  }, [selectedContact, setIsNavVisible]);

  useEffect(() => {
      return () => {
          if (setIsHeaderVisible) setIsHeaderVisible(true);
      };
  }, []);

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

  const contacts = ((data?.contacts && data.contacts.length > 0) ? data.contacts : cachedContacts).filter(c => c.role !== 'Kiosk');

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

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-50 dark:bg-dark-bg font-sans transition-colors duration-300">
        
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32 pt-28" onScroll={handleScroll}>
            
            {isSearching && (
                <div className="mb-4 animate-fade-in z-20">
                    <div className="flex items-center gap-3">
                        <div className="relative group flex-1">
                            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-text-secondary text-lg"></i>
                            <input 
                                ref={inputRef}
                                autoFocus={true}
                                type="text"
                                inputMode="search"
                                enterKeyHint="search"
                                className="w-full h-12 bg-neutral-white dark:bg-dark-surface rounded-2xl pl-12 pr-10 text-base font-bold text-neutral-black dark:text-dark-text-primary placeholder:text-slate-400 dark:placeholder:text-dark-text-secondary outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/20 border border-slate-200 dark:border-dark-border transition-all"
                                placeholder="Tìm kiếm..."
                                value={term}
                                onChange={e => setTerm(e.target.value)}
                            />
                            {term && (
                            <button onClick={() => setTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-200 dark:bg-dark-border/50 rounded-full flex items-center justify-center text-slate-500 dark:text-dark-text-secondary text-[10px] active:bg-slate-300 dark:active:bg-dark-border">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                            )}
                        </div>
                        <button 
                            onClick={handleCancelSearch}
                            className="text-sm font-bold text-slate-500 dark:text-dark-text-secondary active:text-neutral-black dark:active:text-dark-text-primary px-2 py-2"
                        >
                            Hủy
                        </button>
                    </div>
                </div>
            )}
            
            {isSearching && term ? (
                <div className="mt-2 animate-fade-in">
                    <div className="bg-neutral-white dark:bg-dark-surface rounded-[24px] overflow-hidden border border-slate-100 dark:border-dark-border divide-y divide-slate-50 dark:divide-dark-border">
                        {term !== debouncedTerm ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-dark-text-secondary opacity-60">
                                <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-3"></i>
                                <p className="text-sm font-semibold">Đang tìm kiếm...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-dark-text-secondary opacity-60">
                                <i className="fa-solid fa-magnifying-glass-minus text-4xl mb-3"></i>
                                <p className="text-sm font-semibold">Không tìm thấy kết quả</p>
                            </div>
                        ) : (
                            filtered.map(c => (
                                <div key={c.employee_id} 
                                    onClick={() => handleOpenContact(c)}
                                    className="flex items-center gap-4 p-4 active:bg-slate-50 dark:active:bg-dark-border/50 transition-colors cursor-pointer group"
                                >
                                    <Avatar 
                                        src={c.face_ref_url} 
                                        name={c.name} 
                                        className="w-10 h-10 rounded-2xl" 
                                        textSize="text-xs"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-neutral-black dark:text-dark-text-primary truncate">{c.name}</h4>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {c.department && (
                                                <span className="px-2 py-0.5 rounded-md bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary text-[10px] font-extrabold border border-primary/20 dark:border-primary/30 uppercase tracking-wide truncate max-w-[100px]">
                                                    {c.department}
                                                </span>
                                            )}
                                            {c.position && (
                                                <span className="px-2 py-0.5 rounded-md bg-secondary-purple/10 dark:bg-secondary-purple/20 text-secondary-purple dark:text-secondary-purple text-[10px] font-extrabold border border-secondary-purple/20 dark:border-secondary-purple/30 uppercase tracking-wide truncate max-w-[100px]">
                                                    {c.position}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-dark-bg text-slate-300 dark:text-dark-text-secondary flex items-center justify-center group-hover:bg-primary/10 dark:group-hover:bg-primary/20 group-hover:text-primary dark:group-hover:text-primary transition-colors">
                                        <i className="fa-solid fa-chevron-right text-xs"></i>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="pb-4">
                    {sortedGroups.map((groupKey, index) => (
                        <div key={groupKey} className="space-y-3 animate-slide-up mb-6">
                            <h3 className="text-xs font-black text-primary dark:text-primary uppercase ml-2 tracking-widest flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-user-group text-[10px]"></i>
                                    <span>{groupKey}</span>
                                </div>
                                <span className="bg-slate-200 dark:bg-dark-border/50 text-slate-500 dark:text-dark-text-secondary px-1.5 py-0.5 rounded text-[10px] tabular-nums">{groupedContacts[groupKey].length}</span>
                            </h3>
                            
                            <div className="bg-neutral-white dark:bg-dark-surface rounded-[24px] overflow-hidden border border-slate-100 dark:border-dark-border divide-y divide-slate-50 dark:divide-dark-border">
                                {groupedContacts[groupKey].map(c => (
                                    <div key={c.employee_id} 
                                        onClick={() => handleOpenContact(c)}
                                        className="flex items-center gap-4 p-4 active:bg-slate-50 dark:active:bg-dark-border/50 transition-colors cursor-pointer group"
                                    >
                                        <Avatar 
                                            src={c.face_ref_url} 
                                            name={c.name} 
                                            className="w-10 h-10 rounded-2xl" 
                                            textSize="text-xs"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-base font-bold text-neutral-black dark:text-dark-text-primary truncate leading-tight group-hover:text-primary dark:group-hover:text-primary transition-colors">{c.name}</h4>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {c.department && (
                                                    <span className="px-2 py-0.5 rounded-md bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary text-[10px] font-extrabold border border-primary/20 dark:border-primary/30 uppercase tracking-wide truncate max-w-[120px]">
                                                        {c.department}
                                                    </span>
                                                )}
                                                {c.position && (
                                                    <span className="px-2 py-0.5 rounded-md bg-secondary-purple/10 dark:bg-secondary-purple/20 text-secondary-purple dark:text-secondary-purple text-[10px] font-extrabold border border-secondary-purple/20 dark:border-secondary-purple/30 uppercase tracking-wide truncate max-w-[120px]">
                                                        {c.position}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-dark-bg text-slate-300 dark:text-dark-text-secondary flex items-center justify-center group-hover:bg-primary/10 dark:group-hover:bg-primary/20 group-hover:text-primary dark:group-hover:text-primary transition-colors">
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

        <ModalContactDetail 
            contact={selectedContact}
            isOpen={!!selectedContact}
            onClose={handleCloseContact}
            locationsMap={locationsMap}
            empNameMap={empNameMap}
        />
    </div>
  );
};
export default TabContacts;