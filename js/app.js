/* ============================================================
   365 Dias de Gratidão — app do participante
   ============================================================ */
(function () {
  "use strict";
  const G = window.G365, DIAS = window.DIAS || [], EX = window.EXEMPLO || {};
  const sb = G.sb, esc = G.esc, ic = G.icone;
  const raiz = document.getElementById("app");

  const S = {
    user: null, perfil: null, config: null,
    conclusoes: new Map(),          // dia -> Date (local) da conclusão
    tela: "carregando", p: {}, pilha: [],
    menu: false,
    login: { aba: "entrar", erro: "", nome: "", usuario: "" },
    timer: { min: 3, secs: 180, run: false, iv: null },
    share: { tab: "v", modelo: 0, chave: "", url: "" }
  };

  /* ---------- Tamanho do texto ---------- */
  const ESCALAS = [0.92, 1, 1.12, 1.26];
  let tam = 1;
  try { const t = parseInt(localStorage.getItem("g365_tam"), 10); if (t >= 0 && t <= 3) tam = t; } catch (e) {}
  const aplicarTam = () => { document.documentElement.style.setProperty("--k", ESCALAS[tam]); try { localStorage.setItem("g365_tam", String(tam)); } catch (e) {} };
  aplicarTam();

  /* ============================================================
     Regras do percurso
     ============================================================ */
  function C() {
    const hoje = G.hoje();
    const lanc = G.dataISO(S.config.data_lancamento);
    const pre = hoje < lanc;
    const criado = G.dataLocalDeTimestamp(S.perfil.criado_em);
    const grupo = criado < lanc;
    let primeiro = null;
    S.conclusoes.forEach((d) => { if (!primeiro || d < primeiro) primeiro = d; });
    const inicio = grupo ? lanc : primeiro;
    const base = inicio || hoje;
    const liberado = pre ? 0 : inicio ? Math.min(365, Math.max(1, G.diasEntre(inicio, hoje) + 1)) : 1;
    const feito = (n) => S.conclusoes.has(n);
    const nF = S.conclusoes.size;
    let card = Math.max(1, liberado);
    for (let d = 1; d <= liberado; d++) { if (!feito(d)) { card = d; break; } }
    let seq = 0, j = feito(liberado) ? liberado : liberado - 1;
    while (j >= 1 && feito(j)) { seq++; j--; }
    const link = (S.config.link_cadastro || "").trim() || (location.origin + location.pathname.replace(/[^/]*$/, ""));
    return { hoje, lanc, pre, grupo, inicio, base, liberado, hojeN: liberado, feito, nF, card, seq, link,
      dataDia: (n) => G.somarDias(base, n - 1) };
  }

  /* ============================================================
     Navegação (com suporte ao botão voltar do Android)
     ============================================================ */
  function ir(tela, p = {}, opts = {}) {
    pararTimer();
    if (opts.raiz) S.pilha = [];
    else if (S.tela && !["login", "carregando"].includes(S.tela)) S.pilha.push({ tela: S.tela, p: S.p });
    S.tela = tela; S.p = p; S.menu = false;
    try { history.pushState({ g: Date.now() }, ""); } catch (e) {}
    render(true);
  }
  function voltar() { history.back(); }
  window.addEventListener("popstate", () => {
    if (!S.user) return;
    pararTimer();
    if (S.menu) { S.menu = false; render(); return; }
    const ant = S.pilha.pop();
    if (ant) { S.tela = ant.tela; S.p = ant.p; }
    else S.tela = "home", S.p = {};
    render(true);
  });

  /* ============================================================
     Dados
     ============================================================ */
  async function carregarConfigPublica() {
    const { data } = await sb.from("config").select("*").eq("id", 1).maybeSingle();
    S.config = data || { data_lancamento: "2027-01-01", cadastro_aberto: true, mostrar_exemplo: true, link_cadastro: "", convite_titulo: "", convite_msg: "", whatsapp_suporte: "5544984373004" };
  }
  async function carregarTudo() {
    const [cfg, perfil, prog] = await Promise.all([
      sb.from("config").select("*").eq("id", 1).maybeSingle(),
      sb.from("perfis").select("*").eq("id", S.user.id).maybeSingle(),
      sb.from("progresso").select("dia, concluido_em").eq("user_id", S.user.id)
    ]);
    if (cfg.data) S.config = cfg.data;
    S.perfil = perfil.data || { id: S.user.id, nome: (S.user.user_metadata || {}).nome || "", usuario: (S.user.user_metadata || {}).usuario || "", criado_em: S.user.created_at, is_admin: false };
    S.conclusoes = new Map();
    (prog.data || []).forEach((r) => S.conclusoes.set(r.dia, G.dataLocalDeTimestamp(r.concluido_em)));
    sb.rpc("registrar_acesso").then(() => {}, () => {});
  }

  /* ============================================================
     Pedaços de interface
     ============================================================ */
  const selo = (cls = "") => `<span class="selo ${cls}">${ic("folha", cls === "p" ? 15 : cls === "g" ? 28 : 18)}</span>`;
  const cab = (titulo) => `<header class="cab"><button class="btn-icone" data-acao="voltar" aria-label="Voltar">${ic("voltar", 22)}</button><strong>${esc(titulo)}</strong>${selo("p")}</header>`;
  const nav = (ativo) => `<nav class="nav" aria-label="Navegação principal">
      <button class="${ativo === "home" ? "ativo" : ""}" data-acao="nav-home">${ic("casa", 22, 1.7)}Início</button>
      <button class="${ativo === "dev" ? "ativo" : ""}" data-acao="nav-hoje">${ic("livro", 22, 1.7)}Hoje</button>
      <button class="${ativo === "prog" ? "ativo" : ""}" data-acao="nav-prog">${ic("bussola", 22, 1.7)}Progresso</button>
    </nav>`;
  const regua = (nF, clara) => {
    const pct = nF / 365 * 100;
    return `<div class="regua ${clara ? "clara" : ""}">
      <span class="bolha" style="left: clamp(0px, calc(${pct.toFixed(2)}% - 26px), calc(100% - 52px))">${G.pctTxt(nF)}</span>
      <div class="trilho" role="progressbar" aria-label="Percurso concluído" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width: ${pct.toFixed(2)}%"></i></div>
    </div>`;
  };
  const tamCtrl = () => `<div class="tam-ctrl"><button data-acao="tam-menos" aria-label="Diminuir texto">A−</button><span>Tamanho do texto</span><button class="mais" data-acao="tam-mais" aria-label="Aumentar texto">A+</button></div>`;

  function saudacao() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return ["Bom dia", "Um pequeno momento para reconhecer a bondade de Deus antes que o dia comece."];
    if (h >= 12 && h < 18) return ["Boa tarde", "Um pequeno momento para reconhecer a bondade de Deus neste dia."];
    return ["Boa noite", "Um pequeno momento para reconhecer a bondade de Deus neste dia."];
  }

  /* ============================================================
     Telas
     ============================================================ */
  function telaLogin() {
    const L = S.login, criar = L.aba === "criar", aberto = !S.config || S.config.cadastro_aberto !== false;
    return `<section class="login">
      <div class="login-topo">
        ${selo("g")}
        <span class="kicker">um tempo para</span>
        <h1 class="titulo">365 dias<br><em>de gratidão</em></h1>
        <p class="aux">Todos os dias, alguns minutos para agradecer a Deus.</p>
      </div>
      <div class="abas" role="tablist">
        <button role="tab" class="${criar ? "" : "ativo"}" data-acao="aba-entrar">Entrar</button>
        <button role="tab" class="${criar ? "ativo" : ""}" data-acao="aba-criar">Criar conta</button>
      </div>
      <form class="form" id="form-login" novalidate>
        ${criar && !aberto ? `<p class="dica">Os cadastros estão fechados no momento.</p>` : `
        ${criar ? `<label class="campo">Seu nome<input id="in-nome" type="text" maxlength="40" autocomplete="name" placeholder="Como o grupo te conhece" value="${esc(L.nome)}"></label>` : ""}
        <label class="campo">Usuário<input id="in-usuario" type="text" maxlength="20" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="ex.: maria.souza" value="${esc(L.usuario)}"></label>
        <label class="campo">Senha<input id="in-senha" type="password" minlength="6" autocomplete="${criar ? "new-password" : "current-password"}" placeholder="Mínimo de 6 caracteres"></label>
        ${L.erro ? `<p class="erro" role="alert">${esc(L.erro)}</p>` : ""}
        <button class="btn-verde" type="submit" id="btn-entrar">${criar ? "Criar conta e começar" : "Entrar"}</button>
        <p class="dica">${criar ? "Sem aprovação: a conta já fica pronta para usar." : "Seu progresso fica salvo na sua conta, em qualquer aparelho."}</p>
        ${criar ? "" : `<button type="button" class="btn-texto" data-acao="esqueci" style="margin:-4px auto 0;color:var(--verde);font-weight:700;text-decoration:underline;text-underline-offset:3px">Esqueci minha senha</button>`}`}
      </form>
      <p class="credito">Desenvolvido por Jhony Beraldo</p>
    </section>`;
  }

  function telaHome() {
    const c = C(), [sd, sdTxt] = saudacao();
    let card;
    if (c.pre) {
      const faltam = G.diasEntre(c.hoje, c.lanc);
      card = `<section class="card-verde" aria-label="Lançamento do plano">
        <span class="deco"></span>
        <span class="card-tag">${ic("brilho", 15)} O PLANO COMEÇA EM ${G.fmtNum(c.lanc)}</span>
        <div class="contagem"><strong>${faltam}</strong><span>${faltam === 1 ? "dia para começarmos" : "dias para começarmos"}</span></div>
        <p>Sua conta já está pronta. Enquanto isso, conheça como será cada dia.</p>
        ${S.config.mostrar_exemplo !== false ? `<button class="btn-prim largo" data-acao="exemplo">Fazer um dia de teste ${ic("seta", 18)}</button>` : ""}
        <button class="btn-claro-borda" data-acao="convite">${ic("enviar", 18)} Convidar amigos</button>
      </section>`;
    } else {
      const n = c.card, d = DIAS[n - 1], feitoCard = c.feito(n);
      const btn = feitoCard ? "Rever o momento de hoje" : n === c.hojeN ? "Abrir momento de hoje" : `Abrir momento do Dia ${n}`;
      card = `<section class="card-verde" aria-label="Devocional">
        <span class="deco"></span>
        <div class="card-topo"><span class="card-tag">${ic("brilho", 15)} DIA ${n}${n === c.hojeN ? " · HOJE" : ""}</span><span class="card-data">${G.fmtCurta(c.dataDia(n))}</span></div>
        <div class="aspas">“</div>
        <blockquote class="card-verso" style="margin:0">${esc(d.v)}</blockquote>
        <cite class="card-ref">${esc(d.ref)}</cite>
        <button class="btn-prim" data-acao="abrir-dia" data-dia="${n}">${btn} ${ic("seta", 18)}</button>
        <div class="percurso"><span>${ic("chama", 16)} ${c.nF}º dia do percurso</span><span>${c.nF} / 365</span></div>
        ${regua(c.nF)}
      </section>`;
    }
    return `<header class="topo-inicio">
        <div class="marca">${selo()}<div><small>um tempo para</small><strong>365 dias de gratidão</strong></div></div>
        <button class="btn-icone" data-acao="menu" aria-label="Abrir menu">${ic("menu", 22)}</button>
      </header>
      <div class="rolagem">
        <section class="saudacao">
          <span class="kicker">${esc(G.fmtLonga(c.hoje))}</span>
          <h1 class="titulo">${sd},<br><em>vamos agradecer?</em></h1>
          <p class="aux">${sdTxt}</p>
        </section>
        ${card}
        <section class="frase-rodape"><span class="circ">${ic("coracao", 16)}</span><p>“A gratidão muda o modo como enxergamos o dia que recebemos.”</p></section>
      </div>
      ${nav("home")}
      ${S.menu ? telaMenu() : ""}`;
  }

  function telaMenu() {
    return `<div class="veu" data-acao="menu-fechar"></div>
      <div class="folha" role="dialog" aria-label="Menu">
        <div class="quem"><span class="avatar">${ic("pessoa", 22)}</span><div><strong>${esc(S.perfil.nome || S.perfil.usuario)}</strong><span>@${esc(S.perfil.usuario)}</span></div></div>
        <button class="opcao" data-acao="nav-prog">Meu percurso</button>
        ${S.perfil.is_admin ? `<button class="opcao" data-acao="painel">Painel master</button>` : ""}
        <button class="opcao sair" data-acao="sair">Sair da conta</button>
        <button class="btn-texto" data-acao="menu-fechar">Fechar</button>
        <p class="credito">Desenvolvido por Jhony Beraldo</p>
      </div>`;
  }

  function telaDev() {
    const c = C(), n = S.p.dia, d = DIAS[n - 1], leitura = c.feito(n);
    const titulo = leitura ? `Reler · Dia ${n}` : n === c.hojeN ? "Devocional de hoje" : `Devocional do Dia ${n}`;
    return `${cab(titulo)}
      <div class="rolagem">
        <div class="dia-cab"><span>Dia ${n}</span><strong>${G.fmtNum(c.dataDia(n))}</strong></div>
        ${leitura ? `<p class="faixa ok">${ic("check", 17, 2.4)} Dia concluído · modo de leitura</p>` : ""}
        <section class="bloco-verso">
          <span class="rotulo">Versículo</span>
          <div class="aspas-g">“</div>
          <p>${esc(d.v)}</p>
          <div class="verso-rodape"><cite>— ${esc(d.ref)}</cite><button class="btn-pilula" data-acao="compartilhar" aria-label="Compartilhar versículo">${ic("enviar", 16)} Compartilhar</button></div>
        </section>
        <section class="secao"><span class="rotulo">Verdade prática</span><h2 class="verdade">${esc(d.verdade)}</h2></section>
        <section class="secao"><span class="rotulo">Reflexão</span><p class="leitura">${esc(d.reflexao)}</p></section>
        <section class="caixa-exemplo"><span class="ic">${ic("coracao", 18)}</span><div><span class="rotulo">Exemplo para auxiliar</span><p>${esc(d.exemplo)}</p></div></section>
        <section class="secao sem-linha"><span class="rotulo">Colocando em prática</span>
          ${d.pratica.map((t, i) => `<div class="pratica"><span class="n">${i + 1}</span><p>${esc(t)}</p></div>`).join("")}
        </section>
        ${leitura ? "" : `<button class="btn-prim largo" data-acao="grat">${ic("relogio", 19)} Iniciar momento de gratidão</button>`}
        <button class="btn-sec" style="margin-top:10px" data-acao="compartilhar">${ic("enviar", 18)} Compartilhar no Instagram ou WhatsApp</button>
        ${tamCtrl()}
      </div>
      ${nav("dev")}`;
  }

  function telaExemplo() {
    const c = C(), leitura = !!S.p.leitura;
    return `${cab(leitura ? "Reler · Dia de teste" : "Dia de teste")}
      <div class="rolagem">
        ${leitura ? `<p class="faixa ok">${ic("check", 17, 2.4)} Dia concluído · modo de leitura</p>` : `<p class="faixa ouro">${ic("brilho", 16)} Dia de teste, só para você conhecer. A partir de ${G.fmtNum(c.lanc)}, cada dia concluído fica salvo no seu percurso.</p>`}
        <div style="margin-bottom:16px"><span style="display:block;font-family:var(--f-serif);font-size:26px;color:#2D473A">Dia 1</span><span class="dia-titulo">${esc(EX.titulo)}</span></div>
        <section class="bloco-verso"><span class="rotulo">Versículo</span><div class="aspas-g">“</div><p>${esc(EX.v)}</p>
          <div class="verso-rodape"><cite>— ${esc(EX.ref)}</cite><button class="btn-pilula" data-acao="compartilhar" data-tab="v" aria-label="Compartilhar versículo">${ic("enviar", 16)} Compartilhar</button></div></section>
        <section class="secao"><span class="rotulo">Verdade prática</span><h2 class="verdade">${esc(EX.verdade)}</h2></section>
        <section class="secao"><span class="rotulo">Reflexão</span>${EX.reflexao.map((t) => `<p class="leitura">${esc(t)}</p>`).join("")}</section>
        <section class="caixa-exemplo"><span class="ic">${ic("coracao", 18)}</span><div><span class="rotulo">Exemplo para auxiliar</span>
          <p>${esc(EX.exemploIntro)}</p><ul>${EX.exemploLista.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><p>${esc(EX.exemploFim)}</p></div></section>
        <section class="secao sem-linha"><span class="rotulo">Colocando em prática</span>
          <p class="leitura">${esc(EX.praticaIntro)}</p>
          <blockquote class="oracao-destaque">“${esc(EX.praticaOracao)}”</blockquote>
          <p class="leitura">${esc(EX.praticaFim)}</p></section>
        ${leitura ? "" : `<button class="btn-prim largo" data-acao="grat-teste">${ic("relogio", 19)} Iniciar momento de gratidão</button>`}
        <button class="btn-sec" style="margin-top:10px" data-acao="compartilhar" data-tab="v">${ic("enviar", 18)} Compartilhar no Instagram ou WhatsApp</button>
        ${tamCtrl()}
      </div>
      ${nav("dev")}`;
  }

  function telaGrat() {
    const teste = !!S.p.teste, n = S.p.dia, d = teste ? EX : DIAS[n - 1], T = S.timer;
    return `${cab("Momento de gratidão")}
      <div class="grat">
        ${teste ? `<p class="faixa ouro" style="margin:-14px 0 18px">${ic("brilho", 16)} Dia de teste: ele não entra no seu percurso.</p>` : ""}
        <span class="kicker">${teste ? "dia de teste" : "dia " + n} · ${esc(d.ref.toLowerCase())}</span>
        <h1 class="titulo m">Agora, apenas<br><em>agradeça.</em></h1>
        <p class="aux">Feche os olhos. Respire com calma. Deixe seu coração reconhecer a bondade de Deus.</p>
        <div class="anel" id="anel"><div><small class="r">tempo de gratidão</small><strong id="tempo">00:00</strong><small class="s" id="tempo-sub"></small></div></div>
        <div class="chips" role="group" aria-label="Escolher duração">${[3, 4, 5].map((m) => `<button class="chip ${T.min === m ? "ativo" : ""}" data-acao="min" data-min="${m}">${m} min</button>`).join("")}</div>
        <p class="frase-ouro">“Senhor, eu te agradeço por...”</p>
        <button class="btn-prim" style="min-width:230px" data-acao="timer" id="btn-timer"></button>
        <button class="btn-texto" style="margin-top:16px" data-acao="concluir" id="btn-concluir">${ic("check", 17)} Marcar dia como concluído</button>
      </div>`;
  }

  function mesesDoPercurso(c) {
    const lista = [];
    for (let i = 0; i < 365; i++) {
      const d = G.somarDias(c.inicio || (c.pre ? c.lanc : c.hoje), i), k = d.getFullYear() * 12 + d.getMonth();
      let m = lista[lista.length - 1];
      if (!m || m.k !== k) { m = { k, y: d.getFullYear(), mo: d.getMonth(), total: 0, feitos: 0, dias: [] }; lista.push(m); }
      m.total++; m.dias.push(i + 1); if (c.feito(i + 1)) m.feitos++;
    }
    return lista;
  }

  function telaProg() {
    const real = C(), teste = !!S.p.teste;
    const c = teste ? Object.assign({}, real, { pre: false, nF: 1, seq: 1, hojeN: 1, inicio: real.lanc, feito: (n) => n === 1, dataDia: (n) => G.somarDias(real.lanc, n - 1) }) : real;
    const meses = mesesDoPercurso(c), nF = c.nF;
    const kHoje = c.pre ? -1 : c.dataDia(c.hojeN).getFullYear() * 12 + c.dataDia(c.hojeN).getMonth();
    const cruza = meses[0].y !== meses[meses.length - 1].y;
    const fim = meses[meses.length - 1];
    const seqTxt = c.seq > 1 ? `${c.seq} dias seguidos` : c.seq === 1 ? "1 dia seguido" : nF ? "recomece hoje, sem pressa" : "comece no seu ritmo, sem pressa";
    const linhas = meses.map((m) => {
      const tem = m.feitos > 0, completo = m.feitos === m.total, futuro = m.k > kHoje, atual = m.k === kHoje;
      const nome = G.MESC[m.mo] + (cruza ? " " + String(m.y).slice(2) : "");
      const clica = tem;
      return `<button class="mes ${atual ? "atual" : ""} ${futuro ? "futuro" : ""} ${clica ? "" : "sem"}" ${clica ? `data-acao="mes" data-k="${m.k}" data-teste="${teste ? 1 : ""}"` : 'tabindex="-1"'} aria-label="${G.MES[m.mo]} de ${m.y}: ${m.feitos} de ${m.total} dias">
          <span>${nome}</span><span class="barra"><i style="width:${(m.feitos / m.total * 100).toFixed(1)}%"></i></span>
          <span class="qtd ${completo ? "" : "n"}">${completo ? ic("folha", 17, 2) : `${m.feitos} de ${m.total}`}</span>
          <span class="chev" style="opacity:${clica ? 1 : 0}">${ic("seta", 16, 2)}</span></button>`;
    }).join("");
    const feitoAgora = S.p.feitoDia;
    return `${cab("Meu percurso")}
      <div class="rolagem" style="padding-top:28px">
        ${teste ? `<p class="faixa ouro">${ic("brilho", 16)} Simulação do dia de teste. A partir de ${G.fmtNum(real.lanc)}, seus dias concluídos ficam salvos aqui.</p>` : ""}
        <section>
          <span class="kicker">um dia de cada vez</span>
          <h1 class="titulo m">Seu caminho<br><em>de gratidão.</em></h1>
          <p class="aux" style="margin-bottom:22px">Você está construindo uma memória diária da bondade de Deus.</p>
          <div class="prog-topo">
            <div><div class="prog-num"><strong>${nF}</strong><span>/ 365 dias</span></div><span class="fase">${G.faseArvore(nF)}</span></div>
            <button class="arvore-btn" data-acao="arvore" data-teste="${teste ? 1 : ""}" aria-label="Ver minha árvore da gratidão">${G.arvoreSVG(nF, "pt", 112)}</button>
          </div>
          ${regua(nF, true)}
        </section>
        <section class="constancia"><span class="ic">${ic("chama", 20)}</span><div><small>constância</small><strong>${seqTxt}</strong></div>${c.seq > 0 ? `<span class="mais">continue assim</span>` : ""}</section>
        ${feitoAgora ? `<p class="concluido-msg">${ic("check", 18, 2.4)} ${teste ? "Dia de teste marcado como concluído" : `Dia ${feitoAgora} marcado como concluído`}</p>
          <button class="btn-prim largo" style="margin-top:10px" data-acao="compartilhar" ${teste ? 'data-tab="v"' : `data-dia="${feitoAgora}"`}>${ic("enviar", 18)} Compartilhar meu dia</button>` : ""}
        <section class="meses">
          <div class="meses-cab"><div><span class="kicker claro">${G.MESC[meses[0].mo].toUpperCase()} ${meses[0].y} – ${G.MESC[fim.mo].toUpperCase()} ${fim.y}</span><h2>Seu ano em gratidão</h2></div><span style="color:#DDB97A">${ic("folha", 22)}</span></div>
          <div style="margin-top:14px">${linhas}</div>
          <p>Toque em um mês para reler os dias concluídos.</p>
        </section>
        <section class="lembranca"><span class="kicker">uma lembrança para levar</span><p>“Bom é render graças ao Senhor.”</p><cite>Salmos 92:1</cite></section>
      </div>
      ${nav("prog")}`;
  }

  function telaMes() {
    const real = C(), teste = !!S.p.teste;
    const c = teste ? Object.assign({}, real, { pre: false, inicio: real.lanc, feito: (n) => n === 1, dataDia: (n) => G.somarDias(real.lanc, n - 1) }) : real;
    const m = mesesDoPercurso(c).find((x) => x.k === S.p.k);
    if (!m) return telaProg();
    const nomeMes = G.MES[m.mo];
    const dias = m.dias.filter((n) => c.feito(n));
    if (teste) {
      const d = c.dataDia(1);
      return `${cab(nomeMes[0].toUpperCase() + nomeMes.slice(1) + " de " + m.y)}
      <div class="rolagem" style="padding-top:24px">
        <p class="faixa ouro">${ic("brilho", 16)} Simulação do dia de teste. A partir de ${G.fmtNum(real.lanc)}, seus dias concluídos aparecem aqui.</p>
        <span class="kicker">${m.y} · dias concluídos</span>
        <h1 class="titulo m" style="margin-bottom:18px">Reler <em>${nomeMes}</em></h1>
        <div class="lista-dias"><button class="item-dia" data-acao="reler-teste">
            <span class="num"><small>DIA</small><b>1</b></span>
            <span class="tx"><strong>${esc(EX.ref)}</strong><span>${G.SEMANA[d.getDay()]}, ${G.fmtNum(d)} · dia de teste</span></span>
            <span style="color:#A8804A">${ic("seta", 18, 2)}</span></button></div>
      </div>
      ${nav("prog")}`;
    }
    return `${cab(nomeMes[0].toUpperCase() + nomeMes.slice(1) + " de " + m.y)}
      <div class="rolagem" style="padding-top:24px">
        <span class="kicker">${m.y} · dias concluídos</span>
        <h1 class="titulo m" style="margin-bottom:18px">Reler <em>${nomeMes}</em></h1>
        ${dias.length ? "" : `<p class="aux">Os dias que você concluir vão aparecer aqui.</p>`}
        <div class="lista-dias">${dias.map((n) => { const d = c.dataDia(n); return `<button class="item-dia" data-acao="abrir-dia" data-dia="${n}">
            <span class="num"><small>DIA</small><b>${n}</b></span>
            <span class="tx"><strong>${esc(DIAS[n - 1].ref)}</strong><span>${G.SEMANA[d.getDay()]}, ${G.fmtNum(d)}</span></span>
            <span style="color:#A8804A">${ic("seta", 18, 2)}</span></button>`; }).join("")}</div>
      </div>
      ${nav("prog")}`;
  }

  function telaArvore() {
    const c = C(), n = S.p.teste ? 1 : c.nF;
    return `${cab("Minha árvore")}
      <div class="rolagem" style="padding-top:22px">
        <span class="kicker">árvore da gratidão</span>
        <h1 class="titulo m" style="margin:10px 0 6px">${G.faseArvore(n)}</h1>
        <p class="aux" style="margin-bottom:16px">Cada dia concluído faz nascer uma folha. A cada 30 dias, uma folha dourada.</p>
        <div class="arvore-grande">${G.arvoreSVG(n, "ag")}</div>
        <div class="duas-col">
          <div class="mini-card"><strong>${n}</strong><span>${n === 1 ? "folha" : "folhas"}</span></div>
          <div class="mini-card"><strong class="ouro">${Math.floor(n / 30)}</strong><span>folhas douradas</span></div>
        </div>
        ${c.pre ? "" : `<button class="btn-prim largo" style="margin-top:16px" data-acao="compartilhar" data-tab="a">${ic("enviar", 18)} Compartilhar minha árvore</button>`}
      </div>
      ${nav("prog")}`;
  }

  /* ---------- Compartilhar ---------- */
  function conteudoShare() {
    const c = C(), tab = S.share.tab, n = S.p.dia || c.card;
    const d = c.pre ? EX : DIAS[n - 1];
    const prefixo = c.pre ? "DIA DE EXEMPLO" : `DIA ${n}`;
    const link = c.link;
    if (tab === "c") return {
      topo: "CONVITE PARA O PROJETO", texto: S.config.convite_titulo || "Você aceita viver 365 dias aprendendo a agradecer?",
      sub: "365 dias. Um versículo por dia. Alguns minutos na presença de Deus.",
      rodape: `COMEÇAMOS EM ${G.fmtExtenso(c.lanc).toUpperCase()}. VOCÊ VEM CONOSCO?`, link,
      msg: (S.config.convite_msg || "").trim() + "\n\n👉 " + link, arquivo: "convite-365-dias-de-gratidao.png" };
    if (tab === "t") return { topo: `${prefixo} · VERDADE PRÁTICA`, texto: d.verdade, rodape: d.ref.toUpperCase(), link,
      msg: `${d.verdade} (${d.ref})\n\n365 dias de gratidão: ${link}`, arquivo: `gratidao-${c.pre ? "exemplo" : "dia-" + n}.png` };
    if (tab === "a") return { topo: "MINHA ÁRVORE DA GRATIDÃO", texto: `${c.nF} ${c.nF === 1 ? "folha" : "folhas"} · ${G.faseArvore(c.nF).toLowerCase()}`,
      rodape: `${c.nF} DE 365 DIAS DE GRATIDÃO`, arvoreN: c.nF, link,
      msg: `Minha árvore da gratidão já tem ${c.nF} ${c.nF === 1 ? "folha" : "folhas"}. 🌿\n\n365 dias de gratidão: ${link}`, arquivo: "minha-arvore-da-gratidao.png" };
    return { topo: `${prefixo} · VERSÍCULO`, texto: `“${d.v}”`, rodape: d.ref.toUpperCase(), link,
      msg: `“${d.v}” — ${d.ref}\n\n365 dias de gratidão: ${link}`, arquivo: `gratidao-${c.pre ? "exemplo" : "dia-" + n}.png` };
  }

  function telaShare() {
    const c = C(), tab = S.share.tab;
    const abas = (c.pre ? [["c", "Convite"], ["v", "Versículo"], ["t", "Verdade prática"]] : [["v", "Versículo"], ["t", "Verdade prática"], ["a", "Minha árvore"]]);
    const conv = tab === "c" ? conteudoShare() : null;
    return `${cab("Compartilhar")}
      <div class="rolagem share" style="padding-bottom:calc(30px + var(--base))">
        <div class="previa-wrap"><div class="previa" id="previa" aria-label="Prévia da imagem"></div></div>
        <div class="abas-share">${abas.map(([k, l]) => `<button class="${tab === k ? "ativo" : ""}" data-acao="share-tab" data-tab="${k}">${l}</button>`).join("")}</div>
        <span class="kicker">Escolha o modelo</span>
        <div class="modelos">${G.MODELOS.map((m, i) => `<button class="${S.share.modelo === i ? "ativo" : ""}" data-acao="modelo" data-i="${i}" aria-label="Modelo ${m.nome}"><span class="amostra" style="background:${m.amostra};color:${m.destaque}">“</span>${m.nome}</button>`).join("")}</div>
        <div class="acoes">
          <button data-acao="enviar" data-para="stories"><span class="bola">${ic("enviar", 22)}</span>Stories</button>
          <button data-acao="enviar" data-para="whatsapp"><span class="bola">${ic("whats", 22)}</span>WhatsApp</button>
          <button data-acao="enviar" data-para="salvar"><span class="bola">${ic("baixar", 22)}</span>Salvar imagem</button>
        </div>
        ${conv ? `<section class="msg-card"><span class="kicker">Mensagem que vai junto no WhatsApp</span><p>${esc(conv.msg)}</p>
          <button class="btn-sec" style="margin-top:14px;min-height:48px" data-acao="copiar-msg">Copiar mensagem</button></section>` : ""}
      </div>`;
  }

  let gerando = 0;
  async function atualizarPrevia() {
    const el = document.getElementById("previa");
    if (!el) return;
    const o = conteudoShare();
    const chave = JSON.stringify([S.share.tab, S.share.modelo, o.texto, o.topo]);
    if (chave === S.share.chave && S.share.url) { el.innerHTML = `<img src="${S.share.url}" alt="">`; return; }
    const id = ++gerando;
    const blob = await G.gerarImagem({ modelo: S.share.modelo, ...o });
    if (id !== gerando || !blob) return;
    if (S.share.url) URL.revokeObjectURL(S.share.url);
    S.share.url = URL.createObjectURL(blob); S.share.blob = blob; S.share.chave = chave;
    const atual = document.getElementById("previa");
    if (atual) atual.innerHTML = `<img src="${S.share.url}" alt="Prévia da imagem para compartilhar">`;
  }

  async function enviar(para) {
    const o = conteudoShare();
    const chave = JSON.stringify([S.share.tab, S.share.modelo, o.texto, o.topo]);
    if (chave !== S.share.chave || !S.share.blob) await atualizarPrevia();
    const blob = S.share.blob;
    if (!blob) return G.toast("Aguarde a imagem ficar pronta.");
    const file = new File([blob], o.arquivo, { type: "image/png" });
    const podeArquivo = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    try {
      if (para === "whatsapp") {
        if (podeArquivo) { await navigator.share({ files: [file], text: o.msg }); return; }
        window.open("https://wa.me/?text=" + encodeURIComponent(o.msg), "_blank");
        return;
      }
      if (para === "stories") {
        if (podeArquivo) { await navigator.share({ files: [file] }); return; }
        G.baixar(blob, o.arquivo);
        G.toast("Imagem salva. Abra o Instagram e adicione aos Stories.");
        return;
      }
      if (G.ehIOS() && podeArquivo) { await navigator.share({ files: [file] }); return; }
      G.baixar(blob, o.arquivo);
      G.toast("Imagem salva.");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      G.baixar(blob, o.arquivo);
      G.toast("Imagem salva no aparelho.");
    }
  }

  /* ---------- Cronômetro ---------- */
  function pararTimer() { if (S.timer.iv) clearInterval(S.timer.iv); S.timer.iv = null; S.timer.run = false; }
  function desenharTimer() {
    const T = S.timer, total = T.min * 60;
    const tempo = document.getElementById("tempo"); if (!tempo) return;
    tempo.textContent = `${G.p2(Math.floor(T.secs / 60))}:${G.p2(T.secs % 60)}`;
    document.getElementById("tempo-sub").textContent = T.run ? "permaneça neste momento" : T.secs === 0 ? "amém" : "quando estiver pronto";
    document.getElementById("anel").style.setProperty("--p", ((total - T.secs) / total * 100).toFixed(2) + "%");
    document.getElementById("btn-timer").textContent = T.run ? "❚❚  Pausar momento" : "▶  Começar a agradecer";
  }
  function alternarTimer() {
    const T = S.timer;
    if (T.run) { pararTimer(); desenharTimer(); return; }
    if (T.secs <= 0) T.secs = T.min * 60;
    T.run = true;
    let fim = Date.now() + T.secs * 1000;
    T.iv = setInterval(() => {
      T.secs = Math.max(0, Math.round((fim - Date.now()) / 1000));
      if (T.secs <= 0) { pararTimer(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
      desenharTimer();
    }, 250);
    desenharTimer();
  }

  /* ============================================================
     Render
     ============================================================ */
  function render(topo) {
    let html;
    switch (S.tela) {
      case "login": html = telaLogin(); break;
      case "home": html = telaHome(); break;
      case "dev": html = telaDev(); break;
      case "exemplo": html = telaExemplo(); break;
      case "grat": html = telaGrat(); break;
      case "prog": html = telaProg(); break;
      case "mes": html = telaMes(); break;
      case "arvore": html = telaArvore(); break;
      case "share": html = telaShare(); break;
      case "config": html = `<div class="carregando" style="padding:30px;text-align:center;line-height:1.6">Preencha o arquivo <b>js/config.js</b> com os dados do Supabase para usar o app.</div>`; break;
      default: html = `<div class="carregando">Carregando…</div>`;
    }
    raiz.innerHTML = `<div class="tela">${html}</div><div class="toast" id="toast" role="status" aria-live="polite"></div>`;
    if (topo) { const r = raiz.querySelector(".rolagem, .grat, .login"); if (r) r.scrollTop = 0; }
    if (S.tela === "grat") desenharTimer();
    if (S.tela === "share") atualizarPrevia();
  }

  /* ============================================================
     Ações
     ============================================================ */
  raiz.addEventListener("click", async (ev) => {
    const el = ev.target.closest("[data-acao]");
    if (!el) return;
    const a = el.dataset.acao;
    const c = S.user && S.config && S.perfil ? C() : null;
    switch (a) {
      case "voltar": voltar(); break;
      case "esqueci": {
        const num = String((S.config && S.config.whatsapp_suporte) || "5544984373004").replace(/\D/g, "");
        const u = G.normalizarUsuario(S.login.usuario);
        const texto = `Olá, esqueci a senha do 365 dias de gratidão. Meu usuário é ${u || "___"}`;
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(texto)}`, "_blank");
        break;
      }
      case "aba-entrar": S.login.aba = "entrar"; S.login.erro = ""; render(); break;
      case "aba-criar": S.login.aba = "criar"; S.login.erro = ""; render(); break;
      case "menu": S.menu = true; try { history.pushState({ m: 1 }, ""); } catch (e) {} render(); break;
      case "menu-fechar": history.back(); break;
      case "painel": location.href = "admin.html"; break;
      case "sair": pararTimer(); await sb.auth.signOut(); S.user = null; S.perfil = null; S.conclusoes = new Map(); S.pilha = []; S.menu = false; S.tela = "login"; render(true); break;
      case "nav-home": ir("home", {}, { raiz: true }); break;
      case "nav-hoje":
        if (c.pre) { if (S.config.mostrar_exemplo !== false) ir("exemplo", {}, { raiz: true }); else G.toast(`O plano começa em ${G.fmtNum(c.lanc)}.`); }
        else ir("dev", { dia: c.card }, { raiz: true });
        break;
      case "nav-prog": ir("prog", {}, { raiz: true }); break;
      case "abrir-dia": { const n = +el.dataset.dia; if (n >= 1 && n <= c.liberado) ir("dev", { dia: n }); break; }
      case "exemplo": ir("exemplo"); break;
      case "convite": S.share.tab = "c"; ir("share", {}); break;
      case "grat": S.timer = { min: S.timer.min, secs: S.timer.min * 60, run: false, iv: null }; ir("grat", { dia: S.p.dia }); break;
      case "grat-teste": S.timer = { min: S.timer.min, secs: S.timer.min * 60, run: false, iv: null }; ir("grat", { teste: true }); break;
      case "min": pararTimer(); S.timer.min = +el.dataset.min; S.timer.secs = S.timer.min * 60; render(); break;
      case "timer": alternarTimer(); break;
      case "concluir": {
        if (S.p.teste) { pararTimer(); ir("prog", { teste: true, feitoDia: "teste" }, { raiz: true }); break; }
        const n = S.p.dia;
        if (c.feito(n)) { ir("prog", { feitoDia: n }, { raiz: true }); break; }
        el.disabled = true;
        pararTimer();
        const { error } = await sb.from("progresso").insert({ user_id: S.user.id, dia: n });
        if (error && !String(error.message || "").toLowerCase().includes("duplicate")) { el.disabled = false; G.toast(G.traduzirErro(error)); break; }
        S.conclusoes.set(n, G.hoje());
        ir("prog", { feitoDia: n }, { raiz: true });
        break;
      }
      case "arvore": ir("arvore", { teste: !!el.dataset.teste }); break;
      case "mes": ir("mes", { k: +el.dataset.k, teste: !!el.dataset.teste }); break;
      case "reler-teste": ir("exemplo", { leitura: true }); break;
      case "compartilhar": {
        const dia = el.dataset.dia ? +el.dataset.dia : S.p.dia;
        S.share.tab = el.dataset.tab || (c.pre ? "c" : "v");
        ir("share", { dia });
        break;
      }
      case "share-tab": S.share.tab = el.dataset.tab; render(); break;
      case "modelo": S.share.modelo = +el.dataset.i; render(); break;
      case "enviar": enviar(el.dataset.para); break;
      case "copiar-msg": { const ok = await G.copiar(conteudoShare().msg); G.toast(ok ? "Mensagem copiada. É só colar no WhatsApp junto com a imagem." : "Não foi possível copiar."); break; }
      case "tam-menos": tam = Math.max(0, tam - 1); aplicarTam(); break;
      case "tam-mais": tam = Math.min(3, tam + 1); aplicarTam(); break;
    }
  });

  raiz.addEventListener("input", (ev) => {
    if (ev.target.id === "in-nome") S.login.nome = ev.target.value;
    if (ev.target.id === "in-usuario") S.login.usuario = ev.target.value;
  });

  raiz.addEventListener("submit", async (ev) => {
    if (ev.target.id !== "form-login") return;
    ev.preventDefault();
    const L = S.login, criar = L.aba === "criar";
    const nome = (L.nome || "").trim(), usuario = G.normalizarUsuario(L.usuario), senha = (document.getElementById("in-senha") || {}).value || "";
    const falha = (m) => { L.erro = m; render(); };
    if (criar && nome.length < 2) return falha("Informe seu nome.");
    if (!/^[a-z0-9._]{3,20}$/.test(usuario)) return falha("O usuário deve ter de 3 a 20 caracteres: letras, números, ponto ou sublinhado.");
    if (senha.length < 6) return falha("A senha precisa ter pelo menos 6 caracteres.");
    const btn = document.getElementById("btn-entrar"); if (btn) { btn.disabled = true; btn.textContent = "Aguarde…"; }
    try {
      let res;
      if (criar) {
        res = await sb.auth.signUp({ email: G.emailDe(usuario), password: senha, options: { data: { nome, usuario } } });
        if (res.error) throw res.error;
        if (!res.data.session) throw new Error("email not confirmed");
      } else {
        res = await sb.auth.signInWithPassword({ email: G.emailDe(usuario), password: senha });
        if (res.error) throw res.error;
      }
      S.user = res.data.user;
      L.erro = ""; L.nome = ""; L.usuario = "";
      await carregarTudo();
      S.pilha = []; S.tela = "home"; S.p = {};
      render(true);
    } catch (e) {
      falha(G.traduzirErro(e));
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && S.user && S.tela === "home") render();
  });

  /* ============================================================
     Início
     ============================================================ */
  (async () => {
    if (!G.configurado) { S.tela = "config"; render(); return; }
    try {
      const { data } = await sb.auth.getSession();
      if (data.session) {
        S.user = data.session.user;
        await carregarTudo();
        S.tela = "home";
      } else {
        await carregarConfigPublica();
        S.tela = "login";
      }
    } catch (e) {
      try { await carregarConfigPublica(); } catch (_) {}
      S.tela = "login";
    }
    try { history.replaceState({ g: 0 }, ""); } catch (e) {}
    render(true);
  })();
})();
