(() => {
'use strict';
const $ = (s) => document.querySelector(s);
const R1_DATE = '2026-10-04';
const S = { polls: [], range: '2026', inst: new Set() };

const fmtDM = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fmtDMY = (iso) => `${fmtDM(iso)}/${iso.slice(2, 4)}`;
const num1 = (x) => x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const numI = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : num1(x));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

$('#themeBtn').addEventListener('click', () => {
  const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = n;
  try { localStorage.setItem('theme', n); } catch (e) { /* sem storage */ }
});

const inRange = () => (S.range === 'post' ? S.polls.filter((p) => p.fim > R1_DATE) : S.polls.filter((p) => p.fim >= '2026-01-01'));
function latestBy(P) {
  const m = new Map();
  for (const p of P) { const c = m.get(p.inst); if (!c || p.fim > c.fim || (p.fim === c.fim && (p.ini || '') > (c.ini || ''))) m.set(p.inst, p); }
  return [...m.values()].sort((x, y) => y.fim.localeCompare(x.fim) || x.inst.localeCompare(y.inst));
}

function renderAvg() {
  const post = latestBy(S.polls.filter((p) => p.fim > R1_DATE)), el = $('#avg');
  if (post.length < 2) { el.innerHTML = ''; return; }
  const l = post.reduce((s, p) => s + p.lula, 0) / post.length, f = post.reduce((s, p) => s + p.flavio, 0) / post.length, tot = l + f;
  const lead = f - l;
  const txt = Math.abs(lead) < 0.6 ? 'Empate técnico' : `${lead > 0 ? 'Flávio' : 'Lula'} +${num1(Math.abs(lead))} ponto${Math.abs(lead) >= 1.5 ? 's' : ''}`;
  el.innerHTML = `
    <div class="avg-h">Média das pesquisas após o 1º turno</div>
    <div class="who l"><span class="nm">Lula</span><span class="big">${num1(l)}<small>%</small></span></div>
    <div class="who f"><span class="nm">Flávio Bolsonaro</span><span class="big">${num1(f)}<small>%</small></span></div>
    <div class="avg-bar"><b style="width:${(l / tot) * 100}%"></b><b style="width:${(f / tot) * 100}%"></b></div>
    <div class="avg-meta"><b>${txt}</b><span>${post.length} institutos</span></div>`;
}

function renderChips() {
  const P = inRange(), cnt = {};
  P.forEach((p) => { cnt[p.inst] = (cnt[p.inst] || 0) + 1; });
  const names = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || a.localeCompare(b));
  for (const n of [...S.inst]) if (!cnt[n]) S.inst.delete(n);
  $('#chips').innerHTML = `<button class="chip-b${S.inst.size ? '' : ' on'}" data-i="">Todos</button>` +
    names.map((n) => `<button class="chip-b${S.inst.has(n) ? ' on' : ''}" data-i="${esc(n)}">${esc(n)}</button>`).join('');
}

function renderList() {
  const el = $('#list'), P = inRange();
  let L;
  if (S.inst.size) {
    L = P.filter((p) => S.inst.has(p.inst)).sort((a, b) => b.fim.localeCompare(a.fim) || a.inst.localeCompare(b.inst));
    $('#listTitle').textContent = [...S.inst].join(', ');
    $('#listSub').textContent = `${L.length} pesquisa${L.length === 1 ? '' : 's'}, da mais recente para a mais antiga`;
  } else {
    L = latestBy(P);
    $('#listTitle').textContent = 'Pesquisas recentes';
    $('#listSub').textContent = 'A mais recente de cada instituto';
  }
  if (!L.length) { el.innerHTML = '<li class="none">Nenhuma pesquisa neste período.</li>'; return; }
  const multi = S.inst.size > 0;
  el.innerHTML = L.map((p) => {
    const d = p.flavio - p.lula, cls = Math.abs(d) < 0.5 ? 'n' : d > 0 ? 'f' : 'l';
    const txt = cls === 'n' ? 'Empate' : `${cls === 'f' ? 'Flávio' : 'Lula'} +${numI(Math.abs(d))}`;
    return `<li class="${p.url ? 'has-url' : ''}" data-url="${esc(p.url || '')}"><div class="pi"><b>${esc(p.inst)}</b><small>${multi ? fmtDMY(p.fim) : fmtDM(p.fim)}</small></div><div class="pm ${cls}">${txt}</div><div class="pv"><span class="l">${numI(p.lula)}</span><span class="f">${numI(p.flavio)}</span></div></li>`;
  }).join('');
  el.scrollTop = 0;
}
const renderAll = () => { renderChips(); renderList(); };

$('#list').addEventListener('click', (e) => { const li = e.target.closest('li[data-url]'); if (li?.dataset.url) window.open(li.dataset.url, '_blank', 'noopener'); });
$('#chips').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const n = b.dataset.i;
  if (!n) S.inst.clear(); else if (S.inst.has(n)) S.inst.delete(n); else S.inst.add(n);
  renderAll();
});
$('#range').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  S.range = b.dataset.r;
  document.querySelectorAll('#range button').forEach((x) => x.classList.toggle('on', x === b));
  renderAll();
});

fetch('data/pesquisas.json').then((r) => r.json()).then((d) => {
  S.polls = d.pesquisas || [];
  const up = d.atualizado ? new Date(d.atualizado).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '';
  $('#note').textContent = `Toque numa linha para abrir a matéria. Pesquisa não é previsão: a margem típica é de ±2 pontos${up ? `. Atualizado em ${up}` : ''}.`;
  renderAvg(); renderAll();
}).catch(() => { $('#list').innerHTML = '<li class="none">Não foi possível carregar as pesquisas.</li>'; });
})();
