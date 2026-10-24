/* ============================================================
   365 Dias de Gratidão — funções compartilhadas (app e painel)
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.APP_CONFIG || {};
  const G = (window.G365 = {});

  /* ---------- Supabase ---------- */
  G.configurado = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  G.sb = G.configurado
    ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;
  G.emailDe = (usuario) => `${usuario}@${CFG.DOMINIO_LOGIN || "gratidao365.app"}`;
  G.normalizarUsuario = (u) =>
    String(u || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".");

  G.traduzirErro = (e) => {
    const m = String((e && (e.message || e.error_description)) || e || "").toLowerCase();
    if (m.includes("invalid login")) return "Usuário ou senha incorretos.";
    if (m.includes("already registered") || m.includes("already been registered") || m.includes("duplicate")) return "Esse usuário já existe. Escolha outro ou entre com ele.";
    if (m.includes("cadastro_fechado")) return "Os cadastros estão fechados no momento.";
    if (m.includes("antes_do_lancamento")) return "O plano ainda não começou.";
    if (m.includes("fora_de_sequencia")) return "Conclua os dias anteriores primeiro.";
    if (m.includes("dia_ainda_nao_liberado")) return "Este dia ainda não foi liberado.";
    if (m.includes("acesso_negado")) return "Acesso permitido apenas ao administrador.";
    if (m.includes("senha_curta") || m.includes("password")) return "A senha precisa ter pelo menos 6 caracteres.";
    if (m.includes("email not confirmed")) return "Cadastro pendente. No Supabase, desative a confirmação de e-mail (veja o README).";
    if (m.includes("rate limit")) return "Muitas tentativas seguidas. Aguarde um minuto.";
    if (m.includes("fetch") || m.includes("network")) return "Sem conexão. Verifique sua internet e tente de novo.";
    return "Não foi possível concluir. Tente novamente.";
  };

  /* ---------- Datas (sempre no horário local) ---------- */
  G.MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  G.MESC = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  G.SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  G.p2 = (x) => String(x).padStart(2, "0");
  G.hoje = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  G.dataISO = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
  G.dataLocalDeTimestamp = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  G.somarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  G.diasEntre = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  G.fmtNum = (d) => `${G.p2(d.getDate())}/${G.p2(d.getMonth() + 1)}/${d.getFullYear()}`;
  G.fmtCurta = (d) => `${G.p2(d.getDate())} ${G.MESC[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
  G.fmtLonga = (d) => `${G.SEMANA[d.getDay()]}, ${G.p2(d.getDate())} de ${G.MES[d.getMonth()]} de ${d.getFullYear()}`;
  G.fmtExtenso = (d) => `${d.getDate() === 1 ? "1º" : d.getDate()} de ${G.MES[d.getMonth()]} de ${d.getFullYear()}`;
  G.pctTxt = (n) => (n / 365 * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

  /* ---------- Utilidades ---------- */
  G.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  G.$ = (s, el = document) => el.querySelector(s);
  let tToast;
  G.toast = (msg) => {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("ver");
    clearTimeout(tToast);
    tToast = setTimeout(() => t.classList.remove("ver"), 3200);
  };
  G.copiar = async (texto) => {
    try { await navigator.clipboard.writeText(texto); return true; }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = texto; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
      ta.remove(); return ok;
    }
  };

  /* ---------- Ícones ---------- */
  const P = {
    folha: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    brilho: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
    seta: '<path d="m9 18 6-6-6-6"/>',
    chama: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    coracao: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    voltar: '<path d="m12 19-7-7 7-7M19 12H5"/>',
    casa: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    livro: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    bussola: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/>',
    relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    enviar: '<path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
    whats: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/>',
    baixar: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'
  };
  G.icone = (nome, tam = 20, larg = 1.8) =>
    `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="${larg}" stroke-linecap="round" stroke-linejoin="round">${P[nome] || ""}</svg>`;
  G.PATH_FOLHA = P.folha;

  /* ---------- Árvore da gratidão ---------- */
  G.faseArvore = (n) =>
    n === 0 ? "Uma semente esperando" : n <= 7 ? "Um broto nasceu" : n <= 30 ? "Uma muda crescendo" :
    n <= 120 ? "Os galhos se abrindo" : n <= 240 ? "A copa se formando" : n < 365 ? "Uma árvore cheia de gratidão" : "Árvore completa";

  G.arvoreSVG = (n, pre, tam) => {
    const T = window.ARVORE;
    const esc = n === 0 ? 0 : 0.45 + 0.55 * Math.min(1, n / 240);
    const ls = (1 + (1 - esc) * 1.4).toFixed(2);
    const ramos = T.BR.map(([d, th]) => (n >= th ? `<path d="${d}" fill="url(#${pre}tr)"/>` : "")).join("");
    let folhas = "";
    for (let i = 0; i < n && i < T.L.length; i++) {
      const [x, y, a] = T.L[i];
      const g = (i + 1) % 30 === 0 ? "D" : x < 92 ? "A" : x < 110 ? "B" : "C";
      folhas += `<g transform="translate(${x} ${y}) rotate(${a}) scale(${ls})"><path d="M0 0 C2.5 -3.2 8 -3.4 12 0 C8 3.4 2.5 3.2 0 0Z" fill="url(#${pre}${g})"/><path d="M0.6 0 L10.5 0" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="0.5"/></g>`;
    }
    const frutos = n >= 365 ? T.FR.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="url(#${pre}fr)"/>`).join("") : "";
    const semente = n === 0 ? '<ellipse cx="100" cy="184" rx="5" ry="3.5" fill="#8C6A3E"/>' : "";
    const shRx = n === 0 ? 14 : Math.round(30 + 40 * esc);
    const glow = (Math.min(1, n / 365) * 0.7).toFixed(2);
    const sz = tam ? `width="${tam}" height="${tam}"` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" ${sz} viewBox="0 0 200 200" aria-hidden="true"><defs>
<linearGradient id="${pre}tr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4A3322"/><stop offset="0.45" stop-color="#8A6444"/><stop offset="0.7" stop-color="#6E4E34"/><stop offset="1" stop-color="#3E2A1C"/></linearGradient>
<linearGradient id="${pre}A" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FA36F"/><stop offset="1" stop-color="#2F5A41"/></linearGradient>
<linearGradient id="${pre}B" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9DBE86"/><stop offset="1" stop-color="#3F6B4E"/></linearGradient>
<linearGradient id="${pre}C" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#BCD49F"/><stop offset="1" stop-color="#55835C"/></linearGradient>
<linearGradient id="${pre}D" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F1DDA2"/><stop offset="1" stop-color="#B8893F"/></linearGradient>
<radialGradient id="${pre}sh"><stop offset="0" stop-color="#6B5A3E" stop-opacity="0.28"/><stop offset="1" stop-color="#6B5A3E" stop-opacity="0"/></radialGradient>
<radialGradient id="${pre}gl"><stop offset="0" stop-color="#DCE8CC" stop-opacity="0.9"/><stop offset="1" stop-color="#DCE8CC" stop-opacity="0"/></radialGradient>
<radialGradient id="${pre}fr" cx="0.35" cy="0.35"><stop offset="0" stop-color="#FFF3C9"/><stop offset="0.5" stop-color="#E2B95E"/><stop offset="1" stop-color="#A9802F"/></radialGradient>
</defs><ellipse cx="100" cy="188" rx="${shRx}" ry="7" fill="url(#${pre}sh)"/>${semente}<g transform="translate(100 188) scale(${esc.toFixed(3)}) translate(-100 -188)"><ellipse cx="100" cy="76" rx="72" ry="54" fill="url(#${pre}gl)" opacity="${glow}"/>${ramos}${folhas}${frutos}</g></svg>`;
  };

  /* ---------- Imagens para compartilhar (1080 × 1920) ---------- */
  G.MODELOS = [
    { nome: "Verde", cor: "#F8F4E9", destaque: "#E3C48A", escuro: true, amostra: "linear-gradient(160deg, #315745, #1F3D31)" },
    { nome: "Creme", cor: "#2B4138", destaque: "#946F38", escuro: false, amostra: "#FAF8F2" },
    { nome: "Dourado", cor: "#22382F", destaque: "#22382F", escuro: false, amostra: "linear-gradient(160deg, #E9D3A6, #C9A56B)" },
    { nome: "Linho", cor: "#2B4138", destaque: "#8A6531", escuro: false, amostra: "#EFE8DA" },
    { nome: "Noite", cor: "#F3EBDA", destaque: "#D9B676", escuro: true, amostra: "linear-gradient(160deg, #1D2B26, #10201A)" },
    { nome: "Folha", cor: "#F8F4E9", destaque: "#EBCB8E", escuro: true, amostra: "radial-gradient(circle at 85% 12%, rgba(216,182,121,0.35) 0, rgba(216,182,121,0) 40%), linear-gradient(160deg, #3E6B55, #26473A)" }
  ];

  function fundo(ctx, W, H, i) {
    let g;
    switch (i) {
      case 0: g = ctx.createLinearGradient(0, 0, W * 0.36, H); g.addColorStop(0, "#315745"); g.addColorStop(1, "#1F3D31"); break;
      case 1: g = "#FAF8F2"; break;
      case 2: g = ctx.createLinearGradient(0, 0, W * 0.36, H); g.addColorStop(0, "#E9D3A6"); g.addColorStop(1, "#C9A56B"); break;
      case 3: g = "#EFE8DA"; break;
      case 4: g = ctx.createLinearGradient(0, 0, W * 0.36, H); g.addColorStop(0, "#1D2B26"); g.addColorStop(1, "#10201A"); break;
      default: g = ctx.createLinearGradient(0, 0, W * 0.36, H); g.addColorStop(0, "#3E6B55"); g.addColorStop(1, "#26473A");
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (i === 5) {
      const r = ctx.createRadialGradient(W * 0.85, H * 0.12, 0, W * 0.85, H * 0.12, W * 0.45);
      r.addColorStop(0, "rgba(216,182,121,0.35)"); r.addColorStop(1, "rgba(216,182,121,0)");
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    }
    // anéis decorativos no canto
    ctx.save();
    ctx.strokeStyle = G.MODELOS[i].escuro ? "rgba(216,182,121,0.30)" : "rgba(148,111,56,0.18)";
    ctx.lineWidth = 3;
    [260, 330, 400].forEach((r, k) => { ctx.globalAlpha = 1 - k * 0.3; ctx.beginPath(); ctx.arc(W - 140, -60, r, 0, Math.PI * 2); ctx.stroke(); });
    ctx.restore();
  }

  function quebrar(ctx, texto, larg) {
    const palavras = String(texto).split(/\s+/);
    const linhas = []; let atual = "";
    palavras.forEach((p) => {
      const teste = atual ? atual + " " + p : p;
      if (ctx.measureText(teste).width > larg && atual) { linhas.push(atual); atual = p; } else atual = teste;
    });
    if (atual) linhas.push(atual);
    return linhas;
  }

  function carregarImagem(src) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }

  G.gerarImagem = async (o) => {
    // o = { modelo, topo, texto, sub, rodape, link, arvoreN }
    const W = 1080, H = 1920, M = G.MODELOS[o.modelo] || G.MODELOS[0];
    try {
      await Promise.all([
        document.fonts.load('400 64px "Libre Baskerville"'),
        document.fonts.load('700 34px "DM Sans"'),
        document.fonts.load('500 40px "DM Sans"')
      ]);
    } catch (e) {}
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    fundo(ctx, W, H, o.modelo);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    // selo
    ctx.save();
    ctx.strokeStyle = M.destaque; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(W / 2, 190, 62, 0, Math.PI * 2); ctx.stroke();
    ctx.translate(W / 2, 190); ctx.rotate(-10 * Math.PI / 180); ctx.translate(-36, -36); ctx.scale(3, 3);
    ctx.lineWidth = 1.8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke(new Path2D("M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"));
    ctx.stroke(new Path2D("M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"));
    ctx.restore();
    // rótulo superior
    ctx.fillStyle = M.destaque;
    ctx.font = '700 34px "DM Sans", sans-serif';
    if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
    ctx.fillText(o.topo, W / 2, 330);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    // bloco central
    ctx.font = '400 64px "Libre Baskerville", Georgia, serif';
    const tamTexto = o.texto.length > 190 ? 60 : o.texto.length > 130 ? 66 : 76;
    ctx.font = `400 ${tamTexto}px "Libre Baskerville", Georgia, serif`;
    const linhas = quebrar(ctx, o.texto, 860);
    const lh = tamTexto * 1.48;
    ctx.font = '500 40px "DM Sans", sans-serif';
    const subLinhas = o.sub ? quebrar(ctx, o.sub, 840) : [];
    ctx.font = '700 34px "DM Sans", sans-serif';
    const refLinhas = o.rodape ? quebrar(ctx, o.rodape, 860) : [];
    const arvH = o.arvoreN != null ? 620 : 0;
    const altura = arvH + (arvH ? 40 : 0) + linhas.length * lh + (subLinhas.length ? 40 + subLinhas.length * 62 : 0) + (refLinhas.length ? 50 + refLinhas.length * 52 : 0);
    let y = Math.max(420, (H - altura) / 2 + 40);
    if (arvH) {
      ctx.save();
      ctx.fillStyle = "rgba(250,248,242,0.96)";
      const bx = (W - 680) / 2, by = y - 20;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, 680, 660, 48) : ctx.rect(bx, by, 680, 660); ctx.fill();
      ctx.restore();
      const svg = G.arvoreSVG(o.arvoreN, "img", 620);
      const im = await carregarImagem("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
      ctx.drawImage(im, (W - 620) / 2, y, 620, 620);
      y += arvH + 70;
    }
    ctx.fillStyle = M.cor;
    ctx.font = `400 ${tamTexto}px "Libre Baskerville", Georgia, serif`;
    linhas.forEach((l) => { y += lh; ctx.fillText(l, W / 2, y - lh * 0.28); });
    if (subLinhas.length) {
      y += 40; ctx.font = '500 40px "DM Sans", sans-serif'; ctx.globalAlpha = 0.92;
      subLinhas.forEach((l) => { y += 62; ctx.fillText(l, W / 2, y - 16); });
      ctx.globalAlpha = 1;
    }
    if (refLinhas.length) {
      y += 50; ctx.fillStyle = M.destaque; ctx.font = '700 34px "DM Sans", sans-serif';
      if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
      refLinhas.forEach((l) => { y += 52; ctx.fillText(l, W / 2, y - 12); });
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    }
    // rodapé
    ctx.fillStyle = M.cor;
    ctx.font = '400 44px "Libre Baskerville", Georgia, serif';
    ctx.fillText("365 dias de gratidão", W / 2, H - 170);
    if (o.link) {
      ctx.font = '500 30px "DM Sans", sans-serif'; ctx.globalAlpha = 0.85;
      ctx.fillText(o.link.replace(/^https?:\/\//, ""), W / 2, H - 115);
      ctx.globalAlpha = 1;
    }
    return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
  };

  G.ehIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  G.baixar = (blob, nome) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  /* ---------- PWA ---------- */
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
