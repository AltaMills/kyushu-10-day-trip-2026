(() => {
  'use strict';
  const data = window.ITINERARY_DATA;
  if (!data) return;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt = n => typeof n === 'number' ? `¥${n.toLocaleString('en-US')}` : esc(n);
  const sourceMap = Object.fromEntries(data['来源链接'].map(r => [r[0], {title:r[1],url:r[2]}]));
  const sourceRefs = v => {
    if (/^https?:\/\//.test(String(v ?? ''))) return `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">官方页面 ↗</a>`;
    const ids = [...new Set((String(v ?? '').match(/S\d{2}/g) || []))];
    return ids.map(id => {
      const s = sourceMap[id];
      const url = s?.url;
      return /^https?:\/\//.test(url || '') ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}">${id} ↗</a>` : '';
    }).join('');
  };
  const sourceText = v => sourceRefs(v) ? `<p class="event-sources">来源：${sourceRefs(v)}</p>` : '';
  const details = (title, meta, content) => `<details><summary><span class="summary-main">${esc(title)}${meta ? `<span class="summary-meta">${esc(meta)}</span>` : ''}</span></summary><div class="detail-content">${content}</div></details>`;
  const dayRows = data['每日总览'];
  const entries = data['详细行程'];
  const shortDate = i => `10/${i+2}`;
  const jpDate = () => new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}).format(new Date());
  const dayIndex = (() => {
    const bits = jpDate().split('/').map(Number);
    return bits[2] === 2026 && bits[0] === 10 && bits[1] >= 2 && bits[1] <= 11 ? bits[1]-2 : -1;
  })();
  let active = (() => {
    const q = new URLSearchParams(location.search).get('day');
    const i = dayRows.findIndex(r => String(r[0]).startsWith(q + ' '));
    return q && i >= 0 ? i : dayIndex >= 0 ? dayIndex : 0;
  })();
  const place = r => String(r[1] || '').split('→').at(-1).replace('⇄','').trim();

  function showDay(i, focus = false) {
    active = i;
    const row = dayRows[i], date = shortDate(i);
    document.querySelectorAll('.day-tab').forEach((b,j) => {
      b.setAttribute('aria-selected', String(i === j));
      b.tabIndex = i === j ? 0 : -1;
    });
    const note = entries.filter(r => r[0] === date).map(r => {
      const time = String(r[1] || '');
      const status = /核实/.test(time) ? '核实' : /参考/.test(time) ? '参考' : /建议/.test(time) ? '建议' : '';
      const cleanTime = time.replace(/\s*(核实|参考|建议)\s*$/, '');
      return `<article class="event"><div class="event-head"><div><div class="event-time">${esc(cleanTime)}</div><h4>${esc(r[2])}</h4></div>${status ? `<span class="tag ${status==='核实'?'blue':status==='建议'?'accent':''}">${status}</span>` : ''}</div><div class="event-body"><div class="event-detail"><b>怎么去 / 怎么做</b>${esc(r[3]) || '—'}</div><div class="event-detail"><b>费用 / JR券</b>${esc(r[4]) || '—'}</div></div>${r[5] ? `<p class="event-note">${esc(r[5])}</p>` : ''}${sourceText(r[6])}</article>`;
    }).join('');
    $('dayPanel').innerHTML = `<div class="day-overview"><div><span class="tag accent">${esc(row[0])}</span><h3>${esc(row[1])}</h3><p>${esc(row[2])}</p><div class="day-meta"><span class="tag">${esc(row[4])}</span><span class="tag blue">${esc(row[5])}</span></div></div><div class="day-big-number">${String(i+1).padStart(2,'0')}</div></div><div class="day-highlights"><div class="highlight"><span>今晚住宿</span><strong>${esc(row[3])}</strong></div><div class="highlight"><span>当天重点</span><strong>${esc(row[2])}</strong></div></div><div class="timeline">${note}</div><p class="section-tail">“核实”表示原表核对过运营方当时时刻，仍需在乘车当天再查；“建议”为规划时间。</p>`;
    const tab = document.querySelectorAll('.day-tab')[i];
    tab?.scrollIntoView({block:'nearest',inline:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    if (focus) tab?.focus();
    const u = new URL(location.href);
    u.searchParams.set('day',date);
    history.replaceState(null,'',u);
  }
  $('dayStrip').innerHTML = dayRows.map((r,i) => `<button class="day-tab" type="button" role="tab" aria-controls="dayPanel" aria-selected="false" data-day="${i}"><span class="small">第 ${i+1} 天${i===dayIndex?'<i class="today-dot" aria-label="今天"></i>':''}</span><strong>${esc(shortDate(i))}</strong><span class="place">${esc(place(r))}</span></button>`).join('');
  $('dayStrip').addEventListener('click', e => {const b=e.target.closest('.day-tab');if(b)showDay(Number(b.dataset.day));});
  $('dayStrip').addEventListener('keydown', e => {if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();showDay((active+(e.key==='ArrowRight'?1:9))%10,true);});
  $('todayBtn').addEventListener('click', () => {showDay(dayIndex >= 0 ? dayIndex : 0);$('main').scrollIntoView({behavior:'smooth'});});
  showDay(active);

  const storageKey = 'kyushu-2026-task-checks-v1';
  let checked = {};
  try { checked = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
  let taskFilter = '全部';
  const taskRows = data['预约与备选'];
  const filters = ['全部','最高','高','中','已完成'];
  function renderTasks() {
    $('taskFilters').innerHTML = filters.map(f=>`<button class="filter-btn ${taskFilter===f?'active':''}" type="button" data-filter="${f}">${f==='全部'?'全部事项':f==='已完成'?'已勾选':f+'优先级'}</button>`).join('');
    const list = taskRows.map((r,i)=>({...{row:r,index:i}})).filter(({row:r,index:i})=>taskFilter==='全部'||taskFilter==='已完成'&&checked[i]||r[1]===taskFilter);
    $('tasks').innerHTML = list.length ? list.map(({row:r,index:i})=>`<article class="task ${checked[i]?'done':''}"><input class="task-check" type="checkbox" id="task-${i}" data-task="${i}" ${checked[i]?'checked':''} aria-label="标记${esc(r[2])}已确认"><div><div class="task-top"><h3><label for="task-${i}">${esc(r[2])}</label></h3><span class="tag ${r[1]==='最高'?'accent':''}">${esc(r[1])}</span><span class="tag blue">${esc(r[3])}</span></div><p>${esc(r[0])} · ${esc(r[4])}</p><p class="task-note">${esc(r[5])}</p>${sourceRefs(r[6])?`<div class="task-link">${sourceRefs(r[6])}</div>`:''}</div></article>`).join('') : '<p class="fineprint">这里还没有已勾选的事项。</p>';
  }
  $('taskFilters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(b){taskFilter=b.dataset.filter;renderTasks();}});
  $('tasks').addEventListener('change',e=>{if(e.target.matches('[data-task]')){checked[e.target.dataset.task]=e.target.checked;try{localStorage.setItem(storageKey,JSON.stringify(checked));}catch{}renderTasks();}});
  renderTasks();

  const rail = data['JR券比较'];
  $('transportList').innerHTML = details('JR券与单买车票比较','全九州 7 日券',`<p>原表估算：单买 JR 每人 ${fmt(45690)}–${fmt(53990)}；全九州 7 日券参考 ${fmt(25000)}–${fmt(26000)}。单买价未逐段实时出票，折扣票可能更低。</p><p>持券在车站划普通指定席通常不另收费；提前线上锁定热门观光列车座位可能另收费。购票资格、运行日及空位都要以官方页面为准。</p>${sourceText('S01/S02/S37')}`) + data['交通索引'].map(r=>details(r[1],`${r[0]} · ${r[2]}`,`<p><strong>时长：</strong>${esc(r[3])}　<strong>费用：</strong>${esc(r[4])}　<strong>JR券：</strong>${esc(r[5])}</p><p>${esc(r[6])}</p>${sourceText(r[7])}`)).join('');
  $('staysList').innerHTML = data['酒店与行李'].map(r=>{
    const query = encodeURIComponent(`${r[2]} ${String(r[5] || '').split('；')[0]}`);
    return `<article class="stay-card"><span class="stay-date">${esc(r[0])} · ${esc(r[1])}</span><h3>${esc(r[2])}</h3><p><strong>房型与餐食：</strong>${esc(r[4])}</p><p class="address"><strong>位置：</strong>${esc(r[5])}</p><p><strong>行李提醒：</strong>${esc(r[6])}</p><div class="stay-links"><a href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener noreferrer">打开地图 ↗</a>${sourceRefs(r[7])}</div></article>`;
  }).join('');
  const budgetRows = data['两人预算'].filter(r => ['交通','杂费','门票','餐饮','机动'].includes(r[0]));
  const categories = [...new Set(budgetRows.map(r=>r[0]))];
  $('budgetList').innerHTML = categories.map(c=>{
    const rows=budgetRows.filter(r=>r[0]===c), lo=rows.reduce((a,r)=>a+(Number(r[6])||0),0), hi=rows.reduce((a,r)=>a+(Number(r[7])||0),0);
    return details(c,`${fmt(lo)}–${fmt(hi)} · ${rows.length} 项`,rows.map(r=>`<p><strong>${esc(r[1])}：</strong>${fmt(r[6])}–${fmt(r[7])}（${esc(r[2])} × ${esc(r[5])}）<br>${esc(r[8])}</p>`).join(''));
  }).join('');
  $('attractions').innerHTML = data['景点门票预约'].map(r=>details(r[1],`${r[0]} · ${r[2]}`,`<p><strong>开放：</strong>${esc(r[3])}　<strong>预约：</strong>${esc(r[4])}</p><p><strong>建议：</strong>${esc(r[5])}。${esc(r[6])}</p>${sourceText(r[7])}`)).join('');
  $('food').innerHTML = data['美食'].map(r=>details(r[2],`${r[0]} · ${r[1]} · ${r[4]}`,`<p><strong>推荐：</strong>${esc(r[3])}</p><p>${esc(r[5])}</p>${sourceText(r[6])}`)).join('');
  $('sourceList').innerHTML = data['来源链接'].map(r=>/^https?:\/\//.test(r[2]||'')?`<div class="source-item"><span>${esc(r[0])}</span><a href="${esc(r[2])}" target="_blank" rel="noopener noreferrer">${esc(r[1])} ↗</a></div>`:'').join('');
})();
