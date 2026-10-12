import"./main-Bjk9bJOZ.js";const M=()=>document.documentElement.dataset.lang==="en"?"en":"zh",E=t=>t[M()],$={loss:{label:"total loss",digits:3,zero:!0},recon_acc:{label:"reconstruction accuracy",digits:3,domain:[0,1]},soft_mn:{label:"soft m/n compression ratio",digits:3},bp_std:{label:"boundary probability std",digits:3,domain:[0,.5]},bhead_gnorm:{label:"boundary-head gradient norm",digits:3,zero:!0},type_cjk:{label:"CJK boundary prior",digits:3,domain:[0,1]},type_utf8:{label:"UTF-8 boundary prior",digits:3,domain:[0,1]},type_op:{label:"operator boundary prior",digits:3,domain:[0,1]}},A={v2_seeds:{zh:"v2 A-class 用来证明可微边界和重建稳定性。当前曲线只绘制能追溯到原始 run.log 的 seed=123 / seed=999 点列，三种子聚合指标仍以归档 summary 为准。",en:"v2 A-class proves differentiable boundaries and reconstruction stability. The current curves plot only the seed=123 / seed=999 point series traceable to raw run.log files; three-seed aggregate metrics still follow the archived summary."},denoise_scan:{zh:"AB2 显示去噪比例 0.3 到 0.9 都能学会重建，但去噪越重，soft m/n 往往越高，说明模型倾向保留更多 latent unit 来降低任务难度。",en:"AB2 shows reconstruction is learnable at denoise ratios from 0.3 to 0.9, but heavier denoising tends to push soft m/n higher — the model prefers keeping more latent units to make the task easier."},compression_scan:{zh:"AB1 是训练动力学反例：提高 compression pressure 会让部分 target 出现 NaN，说明 v2 的压缩控制不是一个可随意调参的稳定旋钮。",en:"AB1 is a training-dynamics counterexample: raising compression pressure produces NaN at some targets, showing that v2's compression control is not a stable knob you can tune at will."}},z={mask_acc:{label:"mask accuracy",digits:4,higherBetter:!0},byte_ce:{label:"byte cross entropy",digits:4,higherBetter:!1},delta_acc_vs_byte:{label:"delta accuracy vs byte",digits:4,higherBetter:!0},delta_ce_vs_byte:{label:"delta CE vs byte",digits:4,higherBetter:!0}},c={group:"v2_seeds",metric:"loss",strictMetric:"mask_acc",payload:null},H=document.querySelector("[data-curve-chart]"),P=document.querySelector("[data-chart-legend]"),F=document.querySelector("[data-chart-title]"),S=document.querySelector("[data-chart-meta]"),N=document.querySelector("[data-group-note]"),J=document.querySelector("[data-run-table]"),O=document.querySelector("[data-strict-bars]"),R=document.querySelector("[data-strict-table]"),u=(t,e=3)=>t==null||Number.isNaN(Number(t))?"n/a":Number(t).toFixed(e),h=t=>String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[e]),U=()=>c.payload.runs.filter(t=>t.group===c.group&&!t.missing),k=(t,e)=>{const r=t?.[e];return typeof r=="number"&&Number.isFinite(r)?r:null},G=(t,e)=>{const r=$[e];if(r.domain)return r.domain;const n=t.flatMap(i=>i.points.map(d=>k(d,e)).filter(d=>d!==null));if(!n.length)return[0,1];let o=Math.min(...n),a=Math.max(...n);r.zero&&(o=0),o===a&&(o-=.5,a+=.5);const l=(a-o)*.08;return[o-l,a+l]},K=t=>{if(!t.length)return"";if(t.length===1)return`M ${t[0].x} ${t[0].y}`;let e=`M ${t[0].x.toFixed(2)} ${t[0].y.toFixed(2)}`;for(let n=1;n<t.length-1;n+=1){const o=(t[n].x+t[n+1].x)/2,a=(t[n].y+t[n+1].y)/2;e+=` Q ${t[n].x.toFixed(2)} ${t[n].y.toFixed(2)} ${o.toFixed(2)} ${a.toFixed(2)}`}const r=t[t.length-1];return e+=` L ${r.x.toFixed(2)} ${r.y.toFixed(2)}`,e},Q=(t,e,r,n)=>{const o=[];let a=[];return t.points.forEach(l=>{const i=k(l,e);if(i===null){a.length&&o.push(a),a=[];return}a.push({x:r(l.step),y:n(i),step:l.step,value:i})}),a.length&&o.push(a),o},x=()=>{if(!c.payload)return;const t=U(),e=c.metric,r=$[e],n=980,o=420,a={left:72,right:26,top:28,bottom:54},l=n-a.left-a.right,i=o-a.top-a.bottom,d=Math.max(...t.flatMap(s=>s.points.map(_=>_.step))),[p,b]=G(t,e),m=s=>a.left+s/d*l,y=s=>a.top+(1-(s-p)/(b-p))*i,T=[0,.25,.5,.75,1].map(s=>Math.round(d*s/100)*100),q=[0,.25,.5,.75,1].map(s=>p+(b-p)*s),w=[...T.map(s=>`
            <g class="chart-grid">
              <line x1="${m(s).toFixed(2)}" x2="${m(s).toFixed(2)}" y1="${a.top}" y2="${o-a.bottom}"></line>
              <text x="${m(s).toFixed(2)}" y="${o-18}" text-anchor="middle">${s>=1e3?`${Math.round(s/1e3)}k`:s}</text>
            </g>`),...q.map(s=>`
            <g class="chart-grid">
              <line x1="${a.left}" x2="${n-a.right}" y1="${y(s).toFixed(2)}" y2="${y(s).toFixed(2)}"></line>
              <text x="56" y="${(y(s)+4).toFixed(2)}" text-anchor="end">${u(s,r.digits)}</text>
            </g>`)].join(""),B=t.map(s=>{const C=Q(s,e,m,y).map(j=>`
            <path class="chart-line" d="${K(j)}" style="--line-color:${s.color}"></path>
          `).join(""),g=s.nanSteps?.[0],L=g?`
            <g class="chart-nan-marker">
              <line x1="${m(g).toFixed(2)}" x2="${m(g).toFixed(2)}" y1="${a.top}" y2="${o-a.bottom}"></line>
              <text x="${(m(g)+6).toFixed(2)}" y="${a.top+18}">NaN @ ${g}</text>
            </g>`:"";return`${C}${L}`}).join("");H.innerHTML=`
          <rect class="chart-frame" x="${a.left}" y="${a.top}" width="${l}" height="${i}" rx="6"></rect>
          ${w}
          ${B}
          <text class="chart-axis-label" x="${n/2}" y="${o-4}" text-anchor="middle">training step</text>
          <text class="chart-axis-label" x="18" y="${o/2}" text-anchor="middle" transform="rotate(-90 18 ${o/2})">${r.label}</text>
        `,F.textContent=r.label,S.textContent=`${t.length} runs · ${c.payload.meta.stepGrain}`,N.textContent=E(A[c.group]),P.innerHTML=t.map(s=>`
          <span><i style="background:${s.color}"></i>${h(s.label)} · ${s.pointCount} pts</span>
        `).join(""),W(t)},W=t=>{const e=t.map(r=>{const n=r.final||{},o=r.nanSteps?.length?`NaN starts @ ${r.nanSteps[0]}`:"stable log";return`
            <article>
              <span>${h(r.label)}</span>
              <strong>${u(n[c.metric],$[c.metric].digits)}</strong>
              <p>step ${n.step??"n/a"} · acc ${u(n.recon_acc)} · m/n ${u(n.soft_mn)} · bp_std ${u(n.bp_std)} · ${o}</p>
              <code>${h(r.sourcePath)}</code>
            </article>
          `}).join("");J.innerHTML=e},f=()=>{if(!c.payload)return;const t=[...c.payload.strictBackbone.rows],e=c.strictMetric,r=z[e],n=t.map(i=>Number(i[e])).filter(i=>Number.isFinite(i)),o=Math.min(0,...n),l=Math.max(...n)-o||1;O.innerHTML=t.map(i=>{const d=Number(i[e]),p=(Math.min(0,d)-o)/l*100,b=Math.abs(d)/l*100;return`
            <div class="bar-row ${(r.higherBetter?d===Math.max(...n):d===Math.min(...n))?"is-best":""}">
              <div>
                <span>${h(i.run)}</span>
                <strong>${u(d,r.digits)}</strong>
              </div>
              <div class="bar-track" aria-hidden="true">
                <i class="bar-zero" style="left:${(-o/l*100).toFixed(2)}%"></i>
                <b style="left:${p.toFixed(2)}%; width:${b.toFixed(2)}%"></b>
              </div>
            </div>
          `}).join(""),R.innerHTML=`
          <div role="row">
            <span role="columnheader">run</span>
            <span role="columnheader">mask acc / CE</span>
            <span role="columnheader">delta</span>
          </div>
          ${t.map(i=>`
            <div role="row">
              <span role="cell">${h(i.run)}</span>
              <span role="cell">mask_acc ${u(i.mask_acc,4)} · CE ${u(i.byte_ce,4)} · params ${Number(i.params).toLocaleString("en-US")}</span>
              <span role="cell">acc ${u(i.delta_acc_vs_byte,4)} · CE ${u(i.delta_ce_vs_byte,4)}</span>
            </div>
          `).join("")}
        `},v=(t,e,r)=>{document.querySelectorAll(t).forEach(n=>{n.classList.toggle("is-active",n.dataset[e]===r)})};document.querySelector("[data-group-controls]").addEventListener("click",t=>{const e=t.target.closest("button[data-group]");e&&(c.group=e.dataset.group,v("[data-group-controls] button","group",c.group),x())});document.querySelector("[data-metric-controls]").addEventListener("click",t=>{const e=t.target.closest("button[data-metric]");e&&(c.metric=e.dataset.metric,v("[data-metric-controls] button","metric",c.metric),x())});document.querySelector("[data-strict-controls]").addEventListener("click",t=>{const e=t.target.closest("button[data-strict-metric]");e&&(c.strictMetric=e.dataset.strictMetric,v("[data-strict-controls] button","strictMetric",c.strictMetric),f())});window.addEventListener("langchange",()=>{c.payload&&(x(),f())});fetch("/flued-training-curves.json").then(t=>{if(!t.ok)throw new Error(`HTTP ${t.status}`);return t.json()}).then(t=>{c.payload=t,x(),f()}).catch(t=>{F.textContent="data load failed",S.textContent=t.message,N.textContent=M()==="en"?"Failed to load the training-curve JSON; check public/flued-training-curves.json.":"训练曲线 JSON 未能加载，请检查 public/flued-training-curves.json。"});
