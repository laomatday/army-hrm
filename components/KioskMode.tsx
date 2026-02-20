import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { db } from '../services/firebase';
import { doCheckIn } from '../services/api';
import { Employee, Kiosk } from '../types';
import { getKioskById } from '../services/kiosk';

interface Props {
  onExit: () => void;
}

// Giả sử mỗi máy khi khởi chạy sẽ có một ID cấu hình (có thể lưu trong localStorage sau khi thiết lập lần đầu)
const DEFAULT_KIOSK_ID = localStorage.getItem('KIOSK_ID') || 'KIOSK_001';

const KioskMode: React.FC<Props> = ({ onExit }) => {
  const [kioskInfo, setKioskInfo] = useState<Kiosk | null>(null);
  const [token, setToken] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [logs, setLogs] = useState<string[]>([]);
  const [isConfiguring, setIsConfiguring] = useState(!localStorage.getItem('KIOSK_ID'));
  const [tempKioskId, setTempKioskId] = useState(DEFAULT_KIOSK_ID);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 5));
  };

  // Fetch Kiosk Info from DB
  useEffect(() => {
    if (!isConfiguring) {
        const fetchKiosk = async () => {
            const info = await getKioskById(DEFAULT_KIOSK_ID);
            if (info) {
                setKioskInfo(info);
                addLog(`KIOSK INITIALIZED: ${info.name} (${info.center_id})`);
            } else {
                addLog(`ERROR: KIOSK ${DEFAULT_KIOSK_ID} NOT FOUND IN DATABASE`);
                setIsConfiguring(true);
            }
        };
        fetchKiosk();
    }
  }, [isConfiguring]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate Token every 10s
  useEffect(() => {
    if (session || isConfiguring || !kioskInfo) return; 
    
    const generateToken = () => {
      const newToken = Math.random().toString(36).substring(2, 10).toUpperCase();
      setToken(newToken);
      addLog(`NEW TOKEN GENERATED: ${newToken}`);
    };
    generateToken();
    const interval = setInterval(generateToken, 10000);
    return () => clearInterval(interval);
  }, [!!session, isConfiguring, !!kioskInfo]);

  // Listen to Kiosk Sessions
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
              addLog(`USER DETECTED: ${data.employee_name}`);
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

  // Camera Logic
  useEffect(() => {
    let timer: any;
    
    if (session && session.status === 'camera_ready') {
      const startCamera = async () => {
        try {
          addLog("INITIALIZING CAMERA...");
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Trình duyệt không hỗ trợ Camera");
          }

          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
          } catch (e) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            try {
                await videoRef.current.play();
                setIsCameraActive(true);
                addLog("CAMERA READY. COUNTDOWN START.");
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
          addLog(`CAMERA ERROR: ${errorMsg}`);
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
    if (!videoRef.current || !session || !kioskInfo) return;
    
    addLog("CAPTURING BIOMETRIC...");

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
      addLog("PROCESSING ATTENDANCE...");
      
      const mockEmployee = {
          employee_id: session.employee_id,
          name: session.employee_name,
          center_id: session.center_id || kioskInfo.center_id, // Ưu tiên center của user hoặc của kiosk
          role: 'Employee'
      } as Employee;
      
      try {
          const res = await doCheckIn({
              employeeId: session.employee_id,
              lat: session.user_lat || 10.762622,
              lng: session.user_lng || 106.660172,
              deviceId: kioskInfo.kiosk_id,
              imageBase64: base64
          }, mockEmployee);
          
          if (res.success) {
              addLog("VERIFICATION SUCCESSFUL");
              await db.collection('kiosk_sessions').doc(session.id).update({ status: 'completed' });
              setSession(prev => ({ ...prev, status: 'completed' }));
          } else {
              addLog(`VERIFICATION FAILED: ${res.message}`);
              await db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: res.message });
              setSession(prev => ({ ...prev, status: 'failed', error: res.message }));
          }
      } catch (err: any) {
          addLog(`SYSTEM ERROR: ${err.message}`);
          await db.collection('kiosk_sessions').doc(session.id).update({ status: 'failed', error: err.message || "Lỗi hệ thống" });
          setSession(prev => ({ ...prev, status: 'failed', error: err.message || "Lỗi hệ thống" }));
      }
      
      setTimeout(resetSession, 4000);
    }
  };

  const resetSession = () => {
    setSession(null);
    setCountdown(3);
    addLog("SYSTEM RESET. STANDBY.");
  };

  const saveConfig = () => {
      localStorage.setItem('KIOSK_ID', tempKioskId);
      setIsConfiguring(false);
      window.location.reload(); // Reload to re-init
  };

  const qrData = JSON.stringify({ kiosk_id: kioskInfo?.kiosk_id || '', token });

  if (isConfiguring) {
      return (
          <div className="fixed inset-0 bg-[#05070a] text-white flex items-center justify-center p-6 z-[6000]">
              <div className="w-full max-w-md bg-[#0a0c10] border border-emerald-500/20 p-8 rounded-2xl shadow-2xl">
                  <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/30">
                          <i className="fa-solid fa-gear text-emerald-500 text-xl"></i>
                      </div>
                      <h2 className="text-2xl font-black uppercase tracking-tight">Kiosk Setup</h2>
                  </div>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="block text-[10px] text-emerald-500/60 font-black uppercase tracking-[0.2em] mb-2">Terminal ID</label>
                          <input 
                            type="text" 
                            value={tempKioskId}
                            onChange={(e) => setTempKioskId(e.target.value)}
                            className="w-full bg-black/50 border border-emerald-500/20 rounded-lg px-4 py-3 text-white focus:border-emerald-500 outline-none transition-all font-mono"
                            placeholder="e.g. KIOSK_HCMC_01"
                          />
                      </div>
                      
                      <div className="pt-4 flex gap-4">
                          <button 
                            onClick={saveConfig}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-black py-4 rounded-lg transition-all"
                          >
                            INITIALIZE SYSTEM
                          </button>
                          <button 
                            onClick={onExit}
                            className="px-6 border border-white/10 hover:bg-white/5 rounded-lg transition-all"
                          >
                            EXIT
                          </button>
                      </div>
                      
                      <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                          Enter the unique ID for this terminal. This ID must exist in the <code className="text-emerald-500/70">kiosks</code> collection on Firebase.
                      </p>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-[#05070a] text-white font-mono flex flex-col overflow-hidden z-[5000] selection:bg-emerald-500/30">
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(1000%); }
        }
        .scanline-effect {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, transparent, rgba(16, 185, 129, 0.1) 50%, transparent);
          height: 10%;
          width: 100%;
          animation: scanline 8s linear infinite;
          pointer-events: none;
          z-index: 5;
        }
        .cyber-grid {
          background-image: 
            linear-gradient(rgba(16, 185, 129, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16, 185, 129, 0.05) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>

      {/* HEADER */}
      <header className="h-20 border-b border-emerald-500/20 flex items-center justify-between px-10 bg-[#0a0c10]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-12 h-12 border border-emerald-500/50 rounded-lg flex items-center justify-center bg-emerald-500/5">
                <i className="fa-solid fa-microchip text-emerald-500 text-xl"></i>
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-[0.2em] text-emerald-500 uppercase">AITENDANCE KIOSK</h1>
            <div className="text-[10px] text-emerald-500/50 font-bold tracking-widest uppercase">
                {kioskInfo ? `${kioskInfo.name} • ${kioskInfo.center_id}` : 'Biometric Verification Terminal v2.0'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-12">
            <div className="text-right">
                <div className="text-2xl font-light tracking-tighter text-emerald-100">
                    {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                </div>
                <div className="text-[10px] text-emerald-500/50 font-bold">
                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
                </div>
            </div>
            <button 
                onClick={onExit} 
                className="group relative px-6 py-2 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 rounded-sm overflow-hidden"
            >
                <span className="relative z-10 text-xs font-bold tracking-widest">TERMINATE</span>
                <div className="absolute inset-0 bg-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
            </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex relative cyber-grid">
        <div className="scanline-effect"></div>
        
        {/* LEFT PANEL: SYSTEM LOGS */}
        <aside className="w-80 border-r border-emerald-500/10 bg-[#0a0c10]/40 p-6 flex flex-col gap-6 z-10">
            <div>
                <div className="text-[10px] text-emerald-500/40 font-bold mb-4 tracking-widest uppercase">System Status</div>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Uptime</span>
                        <span className="text-emerald-500/80">99.9%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Node</span>
                        <span className="text-emerald-500/80">{kioskInfo?.center_id || '---'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Latency</span>
                        <span className="text-emerald-500/80">14ms</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col">
                <div className="text-[10px] text-emerald-500/40 font-bold mb-4 tracking-widest uppercase">Live Activity</div>
                <div className="flex-1 space-y-4 overflow-hidden">
                    {logs.map((log, i) => (
                        <div key={i} className="text-[11px] leading-relaxed animate-fade-in">
                            <span className="text-emerald-500/30">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span>{' '}
                            <span className={log.includes('ERROR') || log.includes('FAILED') ? 'text-red-400' : 'text-emerald-500/70'}>
                                {log}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 border border-emerald-500/20 bg-emerald-500/5 rounded">
                <div className="text-[10px] text-emerald-500/60 font-bold mb-1 tracking-widest">TERMINAL ID</div>
                <div className="text-lg font-bold text-emerald-500">{kioskInfo?.kiosk_id || '---'}</div>
                <button 
                    onClick={() => { localStorage.removeItem('KIOSK_ID'); setIsConfiguring(true); }}
                    className="text-[9px] text-emerald-500/30 hover:text-emerald-500 underline mt-2 uppercase tracking-tighter"
                >
                    Reconfigure Terminal
                </button>
            </div>
        </aside>

        {/* CENTER AREA: SCANNER / INTERACTION */}
        <div className="flex-1 flex flex-col items-center justify-center p-12 relative z-10">
          
          {/* IDLE STATE: QR CODE */}
          {!session && (
            <div className="flex flex-col items-center max-w-2xl w-full">
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-black text-white mb-4 tracking-tight uppercase">Scan to Authenticate</h2>
                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                  Open the mobile app and scan this secure dynamic QR code to begin the attendance process at <span className="text-emerald-500">{kioskInfo?.name}</span>.
                </p>
              </div>

              <div className="relative group">
                {/* Decorative Frame */}
                <div className="absolute -inset-8 border border-emerald-500/20 rounded-2xl pointer-events-none group-hover:border-emerald-500/40 transition-colors"></div>
                <div className="absolute -top-8 -left-8 w-12 h-12 border-t-2 border-l-2 border-emerald-500"></div>
                <div className="absolute -top-8 -right-8 w-12 h-12 border-t-2 border-r-2 border-emerald-500"></div>
                <div className="absolute -bottom-8 -left-8 w-12 h-12 border-b-2 border-l-2 border-emerald-500"></div>
                <div className="absolute -bottom-8 -right-8 w-12 h-12 border-b-2 border-r-2 border-emerald-500"></div>

                <div className="relative p-10 bg-white rounded-xl shadow-[0_0_80px_rgba(16,185,129,0.15)] transition-transform duration-500 group-hover:scale-[1.02]">
                    <QRCode 
                        value={qrData} 
                        size={320} 
                        level="H" 
                        fgColor="#05070a"
                    />
                    
                    {/* Scanning Animation for QR */}
                    <div className="absolute inset-x-0 h-1 bg-emerald-500/40 shadow-[0_0_15px_#10b981] animate-[scan_3s_linear_infinite] top-0 opacity-50"></div>
                </div>
              </div>

              <div className="mt-16 flex items-center gap-8">
                <div className="flex flex-col items-center gap-2">
                    <div className="text-emerald-500 font-bold text-xl">{token}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Active Token</div>
                </div>
                <div className="h-8 w-[1px] bg-slate-800"></div>
                <div className="flex items-center gap-3 text-emerald-500/60 font-bold text-xs uppercase tracking-widest">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                    Broadcasting...
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE STATE: CAMERA & FEEDBACK */}
          {session && (
            <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in">
              <div className="relative w-full max-w-5xl aspect-[16/9] bg-black rounded-2xl overflow-hidden border border-emerald-500/20 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                
                {/* VIDEO FEED */}
                <video 
                    ref={videoRef} 
                    className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-1000 ${isCameraActive ? 'opacity-100' : 'opacity-0'}`} 
                    autoPlay 
                    playsInline 
                    muted
                ></video>
                
                {/* OVERLAY UI */}
                <div className="absolute inset-0 flex flex-col pointer-events-none">
                  
                  {/* FACE TARGET GUIDE */}
                  {session.status === 'camera_ready' && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-80 h-96 border-2 border-dashed border-emerald-500/40 rounded-[100px] relative">
                            <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-[100px] animate-pulse"></div>
                            
                            {/* Scanning line for face */}
                            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-[1px] bg-emerald-500 shadow-[0_0_10px_#10b981] animate-[scan_2s_ease-in-out_infinite]"></div>
                        </div>
                    </div>
                  )}

                  {/* INFO PANEL */}
                  <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent p-10 mt-auto">
                    <div className="flex items-end justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-2 py-0.5 bg-emerald-500 text-black text-[10px] font-black rounded uppercase">Verified Identity</span>
                                <span className="text-emerald-500/50 text-[10px] font-bold">UID: {session.employee_id}</span>
                            </div>
                            <h2 className="text-4xl font-black text-white uppercase tracking-tight">{session.employee_name}</h2>
                        </div>
                        
                        <div className="flex flex-col items-end">
                            {session.status === 'camera_ready' && (
                                <div className="text-center">
                                    <div className="text-[10px] text-emerald-500 font-black mb-1 uppercase tracking-widest">Biometric Capture In</div>
                                    <div className="text-7xl font-black text-white font-mono leading-none tabular-nums">
                                        0{countdown}
                                    </div>
                                </div>
                            )}

                            {session.status === 'completed' && (
                                <div className="flex items-center gap-4 bg-emerald-500 text-black px-6 py-3 rounded-lg animate-bounce">
                                    <i className="fa-solid fa-check-double text-2xl"></i>
                                    <span className="text-xl font-black uppercase">Attendance Logged</span>
                                </div>
                            )}

                            {session.status === 'failed' && (
                                <div className="flex items-center gap-4 bg-red-600 text-white px-6 py-3 rounded-lg">
                                    <i className="fa-solid fa-xmark text-2xl"></i>
                                    <span className="text-xl font-black uppercase">Verification Failed</span>
                                </div>
                            )}
                        </div>
                    </div>
                  </div>
                </div>

                {/* INITIALIZING OVERLAY */}
                {session.status === 'camera_ready' && !isCameraActive && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05070a]">
                      <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                      <div className="text-emerald-500 font-black tracking-[0.3em] text-xs">BOOTING OPTICAL SENSORS...</div>
                   </div>
                )}
              </div>
              
              {/* ERROR FOOTER */}
              {session.status === 'failed' && (
                <div className="mt-8 bg-red-500/10 border border-red-500/30 text-red-400 px-8 py-4 rounded-lg font-bold text-sm max-w-2xl text-center">
                  <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                  SYSTEM ERROR: {session.error}
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
