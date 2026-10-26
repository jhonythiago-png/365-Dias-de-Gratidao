/* ============================================================
   365 Dias de Gratidão — painel master
   ============================================================ */
(function () {
  "use strict";
  const G = window.G365, sb = G.sb, esc = G.esc, ic = G.icone;
  const raiz = document.getElementById("painel");
  const S = { user: null, perfil: null, config: null, pessoas: [], aba: "visao", filtro: "todos", busca: "", reset: null, erro: "", carregando: true };

  /* ---------- Cálculos ---------- */
  function acessoTxt(ts) {
    if (!ts) return "—";
    const d = new Date(ts), dia = G.dataLocalDeTimestamp(ts), dif = G.diasEntre(dia, G.hoje());
    const hm = `${G.p2(d.getHours())}:${G.p2(d.getMinutes())}`;
    if (dif === 0) return `hoje, ${hm}`;
    if (dif === 1) return `ontem, ${hm}`;
    if (dif < 7) return `há ${dif} dias`;
    return G.fmtNum(dia);
  }
  function linhas() {
    const hoje = G.hoje(), lanc = G.dataISO(S.config.data_lancamento), pre = hoje < lanc;
    return S.pessoas.map((p) => {
      const cad = G.dataLocalDeTimestamp(p.criado_em), grupo = cad < lanc;
      const primeiro = p.primeiro_concluido ? G.dataLocalDeTimestamp(p.primeiro_concluido) : null;
      const inicio = grupo ? lanc : primeiro;
      const feitos = p.feitos || 0;
      const limite = pre ? 0 : inicio ? Math.min(365, G.diasEntre(inicio, hoje) + 1) : 0;
      const atras = limite - feitos;
      let status, cls, cat;
      if (pre) { status = "Aguardando lançamento"; cls = "e-nao"; cat = "nao"; }
      else if (feitos === 0) { status = "Não começou"; cls = "e-nao"; cat = "nao"; }
      else if (atras <= 0) { status = "Em dia"; cls = "e-dia"; cat = "dia"; }
      else if (atras === 1) { status = "Falta o de hoje"; cls = "e-hoje"; cat = "dia"; }
      else { status = `${atras} dias atrás`; cls = "e-atr"; cat = "atr"; }
      return {
        id: p.id, nome: p.nome, usuario: p.usuario, cad: G.fmtNum(cad), cadData: cad,
        inicio: grupo ? `${G.fmtNum(lanc)} (grupo)` : primeiro ? G.fmtNum(primeiro) : "no 1º concluído",
        feitos, pct: G.pctTxt(feitos), largura: Math.max(feitos / 365 * 100, feitos ? 2 : 0).toFixed(1),
        prox: pre ? "—" : feitos >= 365 ? "Concluiu" : atras <= 0 ? `Dia ${feitos + 1}, amanhã` : `Dia ${feitos + 1}`,
        acesso: acessoTxt(p.ultimo_acesso), status, cls, cat, emDiaHoje: !pre && feitos > 0 && atras <= 0
      };
    });
  }

  /* ---------- Telas ---------- */
  function topo() {
    return `<header class="p-topo"><div class="in">
      <div class="marca"><span class="selo">${ic("folha", 18)}</span><div><strong>365 dias de gratidão</strong><small>PAINEL MASTER</small></div></div>
      <div class="quem"><span>${esc(S.perfil.nome || S.perfil.usuario)} · administrador</span><button data-acao="app">Abrir o app</button><button data-acao="sair">Sair</button></div>
    </div></header>`;
  }

  function visao(L) {
    const hoje = G.hoje(), lanc = G.dataISO(S.config.data_lancamento), pre = hoje < lanc;
    const ativos = L.filter((r) => r.feitos > 0);
    const media = ativos.length ? ativos.reduce((a, r) => a + r.feitos, 0) / ativos.length : 0;
    const m = pre
      ? [[L.length, "participantes cadastrados"], [G.diasEntre(hoje, lanc), "dias para o lançamento"], [S.config.cadastro_aberto ? "Aberto" : "Fechado", "cadastro"], [L.filter((r) => r.cadData < lanc).length, "já começam junto com o grupo"]]
      : [[L.length, "participantes cadastrados"], [L.filter((r) => r.emDiaHoje).length, "já fizeram o dia de hoje"], [media.toFixed(1).replace(".", ","), "média de dias concluídos"], [L.filter((r) => r.cat === "atr").length, "com 2 ou mais dias atrás"]];
    const diaGrupo = pre ? 0 : Math.min(365, G.diasEntre(lanc, hoje) + 1);
    const recentes = S.pessoas.slice(0, 4);
    return `<div class="grade-4">${m.map(([v, l]) => `<div class="cartao metrica"><strong>${esc(v)}</strong><span>${l}</span></div>`).join("")}</div>
      <div class="grade-2">
        <section class="cartao"><span class="kicker">Situação do projeto</span>
          <p class="situacao">${pre ? `Fase de cadastro: o plano começa em ${G.fmtNum(lanc)}.` : `Plano em andamento: hoje é o Dia ${diaGrupo} para o grupo.`}</p>
          <p class="p-txt">${pre ? "Os participantes veem a contagem regressiva, o dia de exemplo e o convite para compartilhar." : "Cada participante segue no próprio ritmo, sempre em sequência e sem passar do dia de hoje."}</p></section>
        <section class="cartao"><span class="kicker">Link de cadastro</span>
          <p class="link-box">${esc(linkCadastro())}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-verde" style="width:auto;padding:0 18px;min-height:48px;font-size:15px" data-acao="copiar-link">Copiar link</button><button class="btn-borda" data-acao="aba" data-aba="config">Editar configurações</button></div></section>
      </div>
      <section class="cartao" style="margin-top:12px"><span class="kicker">Cadastros mais recentes</span>
        <div style="margin-top:8px">${recentes.length ? recentes.map((p) => `<div class="linha-rec"><strong>${esc(p.nome)}</strong><span>cadastrou em ${G.fmtNum(G.dataLocalDeTimestamp(p.criado_em))}</span></div>`).join("") : `<p class="p-txt">Ainda não há cadastros.</p>`}</div></section>`;
  }

  function participantes(L) {
    const b = S.busca.trim().toLowerCase();
    const vis = L.filter((r) => (S.filtro === "todos" || r.cat === S.filtro) && (!b || r.nome.toLowerCase().includes(b) || r.usuario.includes(b)));
    const F = [["todos", "Todos"], ["dia", "Em dia"], ["atr", "Atrasados"], ["nao", "Não começaram"]];
    return `<section class="cartao">
      <div class="barra-ferr">
        <div class="filtros">${F.map(([k, l]) => `<button class="${S.filtro === k ? "ativo" : ""}" data-acao="filtro" data-f="${k}">${l}</button>`).join("")}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input class="busca" id="busca" type="search" placeholder="Nome ou usuário" value="${esc(S.busca)}" aria-label="Buscar participante"><button class="btn-borda" data-acao="exportar">Exportar lista</button></div>
      </div>
      <div class="tabela-wrap"><table class="tabela">
        <thead><tr><th>Participante</th><th>Cadastro</th><th>Início (Dia 1)</th><th>Progresso</th><th>Próximo dia</th><th>Último acesso</th><th>Situação</th><th>Ações</th></tr></thead>
        <tbody>${vis.length ? vis.map((r) => `<tr>
          <td><strong>${esc(r.nome)}</strong><small>@${esc(r.usuario)}</small></td>
          <td>${r.cad}</td><td>${esc(r.inicio)}</td>
          <td><div class="mini-regua"><span class="t"><i style="width:${r.largura}%"></i></span><strong>${r.feitos}/365</strong><small style="display:inline">${r.pct}</small></div></td>
          <td>${esc(r.prox)}</td><td>${esc(r.acesso)}</td>
          <td><span class="etiqueta ${r.cls}">${esc(r.status)}</span></td>
          <td><button class="btn-borda" style="min-height:40px;white-space:nowrap" data-acao="reset" data-id="${r.id}">Redefinir senha</button></td>
        </tr>`).join("") : `<tr><td colspan="8" style="color:var(--suave)">Nenhum participante encontrado.</td></tr>`}</tbody>
      </table></div>
      <p class="p-txt" style="font-size:14px">Os participantes não veem esta tela nem o progresso uns dos outros.</p>
    </section>`;
  }

  function configuracoes() {
    const c = S.config, lanc = G.dataISO(c.data_lancamento), corte = G.somarDias(lanc, -1);
    const chave = (id, t, h, on) => `<div class="chave"><div><strong>${t}</strong><span>${h}</span></div><button class="switch" role="switch" id="${id}" aria-checked="${on ? "true" : "false"}" aria-label="${t}" data-acao="switch"></button></div>`;
    return `<div class="grade-2" style="margin-top:0">
      <section class="cartao p-form"><span class="kicker">Início do projeto</span>
        <label class="campo">Data de lançamento do plano<input type="date" id="cfg-data" value="${esc(c.data_lancamento)}"><span>Antes desta data, os participantes veem a contagem regressiva e o dia de exemplo.</span></label>
        <div class="regra" id="regra"><strong>Regra de início</strong><br>Quem se cadastrar até <strong>${G.fmtNum(corte)}</strong> começa junto com o grupo, em <strong>${G.fmtNum(lanc)}</strong>. Quem se cadastrar depois começa no primeiro dia que marcar como concluído.</div>
        ${chave("cfg-cadastro", "Cadastro aberto", "Desligue para impedir novos cadastros.", c.cadastro_aberto)}
        ${chave("cfg-exemplo", "Mostrar dia de exemplo", "Exibido apenas antes do lançamento.", c.mostrar_exemplo)}
        <label class="campo">WhatsApp para pedidos de senha<input type="tel" id="cfg-whats" inputmode="tel" value="${esc(formatarWhats(c.whatsapp_suporte))}" placeholder="(44) 98437-3004"><span>Quem tocar em "Esqueci minha senha" no login abre uma conversa com este número.</span></label>
      </section>
      <section class="cartao p-form"><span class="kicker">Link e convite</span>
        <label class="campo">Link de cadastro<input type="url" id="cfg-link" value="${esc(c.link_cadastro)}" placeholder="${esc(padraoLink())}"><span>Endereço que vai nas imagens e na mensagem de convite. Em branco, usa o endereço do app.</span></label>
        <label class="campo">Frase principal da imagem<input type="text" id="cfg-titulo" value="${esc(c.convite_titulo)}"></label>
        <label class="campo">Mensagem do WhatsApp<textarea id="cfg-msg">${esc(c.convite_msg)}</textarea><span>O link de cadastro é adicionado automaticamente ao final.</span></label>
      </section>
    </div>
    <div class="salvar-linha"><button class="btn-verde" data-acao="salvar">Salvar configurações</button></div>`;
  }

  function modalReset() {
    const p = S.pessoas.find((x) => x.id === S.reset);
    return `<div class="modal-veu"><div class="modal" role="dialog" aria-label="Redefinir senha">
      <strong class="t">Redefinir senha</strong>
      <span class="p-txt" style="margin:0">Defina uma nova senha para <strong>${esc(p ? p.nome : "")}</strong> e envie para a pessoa.</span>
      <label class="campo">Nova senha<input type="text" id="nova-senha" placeholder="Mínimo de 6 caracteres" autocomplete="off"></label>
      ${S.erro ? `<p class="erro" role="alert">${esc(S.erro)}</p>` : ""}
      <div class="acoes-m"><button class="btn-borda" data-acao="reset-cancelar">Cancelar</button><button class="btn-verde" data-acao="reset-salvar">Salvar nova senha</button></div>
    </div></div>`;
  }

  function telaLogin() {
    return `<div class="p-login"><section class="login">
      <div class="login-topo"><span class="selo g">${ic("folha", 28)}</span><span class="kicker">painel master</span><h1 class="titulo">365 dias<br><em>de gratidão</em></h1></div>
      <form class="form" id="form-admin" style="margin-top:28px" novalidate>
        <label class="campo">Usuário<input id="a-usuario" type="text" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
        <label class="campo">Senha<input id="a-senha" type="password" autocomplete="current-password"></label>
        ${S.erro ? `<p class="erro" role="alert">${esc(S.erro)}</p>` : ""}
        <button class="btn-verde" type="submit">Entrar no painel</button>
      </form>
      <p class="credito">Desenvolvido por Jhony Beraldo</p>
    </section></div>`;
  }

  function formatarWhats(n) {
    const d = String(n || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return d;
  }
  function normalizarWhats(v) {
    const d = String(v || "").replace(/\D/g, "");
    if (d.length === 10 || d.length === 11) return "55" + d;
    return d;
  }
  const padraoLink = () => location.origin + location.pathname.replace(/[^/]*$/, "");
  const linkCadastro = () => (S.config.link_cadastro || "").trim() || padraoLink();

  function render() {
    let html;
    if (!G.configurado) html = `<div class="p-main"><p class="p-txt">Preencha o arquivo <b>js/config.js</b> com os dados do Supabase.</p></div>`;
    else if (S.carregando) html = `<div class="carregando" style="min-height:100vh">Carregando…</div>`;
    else if (!S.user) html = telaLogin();
    else {
      const L = linhas();
      const conteudo = S.aba === "part" ? participantes(L) : S.aba === "config" ? configuracoes() : visao(L);
      html = `${topo()}<main class="p-main">
        <h1>Acompanhamento <em>do grupo</em></h1>
        <nav class="p-abas" aria-label="Seções do painel">${[["visao", "Visão geral"], ["part", "Participantes"], ["config", "Configurações"]].map(([k, l]) => `<button class="${S.aba === k ? "ativo" : ""}" data-acao="aba" data-aba="${k}">${l}</button>`).join("")}</nav>
        ${conteudo}
      </main><footer class="p-rodape">Desenvolvido por Jhony Beraldo</footer>${S.reset ? modalReset() : ""}`;
    }
    raiz.innerHTML = html + `<div class="toast" id="toast" role="status" aria-live="polite"></div>`;
  }

  /* ---------- Dados ---------- */
  async function carregar() {
    const [cfg, ppl] = await Promise.all([
      sb.from("config").select("*").eq("id", 1).maybeSingle(),
      sb.rpc("admin_participantes")
    ]);
    if (ppl.error) throw ppl.error;
    S.config = cfg.data; S.pessoas = ppl.data || [];
  }
  async function entrarComSessao(user) {
    const { data: perfil } = await sb.from("perfis").select("*").eq("id", user.id).maybeSingle();
    if (!perfil || !perfil.is_admin) { await sb.auth.signOut(); S.user = null; S.erro = "Acesso permitido apenas ao administrador."; return; }
    S.user = user; S.perfil = perfil; S.erro = "";
    await carregar();
  }

  /* ---------- Eventos ---------- */
  raiz.addEventListener("click", async (ev) => {
    const el = ev.target.closest("[data-acao]"); if (!el) return;
    const a = el.dataset.acao;
    if (a === "aba") { S.aba = el.dataset.aba; render(); }
    else if (a === "filtro") { S.filtro = el.dataset.f; render(); }
    else if (a === "app") location.href = "index.html";
    else if (a === "sair") { await sb.auth.signOut(); S.user = null; render(); }
    else if (a === "copiar-link") { const ok = await G.copiar(linkCadastro()); G.toast(ok ? "Link copiado." : "Não foi possível copiar."); }
    else if (a === "switch") el.setAttribute("aria-checked", el.getAttribute("aria-checked") === "true" ? "false" : "true");
    else if (a === "salvar") {
      const dados = {
        data_lancamento: G.$("#cfg-data").value || S.config.data_lancamento,
        cadastro_aberto: G.$("#cfg-cadastro").getAttribute("aria-checked") === "true",
        mostrar_exemplo: G.$("#cfg-exemplo").getAttribute("aria-checked") === "true",
        link_cadastro: G.$("#cfg-link").value.trim(),
        convite_titulo: G.$("#cfg-titulo").value.trim(),
        convite_msg: G.$("#cfg-msg").value,
        whatsapp_suporte: normalizarWhats(G.$("#cfg-whats").value) || S.config.whatsapp_suporte,
        atualizado_em: new Date().toISOString()
      };
      el.disabled = true;
      const { error } = await sb.from("config").update(dados).eq("id", 1);
      el.disabled = false;
      if (error) return G.toast(G.traduzirErro(error));
      Object.assign(S.config, dados); render(); G.toast("Configurações salvas.");
    }
    else if (a === "exportar") {
      const L = linhas();
      const linhasCsv = [["Nome", "Usuário", "Cadastro", "Início", "Dias concluídos", "Percentual", "Próximo dia", "Último acesso", "Situação"]]
        .concat(L.map((r) => [r.nome, r.usuario, r.cad, r.inicio, r.feitos, r.pct, r.prox, r.acesso, r.status]));
      const csv = "\uFEFF" + linhasCsv.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
      G.baixar(new Blob([csv], { type: "text/csv;charset=utf-8" }), `participantes-${G.fmtNum(G.hoje()).replace(/\//g, "-")}.csv`);
    }
    else if (a === "reset") { S.reset = el.dataset.id; S.erro = ""; render(); setTimeout(() => { const i = G.$("#nova-senha"); if (i) i.focus(); }, 50); }
    else if (a === "reset-cancelar") { S.reset = null; S.erro = ""; render(); }
    else if (a === "reset-salvar") {
      const senha = G.$("#nova-senha").value;
      if (senha.length < 6) { S.erro = "A senha precisa ter pelo menos 6 caracteres."; render(); return; }
      el.disabled = true;
      const { error } = await sb.rpc("admin_redefinir_senha", { p_id: S.reset, p_senha: senha });
      if (error) { S.erro = G.traduzirErro(error); render(); return; }
      const p = S.pessoas.find((x) => x.id === S.reset);
      S.reset = null; S.erro = ""; render(); G.toast(`Nova senha salva para ${p ? p.nome : "o participante"}.`);
    }
  });
  raiz.addEventListener("input", (ev) => {
    if (ev.target.id === "busca") {
      S.busca = ev.target.value;
      const pos = ev.target.selectionStart; render();
      const i = G.$("#busca"); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} }
    }
    if (ev.target.id === "cfg-data" && ev.target.value) {
      const lanc = G.dataISO(ev.target.value), corte = G.somarDias(lanc, -1);
      const r = G.$("#regra");
      if (r) r.innerHTML = `<strong>Regra de início</strong><br>Quem se cadastrar até <strong>${G.fmtNum(corte)}</strong> começa junto com o grupo, em <strong>${G.fmtNum(lanc)}</strong>. Quem se cadastrar depois começa no primeiro dia que marcar como concluído.`;
    }
  });
  raiz.addEventListener("submit", async (ev) => {
    if (ev.target.id !== "form-admin") return;
    ev.preventDefault();
    const usuario = G.normalizarUsuario(G.$("#a-usuario").value), senha = G.$("#a-senha").value;
    const { data, error } = await sb.auth.signInWithPassword({ email: G.emailDe(usuario), password: senha });
    if (error) { S.erro = G.traduzirErro(error); render(); return; }
    try { await entrarComSessao(data.user); } catch (e) { S.erro = G.traduzirErro(e); S.user = null; }
    render();
  });

  /* ---------- Início ---------- */
  (async () => {
    if (!G.configurado) { S.carregando = false; render(); return; }
    render();
    try {
      const { data } = await sb.auth.getSession();
      if (data.session) await entrarComSessao(data.session.user);
    } catch (e) { S.erro = G.traduzirErro(e); S.user = null; }
    S.carregando = false; render();
  })();
})();
