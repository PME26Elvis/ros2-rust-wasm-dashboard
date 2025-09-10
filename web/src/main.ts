import './ui/status-pill';
import './ui/metric-card';
import './ui/live-log';
import './ui/mini-chart';
import './ui/topology';
import './ui/robot-map';   // ⬅ 新增

function parseHash(): Record<string,string> {
  const h = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const out: Record<string,string> = {};
  h.split('&').forEach(kv => {
    const [k,v] = kv.split('=');
    if (k && v) out[decodeURIComponent(k)] = decodeURIComponent(v);
  });
  return out;
}
const hash = parseHash();
const DEFAULT_WS = 'ws://localhost:8787/ws/chatter';
const WS_URL = hash.ws || localStorage.getItem('ws_url') || DEFAULT_WS;
const TOKEN = hash.token || localStorage.getItem('token') || '';

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let backoff = 1000;
const backoffMax = 10_000;

const recvKpi = document.getElementById('kpi-recv') as any;
const tpsKpi  = document.getElementById('kpi-tps') as any;
const bpsKpi  = document.getElementById('kpi-bps') as any;
const p95Kpi  = document.getElementById('kpi-p95') as any;
const statusText = document.getElementById('status-text')!;
const statusPill = document.querySelector('ros-status') as any;
const liveLog = document.querySelector('live-log') as any;
const miniChart = document.querySelector('mini-chart') as any;
const qosBox = document.getElementById('qos-box') as HTMLDivElement;
const filterInput = document.getElementById('filter') as HTMLInputElement;
const toastEl = document.getElementById('toast') as HTMLDivElement;
const robotMap = document.querySelector('robot-map') as any;

let bucketIdx = 0;
let countWindow: number[] = Array(30).fill(0);
let bytesWindow: number[] = Array(30).fill(0);
let latencySamples: number[] = [];
let msgsTotal = 0;

type Sample = { seq:number; send_ms:number; recv_ms:number; latency_ms:number; size_bytes:number; data:string; };
const samples: Sample[] = [];
const pushSample = (s: Sample) => { samples.push(s); if (samples.length > 1000) samples.shift(); };
const downloadCSV = () => {
  const header = 'seq,send_ms,recv_ms,latency_ms,size_bytes,data\n';
  const lines = samples.map(s =>
    [s.seq, s.send_ms, s.recv_ms, s.latency_ms, s.size_bytes, JSON.stringify(s.data)].join(',')
  ).join('\n');
  const blob = new Blob([header + lines], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'ros2_ws_samples.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
};

function toast(msg: string) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  setTimeout(()=>toastEl.classList.remove('show'), 3000);
}
function setConnected(ok: boolean) {
  statusPill?.setAttribute('state', ok ? 'connected' : 'disconnected');
  statusText.textContent = ok ? 'Connected' : 'Disconnected, auto-retrying…';
}
function buildWsUrl(): string {
  if (!TOKEN) return WS_URL;
  const u = new URL(WS_URL); u.searchParams.set('token', TOKEN); return u.toString();
}

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
        msgsTotal++; recvKpi.setAttribute('value', String(msgsTotal));
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
        liveLog.addLine(text);
        if (!Number.isNaN(seq) && !Number.isNaN(sendMs)) {
          pushSample({ seq, send_ms: sendMs, recv_ms: recvMs, latency_ms: latency, size_bytes: size, data: text });
        }
      }

      if (obj.type === 'robot') {
        // 直接餵地圖；ts/recv_ts 以 ms 計算
        const ms = Math.floor((obj.recv_ts || Date.now()/1000) * 1000);
        robotMap.addPoint(Number(obj.x), Number(obj.y), ms);
      }

    } catch (e) {
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

setInterval(() => {
  bucketIdx = (bucketIdx + 1) % 30;
  countWindow[bucketIdx] = 0;
  bytesWindow[bucketIdx] = 0;

  const totalCount = countWindow.reduce((a,b)=>a+b,0);
  const tps = totalCount / 30;
  const totalBytes = bytesWindow.reduce((a,b)=>a+b,0);
  const kbps = (totalBytes / 1024) / 30;

  tpsKpi.setAttribute('value', tps.toFixed(2));
  bpsKpi.setAttribute('value', kbps.toFixed(1));
  (miniChart as any).update(countWindow);

  if (latencySamples.length > 0) {
    const arr = latencySamples.slice().sort((a,b)=>a-b);
    const idx = Math.min(arr.length-1, Math.floor(0.95*(arr.length-1)));
    p95Kpi.setAttribute('value', String(arr[idx]));
  } else {
    p95Kpi.setAttribute('value', '--');
  }
}, 1000);

(document.getElementById('btn-reconnect') as HTMLButtonElement).onclick = () => { backoff = 1000; connect(); };
(document.getElementById('btn-clear') as HTMLButtonElement).onclick = () => { (liveLog as any).clear(); };
(document.getElementById('btn-download') as HTMLButtonElement).onclick = () => { downloadCSV(); };
filterInput.addEventListener('input', () => { (liveLog as any).setFilter(filterInput.value || ''); });

fetch('http://localhost:8787/qos').then(r => r.json()).then(q => {
  qosBox.textContent = `QoS: ${q.reliability}, ${q.durability}, ${q.history}(depth=${q.depth})`;
}).catch(()=> { qosBox.textContent = 'QoS: (unavailable)'; });

connect();
