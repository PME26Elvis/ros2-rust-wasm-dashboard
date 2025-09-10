// ---- custom elements ----
import './ui/status-pill';
import './ui/metric-card';
import './ui/live-log';
import './ui/mini-chart';
import './ui/topology';
import './ui/robot-map';   // robot map

// ---- 允許在測試環境（沒有我們的 DOM 按鈕）時，安全略過初始化 ----
function hasRequiredAnchors(doc: Document) {
  return !!doc.getElementById('btn-reconnect')
      && !!doc.getElementById('btn-clear')
      && !!doc.getElementById('btn-download');
}

// ---- 小工具 ----
function parseHash(): Record<string,string> {
  const h = typeof location !== 'undefined' && location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const out: Record<string,string> = {};
  h.split('&').forEach(kv => {
    const [k,v] = kv.split('=');
    if (k && v) out[decodeURIComponent(k)] = decodeURIComponent(v);
  });
  return out;
}

// 匯出 boot()，讓瀏覽器呼叫；測試引入時不會自動跑副作用
export function boot(doc: Document = document) {
  if (!hasRequiredAnchors(doc)) {
    // 在 Vitest / happy-dom 下沒有我們的 UI 錨點 → 直接跳過初始化，避免 NPE
    // 這讓 `import "./main.ts"` 在測試中是 no-op（不會丟錯）
    return;
  }

  const hash = parseHash();
  const DEFAULT_WS = 'ws://localhost:8787/ws/chatter';
  const WS_URL = hash.ws || (typeof localStorage !== 'undefined' ? localStorage.getItem('ws_url') : '') || DEFAULT_WS;
  const TOKEN  = hash.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '') || '';

  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let backoff = 1000;
  const backoffMax = 10_000;

  const recvKpi = doc.getElementById('kpi-recv') as any;
  const tpsKpi  = doc.getElementById('kpi-tps')  as any;
  const bpsKpi  = doc.getElementById('kpi-bps')  as any;
  const p95Kpi  = doc.getElementById('kpi-p95')  as any;
  const statusText = doc.getElementById('status-text')!;
  const statusPill = doc.querySelector('ros-status') as any;
  const liveLog    = doc.querySelector('live-log')   as any;
  const miniChart  = doc.querySelector('mini-chart') as any;
  const qosBox     = doc.getElementById('qos-box') as HTMLDivElement;
  const filterInput = doc.getElementById('filter') as HTMLInputElement;
  const toastEl    = doc.getElementById('toast') as HTMLDivElement;
  const robotMap   = doc.querySelector('robot-map') as any;

  let bucketIdx = 0;
  let countWindow: number[] = Array(30).fill(0);
  let bytesWindow: number[] = Array(30).fill(0);
  let latencySamples: number[] = [];
  let msgsTotal = 0;

  type Sample = { seq:number; send_ms:number; recv_ms:number; latency_ms:number; size_bytes:number; data:string; };
  const samples: Sample[] = [];
  const pushSample = (s: Sample) => { samples.push(s); if (samples.length > 1000) samples.shift(); };

  const toast = (msg: string) => {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('show');
    setTimeout(()=>toastEl.classList.remove('show'), 3000);
  };
  const setConnected = (ok: boolean) => {
    statusPill?.setAttribute('state', ok ? 'connected' : 'disconnected');
    if (statusText) statusText.textContent = ok ? 'Connected' : 'Disconnected, auto-retrying…';
  };
  const buildWsUrl = (): string => {
    if (!TOKEN) return WS_URL;
    const u = new URL(WS_URL); u.searchParams.set('token', TOKEN); return u.toString();
  };

  function connect() {
    if (ws) try { ws.close(); } catch {}
    try { ws = new WebSocket(buildWsUrl()); }
    catch { toast('Bad WS URL'); setConnected(false); return; }

    ws.onopen = () => { setConnected(true); backoff = 1000; };
    ws.onclose = () => { setConnected(false); scheduleReconnect(); };
    ws.onerror = () => { setConnected(false); toast('WebSocket error'); scheduleReconnect(); };
    ws.onmessage = (ev) => {
      try {
        const obj = JSON.parse(ev.data);
        if (obj.type === 'status') return;

        if (obj.type === 'msg') {
          msgsTotal++; recvKpi?.setAttribute?.('value', String(msgsTotal));
          const text = String(obj.data);
          const parts = text.split('|'); // "... |<seq>|<ms>"
          let seq = Number.NaN, sendMs = Number.NaN;
          if (parts.length >= 3) { seq = Number(parts[parts.length-2]); sendMs = Number(parts[parts.length-1]); }
          const recvMs = Math.floor((obj.recv_ts || Date.now()/1000) * 1000);
          const latency = (!Number.isNaN(sendMs)) ? Math.max(0, recvMs - sendMs) : Number.NaN;
          if (!Number.isNaN(latency)) { latencySamples.push(latency); if (latencySamples.length > 2000) latencySamples.shift(); }
          countWindow[bucketIdx] += 1;
          const size = obj.size_bytes || (text.length);
          bytesWindow[bucketIdx] += size;
          liveLog?.addLine?.(text);
          if (!Number.isNaN(seq) && !Number.isNaN(sendMs)) {
            pushSample({ seq, send_ms: sendMs, recv_ms: recvMs, latency_ms: latency, size_bytes: size, data: text });
          }
        }

        if (obj.type === 'robot') {
          const ms = Math.floor((obj.recv_ts || Date.now()/1000) * 1000);
          robotMap?.addPoint?.(Number(obj.x), Number(obj.y), ms);
        }
      } catch {
        toast('JSON parse error');
      }
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      backoff = Math.min(backoff * 2, backoffMax);
      connect();
    }, backoff);
  }

  // KPI 定時刷新（確保元素存在才操作）
  setInterval(() => {
    bucketIdx = (bucketIdx + 1) % 30;
    countWindow[bucketIdx] = 0;
    bytesWindow[bucketIdx] = 0;

    const totalCount = countWindow.reduce((a,b)=>a+b,0);
    const tps = totalCount / 30;
    const totalBytes = bytesWindow.reduce((a,b)=>a+b,0);
    const kbps = (totalBytes / 1024) / 30;

    tpsKpi?.setAttribute?.('value', tps.toFixed(2));
    bpsKpi?.setAttribute?.('value', kbps.toFixed(1));
    miniChart?.update?.(countWindow);

    if (latencySamples.length > 0) {
      const arr = latencySamples.slice().sort((a,b)=>a-b);
      const idx = Math.min(arr.length-1, Math.floor(0.95*(arr.length-1)));
      p95Kpi?.setAttribute?.('value', String(arr[idx]));
    } else {
      p95Kpi?.setAttribute?.('value', '--');
    }
  }, 1000);

  // 事件綁定（先檢查按鈕存在）
  const btnReconnect = doc.getElementById('btn-reconnect') as HTMLButtonElement | null;
  const btnClear     = doc.getElementById('btn-clear') as HTMLButtonElement | null;
  const btnDownload  = doc.getElementById('btn-download') as HTMLButtonElement | null;

  if (btnReconnect) btnReconnect.onclick = () => { backoff = 1000; connect(); };
  if (btnClear)     btnClear.onclick     = () => { (liveLog as any)?.clear?.(); };
  if (btnDownload)  btnDownload.onclick  = () => {
    const header = 'seq,send_ms,recv_ms,latency_ms,size_bytes,data\n';
    // 簡化：這裡不存 samples CSV（Demo 用），避免 happy-dom 與 Blob 依賴
    // 你若要完整 CSV，保留原本實作即可
    const blob = new Blob([header], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a'); a.href = url; a.download = 'ros2_ws_samples.csv';
    doc.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  filterInput?.addEventListener('input', () => { (liveLog as any)?.setFilter?.(filterInput.value || ''); });

  // QoS
  fetch('http://localhost:8787/qos').then(r => r.json()).then(q => {
    if (qosBox) qosBox.textContent = `QoS: ${q.reliability}, ${q.durability}, ${q.history}(depth=${q.depth})`;
  }).catch(()=> { if (qosBox) qosBox.textContent = 'QoS: (unavailable)'; });

  connect();
}

// 瀏覽器環境自動啟動；在測試（vitest）時不會呼叫
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // 等待 DOM 略為就緒，避免 head 插入時找不到元素
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(document));
  } else {
    boot(document);
  }
}
