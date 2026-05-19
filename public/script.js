/* Geometría física de los 5 sensores (coincide con main.ino) */
const NUM_SENSORS = 5;
const SEGMENT_M = 0.14;
const TOTAL_LEN_M = SEGMENT_M * (NUM_SENSORS - 1);
const SENSOR_POS_M = Array.from({ length: NUM_SENSORS }, (_, i) => i * SEGMENT_M);

/* Geometría de la rampa (teoría / diagrama) */
const THEORY_RAMP = {
    base: 0.47,
    height: 0.40,
    hyp: 0.617,
    angle: Math.atan2(0.40, 0.47),
    angleDeg: Math.atan2(0.40, 0.47) * 180 / Math.PI,
    sensorCm: [0, 14, 28, 42, 56]
};

/* ─── Estado ─── */
let socket = null;
let currentSessionId = null;
let sessionStartUs = null;
let hitSensors = new Set();
let sessionLog = [];
let velChart = null;
let intChart = null;
let accChart = null;

/* ─── Utilidades ─── */
function fmtNum(v, dec = 3) {
    if (v == null || Number.isNaN(v)) return '—';
    return Number(v).toFixed(dec);
}

function segmentLabel(order, i) {
    if (!order || order.length < 2 || i >= order.length - 1) return `T${i + 1}`;
    return `S${order[i]}→S${order[i + 1]}`;
}

function mean(arr) {
    if (!arr?.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function totalTimeFromTimestamps(timestampsUs) {
    if (!timestampsUs || timestampsUs.length < 2) return null;
    return (timestampsUs[timestampsUs.length - 1] - timestampsUs[0]) / 1e6;
}

/* ─── Navegación ─── */
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(t => {
        const label = t.textContent.toLowerCase();
        if ((name === 'dashboard' && label.includes('dash')) ||
            (name === 'theory' && label.includes('teor'))) {
            t.classList.add('active');
        }
    });
    if (name === 'theory') drawTheoryCanvas();
}

/* ─── Canvas: vista de sensores S0–S4 ─── */
const RampView = (() => {
    const C = {
        bg: '#0e0e0f', surface: '#161618', edge: '#3a3a3f', ramp: '#2a2a2e',
        sensorIdle: '#2e2e32', sensorHit: '#c8b98a', sensorInterp: '#6a9e72',
        text: '#8a8a8e', hint: '#55555a', grid: 'rgba(255,255,255,0.025)'
    };
    let cv, cx;

    function init(id) {
        cv = document.getElementById(id);
        cx = cv.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        const dpr = devicePixelRatio || 1;
        const r = cv.getBoundingClientRect();
        cv.width = r.width * dpr;
        cv.height = r.height * dpr;
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(hitSensors, new Set());
    }

    function draw(hits, interpolated) {
        const r = cv.getBoundingClientRect();
        const W = r.width, H = r.height, pad = 36;
        cx.clearRect(0, 0, W, H);
        cx.fillStyle = C.bg;
        cx.fillRect(0, 0, W, H);

        const trackW = W - pad * 2;
        const y = H / 2;

        cx.strokeStyle = C.grid;
        for (let x = 0; x < W; x += 32) {
            cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke();
        }

        cx.strokeStyle = C.ramp;
        cx.lineWidth = 2;
        cx.beginPath();
        cx.moveTo(pad, y);
        cx.lineTo(pad + trackW, y);
        cx.stroke();

        for (let i = 0; i < NUM_SENSORS; i++) {
            const frac = SENSOR_POS_M[i] / TOTAL_LEN_M;
            const x = pad + trackW * frac;
            const isHit = hits.has(i);
            const isInterp = interpolated.has(i);

            cx.strokeStyle = isHit ? (isInterp ? C.sensorInterp : C.sensorHit) : C.sensorIdle;
            cx.lineWidth = isHit ? 2 : 1;
            cx.beginPath();
            cx.moveTo(x, y - 12);
            cx.lineTo(x, y + 12);
            cx.stroke();

            cx.fillStyle = isHit ? (isInterp ? C.sensorInterp : C.sensorHit) : C.hint;
            cx.font = '9px DM Mono, monospace';
            cx.textAlign = 'center';
            cx.fillText('S' + i, x, y + 26);
        }

        cx.fillStyle = C.text;
        cx.font = '10px DM Mono, monospace';
        cx.textAlign = 'left';
        cx.fillText('0 m', pad - 4, y - 18);
        cx.textAlign = 'right';
        cx.fillText(TOTAL_LEN_M.toFixed(2) + ' m', pad + trackW + 4, y - 18);
    }

    function refresh() {
        const interp = new Set(
            [...document.querySelectorAll('.sensor-row.interpolated')].map(
                el => parseInt(el.id.replace('sr', ''), 10)
            )
        );
        draw(hitSensors, interp);
    }

    return { init, refresh };
})();

function drawTheoryCanvas() {
    const cv = document.getElementById('theoryCanvas');
    if (!cv) return;
    const dpr = devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    cv.width = r.width * dpr;
    cv.height = r.height * dpr;
    const cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height, pad = 40;
    const R = THEORY_RAMP;

    cx.fillStyle = '#0e0e0f';
    cx.fillRect(0, 0, W, H);

    const x0 = pad, y0 = H - pad;
    const x1 = W - pad;
    const y1 = y0 - (x1 - x0) * Math.tan(R.angle);
    const y1c = Math.max(y1, pad + 10);

    cx.fillStyle = '#161618';
    cx.beginPath();
    cx.moveTo(x0, y0);
    cx.lineTo(x1, y1c);
    cx.lineTo(x1, y0);
    cx.closePath();
    cx.fill();

    cx.strokeStyle = '#3a3a3f';
    cx.lineWidth = 2;
    cx.beginPath();
    cx.moveTo(x0, y0);
    cx.lineTo(x1, y1c);
    cx.stroke();
    cx.strokeStyle = '#2a2a2e';
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(x0, y0);
    cx.lineTo(x1, y0);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(x1, y0);
    cx.lineTo(x1, y1c);
    cx.stroke();

    cx.strokeStyle = '#55555a';
    cx.beginPath();
    cx.arc(x0, y0, 34, -R.angle, 0);
    cx.stroke();

    cx.fillStyle = '#c8b98a';
    cx.font = '11px DM Mono, monospace';
    cx.textAlign = 'center';
    cx.fillText('θ = ' + R.angleDeg.toFixed(1) + '°', x0 + 48, y0 - 10);

    cx.fillStyle = '#55555a';
    cx.font = '10px DM Mono, monospace';
    cx.fillText('Base = 47 cm', (x0 + x1) / 2, y0 + 18);
    cx.save();
    cx.translate(x1 + 22, (y0 + y1c) / 2);
    cx.rotate(-Math.PI / 2);
    cx.fillText('Altura = 40 cm', 0, 0);
    cx.restore();

    const dx = x1 - x0, dy = y1c - y0, len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len, ny = dx / len;

    for (let i = 0; i < NUM_SENSORS; i++) {
        const frac = R.sensorCm[i] / (R.sensorCm[NUM_SENSORS - 1]);
        const sx = x0 + dx * frac, sy = y0 + dy * frac;
        cx.strokeStyle = '#c8b98a';
        cx.lineWidth = 1.5;
        cx.beginPath();
        cx.moveTo(sx, sy);
        cx.lineTo(sx + nx * 10, sy + ny * 10);
        cx.stroke();
        cx.fillStyle = '#c8b98a';
        cx.font = '8px DM Mono, monospace';
        cx.textAlign = 'center';
        cx.fillText('S' + i, sx + nx * 18, sy + ny * 18 + 3);
    }
}

/* ─── Gráficas (solo datos de session/summary) ─── */
const darkAx = {
    grid: { color: 'rgba(255,255,255,0.035)', lineWidth: 1 },
    ticks: { color: '#55555a', font: { family: 'DM Mono', size: 10 } },
    border: { color: '#2a2a2e' }
};

const ttCfg = unit => ({
    backgroundColor: '#1e1e21',
    borderColor: '#2a2a2e',
    borderWidth: 1,
    titleColor: '#8a8a8e',
    bodyColor: '#e8e8e6',
    bodyFont: { family: 'DM Mono', size: 11 },
    callbacks: { label: c => ' ' + c.parsed.y.toFixed(4) + unit }
});

function initCharts() {
    velChart = new Chart(document.getElementById('velChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'm/s', data: [], backgroundColor: 'rgba(200,185,138,0.16)', borderColor: 'rgba(200,185,138,0.6)', borderWidth: 1, borderRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttCfg(' m/s') }, scales: { x: { ...darkAx }, y: { ...darkAx } } }
    });
    intChart = new Chart(document.getElementById('intChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'ms', data: [], backgroundColor: 'rgba(106,158,114,0.16)', borderColor: 'rgba(106,158,114,0.6)', borderWidth: 1, borderRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttCfg(' ms') }, scales: { x: { ...darkAx }, y: { ...darkAx, title: { display: true, text: 'µs → ms', color: '#55555a', font: { family: 'DM Mono', size: 10 } } } } }
    });
    accChart = new Chart(document.getElementById('accChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'm/s²', data: [], backgroundColor: 'rgba(200,185,138,0.16)', borderColor: 'rgba(200,185,138,0.6)', borderWidth: 1, borderRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttCfg(' m/s²') }, scales: { x: { ...darkAx }, y: { ...darkAx } } }
    });
}

function updateChartsFromSummary(data) {
    const order = data.trigger_order || [];
    const labels = (data.velocities_ms || []).map((_, i) => segmentLabel(order, i));

    velChart.data.labels = labels;
    velChart.data.datasets[0].data = (data.velocities_ms || []).map(v => parseFloat(Number(v).toFixed(4)));
    velChart.update();

    intChart.data.labels = labels;
    intChart.data.datasets[0].data = (data.intervals_us || []).map(us => parseFloat((us / 1000).toFixed(3)));
    intChart.update();

    const accLabels = (data.accelerations_ms2 || []).map((_, i) => {
        if (order.length >= 3 && i < order.length - 2) {
            return `S${order[i]}→S${order[i + 2]}`;
        }
        return `a${i + 1}`;
    });
    accChart.data.labels = accLabels.length ? accLabels : (data.accelerations_ms2 || []).map((_, i) => `a${i + 1}`);
    accChart.data.datasets[0].data = (data.accelerations_ms2 || []).map(a => parseFloat(Number(a).toFixed(4)));
    accChart.update();
}

function clearCharts() {
    [velChart, intChart, accChart].forEach(ch => {
        ch.data.labels = [];
        ch.data.datasets[0].data = [];
        ch.update();
    });
}

/* ─── Lista de sensores ─── */
function buildSensors() {
    const list = document.getElementById('sensorsList');
    list.innerHTML = '';
    for (let i = 0; i < NUM_SENSORS; i++) {
        const posCm = (SENSOR_POS_M[i] * 100).toFixed(0);
        list.insertAdjacentHTML('beforeend',
            `<div class="sensor-row" id="sr${i}">
        <span class="sensor-id">S${i} <span style="font-size:.65rem;opacity:.45">${posCm} cm</span></span>
        <div class="sensor-progress-wrap"><div class="sensor-progress-bar" id="sb${i}"></div></div>
        <span class="sensor-time" id="st${i}">—</span>
        <span class="sensor-vel" id="sv${i}">—</span>
      </div>`);
    }
}

function resetSensors() {
    for (let i = 0; i < NUM_SENSORS; i++) {
        const row = document.getElementById(`sr${i}`);
        row.classList.remove('active', 'interpolated');
        document.getElementById(`sb${i}`).style.width = '0%';
        document.getElementById(`st${i}`).textContent = '—';
        document.getElementById(`sv${i}`).textContent = '—';
    }
    hitSensors.clear();
    RampView.refresh();
}

function activateSensor(index, { timeS, velocity, interpolated }) {
    const row = document.getElementById(`sr${index}`);
    row.classList.add('active');
    if (interpolated) row.classList.add('interpolated');

    hitSensors.add(index);
    document.getElementById(`sb${index}`).style.width = ((index + 1) / NUM_SENSORS * 100) + '%';
    document.getElementById(`st${index}`).textContent = timeS != null ? timeS.toFixed(4) + ' s' : '—';
    document.getElementById(`sv${index}`).textContent = velocity != null ? velocity.toFixed(3) + ' m/s' : '—';
    RampView.refresh();
}

/* ─── Métricas y sesión (derivadas del summary) ─── */
function setMetrics(velocity, acceleration, timeS) {
    document.getElementById('mVel').textContent = fmtNum(velocity);
    document.getElementById('mAcc').textContent = fmtNum(acceleration);
    document.getElementById('mTime').textContent = timeS != null ? timeS.toFixed(4) : '—';
    ['mcVel', 'mcAcc', 'mcTime'].forEach(id => {
        const el = document.getElementById(id);
        el.classList.add('updated');
        setTimeout(() => el.classList.remove('updated'), 700);
    });
}

function clearMetrics() {
    ['mVel', 'mAcc', 'mTime'].forEach(id => document.getElementById(id).textContent = '—');
}

function updateSessionMeta(data) {
    document.getElementById('sessionId').textContent = data.session_id ?? '—';
    document.getElementById('orderOk').textContent = data.order_ok === true ? 'Sí' : data.order_ok === false ? 'No' : '—';
    document.getElementById('sensorsTriggered').textContent = data.sensors_triggered ?? '—';
    document.getElementById('triggerOrder').textContent =
        data.trigger_order?.length ? data.trigger_order.map(s => 'S' + s).join(' → ') : '—';
    const interp = data.interpolated_sensors;
    document.getElementById('interpolatedSensors').textContent =
        interp?.length ? interp.map(s => 'S' + s).join(', ') : 'ninguno';
}

function setStatus(state) {
    const map = {
        idle: ['', 'En espera'],
        running: ['running', 'Midiendo...'],
        done: ['done', 'Completado']
    };
    const [cls, lbl] = map[state] || map.idle;
    document.getElementById('statusDot').className = 'status-dot ' + cls;
    document.getElementById('statusLabel').textContent = lbl;
}

function setWsStatus(connected) {
    document.getElementById('wsDot').className = 'status-dot ' + (connected ? 'live' : '');
    document.getElementById('wsLabel').textContent = connected ? 'WS conectado' : 'WS desconectado';
}

function setEspStatus(online) {
    const el = document.getElementById('espStatus');
    el.textContent = online ? 'ESP32 en línea' : 'ESP32 sin señal';
    el.style.color = online ? 'var(--success)' : 'var(--text-hint)';
}

/* ─── Registro ─── */
function addSessionLog(summary, velocity, timeS) {
    sessionLog.unshift({
        session_id: summary.session_id,
        sensors_triggered: summary.sensors_triggered,
        order_ok: summary.order_ok,
        velocity,
        timeS
    });
    const n = sessionLog.length;
    document.getElementById('logCount').textContent = n + (n === 1 ? ' sesión' : ' sesiones');
    document.getElementById('exportBtn').disabled = false;
    document.getElementById('logBody').insertAdjacentHTML('afterbegin',
        `<tr>
      <td>${n}</td>
      <td>${summary.session_id}</td>
      <td>${summary.sensors_triggered}</td>
      <td>${summary.order_ok ? 'Sí' : 'No'}</td>
      <td>${fmtNum(velocity)}</td>
      <td>${timeS != null ? timeS.toFixed(5) : '—'}</td>
    </tr>`);
}

function exportCSV() {
    if (!sessionLog.length) return;
    const lines = [
        'sesion,id,sensores,orden_ok,velocidad_ms,tiempo_s',
        ...sessionLog.map((r, i) =>
            `${i + 1},${r.session_id},${r.sensors_triggered},${r.order_ok ? 1 : 0},${r.velocity?.toFixed(6) ?? ''},${r.timeS?.toFixed(6) ?? ''}`
        )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rampa_sesiones_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ─── Handlers WebSocket ─── */
function beginSession(sessionId) {
    if (currentSessionId !== sessionId) {
        currentSessionId = sessionId;
        sessionStartUs = null;
        hitSensors.clear();
        resetSensors();
    }
}

function handleSensorEvent(data) {
    beginSession(data.session_id);

    if (data.trigger_sequence === 0 || sessionStartUs == null) {
        sessionStartUs = data.timestamp_us;
    }

    const timeS = sessionStartUs != null
        ? (data.timestamp_us - sessionStartUs) / 1e6
        : null;

    activateSensor(data.sensor_index, {
        timeS,
        velocity: null,
        interpolated: !!data.interpolated
    });

    setStatus('running');
    document.getElementById('canvasHint').textContent =
        `Sesión ${data.session_id} · S${data.sensor_index} detectado`;
}

function applySessionSummary(data) {
    beginSession(data.session_id);
    updateSessionMeta(data);

    const velocities = data.velocities_ms || [];
    const accelerations = data.accelerations_ms2 || [];
    const timestamps = data.timestamps_us || [];
    const order = data.trigger_order || [];
    const interpSet = new Set(data.interpolated_sensors || []);

    const lastVel = velocities.length ? velocities[velocities.length - 1] : null;
    const avgAcc = mean(accelerations);
    const totalTime = totalTimeFromTimestamps(timestamps);

    setMetrics(lastVel, avgAcc, totalTime);
    setStatus('done');

    resetSensors();
    const t0 = timestamps[0];
    for (let i = 0; i < order.length; i++) {
        const sensorIdx = order[i];
        const timeS = t0 != null ? (timestamps[i] - t0) / 1e6 : null;
        const velocity = i > 0 ? velocities[i - 1] : null;
        activateSensor(sensorIdx, {
            timeS,
            velocity,
            interpolated: interpSet.has(sensorIdx)
        });
    }

    updateChartsFromSummary(data);
    addSessionLog(data, lastVel, totalTime);

    document.getElementById('canvasHint').textContent =
        `Sesión ${data.session_id} · ${data.sensors_triggered} sensores · orden ${data.order_ok ? 'OK' : 'anómalo'}`;

    sessionStartUs = null;
}

function connectWebSocket() {
    if (typeof io === 'undefined') {
        console.error('Socket.IO no cargado');
        setWsStatus(false);
        return;
    }

    socket = io();

    socket.on('connect', () => setWsStatus(true));
    socket.on('disconnect', () => setWsStatus(false));
    socket.on('sensor/event', handleSensorEvent);
    socket.on('session/summary', applySessionSummary);
    socket.on('status', payload => {
        const online = payload === true || payload === 'online' ||
            (typeof payload === 'object' && (payload.status === 'online' || payload.online === true));
        setEspStatus(!!online);
    });
}

/* ─── Reinicio ─── */
function resetDashboard() {
    currentSessionId = null;
    sessionStartUs = null;
    resetSensors();
    clearMetrics();
    clearCharts();
    setStatus('idle');
    document.getElementById('canvasHint').textContent = 'Esperando datos del ESP32';
    document.getElementById('sessionId').textContent = '—';
    document.getElementById('orderOk').textContent = '—';
    document.getElementById('sensorsTriggered').textContent = '—';
    document.getElementById('triggerOrder').textContent = '—';
    document.getElementById('interpolatedSensors').textContent = '—';
}

/* ─── Tabs de gráficas ─── */
const tabHints = {
    vel: 'velocities_ms por tramo',
    int: 'intervals_us (ms) por tramo',
    acc: 'accelerations_ms2'
};

document.querySelectorAll('.chart-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('paneVel').classList.toggle('hidden', tab !== 'vel');
        document.getElementById('paneInt').classList.toggle('hidden', tab !== 'int');
        document.getElementById('paneAcc').classList.toggle('hidden', tab !== 'acc');
        document.getElementById('chartHint').textContent = tabHints[tab];
    });
});

document.querySelectorAll('.theory-nav-item').forEach(a => {
    a.addEventListener('click', function () {
        document.querySelectorAll('.theory-nav-item').forEach(x => x.classList.remove('active'));
        this.classList.add('active');
    });
});

/* ─── Boot ─── */
document.addEventListener('DOMContentLoaded', () => {
    RampView.init('rampCanvas');
    buildSensors();
    initCharts();
    connectWebSocket();
});
