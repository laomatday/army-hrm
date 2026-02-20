
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Employee } from '../types';
import { adminGetCollection, adminDeleteDoc, adminUpdateDoc, adminCreateDoc } from '../services/api';
import * as XLSX from 'xlsx';
import { hashPassword, formatDateString } from '../utils/helpers';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from '../contexts/ToastContext';

interface Props {
  user: Employee;
  onLogout: () => void;
  onBackToApp: () => void;
}

// --- CONFIGURATION SCHEMAS ---
const COLLECTIONS = [
  { id: 'employees', name: 'Nhân viên', icon: 'fa-users' },
  { id: 'attendance', name: 'Chấm công', icon: 'fa-calendar-check' },
  { id: 'leave_requests', name: 'Yêu cầu nghỉ', icon: 'fa-envelope-open-text' },
  { id: 'config_locations', name: 'Cấu hình địa điểm', icon: 'fa-map-location-dot' },
  { id: 'config_shifts', name: 'Cấu hình ca', icon: 'fa-clock' },
  { id: 'config_holidays', name: 'Cấu hình ngày lễ', icon: 'fa-calendar-day' },
  { id: 'config_system', name: 'Cấu hình hệ thống', icon: 'fa-gears' },
  { id: 'kiosks', name: 'Quản lý Kiosk', icon: 'fa-tablet-screen-button' },
  { id: 'monthly_stats', name: 'Thống kê tháng', icon: 'fa-chart-column' }
];

const SCHEMAS: any = {
    employees: {
        primaryKey: 'employee_id',
        headers: ['employee_id', 'name', 'role', 'department', 'phone', 'trusted_device_id', 'status'],
        fields: {
            employee_id: { label: 'Mã NV', type: 'text', required: true, colSpan: 1 },
            name: { label: 'Họ và tên', type: 'text', required: true, colSpan: 1 },
            email: { label: 'Email', type: 'email', required: true, colSpan: 1 },
            password: { label: 'Mật khẩu', type: 'password', colSpan: 1 },
            phone: { label: 'Số điện thoại', type: 'text', colSpan: 1 },
            role: { label: 'Vai trò', type: 'select', options: ['Staff', 'Manager', 'Admin', 'HR'], colSpan: 1 },
            center_id: { label: 'Văn phòng', type: 'reference', collection: 'config_locations', valueField: 'center_id', labelField: 'location_name', colSpan: 1 },
            department: { label: 'Phòng ban', type: 'text', colSpan: 1 },
            position: { label: 'Chức vụ', type: 'text', colSpan: 1 },
            direct_manager_id: { label: 'Quản lý trực tiếp', type: 'reference', collection: 'employees', valueField: 'employee_id', labelField: 'name', colSpan: 1 },
            annual_leave_balance: { label: 'Quỹ phép', type: 'number', colSpan: 1 },
            trusted_device_id: { label: 'Device ID (Clear để reset)', type: 'text', colSpan: 1, placeholder: 'DEV_...' },
            status: { label: 'Trạng thái', type: 'select', options: ['Active', 'Inactive'], colSpan: 1 },
        }
    },
    attendance: {
        headers: ['date', 'employee_id', 'name', 'shift_name', 'time_in', 'time_out', 'status'],
        fields: {
            date: { label: 'Ngày', type: 'date', required: true, colSpan: 1 },
            employee_id: { label: 'Nhân viên', type: 'reference', collection: 'employees', valueField: 'employee_id', labelField: 'name', required: true, colSpan: 1 },
            shift_name: { label: 'Ca làm việc', type: 'reference', collection: 'config_shifts', valueField: 'name', labelField: 'name', colSpan: 1 },
            time_in: { label: 'Giờ vào', type: 'text', placeholder: 'HH:mm', colSpan: 1 },
            time_out: { label: 'Giờ ra', type: 'text', placeholder: 'HH:mm', colSpan: 1 },
            status: { label: 'Trạng thái', type: 'select', options: ['Valid', 'Late', 'Invalid'], colSpan: 1 },
            checkin_type: { label: 'Loại Check-in', type: 'select', options: ['GPS', 'Manual'], colSpan: 1 },
            is_valid: { label: 'Hợp lệ', type: 'select', options: ['Yes', 'No'], colSpan: 1 },
            late_minutes: { label: 'Phút trễ', type: 'number', colSpan: 1 },
            work_hours: { label: 'Giờ công', type: 'number', colSpan: 1 }
        }
    },
    leave_requests: {
        headers: ['request_id', 'employee_id', 'type', 'from_date', 'to_date', 'status'],
        fields: {
            employee_id: { label: 'Nhân viên', type: 'reference', collection: 'employees', valueField: 'employee_id', labelField: 'name', colSpan: 1 },
            type: { label: 'Loại đơn', type: 'select', options: ['Nghỉ phép năm', 'Nghỉ ốm', 'Nghỉ không lương', 'Công tác', 'Giải trình công'], colSpan: 1 },
            from_date: { label: 'Từ ngày', type: 'date', colSpan: 1 },
            to_date: { label: 'Đến ngày', type: 'date', colSpan: 1 },
            expiration_date: { label: 'Hết hạn', type: 'date', colSpan: 1 },
            reason: { label: 'Lý do', type: 'textarea', colSpan: 2 },
            status: { label: 'Trạng thái', type: 'select', options: ['Pending', 'Approved', 'Rejected'], colSpan: 1 },
            manager_note: { label: 'Ghi chú quản lý', type: 'text', colSpan: 1 }
        }
    },
    config_locations: {
        primaryKey: 'center_id',
        headers: ['center_id', 'location_name', 'radius_meters', 'status'],
        fields: {
            center_id: { label: 'Mã địa điểm', type: 'text', required: true, colSpan: 1 },
            location_name: { label: 'Tên địa điểm', type: 'text', required: true, colSpan: 1 },
            latitude: { label: 'Vĩ độ (Lat)', type: 'number', colSpan: 1 },
            longitude: { label: 'Kinh độ (Lng)', type: 'number', colSpan: 1 },
            radius_meters: { label: 'Bán kính (m)', type: 'number', colSpan: 1 },
            city_code: { label: 'Mã thành phố', type: 'text', colSpan: 1 },
            status: { label: 'Trạng thái', type: 'select', options: ['Active', 'Inactive'], colSpan: 1 }
        }
    },
    config_shifts: {
        headers: ['name', 'start_time', 'end_time', 'break_point'],
        fields: {
             name: { label: 'Tên ca', type: 'text', required: true, colSpan: 2 },
             start_time: { label: 'Giờ bắt đầu', type: 'text', placeholder: 'HH:mm', colSpan: 1 },
             end_time: { label: 'Giờ kết thúc', type: 'text', placeholder: 'HH:mm', colSpan: 1 },
             break_point: { label: 'Điểm ngắt ca', type: 'text', placeholder: 'HH:mm', colSpan: 1 }
        }
    },
    config_holidays: {
        headers: ['name', 'from_date', 'to_date'],
        fields: {
            name: { label: 'Tên ngày lễ', type: 'text', required: true, colSpan: 2 },
            from_date: { label: 'Từ ngày', type: 'date', colSpan: 1 },
            to_date: { label: 'Đến ngày', type: 'date', colSpan: 1 }
        }
    },
    config_system: {
        headers: ['key', 'value', 'description'],
        fields: {
            key: { label: 'Mã cấu hình', type: 'text', required: true, colSpan: 1 },
            value: { label: 'Giá trị', type: 'text', required: true, colSpan: 1 },
            description: { label: 'Mô tả', type: 'textarea', colSpan: 2 }
        }
    },
    kiosks: {
        primaryKey: 'kiosk_id',
        headers: ['kiosk_id', 'name', 'center_id', 'status'],
        fields: {
            kiosk_id: { label: 'Mã Kiosk', type: 'text', required: true, colSpan: 1, placeholder: 'KIOSK_01' },
            name: { label: 'Tên Kiosk', type: 'text', required: true, colSpan: 1 },
            center_id: { label: 'Văn phòng', type: 'reference', collection: 'config_locations', valueField: 'center_id', labelField: 'location_name', required: true, colSpan: 1 },
            status: { label: 'Trạng thái', type: 'select', options: ['Active', 'Inactive'], colSpan: 1 },
            description: { label: 'Mô tả', type: 'textarea', colSpan: 2 }
        }
    },
    monthly_stats: {
        primaryKey: 'key_id',
        headers: ['key_id', 'employee_id', 'work_days', 'late_mins', 'leave_days'],
        fields: {
             key_id: { label: 'Key ID', type: 'text', disabled: true, colSpan: 1 },
             employee_id: { label: 'Nhân viên', type: 'reference', collection: 'employees', valueField: 'employee_id', labelField: 'name', colSpan: 1 },
             work_days: { label: 'Ngày công', type: 'number', colSpan: 1 },
             leave_days: { label: 'Ngày nghỉ', type: 'number', colSpan: 1 },
             late_mins: { label: 'Phút trễ', type: 'number', colSpan: 1 },
             standard_days: { label: 'Công chuẩn', type: 'number', colSpan: 1 },
             error_count: { label: 'Lỗi', type: 'number', colSpan: 1 }
        }
    }
};

const AdminPanel: React.FC<Props> = ({ user, onLogout, onBackToApp }) => {
  const [selectedCollection, setSelectedCollection] = useState('employees');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Advanced Features State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reference Data (for dropdowns)
  const [references, setReferences] = useState<any>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  
  const { showToast } = useToast();

  // Confirm Modal State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      fetchData();
      fetchReferences();
      setSelectedIds(new Set());
      setCurrentPage(1);
      setSortConfig(null);
      setSearchTerm('');
  }, [selectedCollection]);

  const fetchReferences = async () => {
      const locations = await adminGetCollection('config_locations');
      const emps = await adminGetCollection('employees');
      const shifts = await adminGetCollection('config_shifts');
      
      setReferences({
          config_locations: locations,
          employees: emps,
          config_shifts: shifts
      });
  };

  const fetchData = async () => {
      setLoading(true);
      const res = await adminGetCollection(selectedCollection);
      setData(res);
      setLoading(false);
  };

  // --- ACTIONS ---

  const handleDelete = (id: string) => {
      setConfirmDialog({
          isOpen: true,
          title: "Xác nhận xóa",
          message: "Bạn có chắc chắn muốn xóa bản ghi này? Hành động này không thể hoàn tác.",
          onConfirm: async () => {
              setLoading(true);
              const res = await adminDeleteDoc(selectedCollection, String(id));
              if(res.success) {
                  setData(prev => prev.filter(item => item.id !== id));
                  if (selectedIds.has(id)) {
                      const newSet = new Set(selectedIds);
                      newSet.delete(id);
                      setSelectedIds(newSet);
                  }
                  showToast({ title: "Đã xóa thành công", body: "", type: 'success' });
              } else {
                  showToast({ title: "Lỗi xóa", body: String(res.message), type: 'error' });
              }
              setLoading(false);
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const handleBulkDelete = () => {
      if (selectedIds.size === 0) return;
      
      setConfirmDialog({
          isOpen: true,
          title: "Xóa nhiều bản ghi",
          message: `CẢNH BÁO: Bạn sắp xóa vĩnh viễn ${selectedIds.size} bản ghi. Tiếp tục?`,
          onConfirm: async () => {
              setLoading(true);
              let successCount = 0;
              const ids = Array.from(selectedIds);
              
              for (const id of ids) {
                  const res = await adminDeleteDoc(selectedCollection, String(id));
                  if (res.success) successCount++;
              }
              
              showToast({ 
                  title: `Đã xóa ${successCount}/${ids.length} bản ghi`, 
                  body: "", 
                  type: successCount === ids.length ? 'success' : 'error' 
              });
              await fetchData();
              setSelectedIds(new Set());
              setLoading(false);
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newSet = new Set(selectedIds);
      const pageIds = paginatedData.map(d => String(d.id));
      
      if (e.target.checked) {
          pageIds.forEach(id => newSet.add(id));
      } else {
          pageIds.forEach(id => newSet.delete(id));
      }
      setSelectedIds(newSet);
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
      const newSet = new Set(selectedIds);
      if (checked) newSet.add(id);
      else newSet.delete(id);
      setSelectedIds(newSet);
  };

  const handleEdit = (item: any) => {
      setEditingItem(item);
      setFormData({...item});
      setIsModalOpen(true);
  };

  const handleCreate = () => {
      setEditingItem(null);
      const schema = SCHEMAS[selectedCollection];
      let template: any = {};
      if (schema && schema.fields) {
          Object.keys(schema.fields).forEach(key => template[key] = '');
      } else if (schema && schema.headers) {
          schema.headers.forEach((h: any) => template[h] = '');
      }
      setFormData(template);
      setIsModalOpen(true);
  };

  const handleSave = async () => {
      const payload = { ...formData };
      delete payload.id;

      if (selectedCollection === 'employees' && payload.password) {
          if (payload.password.length < 6) {
              showToast({ title: "Lỗi mật khẩu", body: "Mật khẩu phải có ít nhất 6 ký tự", type: 'error' });
              return;
          }
          payload.password = await hashPassword(payload.password);
      } else if (selectedCollection === 'employees' && editingItem && !payload.password) {
          delete payload.password;
      }

      let res;
      if (editingItem) {
          res = await adminUpdateDoc(selectedCollection, String(editingItem.id), payload);
      } else {
          const schema = SCHEMAS[selectedCollection];
          let customId: string | undefined = undefined;
          if (schema && schema.primaryKey && payload[schema.primaryKey]) {
              customId = String(payload[schema.primaryKey]);
          }
          res = await adminCreateDoc(selectedCollection, payload, customId);
      }

      if (res.success) {
          showToast({ 
              title: editingItem ? "Cập nhật thành công" : "Tạo mới thành công", 
              body: "", 
              type: 'success' 
          });
          setIsModalOpen(false);
          fetchData();
      } else {
          showToast({ title: "Lỗi", body: String(res.message), type: 'error' });
      }
  };

  const handleExport = () => {
      const allKeysSet = new Set<string>();
      data.forEach(item => Object.keys(item).forEach(key => { if (key !== 'id') allKeysSet.add(key); }));
      const ws = XLSX.utils.json_to_sheet(data, { header: Array.from(allKeysSet) });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, selectedCollection);
      XLSX.writeFile(wb, `${selectedCollection}_export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const bstr = evt.target?.result;
              if (typeof bstr !== 'string') return;

              const wb = XLSX.read(bstr, { type: 'binary' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
              
              setConfirmDialog({
                  isOpen: true,
                  title: "Import Excel",
                  message: `Tìm thấy ${jsonData.length} dòng dữ liệu. Import vào bảng ${selectedCollection}?`,
                  onConfirm: async () => {
                      setLoading(true);
                      let successCount = 0;
                      const schema = SCHEMAS[selectedCollection];

                      for (const row of jsonData) {
                          const payload: any = row;
                          if (selectedCollection === 'employees' && payload.password) {
                              payload.password = await hashPassword(String(payload.password));
                          }
                          let customId: string | undefined = undefined;
                          if (schema && schema.primaryKey && payload[schema.primaryKey]) {
                              customId = String(payload[schema.primaryKey]);
                          }
                          const res = await adminCreateDoc(selectedCollection, payload, customId);
                          if (res.success) successCount++;
                      }
                      
                      showToast({ 
                          title: "Import hoàn tất", 
                          body: `Đã import ${successCount}/${jsonData.length} dòng`, 
                          type: 'success' 
                      });
                      fetchData();
                      setLoading(false);
                      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  }
              });
          } catch (err) {
              console.error(err);
              showToast({ title: "Lỗi", body: "Lỗi đọc file Excel", type: 'error' });
              setLoading(false);
          }
      };
      reader.readAsBinaryString(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resolveDisplayValue = (key: string, val: any) => {
      if (val === null || val === undefined) return '';

      const schema = SCHEMAS[selectedCollection];
      const fieldConfig = schema?.fields?.[key];

      if (fieldConfig?.type === 'date') {
          return formatDateString(String(val));
      }

      if (fieldConfig?.type === 'reference') {
          if (key === 'employee_id') return val;
          const refList = references[fieldConfig.collection];
          if (refList) {
              const match = refList.find((r: any) => String(r[fieldConfig.valueField]) === String(val));
              if (match) return match[fieldConfig.labelField];
          }
      }
      return val;
  };

  const handleSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const processedData = useMemo(() => {
      let res = [...data];
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          res = res.filter(item => JSON.stringify(item).toLowerCase().includes(lowerTerm));
      }
      if (sortConfig) {
          res.sort((a, b) => {
              const valA = resolveDisplayValue(sortConfig.key, a[sortConfig.key]);
              const valB = resolveDisplayValue(sortConfig.key, b[sortConfig.key]);
              if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
              if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return res;
  }, [data, searchTerm, sortConfig, selectedCollection, references]);

  const itemsPerPageNum = itemsPerPage;
  const totalPages = Math.ceil(processedData.length / itemsPerPageNum);
  const paginatedData = processedData.slice((currentPage - 1) * itemsPerPageNum, currentPage * itemsPerPageNum);

  const getOrderedHeaders = () => {
      const schema = SCHEMAS[selectedCollection];
      if (schema && schema.headers) return schema.headers;
      return data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'id') : [];
  };
  const headers = getOrderedHeaders();

  const renderFormFields = () => {
      const schema = SCHEMAS[selectedCollection];
      const fieldsToRender = schema?.fields ? Object.keys(schema.fields) : headers;

      return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fieldsToRender.map(key => {
                  const fieldConfig = schema?.fields?.[key] || { label: key, type: 'text', colSpan: 1 };
                  const val = formData[key];
                  const colSpanClass = fieldConfig.colSpan === 2 ? 'md:col-span-2' : 'md:col-span-1';

                  let inputEl;
                  const commonClasses = "block w-full rounded-2xl border-0 px-4 py-3 text-slate-800 dark:text-white shadow-sm ring-1 ring-inset ring-slate-200 dark:ring-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6 transition-all bg-white dark:bg-slate-800 font-medium";

                  if (fieldConfig.type === 'select') {
                      inputEl = (
                          <select 
                            className={commonClasses}
                            value={val || ''} 
                            onChange={e => setFormData({...formData, [key]: e.target.value})}
                          >
                              <option value="">-- Chọn --</option>
                              {fieldConfig.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                      );
                  } else if (fieldConfig.type === 'reference') {
                       const refData = references[fieldConfig.collection] || [];
                       inputEl = (
                          <select 
                            className={commonClasses}
                            value={val || ''} 
                            onChange={e => setFormData({...formData, [key]: e.target.value})}
                          >
                              <option value="">-- Chọn --</option>
                              {refData.map((item: any) => (
                                  <option key={item.id} value={item[fieldConfig.valueField]}>
                                      {item[fieldConfig.labelField]} ({item[fieldConfig.valueField]})
                                  </option>
                              ))}
                          </select>
                       );
                  } else if (fieldConfig.type === 'textarea') {
                      inputEl = (
                          <textarea 
                            rows={3}
                            className={commonClasses}
                            value={val || ''} 
                            onChange={e => setFormData({...formData, [key]: e.target.value})}
                          />
                      );
                  } else {
                       inputEl = (
                          <input 
                            type={fieldConfig.type || 'text'}
                            className={commonClasses}
                            value={typeof val === 'object' ? JSON.stringify(val) : (val || '')}
                            onChange={e => setFormData({...formData, [key]: e.target.value})}
                            placeholder={fieldConfig.placeholder || ''}
                            disabled={fieldConfig.disabled}
                          />
                       );
                  }

                  return (
                      <div key={key} className={colSpanClass}>
                          <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase mb-1.5 tracking-wide">
                              {fieldConfig.label || key} {fieldConfig.required && <span className="text-red-500">*</span>}
                          </label>
                          {inputEl}
                      </div>
                  )
              })}
          </div>
      )
  };

  const renderStatusBadge = (key: string, val: any) => {
       const displayVal = resolveDisplayValue(key, val);
       if (key === 'status') {
            if (val === 'Active' || val === 'Valid' || val === 'Approved') {
                return <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20 uppercase tracking-wide">{displayVal}</span>
            }
            if (val === 'Inactive' || val === 'Rejected' || val === 'Invalid') {
                 return <span className="inline-flex items-center rounded-md bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-extrabold text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/10 uppercase tracking-wide">{displayVal}</span>
            }
            if (val === 'Pending') {
                 return <span className="inline-flex items-center rounded-md bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 text-[10px] font-extrabold text-orange-700 dark:text-orange-400 ring-1 ring-inset ring-orange-600/20 uppercase tracking-wide">{displayVal}</span>
            }
            if (val === 'Late') {
                 return <span className="inline-flex items-center rounded-md bg-yellow-50 dark:bg-yellow-900/30 px-2 py-0.5 text-[10px] font-extrabold text-yellow-800 dark:text-yellow-400 ring-1 ring-inset ring-yellow-600/20 uppercase tracking-wide">{displayVal}</span>
            }
       }
       return <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{displayVal}</span>;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans transition-colors duration-300">
        <div className="w-72 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800 shadow-xl z-20 hidden md:flex">
            <div className="p-6 flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-emerald-900/50">A</div>
                <div>
                     <h1 className="font-black text-white tracking-wide text-lg leading-none">Army Admin</h1>
                     <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mt-1">Management System</p>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
                <div className="px-3 py-2 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mt-2">Dữ liệu</div>
                {COLLECTIONS.map(col => (
                    <button key={col.id} onClick={() => setSelectedCollection(col.id)}
                        className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-3 ${selectedCollection === col.id ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20' : 'hover:bg-slate-800 hover:text-white text-slate-400'}`}>
                        <i className={`fa-solid ${col.icon} w-5 text-center`}></i>
                        {col.name}
                    </button>
                ))}
            </div>
            
            <div className="p-4 border-t border-slate-800 mt-auto bg-slate-900">
                 <div className="flex items-center gap-3 mb-4 px-2">
                     <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                         {user.name.charAt(0)}
                     </div>
                     <div className="overflow-hidden">
                         <p className="text-sm font-bold text-white truncate">{user.name}</p>
                         <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Administrator</p>
                     </div>
                 </div>
                 <button onClick={onBackToApp} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm font-bold mb-1 uppercase tracking-wide">
                     <i className="fa-solid fa-mobile-screen w-5 text-center"></i> Về Ứng dụng
                 </button>
                 <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors text-sm font-bold uppercase tracking-wide">
                     <i className="fa-solid fa-right-from-bracket w-5 text-center"></i> Đăng xuất
                 </button>
            </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 relative bg-slate-50/50 dark:bg-slate-900/50">
            <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-10 sticky top-0">
                <div className="flex items-center gap-4">
                     {/* Mobile Menu Toggle could be here */}
                     <div className="md:hidden w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg">A</div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3 tracking-tight">
                        {COLLECTIONS.find(c => c.id === selectedCollection)?.name}
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-lg text-xs font-extrabold border border-slate-200 dark:border-slate-700 uppercase tracking-wide">{processedData.length} records</span>
                    </h2>
                </div>
                
                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 px-4 py-2.5 rounded-2xl text-xs font-extrabold hover:bg-red-100 dark:hover:bg-red-900/30 hover:shadow-lg hover:shadow-red-100/50 flex items-center gap-2 transition-all animate-scale-in uppercase tracking-wide">
                            <i className="fa-solid fa-trash-can"></i> <span className="hidden md:inline">Xóa {selectedIds.size} mục</span>
                        </button>
                    )}
                    
                    <div className="relative group hidden md:block">
                        <i className="fa-solid fa-search absolute left-4 top-3 text-slate-400 dark:text-slate-500 text-sm group-focus-within:text-emerald-500 transition-colors"></i>
                        <input type="text" placeholder="Tìm kiếm..." 
                            className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium w-64 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm transition-all text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center bg-white dark:bg-slate-800 rounded-2xl p-1 border border-slate-200 dark:border-slate-700 shadow-sm hidden md:flex">
                        <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center gap-1 transition-colors uppercase tracking-wide">
                            <i className="fa-solid fa-file-import text-blue-500 dark:text-blue-400"></i> Import
                        </button>
                        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                        <button onClick={handleExport} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center gap-1 transition-colors uppercase tracking-wide">
                            <i className="fa-solid fa-file-excel text-emerald-500 dark:text-emerald-400"></i> Export
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                    </div>

                    <button onClick={handleCreate} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 shadow-lg shadow-slate-900/20 dark:shadow-white/10 flex items-center gap-2 ml-2 transition-all active:scale-95 uppercase tracking-wide">
                        <i className="fa-solid fa-plus"></i> <span className="hidden md:inline">Tạo mới</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden p-6 flex flex-col">
                <div key={selectedCollection} className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-700 flex-1 flex flex-col overflow-hidden relative transition-all duration-300 animate-slide-up">
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        {loading && (
                             <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm z-30">
                                <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-slate-200 dark:border-slate-700 border-t-emerald-600 dark:border-t-emerald-500"></div>
                             </div>
                        )}
                        
                        <table className="w-full text-left border-collapse table-auto md:w-full">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-20 shadow-sm backdrop-blur-md">
                                <tr>
                                    <th className="px-6 py-4 w-14 border-b border-slate-200 dark:border-slate-700">
                                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 bg-white dark:bg-slate-700"
                                            checked={paginatedData.length > 0 && paginatedData.every(item => selectedIds.has(String(item.id)))} onChange={toggleSelectAll} />
                                    </th>
                                    <th className="px-4 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase w-24 border-b border-slate-200 dark:border-slate-700 tracking-wide">Thao tác</th>
                                    {headers.map(h => {
                                        const schema = SCHEMAS[selectedCollection];
                                        const label = schema?.fields?.[h]?.label || h.replace(/_/g, ' ');
                                        return (
                                            <th key={h} onClick={() => handleSort(h)} className="px-6 py-4 text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-200 dark:border-slate-700 group select-none tracking-wide">
                                                <div className="flex items-center gap-2">
                                                    {label}
                                                    {sortConfig?.key === h ? (
                                                        <i className={`fa-solid fa-arrow-${sortConfig.direction === 'asc' ? 'up' : 'down'} text-emerald-500`}></i>
                                                    ) : (
                                                        <i className="fa-solid fa-sort text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                                    )}
                                                </div>
                                            </th>
                                        )
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {paginatedData.map((item, idx) => (
                                    <tr key={item.id || idx} className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group ${selectedIds.has(item.id) ? 'bg-emerald-50/20 dark:bg-emerald-900/10' : ''}`}>
                                        <td className="px-6 py-4 border-b border-transparent dark:border-slate-800">
                                            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 bg-white dark:bg-slate-700"
                                                checked={selectedIds.has(item.id)} onChange={(e) => toggleSelectOne(String(item.id), e.target.checked)} />
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap border-b border-transparent dark:border-slate-800">
                                            <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(item)} className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center justify-center transition-colors">
                                                    <i className="fa-solid fa-pen text-xs"></i>
                                                </button>
                                                <button onClick={() => handleDelete(String(item.id))} className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center transition-colors">
                                                    <i className="fa-solid fa-trash text-xs"></i>
                                                </button>
                                            </div>
                                        </td>
                                        {headers.map(h => (
                                            <td key={h} className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap md:whitespace-normal max-w-xs md:max-w-md truncate md:overflow-visible border-b border-transparent dark:border-slate-800 group-hover:border-slate-100 dark:group-hover:border-slate-700/50">
                                                {h === 'password' ? '••••••' : renderStatusBadge(h, item[h])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {paginatedData.length === 0 && (
                                    <tr>
                                        <td colSpan={headers.length + 2} className="text-center py-20">
                                            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                                                <i className="fa-regular fa-folder-open text-4xl mb-3 opacity-50"></i>
                                                <span className="text-sm font-medium">Không tìm thấy dữ liệu</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between z-20 transition-colors">
                         <div className="text-xs text-slate-500 dark:text-slate-400 font-bold px-2 tracking-wide">
                             Hiển thị <span className="font-extrabold text-slate-800 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, processedData.length)}</span> trong <span className="font-extrabold text-slate-800 dark:text-white">{processedData.length}</span> kết quả
                         </div>
                         
                         <div className="flex items-center gap-4">
                             <select 
                                className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg py-2 pl-3 pr-8 outline-none focus:ring-emerald-500 cursor-pointer"
                                value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                             >
                                 <option value={10}>10 / trang</option>
                                 <option value={20}>20 / trang</option>
                                 <option value={50}>50 / trang</option>
                                 <option value={100}>100 / trang</option>
                             </select>

                             <div className="flex items-center gap-1">
                                 <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                 >
                                     <i className="fa-solid fa-chevron-left text-xs"></i>
                                 </button>
                                 <span className="px-3 text-xs font-bold text-slate-700 dark:text-slate-300">Trang {currentPage}</span>
                                 <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}
                                    className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                 >
                                     <i className="fa-solid fa-chevron-right text-xs"></i>
                                 </button>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-scale-in">
                    <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30 rounded-t-[24px]">
                        <div>
                             <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{editingItem ? 'Cập nhật thông tin' : 'Thêm mới bản ghi'}</h3>
                             <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1 uppercase tracking-wide">{COLLECTIONS.find(c => c.id === selectedCollection)?.name}</p>
                        </div>
                        <button onClick={() => setIsModalOpen(false)} className="w-9 h-9 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center justify-center transition-colors shadow-sm">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    
                    <div className="p-8 overflow-y-auto custom-scrollbar">
                        {renderFormFields()}
                    </div>

                    <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 rounded-b-[24px] flex justify-end gap-3">
                        <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shadow-sm uppercase tracking-wide">
                            Hủy bỏ
                        </button>
                        <button onClick={handleSave} className="px-6 py-3 rounded-2xl text-sm font-bold bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-700 shadow-lg shadow-slate-900/20 dark:shadow-emerald-900/20 transition-all active:scale-95 uppercase tracking-wide">
                            {editingItem ? 'Lưu thay đổi' : 'Tạo mới'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        <ConfirmDialog 
            isOpen={confirmDialog.isOpen}
            title={confirmDialog.title}
            message={confirmDialog.message}
            confirmLabel="Xác nhận"
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog({...confirmDialog, isOpen: false})}
            type="danger"
            isLoading={loading}
        />
    </div>
  );
};

export default AdminPanel;
