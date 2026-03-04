import React, { useState } from 'react';
import OverviewPanel from './OverviewPanel';
import ConfigPanel from './ConfigPanel';
import HistoryConsole from './HistoryConsole';
import RoutingGuidePanel from './RoutingGuidePanel';
import SkillPanel from './SkillPanel';
import TestPanel from './TestPanel';
import { colors, radius, s } from '../theme';
import { vscode } from '../vscode-api';

export type Lang = 'en' | 'zh';

const t = {
    en: {
        overview: '📊 Overview',
        settings: '⚙️ Models & Keys',
        history: '📡 History',
        guide: '🧭 Routing Guide',
        skill: '🤖 AI Skill',
        test: '🧪 Test',
        subtitle: 'AI Model Bridge — Smart routing for every task',
        github: '⭐ GitHub',
        docs: '📖 Docs',
        feedback: '📝 Feedback',
    },
    zh: {
        overview: '📊 概览',
        settings: '⚙️ 模型管理',
        history: '📡 调用历史',
        guide: '🧭 路由推荐',
        skill: '🤖 AI 调度',
        test: '🧪 测试',
        subtitle: 'AI 模型网关 — 智能路由，按需分配',
        github: '⭐ GitHub',
        docs: '📖 文档',
        feedback: '📝 反馈',
    }
};

const Dashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'history' | 'guide' | 'skill' | 'test'>('overview');
    const [lang, setLang] = useState<Lang>('zh');

    // Read logo URI passed from extension host via data attribute
    const logoUri = document.getElementById('root')?.getAttribute('data-logo-uri') || '';

    const langBtnStyle = (active: boolean): React.CSSProperties => ({
        padding: '3px 10px',
        borderRadius: radius.pill,
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: active ? '600' : '400',
        background: active ? 'var(--vscode-badge-background)' : 'transparent',
        color: active ? 'var(--vscode-badge-foreground)' : 'var(--vscode-descriptionForeground)',
        border: '1px solid transparent',
        userSelect: 'none',
        transition: 'all 0.15s',
    });

    const footerBtnStyle: React.CSSProperties = {
        padding: '6px 14px',
        borderRadius: radius.pill,
        border: '1px solid var(--vscode-input-border)',
        background: 'transparent',
        color: 'var(--vscode-descriptionForeground)',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'all 0.15s',
    };

    return (
        <div style={{
            height: '100%', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column',
            background: 'var(--vscode-editor-background)',
        }}>
            {/* ── Brand Header ─────────────────────────────────────────────── */}
            <div style={{
                padding: '18px 24px 0',
                borderBottom: '1px solid var(--vscode-panel-border)',
            }}>
                {/* Top row: brand + language toggle */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: '4px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {logoUri && (
                            <img src={logoUri} alt="L-Hub" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                        )}
                        <h1 style={{
                            margin: 0, fontSize: '18px', fontWeight: 700,
                            letterSpacing: '-0.3px',
                        }}>
                            L-HUB
                        </h1>
                        <span style={{
                            fontSize: '12px', color: 'var(--vscode-descriptionForeground)',
                            fontWeight: 400,
                        }}>
                            {t[lang].subtitle}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span onClick={() => setLang('en')} style={langBtnStyle(lang === 'en')}>EN</span>
                        <span onClick={() => setLang('zh')} style={langBtnStyle(lang === 'zh')}>中文</span>
                    </div>
                </div>

                {/* Pill Tabs */}
                <div style={{
                    display: 'flex', gap: '6px',
                    padding: '10px 0 12px',
                }}>
                    <span onClick={() => setActiveTab('overview')} style={s.pillTab(activeTab === 'overview')}>
                        {t[lang].overview}
                    </span>
                    <span onClick={() => setActiveTab('config')} style={s.pillTab(activeTab === 'config')}>
                        {t[lang].settings}
                    </span>
                    <span onClick={() => setActiveTab('history')} style={s.pillTab(activeTab === 'history')}>
                        {t[lang].history}
                    </span>
                    <span onClick={() => setActiveTab('guide')} style={s.pillTab(activeTab === 'guide')}>
                        {t[lang].guide}
                    </span>
                    <span onClick={() => setActiveTab('skill')} style={s.pillTab(activeTab === 'skill')}>
                        {t[lang].skill}
                    </span>
                    <span onClick={() => setActiveTab('test')} style={s.pillTab(activeTab === 'test')}>
                        {t[lang].test}
                    </span>
                </div>
            </div>

            {/* ── Content Area ─────────────────────────────────────────────── */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                {activeTab === 'overview' && <OverviewPanel lang={lang} onSwitchTab={(tab) => setActiveTab(tab as any)} />}
                {activeTab === 'config' && <ConfigPanel lang={lang} />}
                {activeTab === 'history' && <HistoryConsole lang={lang} />}
                {activeTab === 'guide' && <RoutingGuidePanel lang={lang} />}
                {activeTab === 'skill' && <SkillPanel lang={lang} />}
                {activeTab === 'test' && <TestPanel lang={lang} />}
            </div>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <div style={{
                padding: '10px 24px',
                borderTop: '1px solid var(--vscode-panel-border)',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
                background: 'var(--vscode-sideBar-background)',
            }}>
                <span style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginRight: '4px' }}>
                    {lang === 'zh' ? '觉得好用？' : 'Like it?'}
                </span>
                <button
                    style={{ ...footerBtnStyle, background: colors.brand, color: '#fff', border: 'none' }}
                    onClick={() => vscode.postMessage({ command: 'openUrl', url: 'https://github.com/readysteadyscience/L-Hub' })}
                >
                    {t[lang].github}
                </button>
                <button
                    style={footerBtnStyle}
                    onClick={() => vscode.postMessage({ command: 'openUrl', url: 'https://github.com/readysteadyscience/L-Hub/issues' })}
                >
                    {t[lang].feedback}
                </button>
                <button
                    style={footerBtnStyle}
                    onClick={() => vscode.postMessage({ command: 'openUrl', url: 'https://github.com/readysteadyscience/L-Hub#readme' })}
                >
                    {t[lang].docs}
                </button>
            </div>
        </div>
    );
};

export default Dashboard;
