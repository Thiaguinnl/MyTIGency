# Depuração — transição Manifesto (seção 6) → PC → Trabalhos

Registro completo de tudo o que foi investigado e alterado no bug dos "quadrados"
(flicker) da transição do fim do Manifesto, e de tudo o que veio depois, até hoje.
Serve para depurar a **queda de FPS e os travamentos** que apareceram nessa seção
(do cartaz até a folha) depois dessas alterações.

- **Código em questão:** `src/utils/manifestoPC.js`, `src/utils/manifestoPCDesk.js`,
  `src/utils/manifestoS6.js`, `src/hooks/useManifestoHorizontal.js`, `src/App.css`
  (bloco "Manifesto · fim: o PC"), `src/i18n/strings.js` (bloco `pc`).
- **Git:** tudo está no commit `42ddb5d PC-transition`, que contém **o porte inteiro da
  transição E e todas as correções juntos**. Não existe um commit "antes da correção
  dos quadrados". A referência da arquitetura antiga é o **LAB v13** (`ddb26c7 lab-v13`,
  `lab/secao6/v13/`), que ainda roda em `http://localhost:5173/lab/secao6/v13/`.
- **Scripts de medição (Playwright + Chrome real):** `docs/debug-transicao-pc/scripts/`
  (ver a seção 6). A saída vai para `docs/debug-transicao-pc/saida/`.

---

## 0. Resumo em 30 segundos

1. **O bug dos quadrados** foi medido: o zoom do PC é feito com `transform: scale` (via
   JavaScript, a cada quadro) sobre uma árvore DOM grande e **pintada**. Gradientes, a
   máscara com a imagem do PC, as vinhetas e os efeitos do tubo eram **re-rasterizados
   pelo Chrome a cada escala nova**. Isso gerava milhares de ladrilhos (tiles) por segundo,
   e numa GPU que não acompanhava sobravam ladrilhos vazios: os quadrados.
2. **A correção** trocou essas peças por **canvases desenhados uma vez** (texturas que a
   GPU só escala), moveu o que anda para `transform` e deu camada própria à imagem do PC.
   Também passou a esconder (`visibility:hidden`) a trilha do Manifesto enquanto o PC
   está no ar.
3. **Medido no meu ambiente** (GTX 1660 SUPER, Chrome real via Playwright): rasterização
   no zoom −77%, cache de imagem −98%, área piscando −98% com GPU simulada fraca, e de
   2 a 6× mais quadros por segundo.
4. **Agora você relata queda imensa de FPS e travamentos** nessa seção, inclusive no
   cartaz. Não reproduzi isso aqui, mas a correção **trocou trabalho de rasterização por
   trabalho de composição**: mais camadas, render surfaces e blend. Isso pode ser bem
   pior numa GPU integrada ou com outro driver. As hipóteses, em ordem de suspeita e com
   o teste de cada uma, estão na **seção 5**.

---

## 1. Linha do tempo da conversa (do começo do bug até agora)

### 1.1 Antes: o estado da cena quando o bug começou a ser discutido

O que já existia quando os relatos de flick começaram (útil, porque também pesa):

- **Cartaz vivo:** o cartaz que encolhe para dentro do CRT é a **própria seção 6 viva**, o
  mesmo nó `.s6` movido para dentro de `.pc-poster` (`nestS6` no hook, `s6.nest()` na seção 6).
  Antes era uma cópia parada (`mountS6(..., { still: true })`); virou viva para os
  stop-motions, a régua e a bola não "congelarem" na troca. Consequência: **dois WebGL
  da seção 6 (texto e grade) rodando dentro da tela do PC, sob o filtro SVG da curva do CRT**.
- **Cursor contínuo:** o cursor da seção 6 não se desfaz mais; descansa ao lado de
  "TRABALHO." e o PC o redesenha a partir dali (`cursorFrom`/`takeCursor`, `curStyle`).
- **Dither com "empurrão" no tranco:** shader do wallpaper com `uWave` (crista) e push
  somado ao scroll.
- Correções de troca: vinheta do cartaz (`.pc-poster` ganhou a sua), impacto duplo
  (`impact.classList.remove('on')` no `nest`), estado zerado ao reentrar (`freshCursor`),
  seção 6 presa em `s6.length()` (para não "desandar" ao voltar).
- Flash branco da 1ª entrada corrigido: `frame(performance.now())` síncrono quando a cena
  liga (`if (entering) frame(...)` em `scroll()`).
- Lente da bola parando no último ponto de dentro da tela (`placeBall` → `if (!inside) return`).
- Seção 6 aninhada renderiza o WebGL só a ~12,5 qps (`renderKey`/`doRender`), e textos
  (`pct`, relógio, "escala %") só são escritos quando mudam.

### 1.2 Os relatos e o que foi feito, na ordem

**(a) Você:** *"Glitch de tela popando de vez em quando durante a transição, flicks
estranhos mais ou menos quando o PC está com o fundo escuro ainda."*
→ Instrumentei uma rolagem lenta e achei escrita de texto a cada quadro dentro da tela
filtrada e o WebGL da seção 6 redesenhando todo quadro. Passou a escrever texto só quando
muda e a limitar o WebGL aninhado a 12,5 qps.

**(b) Você:** *"Sem fazer nenhuma alteração… o flick acontecia na borda do PC, bem na
borda alguns quadrados flickavam, o que pode ser?"*
→ Hipótese: deslocamento da curva SVG puxando a borda, ou ladrilhos do filtro. Sugeri
testes no console:

```js
const s = document.createElement('style'); document.head.append(s)
s.textContent = '.pc-crt-in{filter:none!important}'          // A: sem a curva
const b = document.querySelector('#pc-crt-bend'); Element.prototype.setAttribute.call(b, 'scale', 0); b.setAttribute = () => {} // B: sem deslocamento
s.textContent = '.pc-wall{opacity:0!important}'               // C: sem wallpaper
s.textContent = '.pc-crt-in{transform:none!important}'        // D: sem ampliação/tremor
s.textContent = '.pc-poster{visibility:hidden!important}'     // E: sem a seção 6 na tela
```

**(c) Você:** *"O flick ocorre não somente na moldura, ao scrollar rápido são quadrados
grandes e imensos que aparecem na tela inteira… fiz o teste da curva CRT não pareceu ela,
acho que nossa melhor saída é utilizar o Playwright."* (com print mostrando a moldura do
PC faltando em faixas e pop-ups como caixas cinza)
→ Investigação com Playwright, detalhada na seção 2.

**(d) Você:** *"Siga da forma que achar melhor, quero que consertemos o BUG, mas não quero
nenhuma mudança de aparência…"*
→ Correção (seção 3), comparação pixel a pixel e medição em GPU simulada fraca (seção 4).

**(e) Você:** *"Sim pode fazer isso [lâmpada]; no impacto do monitor remova o cursor que
deforma… o parallax do TRABALHOS está muito estranho… essa parte não tem tradução."*
→ Lâmpada com `rest`, `ballOff` no tranco, parallax com inércia + `will-change` na palavra,
bloco `pc` em PT/EN (seção 3.6–3.9).

**(f) Agora:** queda imensa de FPS e travamentos nessa seção, até no cartaz → este documento.

---

## 2. Diagnóstico do bug dos quadrados (como foi medido)

Ambiente: Chrome real (`channel: 'chrome'`) via Playwright, GPU real
`ANGLE (NVIDIA GeForce GTX 1660 SUPER, D3D11)`, viewport 1700×900, DPR 1, dev server Vite.
Com esse viewport o PC liga em `scrollY ≈ 21200` (o script `probe.mjs` acha o valor).

### 2.1 Árvore de camadas (`probe.mjs`)
Na fase escura: **118 camadas compostas, 106 com conteúdo, ~219 megapixels**. Várias
peças do PC viravam camadas por `Overlap` (sobreposição): `pc-fx-vig`, `pc-leds` e
`pc-dev-glow` (~1989×1592 cada), além de `.manifesto-grid` (3698×1654), `.ms-track`,
`section.ms2`, `section.s3` e o footer, todos compostos por trás da cena opaca.

### 2.2 Gravação de quadros do compositor (`record.mjs`, `record2.mjs`)
`Page.startScreencast` captura o que vai para a tela (inclusive ladrilho faltando). Detecção:
- `record.mjs`: blocos de 64 px "chapados" (desvio ≈ 0). Achou picos de **cinza 220/161/49
  e branco**, que eram **os níveis da lâmpada** (0,85/0,6/0,12/1): a sequência de piscadas
  re-disparando a cada vez que o scroll cruzava T = 0,76 no vai-e-volta.
- `record2.mjs`: piscadas temporais (bloco A → B → A em 3 quadros) na fase escura. Na GPU
  forte, quase nada; um "salto" do PC era **quadro fora de ordem na captura**, não bug.
- `jumps.mjs` confirmou: as escritas no `transform` do rig são suaves (sem vai-e-volta e
  sem 2 escritas por quadro).

### 2.3 Trace do compositor (`tiles.mjs`, `tiles2.mjs`, `tiles3.mjs`, `who.mjs`)
Categorias: `disabled-by-default-cc.debug, cc, disabled-by-default-devtools.timeline`.
Contagem de `RasterTask`, `cc::Tile:deleted`, `GpuImageDecodeCache::EnsureCapacity` em
~1,5 s de scroll leve (6 × `mouse.wheel(0, 60)`), atribuição por camada via
`RasterTask.args.tileData.layerId` + `LayerTree`.

| trecho | parado | rolando | cache de imagem (parado → rolando) |
|---|---|---|---|
| cartaz encolhendo | 797 | **6.141** | 283 → **19.997** |
| zoom out do PC | 1.510 | **7.395** | 707 → **28.375** |
| zoom já terminado | 2.468 | 3.667 | 9.903 → 10.982 |

Por camada, rolando no zoom: `.pc-dev-glow` 2.652, squash `pc-fx-vig` (continha a
imagem do PC) 1.854, vinheta do cartaz `::after` 812, `.pc-fx-band` 410, `.pc-amb` 256,
`.pc-fx-noise` 210, `.pc-fx-scan` 125, `.marquee-track` 246, `section.s3` 234,
`.ms-grain` 97.

Testes A/B com CSS injetado (sem mudar código):
- **Sem filtro do CRT:** nada muda (7.614 contra 7.372). **A curva não era a causa**, o
  que bate com o seu teste.
- **Sem as 3 camadas maiores:** −33% raster, −46% cache.
- **`will-change` nas peças:** quase não ajuda (o Chrome re-rasteriza mesmo assim quando a
  escala muda por JS), **exceto a imagem**: `<img>` com camada própria vira imagem
  composta direto e some da lista.
- **Animação de compositor "keep-alive" para congelar a escala de raster:** só reduz em
  parte (dev-glow 3.000 → 1.620), descartada.
- O **LAB v13** tem o mesmo comportamento (×5 rolando). O problema veio da arquitetura do
  LAB; o site somava ~60% a mais.

**Conclusão:** quando a escala do rig muda, o Chrome re-rasteriza camadas pintadas
(gradientes, máscaras, imagens desenhadas) inteiras na nova escala. Imagens compostas
direto e canvases são texturas: a GPU só escala.

---

## 3. Todas as alterações (o que, onde, por quê, como reverter)

### 3.1 Texturas em canvas no lugar de CSS pintado — `manifestoPC.js` (seção "texturas", ~l. 270–410)
Funções `ctx2d`, `ellipse` (reproduz `radial-gradient(<rx> <ry> at <cx> <cy>, …)` do
CSS), `rgba`, `TEX_DPR = min(2, devicePixelRatio)`, e:

| função | substitui | canvas / resolução | quando pinta |
|---|---|---|---|
| `paintGlow` | `.pc-dev-glow` (gradiente + `mask` com a imagem do PC) | `<canvas class="pc-dev-glow">`, 1228×983 (resolução do PNG); gradiente + `destination-in` com a imagem | `measure()`, `pcImg.onload`, quando a cor do wallpaper chega |
| `paintAmb` | `.pc-amb` (gradiente em `--ax/--ay`, repintado a cada quadro) | `.pc-amb canvas`, 2× viewport em CSS, textura a 1/4 | `measure()`, cor do wallpaper |
| `paintPosterVig` | `.pc-poster::after` (vinheta do cartaz) | `canvas.pc-pvig`, viewport/2 | `measure()` |
| `paintGlass` | `.pc-fx-glass` (radial + linear 160deg) | `g-band` (W1×H1×TEX_DPR, **até 2×**) e `g-hl` (meia resolução, 3 alturas) | `measure()` |
| `paintVig` | `.pc-fx-vig` (radial + `box-shadow inset`) | canvas a 1/2; a sombra interna usa **`shadowBlur`** de uma moldura fora do canvas | `measure()` |
| `paintBand` | `.pc-fx-band` (`background-position` animado) | canvas 2×512, 2 ladrilhos | `measure()` |

Sem a cor do wallpaper (`gcKnown = false`), glow e amb não pintam (como no CSS, onde
`--gc` indefinido invalidava o gradiente).

**Reverter:** voltar o CSS antigo de cada peça (o CSS original está no LAB v13,
`lab/secao6/v13/index.html` e `entorno.css`, ou na seção 7 abaixo) e remover os
canvases do `STAGE`.

### 3.2 Movimento por `transform` em vez de repintar
- **Luz na parede:** `ambCv.style.transform = translate(cx0 − vw, cy0 − vh)` em `frame()` (~l. 718).
  Antes: `host.style.setProperty('--ax'/'--ay')`.
- **Reflexo do vidro:** `glassHl.style.transform = translateY(rx · 0,04 · H1)` em `lifeFrame` (~l. 559).
  Antes: `--gy`.
- **Faixa do tubo:** CSS `.pc-fx-band canvas{ height:400%; animation:pcBand 3.5s linear -1.1667s infinite }`
  com `@keyframes pcBand{ to{ transform:translateY(-75%) } }`. Antes: `background-position` animado.

### 3.3 Camadas próprias (`will-change`) — `App.css`
- `.pc-dev img{ will-change:transform }`: imagem do PC composta direto (antes estava no
  `div .pc-dev`, que virava camada pintada).
- `.pc-amb canvas`, `.pc-fx-band canvas`, `.pc-fx-glass .g-hl`: `will-change:transform`.
- `.ec-word{ will-change:transform }` (item 3.8).
- Já existiam: `.pc-rig`, `.pc-body`, `.pc-cam`.

### 3.4 Trilha escondida enquanto o PC está no ar
- Hook (~l. 598): `root.classList.toggle('pc-on', !!pc && d >= pcAt)` a cada `apply()`.
- CSS (~l. 1990): `.manifesto.pc-on .ms-track{ visibility:hidden }`.
- Motivo: as seções 1–3, a grade, a TV (WebGL) etc. continuavam repintando por trás da
  camada opaca.

### 3.5 Outras correções da mesma rodada
- `.pc-poster .pc-pvig` com `z-index:1`; a vinheta `::after` foi removida.
- `.pc-fx-vig`, `.pc-fx-glass`, `.pc-fx-band` e `.pc-amb` viraram **wrappers com `opacity`
  (e `overflow:hidden`) contendo um canvas**. Veja a hipótese H1 na seção 5.

### 3.6 Lâmpada — `manifestoPC.js` (~l. 58–60 e `lampLevel`)
`LAMP.rest = 4000`: a piscada só toca se a lâmpada ficou apagada ≥ 4 s; `lamp.off` guarda
quando apagou (também ao sair da cena por cima). No vai-e-volta, acende direto.

### 3.7 Bola → cursor do site no tranco
- `manifestoPC.js`: `onImpact(v)` quando `T` cruza `DEGAUSS.at` (0,07), nos dois sentidos,
  e `false` ao sair da cena.
- Hook: `onImpact: (v) => s6.ballOff(v)`.
- `manifestoS6.js`: `ballBlocked`, `ballIn = inside && shift > 0.6 && !ballBlocked`,
  `ballOff(on)` esconde a bola e devolve o cursor contextual.

### 3.8 Parallax de "TRABALHOS" — `manifestoPCDesk.js` (`CARTAZ.par`, `frame` do cartaz)
Alvo pelo cursor, ±18 px em x e ±6 px em y, com inércia `tau = 0,3 s`
(`par.x += (alvo − par.x)·k`). `.ec-word` ganhou `will-change:transform`. Antes eram ±7 px
diretos e a palavra repintava a cada movimento.

### 3.9 Tradução — `strings.js` (bloco `pc` em `pt` e `en`), `manifestoPC.js`, `manifestoPCDesk.js`
Palavra, legendas, adesivo (SVG `textPath`), ícones, pop-ups, barra de tarefas, relógio
(`toLocaleTimeString(tx.locale)`), etiqueta do disquete e bilhetes da mesa (texturas 3D).
`mountPC(..., { t })` → `mountPCDesk(layers, tx)` → `cartaz(layers, tx)` e `mesa(layers, tx)`.
A palavra tem altura máxima de `CARTAZ.maxH = 0,5` da tela (para "WORK" não ficar gigante).
O hook passa `strings[lang].pc`; a cena remonta quando o idioma muda.

### 3.10 Mesa e microtexto (rodadas anteriores, mesma área)
Mesa mais rasa atrás do PC (`back = -0.55`). A palavra encolhe (`ws`) para o microtexto
caber entre ela e a borda de trás da mesa (`horizon`, projetada pela câmera 3D, ~l. 464).

---

## 4. Resultados medidos depois da correção (no meu ambiente)

| medida (rolando) | antes | depois |
|---|---|---|
| zoom — RasterTask | 7.395 | **1.729 (−77%)** |
| zoom — cache de imagem | 28.375 | **517 (−98%)** |
| cartaz encolhendo — RasterTask | 6.141 | 4.819 (−22%) |

O que sobrava no encolhimento: `.pc-fx-noise` e `.pc-fx-scan` (~480 cada), duas camadas
`(sem nó) 1037×760` (o conteúdo filtrado do CRT) e o letreiro do topo. Ficaram em CSS de
propósito: como textura, mudariam de aparência.

**GPU simulada fraca** (`--force-gpu-mem-available-mb`, CPU 4× via `Emulation.setCPUThrottlingRate`),
vai-e-volta rápido na fase escura (`record2.mjs`):

| memória | LAB v13 (antigo) | site corrigido | quadros (LAB → site) |
|---|---|---|---|
| 48 MB | 173 piscadas / 32.959 blocos | 50 / 3.412 | ~350 → ~2.050 |
| 128 MB | 186 / 70.074 | 14 / 1.368 | 1.577 → 3.433 |
| 256 MB | 25 / 585 | **0 / 0** | 1.141 → 3.808 |

**Aparência** (`compare.mjs`): 10 pontos fixos, fotos antes × depois. Pixels com
diferença > 24 ficaram em ~0,5–1,1%, o mesmo nível de duas capturas do mesmo código. Os
recortes ampliados 3× mostram moldura, brilho, vinheta e vidro iguais.

> **Importante para o problema atual:** essas medidas mostraram **mais quadros**, não
> menos, mas numa GTX 1660 com dev server. A queda de FPS que você vê indica outro gargalo
> na sua máquina: composição/preenchimento na GPU ou picos na thread principal, não
> rasterização. Por isso as hipóteses abaixo focam nisso.

---

## 5. Hipóteses para a queda de FPS e os travamentos (ordem de suspeita)

Para cada uma: por que pode ser, e como testar sem mexer no código. Cole no console do
Chrome, com a página na transição. **Recarregue entre um teste e outro.** Use o painel
*Performance* (gravar enquanto rola) e *Rendering → Frame Rendering Stats* para ver o FPS
e se o gargalo é GPU ou CPU.

### H1 — Wrappers com `opacity` em volta de canvases compostos → render surfaces extras (suspeita nº 1)
`.pc-fx-band`, `.pc-fx-glass`, `.pc-fx-vig` e `.pc-amb` agora são **um `div` com `opacity`
(e `overflow:hidden`) contendo um canvas com camada própria**. No Chrome, opacidade ≠ 1
num elemento com filho composto cria uma **render surface**: um passe offscreen inteiro
por quadro, para cada um. Tudo isso dentro de `.pc-crt`, com `border-radius` + `overflow:hidden`
(mais máscara de recorte). Antes eram camadas pintadas simples. Numa GPU integrada isso
pesa muito (fill-rate), e começa já no cartaz, porque essas camadas existem desde que a
cena liga, mesmo com opacidade 0.
Do mesmo tipo:
- `.pc-dev` tem `filter: brightness(var(--lit))` e agora contém um `<img>` composto →
  filtro num pai de filho composto = render surface;
- `.pc-dev-glow` (canvas) tem `mix-blend-mode: screen` → o pai (`.pc-body`) precisa de
  isolamento/render surface para o blend.

**Teste (só desempenho, muda o visual):**
```js
const s=document.createElement('style');document.head.append(s)
s.textContent='.pc-fx-band,.pc-fx-glass,.pc-fx-vig,.pc-amb{opacity:1!important;overflow:visible!important}'
// e/ou
s.textContent='.pc-dev{filter:none!important} .pc-dev-glow{mix-blend-mode:normal!important}'
```
Se o FPS volta, a correção é passar a `opacity` para o próprio canvas (sem wrapper com
opacidade), e o brilho e a luz para dentro de um canvas só. **Não muda a aparência.**

### H2 — Pintura pesada dentro de `measure()` (travamentos pontuais)
`measure()` chama `paintGlow/paintAmb/paintPosterVig/paintGlass/paintBand/paintVig`
(~l. 614). Os pesados:
- `paintGlass`: preenche um canvas de `W1×H1×TEX_DPR` (até ~2.000×1.500 com DPR 2);
- `paintVig`: **`shadowBlur`** grande, um desfoque gaussiano na CPU, que é lento;
- `paintGlow`: `destination-in` com a imagem de 1228×983.

`measure()` roda em cada `ScrollTrigger.refresh` (via `layout()` → `onRefreshInit`), no
`mountPCNow` e quando o wallpaper carrega. Se algo dispara refresh durante o scroll (TV
pronta, fontes, cursor 3D montando, barra de endereço/resize), cada um custa dezenas de ms.
**Teste:** no Performance, procure tarefas longas com `paintVig`/`paintGlass`/`measure` na
pilha. Ou cole antes de rolar:
```js
const o=CanvasRenderingContext2D.prototype.fill;CanvasRenderingContext2D.prototype.fill=function(...a){const t=performance.now();const r=o.apply(this,a);const d=performance.now()-t;if(d>4)console.warn('fill lento',d.toFixed(1)+'ms',this.canvas.className);return r}
```
**Correção possível:** pintar só quando o tamanho mudar (cache por `W1×H1×DPR`) e trocar o
`shadowBlur` por gradientes lineares nas bordas. Não muda a aparência.

### H3 — `visibility:hidden` na trilha inteira ao entrar e sair do PC (travada no cartaz)
`.manifesto.pc-on .ms-track{visibility:hidden}` liga e desliga exatamente em `d = pcAt`,
o início do cartaz. Isso invalida o estilo e reconstrói camadas de um subárvore enorme
(seções 1–3, a TV em WebGL, a grade). Pode dar **um travão** ao entrar e ao sair, e um
por passagem no vai-e-volta.
**Teste:**
```js
const s=document.createElement('style');document.head.append(s)
s.textContent='.manifesto.pc-on .ms-track{visibility:visible!important}'
```
Se o travão no cartaz some: remover a regra, ou trocá-la por `content-visibility`, ou
esconder só as peças com WebGL.

### H4 — A seção 6 viva dentro do CRT (mudança anterior à correção, mas a mais pesada)
O cartaz é a seção 6 viva: WebGL de texto e de grade, stop-motion, régua e bola dentro de
`.pc-crt-in`, que tem o filtro SVG (`feDisplacementMap` + `feImage`) a partir do tranco.
Cada quadro novo do WebGL obriga o filtro a refazer a tela inteira. Já foi limitado a
12,5 qps quando aninhado (`renderKey` em `manifestoS6.js` ~l. 766), mas no cartaz (antes
do tranco, sem filtro) roda em ritmo cheio. O CRT tem o conteúdo filtrado em duas camadas
(`(sem nó) 1037×760` no trace).
**Testes:**
```js
// sem a seção 6 na tela do PC
const s=document.createElement('style');document.head.append(s);s.textContent='.pc-poster .s6{visibility:hidden!important}'
// sem o filtro da curva
s.textContent='.pc-crt-in,.pc-crt-in.curved{filter:none!important}'
```
**Correções possíveis:** baixar o ritmo do WebGL aninhado também no cartaz, congelar a
seção 6 depois de um ponto (T > ~0,4: ela já está pequena), ou voltar ao cartaz parado
(muda o que você pediu antes: stop-motion vivo na troca).

### H5 — Muitos canvases de tela cheia vivos ao mesmo tempo (memória/fill)
Durante a cena estão vivos:
- `env-desk` (three.js da mesa, com sombras 2048² e PMREM);
- `.pc-wall` (shader do wallpaper);
- os dois WebGL da seção 6;
- `s6-cv`, `pc-cur` e `ms-cursor-cv`, o cursor 3D de tela cheia (`z-index:40`);
- `s5-cv`;
- o canvas da TV da seção 2 (escondido pela H3, mas o WebGL continua);
- o ASCII da Hero, se ainda estiver rodando.

Mais as texturas novas: glow, amb, pvig, g-band (até 2× DPR), g-hl, band e vig.
**Teste:** *Rendering → Layer borders* e o painel *Layers* (memória por camada).
Verifique se `ms-cursor-cv` e `s5-cv` desenham algo nessa fase; se não, devem parar o rAF.

### H6 — Animações CSS infinitas de compositor
`pcBand` (faixa), `pcGflk` (cintilação da luz na parede, em `filter`), `pcFlick`, `msGrain`
(ruído e grão, em `background-position`, que **repinta** a 12 qps), `pcGflkb` (spill com
`blur(10px)`). Mantêm o compositor produzindo quadros sem parar, mesmo com a cena
`visibility:hidden` antes de ligar.
**Teste:**
```js
const s=document.createElement('style');document.head.append(s)
s.textContent='.ma-pc *,.ms-grain{animation:none!important}'
```

### H7 — O PC renderizando sem precisar
O rAF do PC (`loop`) roda enquanto `pIn !== null` e o host está visível, e chama
`cursorFrame`, `lifeFrame` e `envFrame` todo quadro (a mesa 3D só renderiza quando a
assinatura muda; o parallax faz a palavra mudar todo quadro enquanto assenta). Confira no
Performance se `frame`/`envFrame`/`renderer.render` aparecem todo quadro mesmo parado.

### H8 — Ambiente de medição
As medidas daqui foram no **dev server** (Vite, sem minificar, com HMR) e numa GPU
dedicada. Compare sempre no build:
```bash
npm run build
```
```bash
npm run preview
```
E veja em `chrome://gpu` se a sua máquina está com "GPU rasterization" e
"Hardware accelerated" ativos (com aceleração desligada, tudo isso vira CPU).

### Roteiro sugerido de bisseção
1. Gravar o Performance rolando cartaz → zoom, e anotar o FPS e as tarefas longas.
2. Rodar H1 (opacidade dos wrappers e blend). Se o FPS volta, a causa é a composição.
3. Rodar H3 (visibility da trilha). Se o travão do cartaz some, é ela.
4. Rodar H4 (seção 6 / filtro).
5. Rodar H6 (animações).
6. Se nada mudar: H2 (pinturas no `measure`), procurando tarefas longas.

---

## 6. Scripts de medição (`docs/debug-transicao-pc/scripts/`)

Pré-requisitos: dev server em `http://localhost:5174/` (ou edite a URL), Playwright já
instalado no projeto (`@playwright/test`), Chrome instalado. Os scripts importam o
Playwright pelo caminho absoluto `C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/playwright/index.mjs`.
Viewport 1700×900, DPR 1, e **`PC_AT = 21200`** (onde o PC liga nesse viewport; se o
layout mudar, rode `probe.mjs` e atualize). Rodar com `node <script> [opções]` dentro da
pasta `scripts`. Saída em `docs/debug-transicao-pc/saida/`.

| script | o que faz | opções úteis |
|---|---|---|
| `probe.mjs` | GPU usada, onde o PC liga, árvore de camadas (tamanho, motivo de composição) | `--headless` |
| `record.mjs` | screencast durante vai-e-volta e blocos "chapados" por quadro | `--headed --tag x --css "..."` |
| `record2.mjs` | screencast na fase escura e **piscadas A→B→A** por quadro | `--headed --dpr 2 --gpumem 128 --cpu 4 --url <lab> --start 600 --tag x` |
| `jumps.mjs` | intercepta cada escrita em `.pc-rig.style.transform` e procura saltos | `--headed` |
| `tiles.mjs` | trace do compositor (tentativa de snapshots) | `--headed --at 1500` |
| `tiles2.mjs` / `tiles3.mjs` | contagem RasterTask, Tile:deleted, EnsureCapacity, com CSS injetado; `tiles3` aceita `--still` | `--headed --at 500\|1500\|2700 --css "..." --tag x` |
| `tiles-lab.mjs` | o mesmo no LAB v13 | `--t 0.6 --still` |
| `who.mjs` | **RasterTask por camada → elemento do DOM** | `--headed --at 500 --still --css "..."` |
| `compare.mjs` | fotos em 10 pontos fixos e diferença pixel a pixel contra outra pasta | `--tag depois --diff antes` |
| `crop.mjs` | recorte lado a lado ampliado de duas fotos | `node crop.mjs <ponto> x y w h saida.png` |
| `verify.mjs` | textos PT/EN, bola no tranco, lâmpada no vai-e-volta, parallax | — |

**Para medir FPS diretamente** (o que falta para o problema atual), um acréscimo simples a
qualquer script, antes de rolar:
```js
await page.evaluate(() => { window.__f = []; let l = performance.now(); (function f(n){ window.__f.push(n - l); l = n; requestAnimationFrame(f) })(l) })
// ... rolar ...
const ft = await page.evaluate(() => window.__f.slice(2))
console.log('fps médio', (1000 / (ft.reduce((a, b) => a + b, 0) / ft.length)).toFixed(1), 'quadros >50ms', ft.filter((x) => x > 50).length)
```
E `Emulation.setCPUThrottlingRate` / `--force-gpu-mem-available-mb` para aproximar da sua
máquina. Para testar as hipóteses H1–H6 com números, rode com `--css` igual ao do teste.

---

## 7. CSS original das peças trocadas por canvas (para reverter)

```css
.pc-fx-band{ opacity:calc(var(--crt) * .07); background:linear-gradient(180deg, transparent 0 40%, #fff 50%, transparent 60% 100%) 0 0 / 100% 300%;
  animation:pcBand 7s linear infinite; }
@keyframes pcBand{ from{ background-position:0 -100%; } to{ background-position:0 200%; } }
.pc-fx-vig{ opacity:var(--crt); box-shadow:inset 0 0 calc(var(--h) * .06) rgba(0,0,0,.4);
  background:radial-gradient(130% 120% at 50% 50%, transparent 62%, rgba(0,0,0,.32) 100%); }
.pc-fx-glass{ opacity:calc(var(--crt) * .9);
  background:radial-gradient(60% 45% at var(--gx, 28%) var(--gy, 18%), rgba(255,255,255,.13), transparent 70%),
             linear-gradient(160deg, rgba(255,255,255,.07) 0 30%, transparent 30.5%); }
.pc-dev{ position:absolute; pointer-events:none; filter:brightness(var(--lit, 1)); }
.pc-dev img{ display:block; width:100%; height:100%; }
.pc-amb{ position:absolute; inset:0; pointer-events:none; opacity:var(--glow, 0);
  background:radial-gradient(ellipse 46% 52% at var(--ax, 50%) var(--ay, 50%), rgba(var(--gc), .24), rgba(var(--gc), .07) 55%, transparent 80%);
  animation:pcGflk .25s steps(1) infinite; }
.pc-dev-glow{ position:absolute; pointer-events:none; opacity:var(--glow, 0); mix-blend-mode:screen;
  -webkit-mask:var(--devmask) 0 0 / 100% 100% no-repeat; mask:var(--devmask) 0 0 / 100% 100% no-repeat;
  background:radial-gradient(ellipse 62% 56% at var(--sx, 50%) var(--sy, 40%), rgba(var(--gc), .8), rgba(var(--gc), .26) 45%, transparent 78%); }
.pc-poster::after{ content:''; position:absolute; inset:0; pointer-events:none; opacity:var(--pv, 1);
  background:radial-gradient(120% 95% at 50% 46%, transparent 52%, rgba(0,0,0,.5) 100%); }
```
O JS de antes setava, em `measure()`: `devGlow.style.setProperty('--devmask', url(pc.png))`,
`--sx`, `--sy` e `crt.style.setProperty('--h', H1px)`; em `frame()`: `--ax`/`--ay` no host;
em `lifeFrame()`: `--gy` no `.pc-crt`. O STAGE tinha `<div class="pc-dev-glow">`, `<div class="pc-amb">`
e os `.pc-fx-*` como `div`s vazios.

---

## 8. Pendências conhecidas

- A queda de FPS e os travamentos atuais (este documento): **não reproduzidos** na GTX 1660 + dev server.
- Com memória de GPU muito apertada (≤ 128 MB), ainda pode faltar ladrilho no conteúdo
  da tela filtrada (CRT): é a curva SVG sobre conteúdo vivo.
- O ruído e as scanlines do tubo continuam em CSS, re-rasterizando com a escala (de propósito,
  pela aparência).
- O letreiro do topo (`.marquee-track`) re-rasteriza constantemente; isso é do site, não da cena.
- A memória do projeto tem o resumo do diagnóstico: `project_pc-transition-raster-churn`.
