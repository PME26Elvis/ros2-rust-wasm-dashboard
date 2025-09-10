import {LitElement, html, css} from 'lit';

type Pt = { x:number; y:number; t:number };

export class RobotMap extends LitElement {
  static styles = css`
    .box{background:var(--card,#1b2130);border:1px solid var(--border,#222836);
      border-radius:12px;padding:10px;}
    .title{color:var(--muted,#9aa4b2);font-size:12px;margin-bottom:6px;}
    canvas{width:100%; height:260px; display:block; border-radius:8px; background:#0f141d;}
  `;

  private points: Pt[] = [];
  private lastDraw = 0;

  addPoint(x:number, y:number, ts:number){
    this.points.push({x,y,t:ts});
    const cutoff = ts - 30_000;
    this.points = this.points.filter(p => p.t >= cutoff);
    // 節流 30ms
    const now = performance.now();
    if (now - this.lastDraw > 30) { this.lastDraw = now; this.draw(); }
  }

  clear(){ this.points = []; this.draw(); }

  firstUpdated(){ this.draw(); }
  private getCanvas(): HTMLCanvasElement { return this.renderRoot.querySelector('canvas') as HTMLCanvasElement; }

  private draw(){
    const c = this.getCanvas(); if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth * dpr, h = c.clientHeight * dpr;
    if (c.width !== w || c.height !== h){ c.width = w; c.height = h; }
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0,0,w,h);

    // 座標轉換：世界 [-6,6]
    const world = {minX:-6, maxX:6, minY:-6, maxY:6};
    const sx = w / (world.maxX - world.minX);
    const sy = h / (world.maxY - world.minY);
    const toXY = (pt:Pt) => {
      const x = (pt.x - world.minX) * sx;
      const y = h - (pt.y - world.minY) * sy;
      return [x,y] as [number,number];
    };

    // 網格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(world.minX); gx <= Math.floor(world.maxX); gx++){
      const x = (gx - world.minX) * sx;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
    }
    for (let gy = Math.ceil(world.minY); gy <= Math.floor(world.maxY); gy++){
      const y = h - (gy - world.minY) * sy;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
    }

    // 30 秒軌跡
    if (this.points.length > 1){
      ctx.strokeStyle = 'rgba(46,196,182,0.5)'; // 淺綠藍
      ctx.lineWidth = 2;
      ctx.beginPath();
      let [x0,y0] = toXY(this.points[0]);
      ctx.moveTo(x0,y0);
      for (let i=1; i<this.points.length; i++){
        const [x,y] = toXY(this.points[i]);
        ctx.lineTo(x,y);
      }
      ctx.stroke();
    }

    // 當前位置
    const last = this.points[this.points.length-1];
    if (last){
      const [x,y] = toXY(last);
      ctx.fillStyle = '#3a86ff';
      ctx.beginPath(); ctx.arc(x,y, 6, 0, Math.PI*2); ctx.fill();
      // 十字
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.moveTo(x-10,y); ctx.lineTo(x+10,y); ctx.moveTo(x,y-10); ctx.lineTo(x,y+10); ctx.stroke();
    }
  }

  render(){
    return html`
      <div class="box">
        <div class="title">Robot map (last 30s)</div>
        <canvas></canvas>
      </div>
    `;
  }
}
customElements.define('robot-map', RobotMap);
