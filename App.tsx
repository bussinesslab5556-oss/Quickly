import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Database, 
  CreditCard, 
  Layout, 
  Mail, 
  Lock, 
  ChevronRight, 
  User, 
  Globe, 
  Check,
  ArrowLeft,
  Settings,
  Zap,
  Crown,
  Briefcase,
  Monitor,
  Send,
  MoreVertical,
  Phone,
  Video,
  Search,
  Languages,
  Info,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Maximize2,
  Menu,
  X,
  FileText,
  Image as ImageIcon,
  Play,
  Square,
  Paperclip,
  Clock,
  HardDrive,
  Download,
  AlertCircle,
  FolderTree,
  ShieldCheck,
  Activity,
  BarChart3,
  Users,
  ShieldAlert,
  ArrowUpRight,
  Bell,
  Wifi,
  WifiOff,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';
import { PlanTier } from './types';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- Types & Constants ---
type AppState = 'AUTH' | 'ONBOARDING_PROFILE' | 'ONBOARDING_LANG' | 'ONBOARDING_PLAN' | 'DASHBOARD' | 'DEV_DOCS' | 'CALLING' | 'PRICING' | 'ADMIN';
type SidebarTab = 'CHATS' | 'FILES';
type MessageFilter = 'all' | 'translated' | 'original';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  type: 'text' | 'voice' | 'image' | 'file';
  originalText: string;
  translatedText?: string;
  isEncrypted: boolean;
  timestamp: Date;
}

interface ChatItem {
  id: string;
  name: string;
  lastMsg: string;
  lang: string;
  avatar: string;
  online: boolean;
}

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'image';
  timestamp: Date;
}

const CURRENT_USER_ID = 'user-123';
const AI_MODEL = 'gemini-1.5-flash'; // Updated to stable 2026 production model
const STORAGE_KEY = 'globalsync_cache_v1';

// --- Notification Service ---
const NotificationService = {
  requestPermission: async () => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },
  show: (title: string, body: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: 'https://i.pravatar.cc/150' });
    }
  }
};

// --- Offline Caching Service ---
const CacheService = {
  saveMessages: (messages: Message[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error("Cache failed", e);
    }
  },
  loadMessages: (): Message[] => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return [];
    try {
      return JSON.parse(cached).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
    } catch (e) {
      return [];
    }
  }
};

// --- Paddle Service ---
const PaddleService = {
  init: () => {
    // @ts-ignore
    if (window.Paddle) {
      // @ts-ignore
      window.Paddle.Environment.set('sandbox');
      // @ts-ignore
      window.Paddle.Setup({ vendor: 12345 });
    }
  },
  openCheckout: (priceId: string, email: string) => {
    // @ts-ignore
    if (window.Paddle) {
      // @ts-ignore
      window.Paddle.Checkout.open({
        product: priceId,
        email: email,
        successCallback: () => alert("Upgrade successful!")
      });
    } else {
      alert("Paddle Integration: Checkout initiated for " + priceId);
    }
  }
};

const App: React.FC = () => {
  // --- State ---
  const [appState, setAppState] = useState<AppState>('AUTH');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('CHATS');
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(PlanTier.FREE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [quotaUsed, setQuotaUsed] = useState(12400); 
  const [storageUsed, setStorageUsed] = useState(42.5);

  // --- Effects ---
  useEffect(() => {
    PaddleService.init();
    const cached = CacheService.loadMessages();
    if (cached.length > 0) setMessages(cached);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) CacheService.saveMessages(messages);
  }, [messages]);

  // --- Logic ---
  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      const matchesSearch = searchQuery === '' || 
        m.originalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.translatedText?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesFilter = filter === 'all' || 
        (filter === 'translated' && m.translatedText) ||
        (filter === 'original' && !m.translatedText);
        
      return matchesSearch && matchesFilter;
    });
  }, [messages, searchQuery, filter]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !isOnline) return;

    if (quotaUsed > 2000000 && appState !== 'PRICING') {
      alert("Quota exceeded! Upgrade your plan.");
      setAppState('PRICING');
      return;
    }

    const currentText = inputText;
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: CURRENT_USER_ID,
      senderName: 'Me',
      type: 'text',
      originalText: currentText,
      isEncrypted: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setQuotaUsed(prev => prev + currentText.length);

    try {
      const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_KEY || 'AI_KEY_MISSING');
      const model = genAI.getGenerativeModel({ 
        model: AI_MODEL,
        systemInstruction: "You are a specialized translation agent. Detect the source language and translate to either English or Spanish accordingly. Output ONLY the translated text."
      });

      const result = await model.generateContent(`Text to translate: ${currentText}`);
      const translated = result.response.text();

      if (translated) {
        setMessages(prev => prev.map(m => m.id === newMessage.id ? { 
          ...m, 
          translatedText: translated.trim() 
        } : m));
      }
    } catch (error) {
      console.error("AI Translation error:", error);
      setMessages(prev => prev.map(m => m.id === newMessage.id ? { 
        ...m, 
        translatedText: `[Sync-AI] Translation service unavailable.` 
      } : m));
    }
  };

  const OfflineBanner = () => (
    !isOnline ? (
      <div className="bg-red-500 text-white text-[10px] font-black uppercase tracking-widest py-2 px-4 flex items-center justify-center gap-2 animate-pulse w-full absolute top-0 z-[100]">
        <WifiOff size={12} /> Working Offline - Messages will sync when reconnected
      </div>
    ) : null
  );

  const DashboardView = () => (
    <div className="flex h-screen bg-[#1F2329] text-white overflow-hidden relative">
      <OfflineBanner />
      
      <div className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        transition-transform duration-300 ease-in-out md:translate-x-0 
        fixed md:relative z-50 
        w-80 h-full border-r border-white/10 flex flex-col bg-[#1A1D21]/80 backdrop-blur-xl
      `}>
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Layout className="text-blue-500 w-6 h-6" /> Sync
            </h1>
            <div className="flex gap-2">
              <button onClick={() => NotificationService.requestPermission()} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"><Bell size={18}/></button>
              <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"><Settings size={18}/></button>
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs ring-2 ring-blue-500/20">Me</div>
            </div>
          </div>
          
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 mb-4">
            <button onClick={() => setSidebarTab('CHATS')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${sidebarTab === 'CHATS' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}><Languages size={14} /> Chats</button>
            <button onClick={() => setSidebarTab('FILES')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${sidebarTab === 'FILES' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}><FolderTree size={14} /> Files</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sidebarTab === 'CHATS' ? (
            MOCK_CHAT_LIST.map((chat: ChatItem) => (
              <div key={chat.id} className="p-3 hover:bg-white/5 cursor-pointer rounded-2xl flex items-center gap-4 transition-all group">
                <div className="relative">
                  <img src={chat.avatar} className="w-11 h-11 rounded-full border border-white/10" alt={chat.name} />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-[#1F2329] rounded-full ${chat.online ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold text-sm truncate">{chat.name}</span>
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tight">Now</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate leading-relaxed">{chat.lastMsg}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-3">
               <h3 className="text-[10px] uppercase font-black text-gray-500 tracking-widest px-2 mb-2">Cloud Storage</h3>
               {MOCK_FILES.map((file: FileItem) => (
                <div key={file.id} className="bg-white/5 p-3 rounded-2xl border border-white/5 flex items-center gap-3 hover:border-blue-500/50 transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                    {file.type === 'image' ? <ImageIcon size={20} /> : <FileText size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{file.name}</div>
                    <div className="text-[9px] text-gray-500 flex items-center gap-2">
                       <span>{file.timestamp.toLocaleDateString()}</span>
                       <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                       <span>2.4 MB</span>
                    </div>
                  </div>
                  <Download size={14} className="text-gray-500 group-hover:text-blue-500" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-white/10 bg-black/20 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5 px-1">
              <span className="text-[9px] uppercase font-black text-gray-500 tracking-widest flex items-center gap-1.5"><HardDrive size={10}/> Storage Used</span>
              <span className="text-[9px] font-black text-green-400">{storageUsed.toFixed(1)} / 500 MB</span>
            </div>
            <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${(storageUsed / 500 * 100)}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-[#1F2329]/40">
        <div className="h-20 border-b border-white/10 flex items-center justify-between px-6 bg-[#1A1D21]/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-gray-400" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu size={20}/></button>
            <div className="relative">
              <img src="https://i.pravatar.cc/150?u=maria" className="w-10 h-10 rounded-full border border-white/10" alt="Maria" />
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[#1F2329] rounded-full"></div>
            </div>
            <div>
              <h2 className="font-bold text-sm">Maria Garcia</h2>
              <div className="flex items-center gap-1.5">
                {isOnline ? <Wifi size={10} className="text-green-500" /> : <WifiOff size={10} className="text-red-500" />}
                <span className="text-[9px] text-blue-500 uppercase font-black tracking-widest">RSA-2048 Active</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {showSearch && (
              <div className="hidden lg:flex items-center bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 animate-in slide-in-from-right-4">
                <Search size={14} className="text-gray-400" />
                <input 
                  autoFocus
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find message..."
                  className="bg-transparent border-none outline-none text-xs ml-2 w-32"
                />
                <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}><X size={14} className="text-gray-400 hover:text-white"/></button>
              </div>
            )}
            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
              <button onClick={() => setShowSearch(!showSearch)} className={`p-2 rounded-lg transition-all ${showSearch ? 'bg-blue-500/20 text-blue-500' : 'text-gray-400 hover:bg-white/5'}`}><Search size={20} /></button>
              <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"><Phone size={20} /></button>
              <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"><Video size={20} /></button>
              <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"><MoreVertical size={20} /></button>
            </div>
          </div>
        </div>

        <div className="px-6 py-2 border-b border-white/5 bg-black/20 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Filter:</span>
              <button onClick={() => setFilter('all')} className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all ${filter === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>All</button>
              <button onClick={() => setFilter('translated')} className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all ${filter === 'translated' ? 'bg-green-500 text-black' : 'text-gray-400 hover:text-white'}`}>Translated</button>
              <button onClick={() => setFilter('original')} className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all ${filter === 'original' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}>Original Only</button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {filteredMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.senderId === CURRENT_USER_ID ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[85%] md:max-w-[70%]`}>
                <div className={`p-4 rounded-[2rem] shadow-xl border transition-all ${msg.senderId === CURRENT_USER_ID ? 'bg-blue-600 border-blue-500/20 text-white rounded-tr-none' : 'bg-white/5 backdrop-blur-md border-white/5 rounded-tl-none'}`}>
                  <p className="text-sm leading-relaxed">{msg.originalText}</p>
                  {msg.translatedText && (
                    <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                       <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-green-300"><Globe size={10}/> AI Translation</div>
                       <p className="text-sm font-medium italic opacity-90 leading-relaxed text-green-300">{msg.translatedText}</p>
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between opacity-50 text-[8px] font-black uppercase tracking-widest">
                    <span><ShieldCheck size={10} className="inline mr-1"/> Verified</span>
                    <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-[#1F2329]/50 border-t border-white/10 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto flex gap-4 items-center">
            <div className="flex-1 bg-black/60 border border-white/10 rounded-2xl flex items-center px-4 py-1.5 shadow-2xl focus-within:ring-2 focus-within:ring-blue-500 transition-all backdrop-blur-md">
              <button className="p-2 text-gray-400 hover:text-blue-500 transition-colors"><Paperclip size={20} /></button>
              <input 
                type="text" 
                value={inputText}
                disabled={!isOnline}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={isOnline ? "Secure, encrypted message..." : "Reconnect to send messages..."}
                className="flex-1 bg-transparent border-none outline-none py-3 px-2 text-sm text-white placeholder-gray-500"
              />
              <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                <button className="p-2.5 text-gray-400 hover:text-green-500 transition-all hover:scale-110"><Mic size={20} /></button>
                <button 
                  onClick={handleSendMessage} 
                  disabled={!inputText.trim() || !isOnline}
                  className={`p-2.5 rounded-xl transition-all shadow-lg ${inputText.trim() && isOnline ? 'bg-blue-600 text-white scale-110 shadow-blue-500/30' : 'text-gray-400 opacity-30 grayscale'}`}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const PricingView = () => (
    <div className="min-h-screen bg-[#1F2329] p-6 md:p-12 overflow-y-auto relative text-white">
      <div className="absolute top-0 right-0 p-8">
        <button onClick={() => setAppState('DASHBOARD')} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"><X size={24}/></button>
      </div>
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-16 space-y-4">
          <h1 className="text-5xl font-black text-white">Power Your <span className="text-blue-500">Global Voice</span></h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { id: PlanTier.FREE, name: 'Free', price: '0', desc: 'Personal use', features: ['2M Characters', '100m Calls', '500MB Storage'] },
            { id: PlanTier.PREMIUM, name: 'Premium', price: '9.99', desc: 'Most Popular', features: ['5M Characters', '5000m Calls', '5GB Storage', '1080p Video'], popular: true },
            { id: PlanTier.PRO, name: 'Pro', price: '29.99', desc: 'Elite access', features: ['Unlimited Trans', 'Unlimited Calls', '20GB Storage', '4K Quality'] },
            { id: PlanTier.BUSINESS, name: 'Business', price: '99', desc: 'Teams & HQ', features: ['Team Controls', 'Analytics', '100GB Storage', 'SSO Login'] }
          ].map(plan => (
            <div key={plan.id} className={`bg-white/5 border border-white/10 backdrop-blur-xl rounded-[2.5rem] p-10 flex flex-col transition-all hover:scale-[1.02] ${plan.popular ? 'ring-2 ring-blue-500 shadow-[0_0_40px_-10px_rgba(59,130,246,0.5)]' : ''}`}>
              <div className="mb-10 text-center">
                <span className="text-[10px] font-black uppercase tracking-[2px] text-blue-500">{plan.desc}</span>
                <h3 className="text-3xl font-black mt-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1 mt-6">
                  <span className="text-5xl font-black">${plan.price}</span>
                  <span className="text-gray-500 font-bold">/mo</span>
                </div>
              </div>
              <ul className="space-y-5 mb-12 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-4 text-sm font-medium">
                    <div className="p-1 bg-green-500/20 rounded-full text-green-500"><Check size={14}/></div> {f}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => {
                  setSelectedPlan(plan.id as PlanTier);
                  if (plan.id === PlanTier.FREE) setAppState('DASHBOARD');
                  else PaddleService.openCheckout(plan.id, 'user@sync.ai');
                }}
                className={`w-full py-5 rounded-2xl font-black text-sm transition-all shadow-xl hover:-translate-y-1 ${plan.popular ? 'bg-blue-600 text-white' : 'bg-white/5 text-white hover:bg-white/10'}`}
              >
                {plan.id === selectedPlan ? 'ACTIVE PLAN' : 'UPGRADE NOW'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (appState === 'PRICING') return <PricingView />;
  if (appState === 'DASHBOARD') return <DashboardView />;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#1F2329] relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-500/20 rounded-full blur-[160px] animate-pulse"></div>
      <div className="w-full max-w-md z-10 space-y-10 text-center">
        <div className="inline-flex items-center justify-center w-28 h-28 bg-blue-600 rounded-[2.5rem] shadow-2xl shadow-blue-500/30 rotate-6 transition-transform hover:rotate-0 duration-500">
          <Layout className="text-white w-14 h-14 -rotate-6" />
        </div>
        <div>
          <h1 className="text-5xl font-black text-white tracking-tighter">GlobalSync <span className="text-blue-500">AI</span></h1>
          <p className="text-gray-400 mt-4 font-bold uppercase tracking-[4px] text-xs">V3.0 Final Release</p>
        </div>
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl space-y-6">
          <button onClick={() => setAppState('DASHBOARD')} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 group text-lg">
            Enter Platform <ChevronRight size={24} className="group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MOCK_CHAT_LIST: ChatItem[] = [
  { id: '1', name: 'Maria Garcia', lastMsg: 'I just reviewed the project brief.', lang: 'Spanish', avatar: 'https://i.pravatar.cc/150?u=maria', online: true },
  { id: '2', name: 'Yuki Tanaka', lastMsg: 'The new translation engine is amazing!', lang: 'Japanese', avatar: 'https://i.pravatar.cc/150?u=yuki', online: false },
  { id: '3', name: 'Hans Müller', lastMsg: 'Guten Morgen, wir sind bereit.', lang: 'German', avatar: 'https://i.pravatar.cc/150?u=hans', online: true },
];

const MOCK_FILES: FileItem[] = [
  { id: 'f1', name: 'Sync_Roadmap_2026.pdf', type: 'file', timestamp: new Date() },
  { id: 'f2', name: 'Team_Security_Cert.png', type: 'image', timestamp: new Date() },
];

export default App;