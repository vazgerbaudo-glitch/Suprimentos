function buildFilters() {
    const meses = [...new Set(ALL.filter(r => r.dc && inY(r.dc)).map(r => ymKey(r.dc)))].sort();
    const sems = [...new Set(ALL.filter(r => r.dc && inY(r.dc)).map(r => isoWeek(r.dc)))].sort();
    const tipos = [...new Set(ALL.map(r => r.td).filter(t => t && t !== 'Contrato' && t !== 'Spot'))].sort();
    f_mes.innerHTML = meses.map(m => `<option value="${m}">${mLabel(m)}</option>`).join('');
    f_sem.innerHTML = sems.map(s => `<option value="${s}">${wkLabelFull(s)}</option>`).join('');
    f_tipo.innerHTML = '<option value="GERAL">Geral</option><option value="CS">Contrato e Spot</option><option value="Contrato">Contrato</option><option value="Spot">Spot</option>'
        + tipos.map(t => `<option value="${t}">${t}</option>`).join('');
    f_tipo.value = STATE.tp;
    if (meses.length) { STATE.mes = meses[meses.length - 1]; f_mes.value = STATE.mes; }
    if (sems.length) { STATE.sem = sems[sems.length - 1]; f_sem.value = STATE.sem; }
}

f_modo.onchange = e => {
    STATE.modo = e.target.value;
    wrap_mes.style.display = STATE.modo === 'mes' ? '' : 'none';
    wrap_sem.style.display = STATE.modo === 'semana' ? '' : 'none';
    render();
};
f_mes.onchange = e => { STATE.mes = e.target.value; render(); };
f_sem.onchange = e => { STATE.sem = e.target.value; render(); };
f_tipo.onchange = e => { STATE.tp = e.target.value; render(); };
document.getElementById('ind-voltar').onclick = () => { STATE.comp = 'GERAL'; render(); };

function movePillIndicator(btn, instant) {
    if (!btn || !pillIndicator) return;
    if (instant) pillIndicator.style.transition = 'none';
    pillIndicator.style.width = btn.offsetWidth + 'px';
    pillIndicator.style.height = btn.offsetHeight + 'px';
    pillIndicator.style.left = btn.offsetLeft + 'px';
    pillIndicator.style.top = btn.offsetTop + 'px';
    if (instant) { pillIndicator.offsetHeight; pillIndicator.style.transition = ''; }
}

function activateTab(t) {
    document.querySelectorAll('.pillnav button').forEach(x => x.classList.toggle('active', x.dataset.t === t));
    document.querySelectorAll('section.tab').forEach(x => x.classList.toggle('active', x.id === t));
    movePillIndicator(document.querySelector('.pillnav button.active'));
    const mc = document.querySelector('.main-col');
    if (mc) mc.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.pillnav button').forEach(b => b.onclick = () => activateTab(b.dataset.t));
document.getElementById('overview').addEventListener('click', e => {
    const el = e.target.closest('[data-t]');
    if (el) activateTab(el.dataset.t);
});
window.addEventListener('resize', () => movePillIndicator(document.querySelector('.pillnav button.active'), true));
movePillIndicator(document.querySelector('.pillnav button.active'), true);
