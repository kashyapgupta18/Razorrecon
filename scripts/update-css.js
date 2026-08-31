const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf8');

// Replace rgba whites with --rgb-glass and blacks with --rgb-shadow
css = css.replace(/rgba\(255,\s*255,\s*255,/g, 'rgba(var(--rgb-glass),');
css = css.replace(/rgba\(0,\s*0,\s*0,/g, 'rgba(var(--rgb-shadow),');

const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
if (rootMatch) {
  const themeVars = `/* Common structure vars */
:root {
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 24px;
  --radius-pill: 9999px;
  
  --font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  --sidebar-width: 270px;
  --sidebar-collapsed: 80px;
  --topbar-height: 64px;
  
  --transition-fast: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 350ms cubic-bezier(0.16, 1, 0.3, 1);
  --transition-slow: 600ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Default Theme (Dark) */
:root, [data-theme="dark"] {
  --rgb-glass: 255, 255, 255;
  --rgb-shadow: 0, 0, 0;
  
  --bg-primary: #040914;
  --bg-secondary: #0a1122;
  --bg-tertiary: #131b31;
  --bg-card: rgba(15, 23, 42, 0.45);
  --bg-card-hover: rgba(20, 30, 50, 0.65);
  --bg-glass: rgba(10, 17, 34, 0.55);
  
  --border: rgba(99, 179, 237, 0.15);
  --border-hover: rgba(99, 179, 237, 0.35);
  --border-glass: rgba(var(--rgb-glass), 0.07);
  
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  
  --accent-blue: #3b82f6;
  --accent-cyan: #06b6d4;
  --accent-green: #10b981;
  --accent-amber: #f59e0b;
  --accent-red: #ef4444;
  --accent-purple: #8b5cf6;
  --accent-pink: #ec4899;
  
  --gradient-primary: linear-gradient(135deg, #3b82f6, #06b6d4);
  --gradient-success: linear-gradient(135deg, #10b981, #06b6d4);
  --gradient-danger: linear-gradient(135deg, #ef4444, #ec4899);
  --gradient-card: linear-gradient(145deg, rgba(15, 23, 42, 0.6), rgba(8, 13, 26, 0.4));
  --gradient-border: linear-gradient(to right, rgba(59,130,246,0.5), rgba(6,182,212,0.5));
  
  --shadow-sm: 0 2px 8px rgba(var(--rgb-shadow), 0.4);
  --shadow-md: 0 8px 24px rgba(var(--rgb-shadow), 0.5);
  --shadow-lg: 0 16px 40px rgba(var(--rgb-shadow), 0.6);
  --shadow-glow-blue: 0 0 24px rgba(59,130,246,0.25);
  --shadow-glow-green: 0 0 24px rgba(16,185,129,0.25);
  --shadow-glow-red: 0 0 24px rgba(239,68,68,0.25);
}

/* Light Theme */
[data-theme="light"] {
  --rgb-glass: 0, 0, 0;
  --rgb-shadow: 0, 0, 0;
  
  --bg-primary: #f8fafc;
  --bg-secondary: #f1f5f9;
  --bg-tertiary: #e2e8f0;
  --bg-card: rgba(255, 255, 255, 0.7);
  --bg-card-hover: rgba(255, 255, 255, 0.9);
  --bg-glass: rgba(255, 255, 255, 0.6);
  
  --border: rgba(59, 130, 246, 0.2);
  --border-hover: rgba(59, 130, 246, 0.4);
  --border-glass: rgba(var(--rgb-glass), 0.08);
  
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  
  --accent-blue: #2563eb;
  --accent-cyan: #0891b2;
  --accent-green: #059669;
  --accent-amber: #d97706;
  --accent-red: #dc2626;
  --accent-purple: #7c3aed;
  --accent-pink: #db2777;
  
  --gradient-primary: linear-gradient(135deg, #2563eb, #0891b2);
  --gradient-success: linear-gradient(135deg, #059669, #0891b2);
  --gradient-danger: linear-gradient(135deg, #dc2626, #db2777);
  --gradient-card: linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(241, 245, 249, 0.7));
  --gradient-border: linear-gradient(to right, rgba(37,99,235,0.3), rgba(8,145,178,0.3));
  
  --shadow-sm: 0 2px 8px rgba(var(--rgb-shadow), 0.05);
  --shadow-md: 0 8px 24px rgba(var(--rgb-shadow), 0.08);
  --shadow-lg: 0 16px 40px rgba(var(--rgb-shadow), 0.12);
  --shadow-glow-blue: 0 0 24px rgba(37,99,235,0.15);
  --shadow-glow-green: 0 0 24px rgba(5,150,105,0.15);
  --shadow-glow-red: 0 0 24px rgba(220,38,38,0.15);
}

/* Cyberpunk Theme */
[data-theme="cyberpunk"] {
  --rgb-glass: 236, 72, 153;
  --rgb-shadow: 236, 72, 153;
  
  --bg-primary: #0a0014;
  --bg-secondary: #16002c;
  --bg-tertiary: #240046;
  --bg-card: rgba(36, 0, 70, 0.5);
  --bg-card-hover: rgba(60, 9, 108, 0.6);
  --bg-glass: rgba(16, 0, 43, 0.6);
  
  --border: rgba(236, 72, 153, 0.3);
  --border-hover: rgba(236, 72, 153, 0.6);
  --border-glass: rgba(236, 72, 153, 0.2);
  
  --text-primary: #fff;
  --text-secondary: #eab308;
  --text-muted: #d946ef;
  
  --accent-blue: #06b6d4;
  --accent-cyan: #eab308;
  --accent-green: #22c55e;
  --accent-amber: #f97316;
  --accent-red: #ef4444;
  --accent-purple: #ec4899;
  --accent-pink: #06b6d4;
  
  --gradient-primary: linear-gradient(135deg, #ec4899, #eab308);
  --gradient-success: linear-gradient(135deg, #22c55e, #06b6d4);
  --gradient-danger: linear-gradient(135deg, #ef4444, #ec4899);
  --gradient-card: linear-gradient(145deg, rgba(36, 0, 70, 0.7), rgba(10, 0, 20, 0.8));
  --gradient-border: linear-gradient(to right, rgba(236,72,153,0.5), rgba(234,179,8,0.5));
  
  --shadow-sm: 0 2px 8px rgba(var(--rgb-shadow), 0.2);
  --shadow-md: 0 8px 24px rgba(var(--rgb-shadow), 0.3);
  --shadow-lg: 0 16px 40px rgba(var(--rgb-shadow), 0.4);
  --shadow-glow-blue: 0 0 24px rgba(236,72,153,0.4);
  --shadow-glow-green: 0 0 24px rgba(34,197,94,0.3);
  --shadow-glow-red: 0 0 24px rgba(239,68,68,0.3);
}

/* Midnight Theme */
[data-theme="midnight"] {
  --rgb-glass: 148, 163, 184;
  --rgb-shadow: 2, 6, 23;
  
  --bg-primary: #020617;
  --bg-secondary: #0f172a;
  --bg-tertiary: #1e293b;
  --bg-card: rgba(15, 23, 42, 0.6);
  --bg-card-hover: rgba(30, 41, 59, 0.8);
  --bg-glass: rgba(2, 6, 23, 0.7);
  
  --border: rgba(20, 184, 166, 0.2);
  --border-hover: rgba(20, 184, 166, 0.4);
  --border-glass: rgba(148, 163, 184, 0.1);
  
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-muted: #64748b;
  
  --accent-blue: #3b82f6;
  --accent-cyan: #14b8a6;
  --accent-green: #10b981;
  --accent-amber: #f59e0b;
  --accent-red: #f43f5e;
  --accent-purple: #6366f1;
  --accent-pink: #d946ef;
  
  --gradient-primary: linear-gradient(135deg, #6366f1, #14b8a6);
  --gradient-success: linear-gradient(135deg, #10b981, #14b8a6);
  --gradient-danger: linear-gradient(135deg, #f43f5e, #d946ef);
  --gradient-card: linear-gradient(145deg, rgba(15,23,42,0.8), rgba(2,6,23,0.9));
  --gradient-border: linear-gradient(to right, rgba(99,102,241,0.5), rgba(20,184,166,0.5));
  
  --shadow-sm: 0 2px 8px rgba(var(--rgb-shadow), 0.6);
  --shadow-md: 0 8px 24px rgba(var(--rgb-shadow), 0.8);
  --shadow-lg: 0 16px 40px rgba(var(--rgb-shadow), 0.9);
  --shadow-glow-blue: 0 0 24px rgba(99,102,241,0.3);
  --shadow-glow-green: 0 0 24px rgba(16,185,129,0.3);
  --shadow-glow-red: 0 0 24px rgba(244,63,94,0.3);
}`;
  css = css.replace(rootMatch[0], themeVars);
  fs.writeFileSync('src/app/globals.css', css);
  console.log('Updated globals.css successfully!');
} else {
  console.error('Could not find :root block');
}
