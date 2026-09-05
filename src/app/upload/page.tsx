'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import AppShell, { useToast } from '../components/AppShell';

type UploadMode = 'merge' | 'replace';
type UploadStage = 'idle' | 'preview' | 'uploading' | 'complete';

interface PreviewData {
  headers: string[];
  rows: string[][];
  totalRows: number;
  fileName: string;
  fileSize: number;
  fileType: 'csv' | 'json';
}

interface UploadResult {
  success: boolean;
  upload: {
    inserted: number;
    skipped: number;
    totalRecordsInFile: number;
    mode: string;
    fileName: string;
  };
  database: {
    totalRecords: number;
  };
  reconciliation: {
    runId: string;
    matchRate: number;
    matched: number;
    unmatched: number;
    precision: number;
    recall: number;
    f1Score: number;
    exceptions: number;
  };
  message: string;
}

const KNOWN_COLUMNS = [
  'type', 'amount', 'amount_minor', 'currency', 'payment_id', 'order_id',
  'settlement_id', 'utr', 'method', 'status', 'event_time', 'date',
  'settlement_time', 'counterparty', 'merchant', 'description', 'source',
  'fee_minor', 'tax_minor', 'net_minor', 'refund_id', 'id'
];

function parseCSVPreview(text: string): PreviewData | null {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows: string[][] = [];
  for (let i = 1; i < Math.min(lines.length, 6); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    rows.push(parseCSVLine(line).map(v => v.trim()));
  }

  return {
    headers,
    rows,
    totalRows: lines.length - 1,
    fileName: '',
    fileSize: 0,
    fileType: 'csv'
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseJSONPreview(text: string): PreviewData | null {
  try {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : [data];
    if (arr.length === 0) return null;

    const headers = [...new Set(arr.flatMap(r => Object.keys(r)))];
    const rows = arr.slice(0, 5).map(r =>
      headers.map(h => {
        const v = r[h];
        return v === null || v === undefined ? '' : String(v);
      })
    );

    return {
      headers,
      rows,
      totalRows: arr.length,
      fileName: '',
      fileSize: 0,
      fileType: 'json'
    };
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function UploadContent() {
  const [stage, setStage] = useState<UploadStage>('idle');
  const [mode, setMode] = useState<UploadMode>('merge');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [templateData, setTemplateData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  // Fetch template data on mount
  useEffect(() => {
    fetch('/api/upload')
      .then(r => r.json())
      .then(d => { if (!d.error) setTemplateData(d); })
      .catch(() => {});
  }, []);

  const processFile = useCallback((f: File) => {
    setError(null);
    setResult(null);

    if (f.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.');
      return;
    }

    const ext = f.name.toLowerCase().split('.').pop();
    if (ext !== 'csv' && ext !== 'json') {
      setError('Unsupported file type. Please upload a .csv or .json file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      let previewData: PreviewData | null = null;

      if (ext === 'csv') {
        previewData = parseCSVPreview(text);
      } else {
        previewData = parseJSONPreview(text);
      }

      if (!previewData) {
        setError('Could not parse file. Please check the format.');
        return;
      }

      previewData.fileName = f.name;
      previewData.fileSize = f.size;
      setPreview(previewData);
      setFile(f);
      setStage('preview');
    };
    reader.readAsText(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = '';
  }, [processFile]);

  const handleUpload = async () => {
    if (!file) return;
    setStage('uploading');
    setUploadProgress(0);
    setError(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 90) { clearInterval(progressInterval); return 90; }
        return p + Math.random() * 15;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || 'Upload failed');
        setStage('preview');
        return;
      }

      setResult(data);
      setStage('complete');
      addToast(data.message, 'success');
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message || 'Upload failed');
      setStage('preview');
      addToast('Upload failed', 'error');
    }
  };

  const resetUpload = () => {
    setStage('idle');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setUploadProgress(0);
  };

  const downloadTemplate = (type: 'csv' | 'json') => {
    if (!templateData) return;
    let content: string;
    let filename: string;
    let mimeType: string;

    if (type === 'csv') {
      content = templateData.csvTemplate;
      filename = 'razorrecon_template.csv';
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(templateData.jsonTemplate, null, 2);
      filename = 'razorrecon_template.json';
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    addToast(`Downloaded ${filename}`, 'info');
  };

  const getColumnStatus = (header: string) => {
    const normalized = header.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (KNOWN_COLUMNS.includes(normalized)) return 'mapped';
    // Check fuzzy matches
    if (normalized.includes('amount') || normalized.includes('amt')) return 'mapped';
    if (normalized.includes('pay') || normalized.includes('transaction')) return 'mapped';
    if (normalized.includes('date') || normalized.includes('time')) return 'mapped';
    if (normalized.includes('merchant') || normalized.includes('vendor')) return 'mapped';
    return 'unmapped';
  };

  return (
    <>
      <div className="section-header">
        <div>
          <h2 className="section-title">Upload Your Data</h2>
          <div className="section-subtitle">Import your own transactions (CSV or JSON) and run the reconciliation engine</div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12, color: '#fca5a5'
        }}>
          <span style={{ fontSize: 20 }}>⚠</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Upload Error</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{error}</div>
          </div>
          <button onClick={() => setError(null)} style={{
            marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5',
            cursor: 'pointer', fontSize: 18, padding: '4px 8px'
          }}>✕</button>
        </div>
      )}

      {/* Stage: Idle — Drop Zone */}
      {stage === 'idle' && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? 'var(--accent-blue)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '80px 40px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              background: isDragging ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.01)',
              transform: isDragging ? 'scale(1.01)' : 'scale(1)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Animated border gradient on drag */}
            {isDragging && (
              <div style={{
                position: 'absolute', inset: -2, borderRadius: 'inherit',
                background: 'conic-gradient(from 0deg, transparent, var(--accent-blue), transparent, var(--accent-cyan), transparent)',
                animation: 'spin 3s linear infinite', opacity: 0.4
              }} />
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', margin: '0 auto 24px',
                background: isDragging
                  ? 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(6,182,212,0.2))'
                  : 'rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s ease',
                border: `1px solid ${isDragging ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={isDragging ? 'var(--accent-blue)' : 'var(--text-muted)'}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: 'all 0.3s', transform: isDragging ? 'translateY(-4px)' : 'none' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3 style={{
                fontSize: 22, fontWeight: 700, marginBottom: 8,
                color: isDragging ? 'var(--accent-blue)' : 'var(--text-primary)',
                transition: 'color 0.3s'
              }}>
                {isDragging ? 'Drop your file here' : 'Drag & drop your file'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                Supports <strong style={{ color: 'var(--accent-green)' }}>.csv</strong> and <strong style={{ color: 'var(--accent-blue)' }}>.json</strong> files up to 5MB
                <br />
                <span style={{ fontSize: 12 }}>or click to browse</span>
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <span className="badge badge-info" style={{ fontSize: 11, padding: '4px 12px' }}>Payments</span>
                <span className="badge badge-success" style={{ fontSize: 11, padding: '4px 12px' }}>Settlements</span>
                <span className="badge badge-warning" style={{ fontSize: 11, padding: '4px 12px' }}>Refunds</span>
                <span className="badge badge-purple" style={{ fontSize: 11, padding: '4px 12px' }}>Bank Entries</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {/* Mode Selector + Templates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
            {/* Upload Mode */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
                📋 Upload Mode
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s',
                  background: mode === 'merge' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${mode === 'merge' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`
                }}>
                  <input type="radio" name="mode" value="merge" checked={mode === 'merge'}
                    onChange={() => setMode('merge')}
                    style={{ marginTop: 3, accentColor: 'var(--accent-green)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      Merge with existing data
                      <span className="badge badge-success" style={{ marginLeft: 8, fontSize: 10 }}>Recommended</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Your uploaded records are added to the existing synthetic data. The reconciliation engine runs on the combined dataset.
                    </div>
                  </div>
                </label>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s',
                  background: mode === 'replace' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${mode === 'replace' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`
                }}>
                  <input type="radio" name="mode" value="replace" checked={mode === 'replace'}
                    onChange={() => setMode('replace')}
                    style={{ marginTop: 3, accentColor: 'var(--accent-red)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      Replace all data
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Wipes existing data and replaces with your upload only. Use if you want a clean slate with your own data.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Download Templates */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
                📥 Download Templates
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                Not sure about the format? Download a sample file, fill it with your data, and upload.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" onClick={() => downloadTemplate('csv')}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  CSV Template
                </button>
                <button className="btn btn-outline" onClick={() => downloadTemplate('json')}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  JSON Template
                </button>
              </div>
              {templateData?.fields && (
                <div style={{ marginTop: 16, padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                    <strong style={{ color: 'var(--accent-green)' }}>Required:</strong> {templateData.fields.required.join(', ')}
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                    <strong style={{ color: 'var(--accent-blue)' }}>Recommended:</strong> {templateData.fields.recommended.join(', ')}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Optional:</strong> {templateData.fields.optional.join(', ')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* How It Works */}
          <div className="card" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
              ⚡ How It Works
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              {[
                { step: '1', icon: '📁', title: 'Upload', desc: 'Drop your CSV or JSON file with payment/settlement data' },
                { step: '2', icon: '🔍', title: 'Preview', desc: 'Review parsed columns and confirm the data looks correct' },
                { step: '3', icon: '⚙️', title: 'Process', desc: 'Data is validated, normalized, and inserted into your database' },
                { step: '4', icon: '🎯', title: 'Reconcile', desc: '7-layer engine matches transactions and reports results' },
              ].map(s => (
                <div key={s.step} style={{
                  textAlign: 'center', padding: '20px 16px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    width: 20, height: 20, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                    background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{s.step}</div>
                  <div style={{ fontSize: 32, marginBottom: 12, marginTop: 4 }}>{s.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Stage: Preview */}
      {stage === 'preview' && preview && (
        <>
          {/* File Info Bar */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-md)',
                  background: preview.fileType === 'csv'
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))'
                    : 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${preview.fileType === 'csv' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)'}`
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: preview.fileType === 'csv' ? 'var(--accent-green)' : 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {preview.fileType}
                  </span>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{preview.fileName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatBytes(preview.fileSize)} · {preview.totalRows.toLocaleString()} records · {preview.headers.length} columns
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className={`badge ${mode === 'merge' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 12, padding: '5px 12px' }}>
                  {mode === 'merge' ? '➕ Merge Mode' : '🔄 Replace Mode'}
                </span>
                <button className="btn btn-outline" onClick={resetUpload} style={{ padding: '8px 16px' }}>
                  ← Change File
                </button>
              </div>
            </div>
          </div>

          {/* Column Mapping */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Column Mapping</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Auto-detected columns from your file. Green = recognized, gray = will be ignored.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {preview.headers.map((h, i) => {
                const status = getColumnStatus(h);
                return (
                  <span key={i} style={{
                    padding: '6px 14px', borderRadius: '100px', fontSize: 12, fontWeight: 600,
                    background: status === 'mapped' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${status === 'mapped' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    color: status === 'mapped' ? '#6ee7b7' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    {status === 'mapped' ? '✓' : '○'} {h}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Data Preview Table */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
              Data Preview
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                First {preview.rows.length} of {preview.totalRows.toLocaleString()} rows
              </span>
            </h3>
            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{
                      padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)',
                      borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 600,
                      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', 
                      position: 'sticky', top: 0, background: 'var(--bg-card)'
                    }}>#</th>
                    {preview.headers.map((h, i) => (
                      <th key={i} style={{
                        padding: '10px 12px', textAlign: 'left',
                        color: getColumnStatus(h) === 'mapped' ? 'var(--accent-green)' : 'var(--text-muted)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 600,
                        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                        whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--bg-card)'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, ri) => (
                    <tr key={ri} style={{ transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.03)', fontFamily: 'var(--font-mono)' }}>
                        {ri + 1}
                      </td>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{
                          padding: '10px 12px', color: 'var(--text-secondary)',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                          fontFamily: /^\d+(\.\d+)?$/.test(cell) ? 'var(--font-mono)' : 'inherit'
                        }} title={cell}>
                          {cell || <span style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upload Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button className="btn btn-outline" onClick={resetUpload} style={{ padding: '12px 24px' }}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleUpload} style={{
              padding: '12px 32px', fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {mode === 'merge' ? 'Merge' : 'Upload'} {preview.totalRows.toLocaleString()} Records
            </button>
          </div>
        </>
      )}

      {/* Stage: Uploading */}
      {stage === 'uploading' && (
        <div className="card" style={{ textAlign: 'center', padding: '80px 40px' }}>
          <div style={{
            width: 80, height: 80, margin: '0 auto 32px', position: 'relative'
          }}>
            <svg viewBox="0 0 100 100" style={{ width: 80, height: 80, transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#progress-grad)" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - uploadProgress / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}
              />
              <defs>
                <linearGradient id="progress-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent-blue)" />
                  <stop offset="100%" stopColor="var(--accent-cyan)" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)'
            }}>
              {Math.round(uploadProgress)}%
            </div>
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            {uploadProgress < 50 ? 'Uploading data...' : uploadProgress < 90 ? 'Processing records...' : 'Running reconciliation...'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {preview?.totalRows.toLocaleString()} records from {preview?.fileName}
          </p>
        </div>
      )}

      {/* Stage: Complete */}
      {stage === 'complete' && result && (
        <>
          {/* Success Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.06))',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 'var(--radius-lg)', padding: '32px', marginBottom: 24,
            textAlign: 'center'
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
              background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
              Upload Complete!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 500, margin: '0 auto' }}>
              {result.message}
            </p>
          </div>

          {/* Result KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="kpi-card">
              <div className="kpi-label">Records Imported</div>
              <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>{result.upload.inserted}</div>
              <div className="kpi-sub">{result.upload.skipped > 0 ? `${result.upload.skipped} skipped` : 'All records valid'}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total in Database</div>
              <div className="kpi-value" style={{ color: 'var(--accent-blue)' }}>{result.database.totalRecords}</div>
              <div className="kpi-sub">{result.upload.mode === 'merge' ? 'Including synthetic data' : 'Your data only'}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Match Rate</div>
              <div className="kpi-value" style={{ color: result.reconciliation.matchRate > 70 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                {result.reconciliation.matchRate}%
              </div>
              <div className="kpi-sub">{result.reconciliation.matched} matched · {result.reconciliation.unmatched} unmatched</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Exceptions Found</div>
              <div className="kpi-value" style={{ color: result.reconciliation.exceptions > 0 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                {result.reconciliation.exceptions}
              </div>
              <div className="kpi-sub">Requiring review</div>
            </div>
          </div>

          {/* Reconciliation Details */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
              🎯 Reconciliation Results
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Precision</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                  {result.reconciliation.precision}%
                </div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Recall</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                  {result.reconciliation.recall}%
                </div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>F1 Score</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>
                  {result.reconciliation.f1Score}%
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => window.location.href = '/'}>
              📊 Go to Dashboard
            </button>
            <button className="btn btn-secondary" onClick={() => window.location.href = '/reconciliation'}>
              🔍 View Reconciliation
            </button>
            <button className="btn btn-secondary" onClick={() => window.location.href = '/exceptions'}>
              ⚠ View Exceptions
            </button>
            <button className="btn btn-outline" onClick={resetUpload}>
              📤 Upload More Data
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

export default function UploadPage() {
  return <AppShell currentPath="/upload" title="Upload Data"><UploadContent /></AppShell>;
}
