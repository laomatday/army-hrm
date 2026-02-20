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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Generate Token every 10s
  useEffect(() => {
    const generateToken = () => {
      const newToken = Math.random().toString(36).substring(2, 10).toUpperCase();
      setToken(newToken);
    };
    generateToken();
    const interval = setInterval(generateToken, 10000);
    return () => clearInterval(interval);
  }, []);

  // Listen to Kiosk Sessions
  useEffect(() => {
    if (!token) return;
    
    const unsubscribe = db.collection('kiosk_sessions')
      .where('kiosk_id', '==', KIOSK_ID)
      .where('status', '==', 'pending')
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            // Accept if token matches
            if (data.token === token) {
              setSession({ id: change.doc.id, ...data });
              db.collection('kiosk_sessions').doc(change.doc.id).update({ status: 'camera_ready' });
            } else {
              // Token mismatch, mark as failed
              db.collection('kiosk_sessions').doc(change.doc.id).update({ status: 'failed', error: 'Mã QR đã hết hạn' });
            }
          }
        });
      });
    return () => unsubscribe();
  }, [token]);

  // Camera Logic when session is active
  useEffect(() => {
    let timer: any;
    
    if (session && session.status === 'camera_ready') {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          
          // Start countdown
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
          
        } catch (err) {
          console.error("Camera error:", err);
          db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: 'Lỗi Camera Kiosk' });
          setTimeout(resetSession, 3000);
        }
      };
      startCamera();
    }

    return () => {
      if (timer) clearInterval(timer);
      stopCamera();
    };
  }, [session?.status]); // Only run when status changes to camera_ready

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const takePictureAndSubmit = async () => {
    if (!videoRef.current || !session) return;
    
    // Ensure video is ready
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        console.error("Video not ready for capture");
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
      // Mirror the image back to normal if video is mirrored
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/webp', 0.5);
      
      // Stop camera immediately after capture
      stopCamera();
      
      // Submit check-in
      const mockEmployee = {
          employee_id: session.employee_id,
          name: session.employee_name,
          center_id: 'CENTER_1', // Assuming default
          role: 'Employee'
      } as Employee;
      
      try {
          // Use Kiosk's location (dummy valid location)
          const res = await doCheckIn({
              employeeId: session.employee_id,
              lat: 10.762622,
              lng: 106.660172,
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

  if (session) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-[5000]">
        <div className="absolute top-10 left-0 w-full text-center z-10">
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Xin chào, {session.employee_name}</h1>
            {session.status === 'camera_ready' && (
                <p className="text-xl text-emerald-400 font-bold animate-pulse">Vui lòng nhìn vào Camera ({countdown}s)</p>
            )}
            {session.status === 'completed' && (
                <p className="text-xl text-emerald-400 font-bold">Chấm công thành công!</p>
            )}
            {session.status === 'failed' && (
                <p className="text-xl text-red-400 font-bold">Lỗi: {session.error}</p>
            )}
        </div>
        
        <div className="relative w-full max-w-3xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800">
            <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay playsInline muted></video>
            {session.status === 'camera_ready' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-4 border-emerald-500/50 rounded-full border-dashed animate-[spin_10s_linear_infinite]"></div>
                </div>
            )}
            {session.status === 'completed' && (
                <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                    <i className="fa-solid fa-check-circle text-9xl text-emerald-500 animate-scale-in"></i>
                </div>
            )}
            {session.status === 'failed' && (
                <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                    <i className="fa-solid fa-triangle-exclamation text-9xl text-red-500 animate-scale-in"></i>
                </div>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center z-[5000] p-8">
      <button onClick={onExit} className="absolute top-8 left-8 w-12 h-12 bg-white dark:bg-slate-800 rounded-full shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
          <i className="fa-solid fa-arrow-left"></i>
      </button>
      
      <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-slate-800 dark:text-white tracking-tight mb-4">Trạm Chấm Công</h1>
          <p className="text-xl text-slate-500 dark:text-slate-400 font-medium">Sử dụng ứng dụng trên điện thoại để quét mã QR</p>
      </div>
      
      <div className="bg-white p-8 rounded-[32px] shadow-2xl shadow-emerald-500/10 border border-slate-100 relative">
          <div className="absolute -top-4 -right-4 w-8 h-8 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
          <div className="absolute -top-4 -right-4 w-8 h-8 bg-emerald-500 rounded-full"></div>
          
          <QRCode value={qrData} size={320} level="H" />
          
          <div className="mt-8 text-center">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Mã tự động làm mới sau</p>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full animate-[pulse_10s_linear_infinite]" style={{ width: '100%' }}></div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default KioskMode;
