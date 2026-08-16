/* Hallmark · behavior layer for Long Document / Midnight theme */

document.addEventListener('DOMContentLoaded', () => {
  gsap.registerPlugin(ScrollTrigger);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  /* ===== LENIS SMOOTH SCROLL ===== */
  if (!reducedMotion) {
    const lenisInstance = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
    });
    lenisInstance.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenisInstance.raf(time * 1000));
    window.lenis = lenisInstance;
    gsap.ticker.lagSmoothing(0);
  }

  /* ===== READING PROGRESS BAR ===== */
  const progressBar = document.getElementById('progress');
  if (progressBar) {
    const updateProgress = () => {
      const scrollTop = window.scrollY || window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPct = scrollTop / docHeight;
      progressBar.style.transform = `scaleX(${scrollPct})`;
    };
    window.addEventListener('scroll', updateProgress);
    updateProgress();
  }

  /* ===== FLUID SHADER BACKGROUND ===== */
  (function initFluid() {
    const root = document.getElementById('fluid-root');
    if (!root) return;

    const canvas = document.createElement('canvas');
    root.appendChild(canvas);
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
    if (!gl) {
      root.style.background = 'var(--color-bg-gradient)';
      return;
    }

    const halfFloat = gl.getExtension('OES_texture_half_float');
    const linearFilter = gl.getExtension('OES_texture_half_float_linear');
    if (!halfFloat || !linearFilter) {
      root.style.background = 'var(--color-bg-gradient)';
      return;
    }
    const halfFloatType = halfFloat.HALF_FLOAT_OES;

    let W, H, simW, simH;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      simW = Math.floor(W * 0.5);
      simH = Math.floor(H * 0.5);
    }
    resize();
    window.addEventListener('resize', resize);

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    function createProgram(vs, fs) {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      return p;
    }

    const VS = `
      attribute vec2 a_pos;
      varying vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;

    const FLUID_FS = `
      precision highp float;
      uniform sampler2D uFluidTex;
      uniform vec2 uResolution;
      uniform vec4 iMouse;
      uniform float uDecay, uTrail;
      varying vec2 v_uv;

      vec3 dec(vec3 r) { return (r - 0.5) * 0.8; }
      vec3 enc(vec3 s) { return s / 0.8 + 0.5; }

      void main() {
        vec2 tx = 1.0 / uResolution;
        vec3 p = dec(texture2D(uFluidTex, v_uv).rgb);
        vec2 vel = p.rg;
        float ink = p.b;

        vec3 L = dec(texture2D(uFluidTex, v_uv - vec2(tx.x, 0)).rgb);
        vec3 R = dec(texture2D(uFluidTex, v_uv + vec2(tx.x, 0)).rgb);
        vec3 U = dec(texture2D(uFluidTex, v_uv + vec2(0, tx.y)).rgb);
        vec3 D = dec(texture2D(uFluidTex, v_uv - vec2(0, tx.y)).rgb);

        vel = mix(vel, (L.rg + R.rg + U.rg + D.rg) * 0.25, 0.28);
        ink = mix(ink, (L.b + R.b + U.b + D.b) * 0.25, 0.28);

        vec3 adv = dec(texture2D(uFluidTex, v_uv - vel * tx * 1.2).rgb);
        vel = mix(vel, adv.rg, 0.45);
        ink = mix(ink, adv.b, 0.45);

        vec2 mo = iMouse.xy - iMouse.zw;
        float bm = exp(-pow(distance(v_uv * uResolution, iMouse.xy), 2.0) * 2.2e-4);
        vel += mo * bm * 0.03;
        ink += bm * 0.09;

        vel *= uDecay;
        ink *= uTrail;

        gl_FragColor = vec4(enc(vec3(vel, ink)), 1.0);
      }
    `;

    const DISPLAY_FS = `
      precision highp float;
      uniform sampler2D uDisplayTex;
      uniform vec2 uResolution;
      varying vec2 v_uv;
      void main() {
        vec3 col = texture2D(uDisplayTex, v_uv).rgb;
        col.r *= 1.4;
        col.g *= 0.85;
        col.b *= 0.4;
        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const displayProg = createProgram(VS, DISPLAY_FS);
    const fluidProg = createProgram(VS, FLUID_FS);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const aPosLoc = gl.getAttribLocation(fluidProg, 'a_pos');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    function createFBTexture() {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, simW, simH, 0, gl.RGBA, halfFloatType, null);
      return tex;
    }

    const fbA = gl.createFramebuffer();
    const fbB = gl.createFramebuffer();
    const texA = createFBTexture();
    const texB = createFBTexture();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texA, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texB, 0);

    function setMouseUniform(prog, x, y, px, py) {
      const loc = gl.getUniformLocation(prog, 'iMouse');
      gl.uniform4f(loc, x * DPR, y * DPR, px * DPR, py * DPR);
    }

    let mouseX = 0, mouseY = 0, prevMouseX = 0, prevMouseY = 0;
    let hasMoved = false;

    canvas.addEventListener('mousemove', (e) => {
      prevMouseX = mouseX;
      prevMouseY = mouseY;
      mouseX = e.clientX;
      mouseY = e.clientY;
      hasMoved = true;
    });

    canvas.addEventListener('mouseleave', () => { hasMoved = false; });
    canvas.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      prevMouseX = mouseX;
      prevMouseY = mouseY;
      mouseX = t.clientX;
      mouseY = t.clientY;
      hasMoved = true;
      e.preventDefault();
    }, { passive: false });

    if (coarsePointer) {
      root.style.opacity = '0.5';
    }

    let frame = 0;
    const decay = 0.995;
    const trail = 0.985;

    function render() {
      gl.useProgram(fluidProg);

      if (hasMoved) {
        setMouseUniform(fluidProg, mouseX, mouseY, prevMouseX, prevMouseY);
      } else {
        setMouseUniform(fluidProg, -9999, -9999, -9999, -9999);
      }

      const resLoc = gl.getUniformLocation(fluidProg, 'uResolution');
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(fluidProg, 'uDecay'), decay);
      gl.uniform1f(gl.getUniformLocation(fluidProg, 'uTrail'), trail);

      gl.bindFramebuffer(gl.FRAMEBUFFER, frame % 2 === 0 ? fbB : fbA);
      gl.viewport(0, 0, simW, simH);
      gl.bindTexture(gl.TEXTURE_2D, frame % 2 === 0 ? texA : texB);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(gl.getUniformLocation(fluidProg, 'uFluidTex'), 0);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.useProgram(displayProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, frame % 2 === 0 ? texB : texA);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(gl.getUniformLocation(displayProg, 'uDisplayTex'), 0);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      frame++;
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  })();

  /* ===== NAVIGATION HIGHLIGHT ON SCROLL ===== */
  if (!reducedMotion) {
    const sections = document.querySelectorAll('section[id], article[id]');
    const navLinks = document.querySelectorAll('.nav__menu a');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = entry.target.id;
        const link = document.querySelector(`.nav__menu a[href="#${id}"]`);
        if (entry.isIntersecting && link) {
          link.style.color = 'var(--color-accent-bright)';
        } else if (link) {
          link.style.color = '';
        }
      });
    }, { threshold: 0.4, rootMargin: '-20% 0px -40% 0px' });

    sections.forEach(s => observer.observe(s));
  }

  /* ===== SMOOTH ANCHOR SCROLL ===== */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        if (window.lenis) {
          window.lenis.scrollTo(target);
        } else {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  /* ===== SUBSCRIBE FORM ===== */
  (function initSubscribe() {
    const form = document.getElementById('subscribe-form');
    const emailInput = document.getElementById('subscribe-email');
    const btn = document.getElementById('subscribe-btn');
    const feedback = document.getElementById('subscribe-feedback');
    if (!form || !feedback) return;

    const showFeedback = (msg, type) => {
      feedback.textContent = msg;
      feedback.className = 'subscribe-feedback show ' + type;
      setTimeout(() => { feedback.className = 'subscribe-feedback'; }, 4000);
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!pattern.test(email)) {
        showFeedback('Por favor, insira um e-mail válido.', 'error');
        emailInput.focus();
        return;
      }
      btn.disabled = true;
      btn.querySelector('span').textContent = 'ENVIANDO...';
      setTimeout(() => {
        showFeedback('Inscrito com sucesso! Confira seu e-mail. 🚀', 'success');
        form.reset();
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Assinar';
      }, 900);
    });
  })();

   /* ===== COMMENTS SECTION ===== */
  (function initComments() {
    const form = document.getElementById('comment-form');
    const list = document.getElementById('comments-list');
    const STORAGE_KEY = 'codex-comments';
    const counterEl = document.getElementById('nav-comment-count');
    if (!form || !list) return;

    function updateCommentCounter(count) {
      if (!counterEl) return;
      if (count > 0) {
        counterEl.textContent = count;
        counterEl.classList.add('show');
      } else {
        counterEl.textContent = '';
        counterEl.classList.remove('show');
      }
    }

    function loadComments() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      try { return JSON.parse(raw); } catch { return []; }
    }

    function saveComments(comments) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
    }

    function renderComments() {
      const comments = loadComments().reverse();
      if (comments.length === 0) {
        list.innerHTML = '<div class="comments__empty"><span>Seja o primeiro a comentar!</span></div>';
        updateCommentCounter(0);
        return;
      }
      list.innerHTML = comments.map(c => createCommentEl(c)).join('');
      updateCommentCounter(comments.length);
      setTimeout(() => {
        document.querySelectorAll('.comment').forEach((el, i) => {
          el.style.animationDelay = (0.05 + i * 0.06) + 's';
        });
      }, 50);
    }

    function createCommentEl(c) {
      const initials = c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const time = new Date(c.timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      return `<div class="comment">
        <div class="comment__avatar">${initials}</div>
        <div class="comment__body">
          <div class="comment__author">${c.name}
            <span class="comment__time">${time}</span>
          </div>
          <div class="comment__text">${escapeHtml(c.text)}</div>
        </div>
      </div>`;
    }

    function escapeHtml(str) {
      return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const text = form.comment.value.trim();
      if (!name || !email || !text) return;
      const comments = loadComments();
      comments.push({
        name, email, text,
        timestamp: Date.now()
      });
      saveComments(comments);
      form.reset();
      renderComments();
    });

    renderComments();
  })();
});
