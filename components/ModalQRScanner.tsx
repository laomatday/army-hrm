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

    scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      (decodedText) => {
        if (isScanning) {
          setIsScanning(false);
          scanner.stop().then(() => {
            onScan(decodedText);
          }).catch(err => {
            console.error(err);
            onScan(decodedText); // Proceed anyway
          });
        }
      },
      (errorMessage) => {
        // parse errors are ignored
      }
    ).catch((err) => {
      onError("Không thể mở camera: " + err);
      onClose();
    });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[4000] bg-black flex flex-col">
      <div className="relative flex-1 bg-black flex items-center justify-center">
        <div id="qr-reader" className="w-full max-w-md"></div>
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
