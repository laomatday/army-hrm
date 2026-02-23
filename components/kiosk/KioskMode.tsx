import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { db } from '../../services/firebase';
import { doCheckIn } from '../../services/api';
import { uploadToGoogleDrive } from '../../services/googleDrive';
import { Employee, Kiosk } from '../../types';
import { getKioskById } from '../../services/kiosk';

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
    const interval = setInterval(generateToken, 60000);
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
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        
        stopCamera();
        setSession((prev: any) => ({ ...prev, status: 'uploading' }));

        const filename = `checkin_${session.employee_id}_${Date.now()}.jpg`;
        const imageUrl = await uploadToGoogleDrive(filename, base64);

        if (!imageUrl) {
            await db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: 'Lỗi tải ảnh lên Google Drive' });
            setSession((prev: any) => ({ ...prev, status: 'failed', error: "Lỗi tải ảnh" }));
            setTimeout(resetSession, 4000);
            return;
        }
        
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
                            imageUrl: imageUrl
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
        <div className="fixed inset-0 bg-slate-50 dark:bg-dark-bg text-neutral-black dark:text-dark-text-primary flex items-center justify-center p-6 z-[6000] font-sans transition-colors duration-300">
            <div className="w-full max-w-sm bg-neutral-white dark:bg-dark-surface p-8 rounded-[32px] border border-slate-200 dark:border-dark-border shadow-xl animate-scale-in">
                <div className="text-center mb-8">
                    <i className="fa-solid fa-gear text-primary text-4xl mb-3"></i>
                    <h2 className="text-2xl font-black tracking-tight">Cài đặt Kiosk</h2>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-extrabold text-slate-500 dark:text-dark-text-secondary mb-2 uppercase tracking-wide">Mã thiết bị</label>
                        <input 
                          type="text" 
                          value={tempKioskId}
                          onChange={(e) => setTempKioskId(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-dark-bg/50 border border-slate-200 dark:border-dark-border rounded-2xl px-4 py-4 font-bold text-neutral-black dark:text-dark-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                          placeholder="e.g., kioks_01"
                        />
                    </div>
                    
                    <div className="pt-4 flex gap-3">
                        <button 
                          onClick={saveConfig}
                          className="flex-1 bg-primary hover:bg-primary/90 text-neutral-white font-extrabold py-4 rounded-2xl transition-all uppercase tracking-widest"
                        >
                          Khởi tạo
                        </button>
                        <button 
                          onClick={onExit}
                          className="px-6 bg-slate-200 dark:bg-dark-border/50 hover:bg-slate-300 dark:hover:bg-dark-border text-slate-700 dark:text-dark-text-primary font-extrabold rounded-2xl transition-all uppercase tracking-widest"
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
    <div className="fixed inset-0 bg-slate-50 dark:bg-dark-bg text-neutral-black dark:text-dark-text-primary font-sans flex flex-col z-[5000] transition-colors duration-300">
      <header className="h-24 flex items-center justify-between px-8 border-b border-slate-200 dark:border-dark-border bg-neutral-white/50 dark:bg-dark-surface/50 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-black tracking-widest text-primary flex items-center gap-3">
              <i className="fa-solid fa-tablet-screen-button"></i> AITENDANCE KIOSK
          </h1>
          <p className="text-sm font-bold text-slate-500 dark:text-dark-text-secondary mt-1 uppercase tracking-wide">{kioskInfo?.name}</p>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="text-3xl font-black tabular-nums tracking-tighter">{currentTime.toLocaleTimeString('vi-VN', { hour12: false })}</div>
          <button onClick={onExit} className="text-xs font-bold text-secondary-red hover:text-secondary-red/80 transition-colors uppercase tracking-widest mt-1"><i className="fa-solid fa-power-off"></i> Thoát Kiosk</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] dark:bg-none">
          
        {!session && (
          <div className="text-center animate-fade-in">
            <h2 className="text-4xl font-black mb-4 tracking-tight">Quét QR để Chấm công</h2>
            <p className="text-slate-500 dark:text-dark-text-secondary mb-10 font-medium text-lg">
              Mở ứng dụng di động Army HRM và chọn Quét Kiosk.
            </p>

            {/* Note: QR Code backgrounds are usually kept white to ensure fast scanning by devices */}
            <div className="p-8 bg-neutral-white dark:bg-neutral-white rounded-[32px] border border-slate-200 dark:border-dark-border inline-block shadow-2xl">
                <QRCode value={qrData} size={300} />
            </div>
            
            <div className="mt-10 bg-primary/10 dark:bg-primary/20 inline-block px-8 py-4 rounded-3xl border border-primary/20">
                <div className="text-3xl font-black font-mono tracking-[0.3em] text-primary">{token}</div>
                <div className="text-[10px] font-extrabold text-slate-500 dark:text-dark-text-secondary uppercase mt-1 tracking-widest">Mã phiên hiện tại</div>
            </div>
          </div>
        )}

        {session && (
          <div className="w-full h-full flex flex-col items-center justify-center text-center animate-scale-in">
            <div className="relative w-full max-w-2xl aspect-video bg-neutral-black rounded-[32px] overflow-hidden border-4 border-slate-200 dark:border-dark-border shadow-2xl">
              <video ref={videoRef} className={`w-full h-full object-cover transform scale-x-[-1] ${isCameraActive ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`} autoPlay playsInline muted></video>
              
              {session.status !== 'camera_ready' && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-black/80 backdrop-blur-sm">
                    <i className="fa-solid fa-circle-notch fa-spin text-primary text-5xl mb-4"></i>
                    <p className="text-neutral-white font-bold tracking-widest uppercase">Đang chuẩn bị Camera...</p>
                 </div>
              )}

              {session.status === 'camera_ready' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="text-[10rem] font-black text-neutral-white tabular-nums drop-shadow-2xl animate-ping" style={{textShadow: '0 10px 30px rgba(0,0,0,0.8)'}}>{countdown}</div>
                </div>
              )}
            </div>
            
            <div className="mt-8 flex flex-col justify-center items-center h-20">
                <h2 className="text-3xl font-black tracking-tight">{session.employee_name}</h2>
                {session.status === 'uploading' && <p className="text-secondary-orange font-bold mt-2 text-lg uppercase tracking-wide animate-pulse">Đang tải ảnh lên...</p>}
                {session.status === 'completed' && <p className="text-secondary-green font-bold mt-2 text-lg uppercase tracking-wide"><i className="fa-solid fa-check-circle mr-1"></i> Chấm công thành công!</p>}
                {session.status === 'failed' && <p className="text-secondary-red font-bold mt-2 text-lg uppercase tracking-wide"><i className="fa-solid fa-triangle-exclamation mr-1"></i> Thất bại: {session.error}</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default KioskMode;