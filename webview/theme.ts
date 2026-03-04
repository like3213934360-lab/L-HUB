import type React from 'react';

// ─── Design Tokens ────────────────────────────────────────────────────────────

export const colors = {
    brand: '#C8956C',           // Warm amber — primary brand accent
    brandLight: '#E8C9A8',      // Light amber for hover/backgrounds
    brandBg: 'rgba(200,149,108,0.08)', // Subtle brand tint for cards
    success: '#34A853',
    warning: '#FBBC04',
    error: '#EA4335',
    link: '#5B9BD5',
};

export const radius = {
    sm: '4px',
    md: '8px',
    lg: '12px',
    pill: '20px',
};

export const shadow = {
    card: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
    cardHover: '0 4px 12px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)',
    modal: '0 8px 32px rgba(0,0,0,0.18)',
};

// Provider brand colors
export const providerColors: Record<string, string> = {
    'DeepSeek': '#4A90D9',
    'GLM (智谱)': '#6B5CE7',
    'Qwen (通义)': '#E8740C',
    'MiniMax': '#D94B86',
    'Kimi K2': '#2AB5A0',
    'OpenAI': '#10A37F',
    'Anthropic (Claude)': '#CC785C',
    'Google (Gemini)': '#4285F4',
    'Mistral': '#FF6F00',
    'cli': '#38BDF8',
};

// ─── Shared Styles ────────────────────────────────────────────────────────────

export const s = {
    // ---------- Cards ----------
    card: {
        background: 'var(--vscode-editor-background)',
        borderRadius: radius.md,
        padding: '14px 16px',
        marginBottom: '10px',
        boxShadow: shadow.card,
        transition: 'box-shadow 0.2s, transform 0.2s',
        border: '1px solid var(--vscode-panel-border)',
    } as React.CSSProperties,

    cardHover: {
        boxShadow: shadow.cardHover,
        transform: 'translateY(-1px)',
    } as React.CSSProperties,

    // ---------- Inputs ----------
    input: {
        width: '100%',
        padding: '8px 12px',
        background: 'var(--vscode-input-background)',
        color: 'var(--vscode-input-foreground)',
        border: '1px solid var(--vscode-input-border)',
        borderRadius: radius.sm,
        boxSizing: 'border-box' as const,
        fontSize: '13px',
        outline: 'none',
        transition: 'border-color 0.15s',
    } as React.CSSProperties,

    select: {
        width: '100%',
        padding: '8px 12px',
        background: 'var(--vscode-input-background)',
        color: 'var(--vscode-input-foreground)',
        border: '1px solid var(--vscode-input-border)',
        borderRadius: radius.sm,
        boxSizing: 'border-box' as const,
        fontSize: '13px',
    } as React.CSSProperties,

    // ---------- Buttons ----------
    btnPrimary: {
        padding: '8px 18px',
        background: colors.brand,
        color: '#fff',
        border: 'none',
        borderRadius: radius.pill,
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600' as const,
        transition: 'background 0.15s, transform 0.1s',
    } as React.CSSProperties,

    btnSecondary: {
        padding: '7px 14px',
        background: 'transparent',
        color: 'var(--vscode-descriptionForeground)',
        border: '1px solid var(--vscode-input-border)',
        borderRadius: radius.pill,
        cursor: 'pointer',
        fontSize: '13px',
        transition: 'border-color 0.15s, color 0.15s',
    } as React.CSSProperties,

    // ---------- Text ----------
    label: {
        display: 'block',
        marginBottom: '6px',
        fontSize: '12px',
        fontWeight: '600' as const,
        color: 'var(--vscode-editor-foreground)',
    } as React.CSSProperties,

    hint: {
        margin: '4px 0 0',
        fontSize: '11px',
        color: 'var(--vscode-descriptionForeground)',
    } as React.CSSProperties,

    // ---------- Layout ----------
    sectionTitle: {
        margin: '0 0 4px',
        fontSize: '15px',
        fontWeight: '600' as const,
    } as React.CSSProperties,

    pillTab: (active: boolean): React.CSSProperties => ({
        padding: '6px 16px',
        borderRadius: radius.pill,
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: active ? '600' : '400',
        background: active ? colors.brand : 'transparent',
        color: active ? '#fff' : 'var(--vscode-descriptionForeground)',
        border: active ? 'none' : '1px solid transparent',
        transition: 'all 0.2s',
        userSelect: 'none' as const,
    }),
};
