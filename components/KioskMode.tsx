import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { db } from '../services/firebase';
import { doCheckIn } from '../services/api';
import { uploadToGoogleDrive } from '../services/googleDrive'; // Import the new upload function
import { Employee, Kiosk } from '../types';
import { getKioskById } from '../services/kiosk';

interface Props {
  onExit: () => void;
}

const KioskMode: React.FC<Props> = ({ onExit }) => {
  const [kioskInfo, setKioskInfo] = useState<Kiosk | null>(null);
  const [token, setToken] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const savedKioskId = localStorage.getItem('KIOSK_ID');
  const [isConfiguring, setIsConfiguring] = useState(!savedKioskId);
  const [tempKioskId, setTempKioskId] = useState(savedKioskId || 'kioks_01');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isConfiguring && savedKioskId) {
        const fetchKiosk = async () => {
            const info = await getKioskById(savedKioskId);
            if (info) {
                setKioskInfo(info);
            } else {
                setIsConfiguring(true);
            }
        };
        fetchKiosk();
    }
  }, [isConfiguring, savedKioskId]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (session || isConfiguring || !kioskInfo) return; 
    
    const generateToken = () => {
      const newToken = Math.random().toString(36).substring(2, 10).toUpperCase();
      setToken(newToken);
    };
    generateToken();
    const interval = setInterval(generateToken, 10000);
    return () => clearInterval(interval);
  }, [!!session, isConfiguring, !!kioskInfo]);

  useEffect(() => {
    if (isConfiguring || !kioskInfo) return;

    const unsubscribe = db.collection('kiosk_sessions')
      .where('kiosk_id', '==', kioskInfo.kiosk_id)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            const docId = change.doc.id;

            if (data.status === 'pending' && data.token === token && !session) {
              const sessionData = { id: docId, ...data, status: 'camera_ready' };
              setSession(sessionData);
              db.collection('kiosk_sessions').doc(docId).update({ status: 'camera_ready' });
            } 
            else if (session && docId === session.id) {
              setSession({ id: docId, ...data });
            }
          }
        });
      });
    return () => unsubscribe();
  }, [token, session?.id, isConfiguring, kioskInfo?.kiosk_id]);

  useEffect(() => {
    let timer: any;
    
    if (session && session.status === 'camera_ready') {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setIsCameraActive(true);
          }
          
          let count = 3;
          setCountdown(count);
          timer = setInterval(() => {
            count -= 1;
            setCountdown(count);
            if (count === 0) {
              clearInterval(timer);
              takePictureAndSubmit();
            }
          }, 1000);
          
        } catch (err: any) {
          db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: 'Camera Error' });
          setTimeout(resetSession, 5000);
        }
      };
      
      const timeout = setTimeout(startCamera, 200);
      return () => clearTimeout(timeout);
    }

    return () => {
      if (timer) clearInterval(timer);
      stopCamera();
    };
  }, [session?.id, session?.status]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const takePictureAndSubmit = async () => {
    if (!videoRef.current || !session || !kioskInfo) return;

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8); // Use jpeg for broader compatibility
        
        stopCamera();

        // Announce upload start
        setSession((prev: any) => ({ ...prev, status: 'uploading' }));

        // 1. Upload to Google Drive
        const filename = `checkin_${session.employee_id}_${Date.now()}.jpg`;
        const imageUrl = await uploadToGoogleDrive(filename, base64);

        if (!imageUrl) {
            await db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: 'Lỗi tải ảnh lên Google Drive' });
            setSession((prev: any) => ({ ...prev, status: 'failed', error: "Lỗi tải ảnh" }));
            setTimeout(resetSession, 4000);
            return;
        }
        
        // 2. Proceed with check-in
        const mockEmployee = { employee_id: session.employee_id, name: session.employee_name, center_id: kioskInfo.center_id } as Employee;
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const res = await doCheckIn({
                            employeeId: session.employee_id,
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            deviceId: kioskInfo.kiosk_id, 
                            imageUrl: imageUrl // Pass the new URL
                        }, mockEmployee);
                        
                        if (res.success) {
                            await db.collection('kiosk_sessions').doc(session.id).update({ status: 'completed' });
                            setSession((prev: any) => ({ ...prev, status: 'completed' }));
                        } else {
                            await db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: res.message });
                            setSession((prev: any) => ({ ...prev, status: 'failed', error: res.message }));
                        }
                    } catch (err: any) {
                        await db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: "Lỗi hệ thống khi chấm công" });
                        setSession((prev: any) => ({ ...prev, status: 'failed', error: "Lỗi hệ thống" }));
                    }
                    
                    setTimeout(resetSession, 4000);
                },
                async (error) => {
                    console.error("Kiosk GPS Error:", error);
                    await db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: "Lỗi GPS: Vui lòng cấp quyền vị trí cho thiết bị kiosk." });
                    setSession((prev: any) => ({ ...prev, status: 'failed', error: "Chưa cấp quyền GPS" }));
                    setTimeout(resetSession, 4000);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            await db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: "Thiết bị kiosk không hỗ trợ định vị." });
            setSession((prev: any) => ({ ...prev, status: 'failed', error: "Trình duyệt không hỗ trợ GPS" }));
            setTimeout(resetSession, 4000);
        }
    }
  };

  const resetSession = () => {
    setSession(null);
    setCountdown(3);
  };

  const saveConfig = () => {
      localStorage.setItem('KIOSK_ID', tempKioskId);
      setIsConfiguring(false);
  };

  const qrData = JSON.stringify({ kiosk_id: kioskInfo?.kiosk_id || '', token });

  if (isConfiguring) {
    return (
        <div className="fixed inset-0 bg-slate-900 text-white flex items-center justify-center p-6 z-[6000]">
            <div className="w-full max-w-sm bg-slate-800 p-8 rounded-2xl border border-slate-700">
                <div className="text-center mb-8">
                    <i className="fa-solid fa-gear text-emerald-500 text-4xl mb-3"></i>
                    <h2 className="text-2xl font-bold">Cài đặt Kiosk</h2>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Mã thiết bị</label>
                        <input 
                          type="text" 
                          value={tempKioskId}
                          onChange={(e) => setTempKioskId(e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-emerald-500 outline-none"
                          placeholder="e.g., kioks_01"
                        />
                    </div>
                    
                    <div className="pt-4 flex gap-4">
                        <button 
                          onClick={saveConfig}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-bold py-3 rounded-lg"
                        >
                          Khởi tạo
                        </button>
                        <button 
                          onClick={onExit}
                          className="px-6 bg-slate-700 hover:bg-slate-600 rounded-lg"
                        >
                          Thoát
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


  return (
    <div className="fixed inset-0 bg-slate-900 text-white font-sans flex flex-col z-[5000]">
      <header className="h-20 flex items-center justify-between px-8 border-b border-slate-800">
        <div>
          <h1 className="text-lg font-bold tracking-wider text-emerald-500">AITENDANCE KIOSK</h1>
          <p className="text-xs text-slate-500">{kioskInfo?.name}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold">{currentTime.toLocaleTimeString('vi-VN', { hour12: false })}</div>
          <button onClick={onExit} className="text-xs text-red-500 hover:underline">Tắt Kiosk</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8">
          
        {!session && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Quét QR để Chấm công</h2>
            <p className="text-slate-400 mb-8">
              Dùng ứng dụng di động Army HRM để quét mã.
            </p>

            <div className="p-6 bg-white rounded-xl">
                <QRCode value={qrData} size={256} />
            </div>
            
            <div className="mt-8">
                <div className="text-lg font-mono tracking-widest text-emerald-400">{token}</div>
                <div className="text-xs text-slate-500">MÃ PHIÊN</div>
            </div>
          </div>
        )}

        {session && (
          <div className="w-full h-full flex flex-col items-center justify-center text-center">
            <div className="relative w-full max-w-2xl aspect-video bg-black rounded-lg overflow-hidden border border-slate-700">
              <video ref={videoRef} className={`w-full h-full object-cover transform scale-x-[-1] ${isCameraActive ? 'opacity-100' : 'opacity-0'}`} autoPlay playsInline muted></video>
              
              {session.status !== 'camera_ready' && (
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
                 </div>
              )}

              {session.status === 'camera_ready' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="text-8xl font-bold text-white" style={{textShadow: '0 0 20px black'}}>{countdown}</div>
                </div>
              )}
            </div>
            
            <div className="mt-6 h-12 flex flex-col justify-center items-center">
                <h2 className="text-2xl font-bold">{session.employee_name}</h2>
                {session.status === 'uploading' && <p className="text-amber-500">Đang tải ảnh lên...</p>}
                {session.status === 'completed' && <p className="text-emerald-500">Chấm công thành công!</p>}
                {session.status === 'failed' && <p className="text-red-500">Chấm công thất bại: {session.error}</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default KioskMode;
