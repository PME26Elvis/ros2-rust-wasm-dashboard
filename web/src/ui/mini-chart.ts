import {LitElement, html, css} from 'lit';

export class MiniChart extends LitElement {
  static styles = css`
    .title { color: var(--muted, #9aa4b2); font-size: 12px; margin-bottom: 6px; }
    canvas { width: 100%; height: 120px; display: block; }
  `;
  private data: number[] = Array(30).fill(0);
  private ctx?: CanvasRenderingContext2D;

  firstUpdated() {
    const canvas = this.renderRoot.querySelector('canvas') as HTMLCanvasElement;
    this.ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    this.draw();
    window.addEventListener('resize', () => {
      const d = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * d;
      canvas.height = canvas.clientHeight * d;
      this.draw();
    });
  }

  update(d: number[]) {
    this.data = d.slice();
    this.draw();
  }

  private draw() {
    const ctx = this.ctx; if (!ctx) return;
    const { width: W, height: H } = ctx.canvas;
    ctx.clearRect(0,0,W,H);

    // x 軸
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#8ea0b6';
    ctx.beginPath();
    ctx.moveTo(0, H-0.5); ctx.lineTo(W, H-0.5); ctx.stroke();
    ctx.globalAlpha = 1;

    const max = Math.max(1, ...this.data);
    const step = W / (this.data.length - 1);

    // 折線（使用主題 accent 色，確保深色背景可見）
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2ec4b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.data.forEach((v, i) => {
      const x = i * step;
      const y = H - (v / max) * (H - 8) - 4;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  render() { return html`<div class="title">Messages per second (last 30s)</div><canvas></canvas>`; }
}
customElements.define('mini-chart', MiniChart);
