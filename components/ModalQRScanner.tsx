import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  onClose: () => void;
  onScan: (data: string) => void;
  onError: (msg: string) => void;
}

const ModalQRScanner: React.FC<Props> = ({ onClose, onScan, onError }) => {
  const [isScanning, setIsScanning] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    const startScanner = async () => {
        try {
            await scanner.start(
              { facingMode: "environment" },
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
              },
              (decodedText) => {
                if (isScanning) {
                  setIsScanning(false);
                  scanner.stop().then(() => {
                    onScan(decodedText);
                  }).catch(err => {
                    console.error(err);
                    onScan(decodedText);
                  });
                }
              },
              () => {}
            );
        } catch (err) {
            onError("Không thể mở camera: " + err);
            onClose();
        }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
          const s = scannerRef.current;
          if (s.isScanning) {
              s.stop().catch(err => console.error("Error stopping scanner", err));
          }
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[4000] bg-black flex flex-col overflow-hidden">
      <style>{`
        #qr-reader video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border-radius: 12px;
        }
        #qr-reader {
            border: none !important;
            overflow: hidden;
        }
        @keyframes scan {
            0% { top: 0; }
            50% { top: 100%; }
            100% { top: 0; }
        }
      `}</style>
      <div className="relative flex-1 bg-black flex items-center justify-center p-4">
        <div id="qr-reader" className="w-full max-w-md aspect-square rounded-2xl overflow-hidden shadow-2xl border-2 border-emerald-500/20"></div>
        
        {/* Overlay Scanner UI */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[250px] h-[250px] border-2 border-emerald-500 rounded-2xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 -mt-1 -ml-1 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 -mt-1 -mr-1 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 -mb-1 -ml-1 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 -mb-1 -mr-1 rounded-br-lg"></div>
                
                {/* Scanning Line Animation */}
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
            </div>
        </div>
      </div>
      
      <div className="bg-black pb-safe pt-6 px-6">
          <div className="flex justify-center items-center max-w-sm mx-auto">
            <button onClick={onClose} className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
          <p className="text-center text-slate-400 text-xs mt-4 mb-2">Đưa mã QR trên Kiosk vào khung hình</p>
      </div>
    </div>
  );
};

export default ModalQRScanner;
