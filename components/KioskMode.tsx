import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { db } from '../services/firebase';
import { doCheckIn } from '../services/api';
import { Employee } from '../types';

interface Props {
  onExit: () => void;
}

const KIOSK_ID = 'KIOSK_001';

const KioskMode: React.FC<Props> = ({ onExit }) => {
  const [token, setToken] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate Token every 10s
  useEffect(() => {
    if (session) return; // Stop rotation if session active
    
    const generateToken = () => {
      const newToken = Math.random().toString(36).substring(2, 10).toUpperCase();
      setToken(newToken);
    };
    generateToken();
    const interval = setInterval(generateToken, 10000);
    return () => clearInterval(interval);
  }, [!!session]);

  // Listen to Kiosk Sessions
  useEffect(() => {
    const unsubscribe = db.collection('kiosk_sessions')
      .where('kiosk_id', '==', KIOSK_ID)
      .onSnapshot((snapshot) => {
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.status === 'pending' && data.token === token && !session) {
            const sessionData = { id: doc.id, ...data, status: 'camera_ready' };
            setSession(sessionData);
            db.collection('kiosk_sessions').doc(doc.id).update({ status: 'camera_ready' });
          } 
          else if (session && doc.id === session.id) {
            setSession({ id: doc.id, ...data });
          }
        });
      });
    return () => unsubscribe();
  }, [token, session?.id]);

  // Camera Logic
  useEffect(() => {
    let timer: any;
    
    if (session && session.status === 'camera_ready') {
      const startCamera = async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Trình duyệt không hỗ trợ Camera");
          }

          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
          } catch (e) {
            console.warn("Retrying camera with basic constraints");
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            try {
                await videoRef.current.play();
                setIsCameraActive(true);
            } catch (playErr) {
                console.error("Video play error:", playErr);
            }
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
          console.error("Camera error:", err);
          const errorMsg = err.name === 'NotAllowedError' ? 'Quyền truy cập Camera bị từ chối' : (err.message || 'Không thể mở Camera');
          db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: errorMsg });
          setSession(prev => prev ? { ...prev, status: 'failed', error: errorMsg } : null);
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
    if (!videoRef.current || !session) return;
    
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: 'Camera chưa sẵn sàng' });
        setTimeout(resetSession, 3000);
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    const scale = 640 / videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight * scale;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/webp', 0.5);
      
      stopCamera();
      
      const mockEmployee = {
          employee_id: session.employee_id,
          name: session.employee_name,
          center_id: session.center_id || 'CENTER_1',
          role: 'Employee'
      } as Employee;
      
      try {
          const res = await doCheckIn({
              employeeId: session.employee_id,
              lat: session.user_lat || 10.762622,
              lng: session.user_lng || 106.660172,
              deviceId: KIOSK_ID,
              imageBase64: base64
          }, mockEmployee);
          
          if (res.success) {
              await db.collection('kiosk_sessions').doc(session.id).update({ status: 'completed' });
              setSession(prev => ({ ...prev, status: 'completed' }));
          } else {
              await db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: res.message });
              setSession(prev => ({ ...prev, status: 'failed', error: res.message }));
          }
      } catch (err: any) {
          await db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: err.message || "Lỗi hệ thống" });
          setSession(prev => ({ ...prev, status: 'failed', error: err.message || "Lỗi hệ thống" }));
      }
      
      setTimeout(() => {
          resetSession();
      }, 3000);
    }
  };

  const resetSession = () => {
    setSession(null);
    setCountdown(3);
  };

  const qrData = JSON.stringify({ kiosk_id: KIOSK_ID, token });

  // --- RENDER HELPERS ---

  const renderStatusBadge = () => {
    if (!session) return <span className="text-emerald-500 animate-pulse">● SYSTEM READY</span>;
    if (session.status === 'camera_ready') return <span className="text-yellow-500 animate-pulse">● PROCESSING USER</span>;
    if (session.status === 'completed') return <span className="text-emerald-500">● SUCCESS</span>;
    if (session.status === 'failed') return <span className="text-red-500">● ERROR</span>;
    return <span className="text-slate-500">● STANDBY</span>;
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white font-mono flex flex-col overflow-hidden z-[5000]">
      {/* HEADER */}
      <header className="h-16 border-b border-[#333] flex items-center justify-between px-8 bg-[#111] relative">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div>
          <h1 className="text-lg font-bold tracking-widest text-slate-300">MÁY TRẠM</h1>
        </div>

        <div className="flex items-center gap-8 text-sm font-bold text-slate-500">
          <button onClick={onExit} className="hover:text-white transition-colors">
            <i className="fa-solid fa-power-off"></i> EXIT
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex relative">
        {/* INTERACTION AREA */}
        <div className="flex-1 flex items-center justify-center bg-[#050505] relative overflow-hidden">
          
          {/* Token Display Overlay */}
          <div className="absolute bottom-8 left-8 z-20 opacity-30 hover:opacity-100 transition-opacity pointer-events-none">
             <div className="text-[10px] text-[#666] uppercase tracking-widest mb-1">Session Token</div>
             <div className="font-mono text-xl text-emerald-500 tracking-wider">{token}</div>
          </div>
          
          {/* BACKGROUND GRID */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
          </div>

          {/* IDLE STATE: QR CODE */}
          {!session && (
            <div className="relative z-10 flex flex-col items-center animate-fade-in">
              <div className="relative p-6 bg-white rounded-xl shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                <div className="absolute -top-3 -left-3 w-6 h-6 border-t-4 border-l-4 border-emerald-500"></div>
                <div className="absolute -top-3 -right-3 w-6 h-6 border-t-4 border-r-4 border-emerald-500"></div>
                <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-4 border-l-4 border-emerald-500"></div>
                <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-4 border-r-4 border-emerald-500"></div>
                <QRCode value={qrData} size={300} level="H" />
              </div>
              <div className="mt-8 flex items-center gap-3 text-slate-500 text-sm font-bold tracking-widest uppercase">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                Waiting for connection...
              </div>
            </div>
          )}

          {/* ACTIVE STATE: CAMERA & FEEDBACK */}
          {session && (
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-12">
              
              {/* CAMERA FRAME */}
              <div className="relative w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden border border-[#333] shadow-2xl">
                
                {/* VIDEO FEED */}
                <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay playsInline muted></video>
                
                {/* OVERLAY UI */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* CORNERS */}
                  <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-white/50"></div>
                  <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-white/50"></div>
                  <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-white/50"></div>
                  <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-white/50"></div>

                  {/* CENTER TARGET */}
                  {session.status === 'camera_ready' && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-white/30 rounded-full flex items-center justify-center">
                      <div className="w-60 h-60 border border-white/20 rounded-full animate-ping"></div>
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                  )}

                  {/* INFO BAR */}
                  <div className="absolute bottom-0 left-0 w-full bg-black/80 backdrop-blur p-6 flex justify-between items-center border-t border-[#333]">
                    <div>
                      <h2 className="text-2xl font-bold text-white">{session.employee_name}</h2>
                      <p className="text-sm text-slate-400 font-mono">{session.employee_id}</p>
                    </div>
                    
                    {session.status === 'camera_ready' && (
                      <div className="text-5xl font-black text-white font-mono tracking-tighter">
                        00:0{countdown}
                      </div>
                    )}

                    {session.status === 'completed' && (
                      <div className="flex items-center gap-3 text-emerald-400">
                        <i className="fa-solid fa-check-circle text-3xl"></i>
                        <span className="text-xl font-bold uppercase">Verified</span>
                      </div>
                    )}

                    {session.status === 'failed' && (
                      <div className="flex items-center gap-3 text-red-400">
                        <i className="fa-solid fa-triangle-exclamation text-3xl"></i>
                        <span className="text-xl font-bold uppercase">Failed</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* LOADING SPINNER */}
                {session.status === 'camera_ready' && !isCameraActive && (
                   <div className="absolute inset-0 flex items-center justify-center bg-[#111]">
                      <div className="text-emerald-500 font-mono animate-pulse">INITIALIZING OPTICS...</div>
                   </div>
                )}
              </div>
              
              {/* ERROR MESSAGE BELOW */}
              {session.status === 'failed' && (
                <div className="mt-6 bg-red-900/20 border border-red-900/50 text-red-400 px-6 py-3 rounded font-mono text-sm">
                  ERROR: {session.error}
                </div>
              )}

            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default KioskMode;
