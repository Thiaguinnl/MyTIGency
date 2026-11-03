// LAB seções 1–2: três direções estáticas, mesmo conteúdo (o de src/i18n/strings.js
// → manifesto), PT e EN. Textos novos do LAB (rótulos de janela, status) estão em
// TX e também têm as duas línguas.
import pcUrl from '../../src/assets/s6/pc/pc.png'
import cursorUrl from '../../src/assets/s2-cursor.svg'
import icoAlert from '../../src/assets/s6/pc/ico-b-19.png'
import icoTxt from '../../src/assets/s6/pc/ico-b-13.png'

const TX = {
  pt: {
    // o Manifesto de verdade (strings.js)
    statement: ['Na MyTIgency, acreditamos', 'que um site não se', 'apresenta.', 'Ele', 'conduz.'],
    big: 'Nós', lines: ['conversamos', 'e resolvemos', 'tudo.'], no: 'Sem',
    items: ['Gerente de conta', 'Terceirizar', 'Intermediários'],
    chat: [['in', 'não sei bem o que eu quero ainda'], ['out', 'normal! me conta do seu negócio que a gente descobre junto.'], ['in', 'sério? simples assim?'], ['out', 'é a parte que a gente mais gosta.']],
    cue: 'continue rolando',
    // rótulos do LAB
    sys: 'Mensagem do sistema', present: 'Apresentar', lead: 'Conduzir',
    messenger: 'MyT Messenger', online: 'Online', offline: 'Fora da conversa', blocked: 'não existe aqui',
    founders: ['Miguel', 'Thiago'], founderRole: ['design', 'código'], typing: 'digitando…', send: 'Enviar', placeholder: 'mensagem',
    layers: 'Camadas', hidden: 'oculta', removed: 'removida', selected: 'seleção',
  },
  en: {
    statement: ['At MyTIgency, we believe', 'a site never', 'introduces', 'itself. It', 'leads.'],
    big: 'We', lines: ['talk it', 'through and', 'solve it.'], no: 'No',
    items: ['Account manager', 'Outsourcing', 'Middlemen'],
    chat: [['in', "i'm not sure what i want yet"], ['out', "that's normal! tell me about your business and we'll figure it out together."], ['in', 'really? that simple?'], ['out', "it's the part we like the most."]],
    cue: 'keep scrolling',
    sys: 'System message', present: 'Introduce', lead: 'Lead',
    messenger: 'MyT Messenger', online: 'Online', offline: 'Out of the conversation', blocked: "doesn't exist here",
    founders: ['Miguel', 'Thiago'], founderRole: ['design', 'code'], typing: 'typing…', send: 'Send', placeholder: 'message',
    layers: 'Layers', hidden: 'hidden', removed: 'removed', selected: 'selection',
  },
}

const qs = new URLSearchParams(location.search)
const V = ['1', '2', '3'].includes(qs.get('v')) ? qs.get('v') : '1'
const LANG = qs.get('lang') === 'en' ? 'en' : 'pt'
const t = TX[LANG]
document.documentElement.lang = LANG === 'en' ? 'en' : 'pt-BR'

const link = (k, v, label) => {
  const p = new URLSearchParams(location.search)
  p.set(k, v)
  const on = (k === 'v' ? V : LANG) === v
  return `<a href="?${p}" ${on ? 'aria-current="true"' : ''}>${label}</a>`
}
document.querySelector('.lab-v').innerHTML = [['1', 'Mensageiro'], ['2', 'Cartaz Y2K'], ['3', 'Editor']].map(([v, l]) => link('v', v, `${v} · ${l}`)).join('')
document.querySelector('.lab-l').innerHTML = link('lang', 'pt', 'PT') + link('lang', 'en', 'EN')

const win = (title, body, cls = '') => `<div class="w98 ${cls}"><div class="w98-t"><span>${title}</span><i aria-hidden="true">×</i></div>${body}</div>`
// o PC da seção 2 (render recortado; a tela é um buraco: DEV.screen em manifestoPC.js)
const pc = (cls, screen) => `<div class="pc ${cls}"><div class="pc-scr">${screen}</div><img src="${pcUrl}" alt=""></div>`
const cursor = (cls = '') => `<img class="cur ${cls}" src="${cursorUrl}" alt="" aria-hidden="true">`
const [s0, s1, s2, s3, s4] = t.statement

// ---------- 1 · Mensageiro ----------
// S1: a frase é uma mensagem do sistema; os dois botões são a tese — "apresentar"
// está desligado, "conduzir" é o botão padrão (o foco já está nele). S2: a conversa
// direta é literal: na lista, online só os dois fundadores; gerente de conta,
// terceirizar e intermediários estão fora, riscados.
function v1() {
  return `
  <section class="s v1-s1" aria-label="Ethos">
    ${win(`<img src="${icoTxt}" alt=""> manifesto.txt — ${t.sys}`, `
      <div class="v1-body">
        <img class="v1-ico" src="${icoAlert}" alt="">
        <p class="v1-say"><span>${s0}</span> <span>${s1}</span> <s>${s2}</s> <span>${s3}</span></p>
      </div>
      <p class="v1-lead">${s4}</p>
      <div class="w98-k"><b class="off" aria-disabled="true">${t.present}</b><b class="def">${t.lead}${cursor('v1-cur')}</b></div>`, 'v1-win')}
  </section>
  <section class="s v1-s2" aria-label="${t.big}">
    <h2 class="v1-h"><span class="big">${t.big}</span><span class="ln">${t.lines.map((l) => `<span>${l}</span>`).join(' ')}</span></h2>
    ${win(t.messenger, `
      <div class="v1-msn">
        <aside class="v1-list">
          <h3>${t.online} (2)</h3>
          ${t.founders.map((n, i) => `<p class="on"><i></i>${n} <em>· ${t.founderRole[i]}</em></p>`).join('')}
          <h3>${t.offline} (3)</h3>
          ${t.items.map((n) => `<p class="out"><i></i><s>${n}</s><em>${t.blocked}</em></p>`).join('')}
        </aside>
        <div class="v1-chat">
          ${t.chat.map(([who, m]) => `<p class="b ${who}">${m}</p>`).join('')}
          <p class="v1-typing">${t.founders[0]} ${t.typing}</p>
          <div class="v1-input"><span>${t.placeholder}</span><b>${t.send}</b></div>
        </div>
      </div>`, 'v1-msnwin')}
  </section>`
}

// ---------- 2 · Cartaz Y2K ----------
// A tipografia é o cartaz, como nas referências (WordArt, adesivo, grotesca larga
// misturada com serifa itálica): a frase em grotesca extra-larga, "apresenta" em
// serifa riscada à mão, "conduz" é o adesivo vermelho com borda — o mesmo das letras
// 3D do fim do Manifesto (abre e fecha com o mesmo objeto). S2: "NÓS" gigante em
// adesivo; a conversa vira adesivos; o "sem" é uma lista de caixas desmarcadas.
function v2() {
  return `
  <section class="s v2-s1" aria-label="Ethos">
    <p class="v2-a">${s0}<br>${s1}</p>
    <p class="v2-b"><span class="v2-strike">${s2}</span> <span class="v2-ele">${s3}</span></p>
    <p class="v2-lead"><span class="stk">${s4}</span>${cursor('v2-cur')}</p>
  </section>
  <section class="s v2-s2" aria-label="${t.big}">
    <h2 class="v2-big"><span class="stk">${t.big}</span></h2>
    <p class="v2-lines">${t.lines.map((l) => `<span>${l}</span>`).join('')}</p>
    <div class="v2-chat">${t.chat.map(([who, m], i) => `<p class="tag ${who} r${i}">${m}</p>`).join('')}</div>
    ${win(`${t.no}…`, `<ul class="v2-no">${t.items.map((n) => `<li><span class="box" aria-hidden="true"></span><s>${n}</s></li>`).join('')}</ul>`, 'v2-nowin')}
  </section>`
}

// ---------- 3 · Editor ----------
// O idioma das seções 3–6 (o site como algo editado à mão): a frase é uma camada
// de texto; no painel de camadas, "apresenta" está oculta e "conduz" selecionada,
// com a caixa, as alças e a medida real. S2: as camadas "gerente de conta",
// "terceirizar" e "intermediários" foram removidas; sobra "nós".
function v3() {
  return `
  <section class="s v3-s1" aria-label="Ethos">
    <aside class="v3-layers"><h3>${t.layers}</h3>
      <p>T ${s0}</p><p>T ${s1}</p><p class="off">T ${s2} <em>${t.hidden}</em></p><p>T ${s3}</p><p class="sel">T ${s4} <em>${t.selected}</em></p>
    </aside>
    <div class="v3-text">
      <p class="v3-line">${s0}</p>
      <p class="v3-line">${s1} <span class="v3-ghost">${s2}</span> ${s3}</p>
      <p class="v3-lead"><span class="v3-sel"><span>${s4}</span><i></i><i></i><i></i><i></i><b class="v3-dim" data-dim></b></span></p>
    </div>
    ${cursor('v3-cur')}
  </section>
  <section class="s v3-s2" aria-label="${t.big}">
    <aside class="v3-layers"><h3>${t.layers}</h3>
      <p class="sel">T ${t.big}</p>
      ${t.items.map((n) => `<p class="gone"><s>▢ ${n}</s> <em>${t.removed}</em></p>`).join('')}
    </aside>
    <h2 class="v3-big">${t.big}<span>${t.lines.join(' ')}</span></h2>
    ${pc('v3-pc', `<p>&gt; conversa.exe</p><p>&gt; ${t.founders.join(' + ')}<b>_</b></p>`)}
  </section>`
}

const app = document.getElementById('app')
app.dataset.v = V
app.innerHTML = { 1: v1, 2: v2, 3: v3 }[V]()
// a medida real da seleção (px), como no editor
const sel = document.querySelector('[data-dim]')
if (sel) {
  const r = sel.parentElement.getBoundingClientRect()
  sel.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`
}
