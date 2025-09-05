// 사용 예시:
// const destroy = initLuxuryStarlight('#lux-starlight');
// 필요 시 destroy()로 효과 제거

function initLuxuryStarlight(mountSelector, opts = {}) {
  const mount = typeof mountSelector === 'string' ? document.querySelector(mountSelector) : mountSelector;
  if (!mount) return;

  // ===== 옵션 (기본값 포함) =====
  const DPR_MAX   = opts.dprMax ?? 2;
  const density   = opts.density ?? 0.9;           // 기본 밀도
  const drift     = opts.drift ?? 1;               // 표류 강도
  const tone      = opts.tone ?? 'champagne';      // 'champagne' | 'white'
  const layer     = opts.layer ?? 'above';         // 'above' | 'below'
  const fps       = opts.fps ?? 60;                // 렌더 FPS(eco 모드에선 30 권장)
  const twkScale  = opts.twinkleScale ?? 0.2;      // ★ 반짝임 속도 스케일(기존 대비 1/5=0.2)
  const countScale= opts.countScale ?? (1/3);      // ★ 별 개수 스케일(기존 대비 1/3)

  // 접근성: 사용자가 모션 축소를 선호하면 자동으로 프레임/드리프트 낮춤
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const effFPS   = prefersReduced ? Math.min(30, fps) : fps;
  const effDrift = prefersReduced ? drift * 0.5 : drift;

  // ===== 마운트 레이어 =====
  Object.assign(mount.style, {
    position: 'fixed',
    inset: '0',
    zIndex: String(layer === 'below' ? -1 : 0),
    pointerEvents: 'none',
    overflow: 'hidden'
  });

  // ===== 캔버스 =====
  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d', { alpha: true });
  Object.assign(cvs.style, { width: '100%', height: '100%', display: 'block' });
  mount.appendChild(cvs);

  // ===== 상태 =====
  let w = 0, h = 0, dpr = 1, running = true, paused = false;
  let stars = [];              // 별 배열
  const sprites = Object.create(null); // 반경별 글로우 스프라이트 캐시
  let vignette = null;         // 비네트 오버레이(리사이즈 시 갱신)
  const rnd = (a = 1, b = 0) => Math.random() * (a - b) + b;

  // ===== 가시성 관리(탭 비활성 시 정지) =====
  const onVisibility = () => { paused = document.visibilityState !== 'visible'; };
  document.addEventListener('visibilitychange', onVisibility, { passive: true });
  onVisibility();

  // ===== 리사이즈 & 생성 =====
  function resize() {
    w = mount.clientWidth || window.innerWidth;
    h = mount.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    cvs.width = Math.floor(w * dpr);
    cvs.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildVignette();  // 비네트 캐시 갱신
    generate();       // 별 재생성
  }

  // ===== 비네트(성능 최적화: per-frame 생성 대신 캐시) =====
  function buildVignette() {
    const off = document.createElement('canvas');
    off.width = Math.floor(w * dpr);
    off.height = Math.floor(h * dpr);
    const o = off.getContext('2d'); o.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = o.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.hypot(w, h)/2);
    g.addColorStop(0, 'rgba(8,12,20,0.04)');
    g.addColorStop(1, 'rgba(8,12,20,0.08)');
    o.fillStyle = g; o.fillRect(0, 0, w, h);
    vignette = off;
  }

  // ===== 스프라이트(글로우) 캐시 =====
  function getSprite(r) {
    const key = `${tone}:${Math.round(r * 10)}`;
    if (sprites[key]) return sprites[key];
    const size = Math.ceil(r * 8 + 8);
    const off = document.createElement('canvas');
    off.width = off.height = Math.ceil(size * dpr);
    const o = off.getContext('2d');
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = size / 2, cy = size / 2;
    const g = o.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
    if (tone === 'champagne') {
      g.addColorStop(0.0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.35,'rgba(255,248,230,0.55)');
      g.addColorStop(0.7, 'rgba(255,215,150,0.18)');
      g.addColorStop(1.0, 'rgba(255,215,150,0.00)');
    } else {
      g.addColorStop(0.0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
      g.addColorStop(1.0, 'rgba(255,255,255,0.00)');
    }
    o.fillStyle = g; o.beginPath(); o.arc(cx, cy, r * 4, 0, Math.PI * 2); o.fill();
    return (sprites[key] = off);
  }

  // ===== 별 생성 (★ 개수 1/3로 감소) =====
  function generate() {
    const base = (w * h) / 10000;
    const count = Math.floor(base * (20 * density) * countScale);
    stars.length = count;
    for (let i = 0; i < count; i++) {
      const z = rnd(1, 0);                            // 0:가까움 ~ 1:멀음
      const r = Math.pow(Math.random(), 2.2) * 1.4 + (Math.random() < 0.06 ? 0.9 : 0);
      stars[i] = {
        x: rnd(w), y: rnd(h), z, r,
        baseA: rnd(0.25, 0.55),
        twAmp: rnd(0.35, 0.85),
        twSpd: rnd(0.6, 1.3) * twkScale,              // ★ 1/5 속도(느리게)
        phase: rnd(Math.PI * 2),
        vx: (0.02 + 0.06 * (1 - z)) * effDrift,
        vy: (0.005 + 0.02 * (1 - z)) * effDrift,
        sparkle: rnd(Math.PI * 2)
      };
    }
  }

  // ===== 렌더 루프 (프레임 스로틀 + 비가시성 일시정지) =====
  let lastTS = 0, frameInterval = 1000 / effFPS;
  function loop(ts) {
    if (!running) return;
    if (paused) { requestAnimationFrame(loop); return; }

    if (ts - lastTS < frameInterval) { requestAnimationFrame(loop); return; }
    lastTS = ts;

    ctx.clearRect(0, 0, w, h);
    if (vignette) ctx.drawImage(vignette, 0, 0, cvs.width, cvs.height);

    ctx.globalCompositeOperation = 'lighter';

    // 미세 알파 컷오프(거의 보이지 않는 별은 스킵 → 드로우콜 감소)
    const ALPHA_MIN = 0.035;

    for (let i = 0, n = stars.length; i < n; i++) {
      const s = stars[i];
      // 부드러운 트윙클(느리게)
      let a = s.baseA * (0.65 + 0.35 * Math.sin(ts / 1000 * s.twSpd + s.phase));
      // 드문 스파클(가끔만 가속)
      if (Math.sin(ts / 1000 * 3 + s.sparkle) > 0.997) a = Math.min(1, a + 0.5);

      // 좌표 업데이트(은은한 표류)
      s.x += s.vx; s.y += s.vy;
      if (s.x > w + 20) s.x = -20; else if (s.x < -20) s.x = w + 20;
      if (s.y > h + 20) s.y = -20; else if (s.y < -20) s.y = h + 20;

      if (a < ALPHA_MIN) continue; // 거의 안 보이면 스킵

      const spr = getSprite(s.r);
      ctx.globalAlpha = a;
      // spr는 DPR 스케일로 만들어져 있어 원본 픽셀 크기로 그대로 사용
      ctx.drawImage(spr, s.x - spr.width / (2 * dpr), s.y - spr.height / (2 * dpr), spr.width / dpr, spr.height / dpr);

      // 큰 별 크로스 플레어(부하 최소화: r 조건 + 낮은 알파)
      if (s.r > 1.8) {
        ctx.globalAlpha = a * 0.28;
        ctx.strokeStyle = 'rgba(255,240,210,0.55)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(s.x - 10, s.y); ctx.lineTo(s.x + 10, s.y);
        ctx.moveTo(s.x, s.y - 10); ctx.lineTo(s.x, s.y + 10);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(loop);
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize, { passive: true });

  resize();
  requestAnimationFrame(loop);

  // ===== 해제 함수 반환 =====
  return function destroy() {
    running = false;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    mount.innerHTML = '';
  };
}
initLuxuryStarlight('#lux-starlight');