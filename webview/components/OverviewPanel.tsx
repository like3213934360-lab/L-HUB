import React, { useState, useEffect } from 'react';
import { vscode } from '../vscode-api';
import { s, colors, radius, shadow, providerColors } from '../theme';
import { Lang } from './Dashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelStatus {
    id: string;
    label: string;
    modelId: string;
    group: string;
    enabled: boolean;
    status: 'online' | 'offline' | 'unknown';
    testMsg?: string;
}

interface OverviewStats {
    models: ModelStatus[];
    todayRequests: number;
    successRate: number;
    avgLatency: number;
    totalTokens: number;
    recentRequests: {
        id: string;
        timestamp: number;
        method: string;
        model: string;
        duration: number;
        status: 'success' | 'error';
        totalTokens: number;
    }[];
}

// ─── Gradient Stat Cards ──────────────────────────────────────────────────────

const CARD_GRADIENTS = [
    'linear-gradient(135deg, #0d9488 0%, #065f46 100%)',   // teal
    'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',   // indigo
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',   // amber
    'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',   // pink
];

const StatCard: React.FC<{
    icon: string;
    label: string;
    value: string | number;
    sub?: string;
    gradient: string;
    delay: number;
}> = ({ icon, label, value, sub, gradient, delay }) => (
    <div
        className={`animate-in animate-in-${delay}`}
        style={{
            flex: '1 1 0',
            minWidth: '130px',
            padding: '20px 16px',
            borderRadius: radius.lg,
            background: gradient,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            cursor: 'default',
            transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.35)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)'; }}
    >
        {/* Shimmer overlay */}
        <div className="shimmer-bar" style={{
            position: 'absolute', inset: 0,
            borderRadius: radius.lg,
            pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '15px', marginBottom: '8px', opacity: 0.9 }}>{icon}</div>
            <div style={{
                fontSize: '28px', fontWeight: 800,
                fontFamily: "'JetBrains Mono', 'Cascadia Code', 'SF Mono', monospace",
                color: '#fff',
                lineHeight: 1.1, marginBottom: '4px',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                letterSpacing: '-1px',
            }}>
                {value}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            {sub && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '3px' }}>{sub}</div>}
        </div>
    </div>
);

// ─── Glowing Status Dot ───────────────────────────────────────────────────────

const statusInfo = (s: string) => {
    if (s === 'online') return { color: '#34D399', glow: '0 0 8px #34D399, 0 0 20px rgba(52,211,153,0.3)', label: '✓' };
    if (s === 'offline') return { color: '#F87171', glow: '0 0 6px rgba(248,113,113,0.4)', label: '✗' };
    return { color: '#6B7280', glow: 'none', label: '?' };
};

const ModelStatusChip: React.FC<{ m: ModelStatus }> = ({ m }) => {
    const info = statusInfo(m.status);
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 14px',
            borderRadius: radius.md,
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '12px',
            opacity: m.enabled ? 1 : 0.35,
            transition: 'all 0.2s',
            cursor: 'default',
        }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            title={m.testMsg || (m.status === 'online' ? '在线' : m.status === 'offline' ? '离线' : '未测试')}
        >
            <span
                className={m.status === 'online' ? 'dot-online' : undefined}
                style={{
                    display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                    background: info.color,
                    boxShadow: info.glow,
                    flexShrink: 0,
                }}
            />
            <span style={{
                fontWeight: 600, fontSize: '12px',
                color: providerColors[m.group] || 'var(--vscode-editor-foreground)',
            }}>
                {m.group === 'cli' ? m.label : (m.group?.split(' ')[0] || m.modelId)}
            </span>
            <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '11px', opacity: 0.7 }}>
                {m.group === 'cli' ? (m.testMsg || '') : m.label?.split(' ').slice(0, 2).join(' ')}
            </span>
        </div>
    );
};

// ─── Activity Row ─────────────────────────────────────────────────────────────

const ActivityRow: React.FC<{ r: any; lang: Lang }> = ({ r, lang }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 12px',
        borderRadius: radius.sm,
        background: 'rgba(255,255,255,0.02)',
        borderLeft: `3px solid ${r.status === 'success' ? '#34D399' : '#F87171'}`,
        fontSize: '12px',
        transition: 'background 0.15s',
    }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
    >
        <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '11px', minWidth: '44px', fontFamily: 'monospace' }}>
            {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '20px', height: '20px', borderRadius: '50%',
            background: r.status === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
            color: r.status === 'success' ? '#34D399' : '#F87171',
            fontSize: '10px', fontWeight: 700, flexShrink: 0,
        }}>
            {r.status === 'success' ? '✓' : '✗'}
        </span>
        <span style={{
            fontWeight: 600, minWidth: '70px', fontSize: '12px',
            color: 'var(--vscode-editor-foreground)',
        }}>
            {r.model || 'unknown'}
        </span>
        <span style={{ flex: 1, color: 'var(--vscode-descriptionForeground)', fontSize: '11px', fontFamily: 'monospace', opacity: 0.7 }}>
            {r.method}
        </span>
        <span style={{
            padding: '2px 8px', borderRadius: radius.pill, fontSize: '10px', fontFamily: 'monospace', fontWeight: 600,
            background: r.duration < 3000 ? 'rgba(52,211,153,0.12)' : r.duration < 8000 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
            color: r.duration < 3000 ? '#34D399' : r.duration < 8000 ? '#FBBF24' : '#F87171',
        }}>
            {r.duration < 1000 ? `${r.duration}ms` : `${(r.duration / 1000).toFixed(1)}s`}
        </span>
        {r.totalTokens > 0 && (
            <span style={{
                padding: '2px 8px', borderRadius: radius.pill, fontSize: '10px', fontFamily: 'monospace',
                background: 'rgba(139,92,246,0.12)', color: '#A78BFA',
            }}>
                {r.totalTokens > 1000 ? `${(r.totalTokens / 1000).toFixed(1)}K` : r.totalTokens}
            </span>
        )}
    </div>
);

// ─── Section Header ───────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ icon: string; title: string; right?: React.ReactNode }> = ({ icon, title, right }) => (
    <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '14px',
    }}>
        <div style={{
            fontSize: '14px', fontWeight: 700, letterSpacing: '-0.2px',
            display: 'flex', alignItems: 'center', gap: '8px',
        }}>
            <span style={{ fontSize: '16px' }}>{icon}</span>
            {title}
        </div>
        {right && <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>{right}</div>}
    </div>
);

// ─── OverviewPanel ────────────────────────────────────────────────────────────

const OverviewPanel: React.FC<{ lang: Lang; onSwitchTab: (tab: string) => void }> = ({ lang, onSwitchTab }) => {
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [testingAll, setTestingAll] = useState(false);

    const hasAutoTriggered = React.useRef(false);

    useEffect(() => {
        const handler = (ev: MessageEvent) => {
            if (ev.data.command === 'overviewStats') {
                setStats(ev.data.stats);
                // Auto-trigger test once if no models are online (first load after reload)
                const models = ev.data.stats?.models || [];
                const apiModels = models.filter((m: any) => m.group !== 'cli');
                const onlineApi = apiModels.filter((m: any) => m.status === 'online').length;
                if (!hasAutoTriggered.current && onlineApi === 0 && apiModels.length > 0) {
                    hasAutoTriggered.current = true;
                    setTestingAll(true);
                    setTimeout(() => vscode.postMessage({ command: 'testAllModels' }), 1000);
                }
            }
            if (ev.data.command === 'testAllComplete') {
                setTestingAll(false);
                // Refresh stats to pick up new test results from the cache
                vscode.postMessage({ command: 'getOverviewStats' });
            }
            // Listen to individual test results and update model status in real-time
            if (ev.data.command === 'testResult' && ev.data.requestId?.startsWith('autotest_')) {
                const parts = ev.data.requestId.split('_');
                const configId = parts.slice(1, -1).join('_');
                setStats(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        models: prev.models.map(m =>
                            m.id === configId
                                ? { ...m, status: ev.data.ok ? 'online' : 'offline', testMsg: ev.data.msg }
                                : m
                        ),
                    };
                });
            }
        };
        window.addEventListener('message', handler);
        vscode.postMessage({ command: 'getOverviewStats' });

        const timer = setInterval(() => {
            vscode.postMessage({ command: 'getOverviewStats' });
        }, 30000);

        return () => {
            window.removeEventListener('message', handler);
            clearInterval(timer);
        };
    }, []);

    const T = {
        en: {
            models: 'MODELS', requests: 'REQUESTS', latency: 'LATENCY', tokens: 'TOKENS',
            online: 'online', today: 'today', modelStatus: 'System Status',
            recentActivity: 'Live Activity', quickActions: 'Quick Actions',
            testAll: '🔄 Test All Connections', addModel: '+ Add Model', viewHistory: '📊 View History',
            noModels: 'No models configured yet. Add your first model to get started.',
            noActivity: 'No recent activity. Make an API call to see it here.',
            success: 'success',
        },
        zh: {
            models: '模型', requests: '请求', latency: '延迟', tokens: 'TOKEN',
            online: '在线', today: '今日', modelStatus: '系统状态',
            recentActivity: '实时动态', quickActions: '快速操作',
            testAll: '🔄 一键全部测试', addModel: '+ 添加模型', viewHistory: '📊 查看历史',
            noModels: '尚未配置任何模型，点击下方按钮开始添加。',
            noActivity: '暂无近期调用，发起一次 API 请求后将显示。',
            success: '成功',
        },
    }[lang];

    if (!stats) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="shimmer-bar" style={{ width: '200px', height: '4px', borderRadius: '2px', marginBottom: '12px' }} />
                    <span style={{ fontSize: '13px', color: 'var(--vscode-descriptionForeground)' }}>
                        {lang === 'zh' ? '加载仪表盘…' : 'Loading dashboard…'}
                    </span>
                </div>
            </div>
        );
    }

    const onlineCount = stats.models.filter(m => m.status === 'online').length;
    const totalEnabled = stats.models.filter(m => m.enabled).length;

    return (
        <div style={{ maxWidth: '860px' }}>
            {/* ── Gradient Stat Cards ─────────────────────────────── */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <StatCard
                    icon="🟢" label={T.models}
                    value={`${onlineCount}/${totalEnabled}`}
                    sub={T.online}
                    gradient={CARD_GRADIENTS[0]} delay={1}
                />
                <StatCard
                    icon="📡" label={T.requests}
                    value={stats.todayRequests || '0'}
                    sub={`${T.today} · ${stats.successRate}% ${T.success}`}
                    gradient={CARD_GRADIENTS[1]} delay={2}
                />
                <StatCard
                    icon="⚡" label={T.latency}
                    value={stats.avgLatency > 0 ? `${(stats.avgLatency / 1000).toFixed(1)}s` : '—'}
                    sub={T.today}
                    gradient={CARD_GRADIENTS[2]} delay={3}
                />
                <StatCard
                    icon="💎" label={T.tokens}
                    value={stats.totalTokens > 1000 ? `${(stats.totalTokens / 1000).toFixed(1)}K` : (stats.totalTokens || '—')}
                    sub={T.today}
                    gradient={CARD_GRADIENTS[3]} delay={4}
                />
            </div>

            {/* ── Model Status Matrix ────────────────────────────── */}
            <div className="animate-in" style={{
                padding: '20px',
                borderRadius: radius.lg,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: '16px',
                backdropFilter: 'blur(12px)',
            }}>
                <SectionHeader
                    icon="🔮"
                    title={T.modelStatus}
                    right={<span>{onlineCount}/{totalEnabled} {T.online}</span>}
                />
                {stats.models.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {stats.models.filter(m => m.enabled).map(m => (
                            <ModelStatusChip key={m.id} m={m} />
                        ))}
                        {stats.models.filter(m => !m.enabled).length > 0 && (
                            <div style={{
                                fontSize: '11px', color: 'var(--vscode-descriptionForeground)',
                                padding: '8px 14px', alignSelf: 'center', opacity: 0.5,
                            }}>
                                +{stats.models.filter(m => !m.enabled).length} {lang === 'zh' ? '已禁用' : 'disabled'}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{
                        textAlign: 'center', padding: '30px',
                        color: 'var(--vscode-descriptionForeground)', fontSize: '13px',
                    }}>
                        <span style={{ fontSize: '36px', display: 'block', marginBottom: '10px', opacity: 0.3 }}>🔌</span>
                        {T.noModels}
                    </div>
                )}
            </div>

            {/* ── Recent Activity ─────────────────────────────────── */}
            <div className="animate-in" style={{
                padding: '20px',
                borderRadius: radius.lg,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: '20px',
                backdropFilter: 'blur(12px)',
            }}>
                <SectionHeader icon="⚡" title={T.recentActivity} />
                {stats.recentRequests.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {stats.recentRequests.slice(0, 8).map(r => (
                            <ActivityRow key={r.id} r={r} lang={lang} />
                        ))}
                    </div>
                ) : (
                    <div style={{
                        textAlign: 'center', padding: '24px',
                        color: 'var(--vscode-descriptionForeground)', fontSize: '12px',
                    }}>
                        <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px', opacity: 0.3 }}>📭</span>
                        {T.noActivity}
                    </div>
                )}
            </div>

            {/* ── Quick Actions ────────────────────────────────────── */}
            <div className="animate-in" style={{
                display: 'flex', gap: '10px', justifyContent: 'center',
                flexWrap: 'wrap', padding: '8px 0',
            }}>
                <button
                    style={{
                        padding: '10px 24px',
                        background: testingAll ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: radius.pill,
                        cursor: testingAll ? 'wait' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        boxShadow: testingAll ? 'none' : '0 4px 16px rgba(99,102,241,0.35)',
                        transition: 'all 0.2s',
                        opacity: testingAll ? 0.5 : 1,
                    }}
                    disabled={testingAll}
                    onClick={() => {
                        setTestingAll(true);
                        vscode.postMessage({ command: 'testAllModels' });
                    }}
                    onMouseEnter={e => { if (!testingAll) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
                >
                    {testingAll ? (lang === 'zh' ? '⏳ 正在测试…' : '⏳ Testing…') : T.testAll}
                </button>
                <button
                    style={{
                        padding: '10px 20px',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--vscode-editor-foreground)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: radius.pill,
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                        backdropFilter: 'blur(8px)',
                    }}
                    onClick={() => onSwitchTab('config')}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = ''; }}
                >
                    {T.addModel}
                </button>
                <button
                    style={{
                        padding: '10px 20px',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--vscode-editor-foreground)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: radius.pill,
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                        backdropFilter: 'blur(8px)',
                    }}
                    onClick={() => onSwitchTab('history')}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = ''; }}
                >
                    {T.viewHistory}
                </button>
            </div>
        </div>
    );
};

export default OverviewPanel;
