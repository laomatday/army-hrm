
import React, { useState } from 'react';
import { QrReader } from 'react-qr-reader';
import { kioskService } from '../../features/kiosk/kiosk.service';
import { Employee } from '../../shared/types';
import Spinner from '../../shared/components/Spinner';

interface ModalCameraProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: string) => void;
  user: Employee;
}

export default function ModalCamera({ isOpen, onClose, onScanSuccess, user }: ModalCameraProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleScan = async (result: any, error: any) => {
    if (result && !loading) {
      setLoading(true);
      setError(null);
      const text = result?.text;
      
      try {
        console.log("Scanned:", text);
        // 1. Try Kiosk Scan First
        const isKiosk = await kioskService.scanKioskQR(user, text);
        
        if (isKiosk) {
             onScanSuccess('Đã gửi yêu cầu chụp ảnh tới Kiosk!');
             setLoading(false);
             onClose();
             return;
        } else {
             // Fallback or error
             // setError("Mã QR không hợp lệ hoặc hết hạn");
             // setLoading(false);
             // Re-enable scanning after a delay if invalid
             setTimeout(() => setLoading(false), 2000);
        }
      } catch (err) {
        console.error(err);
        setError("Lỗi xử lý mã QR");
        setLoading(false);
      }
    }
    
    // if (error) { console.info(error); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
        
        <div className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col h-[80vh] max-h-[600px]">
          
          {/* Header */}
          <div className="flex justify-between items-center p-4 bg-slate-900 z-20 shadow-md">
            <h3 className="font-bold text-lg text-white">Quét mã Kiosk</h3>
            <button 
                onClick={onClose} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-all"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          {/* Camera View */}
          <div className="relative flex-1 bg-black overflow-hidden">
            {loading && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white animate-fade-in">
                    <Spinner size="lg" color="border-emerald-500" />
                    <p className="mt-4 font-medium text-emerald-400">Đang xử lý...</p>
                </div>
            )}
            
            <QrReader
              onResult={handleScan}
              constraints={{ facingMode: 'environment' }}
              className="w-full h-full object-cover"
              videoContainerStyle={{ paddingTop: '0', height: '100%', width: '100%' }}
              videoStyle={{ objectFit: 'cover', height: '100%', width: '100%' }}
              scanDelay={500}
            />
            
            {/* Overlay Frame */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-64 h-64 border-2 border-emerald-400/50 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.3)]">
                    {/* Corners */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl -mt-0.5 -ml-0.5"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl -mt-0.5 -mr-0.5"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl -mb-0.5 -ml-0.5"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl -mb-0.5 -mr-0.5"></div>
                    
                    {/* Scan Line Animation */}
                     <div className="absolute left-0 right-0 h-0.5 bg-emerald-400/80 shadow-[0_0_15px_#34d399] animate-[scan_2s_ease-in-out_infinite]"></div>
                </div>
            </div>
            
            {/* Error Message */}
            {error && (
                <div className="absolute bottom-10 left-4 right-4 z-20">
                    <div className="bg-red-500/90 backdrop-blur text-white px-4 py-3 rounded-xl shadow-lg text-center font-medium animate-slide-up flex items-center justify-center gap-2">
                        <i className="fa-solid fa-circle-exclamation"></i>
                        <span>{error}</span>
                    </div>
                </div>
            )}
          </div>

          {/* Footer Instruction */}
          <div className="p-6 bg-slate-900 text-center z-20">
             <p className="text-slate-400 text-sm font-medium">
                Di chuyển camera đến mã QR trên màn hình Kiosk
             </p>
          </div>
        </div>
    </div>
  );
}
