import {LitElement, html, css} from 'lit';

export class StatusPill extends LitElement {
  static styles = css`
    :host { display: inline-flex; }
    .pill {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 10px; border-radius: 999px;
      background: var(--panel, #151922); border: 1px solid var(--border, #222836);
      color: var(--text, #e6e9ef); font-size: 13px;
    }
    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--ok, #22c55e);
    }
    :host([state="disconnected"]) .dot { background: var(--danger, #ff6b6b); }
  `;
  static properties = { state: {type: String, reflect: true} };
  state = 'disconnected';
  render() { return html`<span class="pill"><span class="dot"></span>${this.state}</span>`; }
}
customElements.define('ros-status', StatusPill);
