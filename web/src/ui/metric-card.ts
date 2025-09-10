import {LitElement, html, css} from 'lit';

export class MetricCard extends LitElement {
  static styles = css`
    .card { background: var(--card, #1b2130); border: 1px solid var(--border,#222836);
      border-radius: 12px; padding: 10px; }
    .label { color: var(--muted, #9aa4b2); font-size: 12px; }
    .value { font-size: 24px; font-weight: 600; margin-top: 6px; }
  `;
  static properties = { label: {type: String}, value: {type: String} };
  label = ''; value = '0';
  render() { return html`<div class="card"><div class="label">${this.label}</div><div class="value">${this.value}</div></div>`; }
}
customElements.define('metric-card', MetricCard);
