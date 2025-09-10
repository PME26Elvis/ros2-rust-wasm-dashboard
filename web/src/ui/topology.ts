import {LitElement, html, css} from 'lit';

export class TopologyMini extends LitElement {
  static styles = css`
    .box{background:var(--card,#1b2130);border:1px solid var(--border,#222836);
      border-radius:12px;padding:10px;}
    .title{color:var(--muted,#9aa4b2);font-size:12px;margin-bottom:6px;}
    svg{width:100%;height:140px;display:block}
    .node{fill:#0f1724;stroke:#2b3345;stroke-width:1.2}
    .label{fill:#e6e9ef;font-size:12px}
    .topic{fill:#132030;stroke:#2b3345}
    .arrow{stroke:#8ea0b6;stroke-width:2;marker-end:url(#arrow)}
  `;
  render(){
    // 固定 demo： demo_pub → /chatter → ros2_ws_bridge
    return html`
    <div class="box">
      <div class="title">Topology (demo)</div>
      <svg viewBox="0 0 520 140" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3"
                  orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#8ea0b6"></path>
          </marker>
        </defs>

        <!-- nodes -->
        <rect class="node"  x="10"  y="40" width="140" height="48" rx="10"></rect>
        <text class="label" x="80"  y="68" text-anchor="middle">demo_pub</text>

        <rect class="topic" x="190" y="40" width="140" height="48" rx="10"></rect>
        <text class="label" x="260" y="68" text-anchor="middle">/chatter</text>

        <rect class="node"  x="370" y="40" width="140" height="48" rx="10"></rect>
        <text class="label" x="440" y="68" text-anchor="middle">ros2_ws_bridge</text>

        <!-- arrows -->
        <line class="arrow" x1="150" y1="64" x2="190" y2="64"></line>
        <line class="arrow" x1="330" y1="64" x2="370" y2="64"></line>
      </svg>
    </div>`;
  }
}
customElements.define('topology-mini', TopologyMini);
