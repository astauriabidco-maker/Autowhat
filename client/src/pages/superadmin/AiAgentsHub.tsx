import { useState } from 'react';
import { 
    Cpu, Network, ShieldCheck, Settings, 
    Layers, Brain, Eye, MessageSquare, Save, Zap, RefreshCw
} from 'lucide-react';

interface AgentConfig {
    id: string;
    name: string;
    description: string;
    isEnabled: boolean;
    provider: string;
    model: string;
    icon: React.ElementType;
    prompt?: string;
}

export default function AiAgentsHub() {
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [openaiKey, setOpenaiKey] = useState('sk-proj-....................');

    // Mock initial state for the UI demonstration
    const [agents, setAgents] = useState<AgentConfig[]>([
        {
            id: 'nlp-router',
            name: 'Router Agent (NLP)',
            description: 'Classe dynamiquement les intentions WhatsApp (Congés, Notes, FAQ...) au lieu de menus rigides.',
            isEnabled: true,
            provider: 'OpenAI',
            model: 'gpt-4o-mini',
            icon: Network,
            prompt: 'Tu es le cerveau routeur de WhatsPoint. Ton but est de classifier l\'intention de l\'utilisateur...'
        },
        {
            id: 'vision-ocr',
            name: 'Vision Agent (OCR)',
            description: 'Lit et extrait les montants de TVA/TTC des tickets de caisse via l\'API LLM Vision.',
            isEnabled: true,
            provider: 'OpenAI',
            model: 'gpt-4o',
            icon: Eye,
            prompt: 'Tu es un expert comptable AI. Analyse ce ticket de caisse et retourne un JSON strict...'
        },
        {
            id: 'rag-assistant',
            name: 'RAG Agent (FAQ RH)',
            description: 'Répond aux questions RH en puisant dans la base documentaire du Tenant.',
            isEnabled: false,
            provider: 'Anthropic',
            model: 'claude-3.5-sonnet',
            icon: Brain,
            prompt: 'Tu es l\'assistant RH de l\'entreprise. Base tes réponses uniquement sur le contexte documentaire fourni.'
        },
        {
            id: 'proactive-alerter',
            name: 'Proactive Watcher (Cron)',
            description: 'Surveille silencieusement les dates de fin d\'arrêts et expire les bases RGPD.',
            isEnabled: true,
            provider: 'System',
            model: 'Node Cron',
            icon: Cpu
        }
    ]);

    const toggleAgent = (id: string) => {
        setAgents(agents.map(a => a.id === id ? { ...a, isEnabled: !a.isEnabled } : a));
    };

    const handleSave = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        }, 1200);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Header section with Glassmorphism */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-950 p-8 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-purple-500/20 blur-[100px] rounded-full pointer-events-none" />
                
                <div className="relative z-10 space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200">
                        <Zap size={16} className="text-yellow-400" />
                        <span className="text-sm font-semibold tracking-wide">AGENTIC ARCHITECTURE V1</span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                        AI Agents Central Hub
                    </h1>
                    <p className="text-indigo-200 max-w-2xl text-lg relative z-10">
                        L'intelligence artificielle au cœur du middleware. Activez, configurez et monitorez vos agents autonomes en temps réel pour orchestrer les flux WhatsApp.
                    </p>
                </div>
                
                <div className="relative z-10 flex gap-4 min-w-max">
                    <button 
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/50 hover:scale-105"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                        {saved ? "Synchronisé" : "Déployer Config"}
                    </button>
                </div>
            </div>

            {/* Global API Config */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
                        <Settings size={22} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Configurations Globales (LLM Providers)</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700">Clé API OpenAI Principale</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                value={openaiKey}
                                onChange={(e) => setOpenaiKey(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                            />
                            <ShieldCheck className="absolute left-3 top-3.5 text-emerald-500" size={20} />
                        </div>
                        <p className="text-xs text-slate-500">Utilisée par le Router Agent et le Vision OCR.</p>
                    </div>
                    <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700">Clé API Anthropic (Optionnelle)</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                placeholder="sk-ant-api03-..." 
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                            />
                            <ShieldCheck className="absolute left-3 top-3.5 text-slate-400" size={20} />
                        </div>
                        <p className="text-xs text-slate-500">Privilégiée pour le RAG due à sa grande fenêtre de contexte.</p>
                    </div>
                </div>
            </div>

            {/* AI Agents Grid */}
            <h2 className="text-2xl font-bold text-slate-800 pt-4 flex items-center gap-2">
                <Layers className="text-indigo-600" />
                Flotte d'Agents Autonomes
            </h2>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {agents.map(agent => (
                    <div 
                        key={agent.id} 
                        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border ${
                            agent.isEnabled 
                            ? 'border-indigo-200 bg-white shadow-lg shadow-indigo-100/50' 
                            : 'border-slate-200 bg-slate-50/50 opacity-80'
                        } transition-all duration-300 hover:shadow-xl`}
                    >
                        {/* Status line */}
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${agent.isEnabled ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-slate-300'}`} />

                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-2xl ${agent.isEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                        <agent.icon size={28} strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">{agent.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${agent.isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                                {agent.isEnabled ? 'ONLINE' : 'OFFLINE'}
                                            </span>
                                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                {agent.provider} • {agent.model}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => toggleAgent(agent.id)}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${agent.isEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${agent.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            
                            <p className="text-slate-600 text-sm leading-relaxed mb-6 font-medium">
                                {agent.description}
                            </p>

                            {/* System Prompt Configurator - Only if agent supports it and is enabled */}
                            {agent.prompt !== undefined && (
                                <div className={`transition-all duration-300 ${agent.isEnabled ? 'opacity-100 h-auto' : 'opacity-50 pointer-events-none'}`}>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                        <MessageSquare size={14} /> System Prompt (Personnalité)
                                    </label>
                                    <textarea 
                                        defaultValue={agent.prompt}
                                        className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-mono focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                                        placeholder="Définissez les règles comportementales de cet agent..."
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Activity Monitor / Logs Preview */}
            <div className="mt-8 bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800">
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <ActivityIcon /> 
                        Agentic Nervous System Logs
                    </h3>
                    <div className="flex gap-2">
                        <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                        <div className="h-3 w-3 bg-yellow-500 rounded-full" />
                        <div className="h-3 w-3 bg-green-500 rounded-full" />
                    </div>
                </div>
                <div className="p-6 font-mono text-xs text-emerald-400 space-y-2 h-64 overflow-y-auto">
                    <p><span className="text-slate-500">[11:21:45]</span> [Router] Message reçu: "J'ai la grippe". Intent détecté: SICK_LEAVE (Confiance: 0.98)</p>
                    <p><span className="text-slate-500">[11:22:15]</span> [Vision] Analyse image receipt_459.jpg... Extraction TVA: 20%, Total: 45.90€</p>
                    <p><span className="text-slate-500">[11:23:01]</span> [Proactive] Scan RGPD... Purge de 12 fichiers médicaux expirés (&gt;24h).</p>
                    <p className="text-slate-300 pt-2 italic">Waiting for incoming orchestrations...</p>
                </div>
            </div>
        </div>
    );
}

// Simple fallback icon
const ActivityIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
);
