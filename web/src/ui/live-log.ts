import {LitElement, html, css} from 'lit';

const ROW_H = 18;        // 每行像素高度（要與樣式一致）
const MAX_LINES = 500;

export class LiveLog extends LitElement {
  static styles = css`
    .wrap {
      max-height: 480px;
      overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px; line-height: 18px;
      border-radius: 8px;
    }
    .muted { color: var(--muted, #9aa4b2); margin-bottom: 4px; }
    .spacer { height: 0px; }
    .row { height: ${ROW_H}px; border-bottom: 1px dashed rgba(255,255,255,0.05); padding: 0 0; }
  `;

  private lines: string[] = [];
  private filter = '';
  private scrollTop = 0;

  setFilter(s: string) { this.filter = s; this.requestUpdate(); }

  addLine(s: string) {
    this.lines.push(s);
    if (this.lines.length > MAX_LINES) this.lines.shift();
    this.requestUpdate();
    this.updateComplete.then(() => {
      const el = this.scrollEl();
      el.scrollTop = el.scrollHeight; // 追尾
    });
  }
  clear() { this.lines = []; this.requestUpdate(); }

  private scrollEl(): HTMLElement {
    return this.renderRoot.querySelector('.wrap') as HTMLElement;
  }

  private onScroll = (e: Event) => {
    this.scrollTop = (e.target as HTMLElement).scrollTop;
    this.requestUpdate();
  };

  render() {
    const view = this.filter ? this.lines.filter(l => l.includes(this.filter)) : this.lines;

    // 可視範圍計算
    const viewportH = 480;               // 與 CSS 的 max-height 對齊
    const totalH = view.length * ROW_H;
    const start = Math.max(0, Math.floor(this.scrollTop / ROW_H) - 10); // 上下各多渲染 10 行緩衝
    const visibleCount = Math.ceil(viewportH / ROW_H) + 20;
    const end = Math.min(view.length, start + visibleCount);

    const topSpacerH = start * ROW_H;
    const bottomSpacerH = Math.max(0, totalH - topSpacerH - (end - start) * ROW_H);

    return html`
      <div class="muted">Live logs (latest ${MAX_LINES})</div>
      <div class="wrap" @scroll=${this.onScroll}>
        <div class="spacer" style="height:${topSpacerH}px"></div>
        ${view.slice(start, end).map(l => html`<div class="row">${l}</div>`)}
        <div class="spacer" style="height:${bottomSpacerH}px"></div>
      </div>
    `;
  }
}
customElements.define('live-log', LiveLog);
