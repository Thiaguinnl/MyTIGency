# Varredura geral — MyTigency (31/10/2026)

**Atualização 31/10:** corrigidos os grupos 1 a 4 (B1–B9, B12 e parte do P4). Cada item diz o status e como foi verificado. Nada foi commitado.

**Como os grupos 1–3 foram verificados:**
- os scripts de reprodução rodaram de novo no build de produção;
- comparação A/B com um build da versão anterior, servido do disco pelo Playwright: scroll muito rápido (sem regressão; a versão antiga tem os mesmos picos de GPU) e posição do header/marquee em 15 pontos, inclusive no encaixe e com o menu aberto no footer (idênticas);
- dev com StrictMode: a TV renderiza e `/#trabalhos` pousa;
- `npm run lint` sem avisos novos.

**Como verifiquei:** build de produção (`npm run build` + `preview-build`, porta 4173), Chrome real via Playwright (`channel: 'chrome'`, GTX 1660), 1600×900 salvo indicação. Para simular um aparelho fraco usei CDP: CPU 4× e 6× mais lenta, rede 4G e 3G rápido. Os scripts de reprodução estão em `docs/varredura/scripts/`: rode `node <script>.mjs` com o `preview-build` no ar. As capturas estão em `docs/varredura/capturas/`.
`npm run lint`: 0 erros; os avisos são só de `lab/`, `docs/` e `BackgroundBoxes` (código órfão).

Severidade: 🔴 crítico · 🟠 alto · 🟡 médio · ⚪ baixo/refino. Status: **pendente**, salvo quando o item diz **corrigido**.

## Hipótese principal

**Confirmada em parte.** As cenas se reposicionam certo em todos os caminhos não lineares. A chegada por `/#trabalhos`, o menu, o pulo, o Voltar do navegador e o scroll rápido pousaram sempre no y esperado, sem Lenis travado. O que quebra fica em volta das cenas, e são 4 raízes:

1. **O rótulo do header vem de um observador incremental** (B1). Só lê o que *mudou* num lote do IntersectionObserver, e os elementos observados se movem por `transform`/`fixed`.
2. **O capítulo com ímã trata scroll programático como se fosse gesto** (B2).
3. **Estado que só sincroniza em evento, não no scroll** (B4).
4. **As duas entradas HTML não são iguais** (B5). A navegação SPA herda o `<head>` da primeira página aberta.

---

## Bugs

### B1 🔴 Header mostra o rótulo errado depois de qualquer entrada não linear
- **Passos (todos reproduzem, PT/EN, 1600×900):**
  - carregar `/#trabalhos`: durante os ~8 s do capítulo o rótulo diz **HOME** (até o cartaz);
  - `/contato` → Menu → Trabalhos: idem;
  - Menu → Trabalhos a partir da Hero ou da seção 6: **HOME** até o cartaz;
  - Voltar do navegador de `/contato` para a home: **HOME** em y 23167;
  - "Voltar ao início": pousa no começo do Manifesto (y 1527) com **HOME**;
  - do footer, saltar para o Manifesto: **CARREIRAS** no meio da seção 5 (captura `fonts-direct.png`);
  - em Trabalhos, clicar em Home: **TRABALHOS** na seção 6;
  - captura `lang-24078-a.png`: **HOME** na seção 6.
- **Esperado:** MANIFESTO dentro do Manifesto, TRABALHOS no cartaz e na folha.
- **Causa:** `src/hooks/useActiveSection.js` só olha as entradas que mudaram no lote do IntersectionObserver.
  - `#top` (Hero) é `position: fixed`: fica sempre "na faixa" até sumir com `display: none`.
  - `#manifesto` é a **seção 1 dentro da trilha que anda de lado**: no pin lateral ela sai da tela pela esquerda.
  - Depois de um salto, nenhum elemento observado "entra", e o rótulo fica com o último valor.
  - No scroll linear funciona por sorte de ordem.
- **Correção proposta (1 arquivo):** calcular a seção ativa pela posição no documento, comparada com `scrollY` a cada scroll.
  - A posição de cada seção vem da cadeia de `offsetTop`, imune a transform. Fica em cache e só é refeita no resize e no `refresh` do ScrollTrigger.
  - O override do `cartaz` continua como está.
  - Zero leitura de layout por quadro.
- **✅ Corrigido** (`useActiveSection.js`):
  - a seção ativa é a última cujo início (`offsetTop`, em cache) passou da linha `--marquee-h + --header-h`;
  - é remedida no resize e quando a altura da página muda (ResizeObserver no body);
  - verificado: `/#trabalhos`, contato → Trabalhos e o Voltar do navegador mostram MANIFESTO durante o capítulo e TRABALHOS no cartaz; "Voltar ao início" mostra MANIFESTO; voltar ao topo mostra HOME; reduced motion e mobile ok.

### B2 🔴 HOME (logo do header ou Menu → Home) a partir de Trabalhos para no meio do Manifesto
- **Passos:** rolar até Trabalhos (y 27500) e clicar no logo do header, ou em Menu → Home.
- **Esperado:** subir até o topo.
- **Acontece:** para em **y 20037** (seção 6, começo do capítulo com ímã) e fica lá. Script `home.mjs`.
- **Causa:** `snapTick` (`useManifestoHorizontal.js`) vê o `lenis.scrollTo(0)` suave subindo pelo capítulo e acha que é a pessoa rolando.
  - Ele chama `snapGo(-1)`, e o `freezeScroll` interrompe o scroll (`lenis.scrollTo(lenis.scroll, immediate)`).
  - Depois o capítulo volta sozinho até o começo dele.
- **Correção:** o ímã ignora scroll programático. Um helper único em `pageTransition.js` ("ir ao topo") marca o scroll como programático até terminar. Header, Menu e Footer (B3) passam a usar esse helper. A mesma raiz vale para qualquer `lenis.scrollTo` suave que atravesse o capítulo.
- **✅ Corrigido:**
  - `scrollToTop()` em `pageTransition.js` marca o scroll com `userData: { auto: true }`; a rodinha da pessoa zera a marca, porque o Lenis troca o `userData` a cada gesto;
  - o `snapTick` sai do caminho enquanto `isAutoScroll()` é verdadeiro;
  - `force: true`: no celular, o Menu → Home também rola com o menu ainda travando o Lenis;
  - verificado: logo e Menu → Home a partir de y 27500 chegam a y 0.

### B3 🟠 Logo do rodapé não faz nada na home
- **Passos:** rolar até o fim da home e clicar no logo grande do rodapé (`href="#top"`).
- **Acontece:** a URL vira `/#top` e o scroll não se mexe (y 28357 → 28357).
- **Causa:** a Hero é fixa, então âncora em `#top` é no-op. É o mesmo motivo já comentado no `Header.jsx`, mas o footer não tem o handler.
- **Correção:** o mesmo helper do B2.
- **✅ Corrigido:** o logo do rodapé leva de y 28357 a y 0, sem sujar a URL com `#top`.

### B4 🟠 Botão Pular/Voltar mostra o modo errado
- **Passos:** do topo, rolar com a rodinha até a seção 5/6. Script `skipmode.mjs`.
- **Esperado:** a partir da seção 5, o botão vira "↑ Voltar ao início" (`manifestoSkip.js`).
- **Acontece:** fica **"→ Pular Manifesto"** de y 1838 até 19400; clicar leva para a frente, ao cartaz.
  - Também acontece o inverso: depois de passar pelo cartaz e voltar às seções 1–4 por salto, o botão pode ficar "Voltar ao início".
  - A captura `fonts-from-contato.png` mostra "Ir para Trabalhos" na seção 5.
- **Causa:** `syncSkip()` só roda no `onToggle` da faixa do botão e quando o PC muda (`stepPC`), nunca pelo scroll.
- **Correção (1 linha):** chamar `syncSkip()` dentro de `apply()`. O `setSkip` já ignora valor igual.
- **✅ Corrigido:** rolando linearmente, o botão vira "Voltar ao início" no fim da cena A (y ≈ 8335, 1600×900).

### B5 🟠 Entrando pelo `/contato`, a home fica com fontes erradas
- **Passos:** abrir `/contato` direto e clicar no logo (ou no menu) para ir à home; rolar até a seção 5.
- **Acontece:** "NADA surge antes da hora" sai largo em vez de condensado. A Archivo vem só com largura 100%: falta o eixo 62–125% usado pelas seções 5/6. A Playfair (`.ls-big`) não carrega e cai no fallback. Compare `fonts-from-contato.png` com `fonts-direct.png`.
- **Causa:** `contato.html` pede outra lista do Google Fonts (Archivo sem `wdth` e sem Playfair). Como a navegação é SPA, a home herda o `<head>` da primeira página aberta.
- **Correção:** a mesma lista de fontes nos dois HTML, já enxuta (ver P4).
- **✅ Corrigido:** o `<link>` agora é idêntico nos dois HTML. Vindo do contato, a home carrega a Archivo 62–125% e a Playfair, como na carga direta.

### B6 🟠 Vazamento de contexto WebGL a cada ida e volta home ↔ contato
- **Passos:** home → Fale conosco → logo → home, 5×. Script `roundtrip.mjs`.
- **Acontece:** a cada volta sobra **1 contexto WebGL vivo**: 5 voltas, 5 órfãos, mais ~0,7 MB de heap por volta. O Chrome aceita ~16 contextos; depois de ~10 voltas começa a derrubar ("Too many active WebGL contexts").
- **Causa:** é a TV da seção 2. O `dispose()` de `src/utils/tv3d.js` chama `renderer.dispose()`, mas não `renderer.forceContextLoss()` (o PC e a mesa já chamam), e o canvas continua referenciado.
- **Correção:** `forceContextLoss()` no dispose do `tv3d`. Por consistência, também no `1asciiLogo`, no `cursor3d` e no `manifestoS6GL`.
- **✅ Corrigido:**
  - `forceContextLoss()` nos quatro. Libera a GPU na hora, sem esperar o coletor de lixo: voltando à home, os 7 contextos novos não somam aos velhos;
  - na TV, só quando o canvas saiu da página: o canvas é do React, e o StrictMode do dev remonta no mesmo canvas;
  - verificado: 0 contextos vivos no contato depois de 5 voltas (antes eram 5).
  - **Resta:** o heap JS ainda cresce ~0,6 MB por volta. Algo segura o canvas da TV, mas a GPU já está livre. Baixa prioridade.

### B7 🟠 Trocar PT/EN no meio da home congela a página
- **Passos:** Menu → EN estando na Hero, na seção 3, na seção 6 ou no cartaz. Script `lang.mjs`.
- **Acontece:** tarefa longa de **579 / 743 / 692 / 1618 ms** num desktop rápido. Num aparelho fraco a estimativa é de 3 a 8 s de tela parada.
- **Causa:** `useManifestoHorizontal` tem `lang` nas dependências. Trocar o idioma desmonta e remonta o Manifesto inteiro, sem tela de carregamento: o pin, o PC (2 WebGL), a mesa 3D, as seções 5/6 e o cursor 3D.
- **Correção (esforço médio):** tirar `lang` da dependência e atualizar só os textos. O PC e a régua da seção 3 recebem os textos novos por um setter.
  - Ao medir, a estimativa se mostrou otimista: o texto do PC está no 3D (a palavra é geometria; o disquete e os bilhetes são texturas). Trocar só o texto exigiria mexer em 6 módulos aprovados.
- **✅ Corrigido (opção escolhida: cortina rápida):**
  - na home, `switchLang()` em `pageTransition.js` passa a trocar o idioma por baixo de uma versão curta da cortina de dither: cobre em 600 ms, nascendo do botão PT/EN, com o rótulo ENGLISH_ ou PORTUGUÊS_;
  - o idioma é aplicado com `flushSync` com a tela já coberta; a cortina espera o aquecimento (shaders novos, cursor 3D) e revela do centro em 700 ms. Reduced motion: fade;
  - no contato a troca segue direta (barata);
  - o Manifesto ainda remonta, mas nunca com a tela à mostra.
- **Junto, duas falhas da remontagem no meio do pin (já existiam; também afetam quem chega por salto e volta rolando):**
  - o cursor 3D não montava, porque esperava a seção 2 "entrar" e ela está deslocada de lado. Agora monta também quando o pin já está andando;
  - o botão Pular/Voltar sumia, porque a faixa dele, criada já dentro do intervalo, não dispara `onToggle`. Agora o estado inicial sai da posição atual, no desktop e no mobile.
- **Verificação (`langcurtain.mjs`, `langstate.mjs`, `langcontato.mjs`):**
  - PT→EN na Hero, cena A, seção 6 e cartaz: **0 tarefas longas visíveis** (CPU 1×; também em reduced motion);
  - cortina de 3,0–4,4 s no desktop rápido. Com CPU 4×, o congelamento de 4–5,6 s fica todo coberto e a cortina dura 7–11 s;
  - mesma cena, mesmo y e rótulo certo depois da troca;
  - cursor 3D, botão (com o modo certo) e régua iguais ao estado em PT;
  - no contato: EN em 44 ms, sem cortina.

### B8 🟠 Aquecimento sem prazo: uma tarefa que nunca termina trava o gate para sempre
- **Em dev:** é o caso já medido. O StrictMode leva ao erro `isReady`, e `/#trabalhos` não posiciona.
- **Em produção também acontece:**
  - a pessoa sai da home, ou troca o idioma (B7), enquanto os shaders ainda compilam;
  - o `compileAsync` do three joga `TypeError` dentro de um `setTimeout`, e a promise nunca resolve;
  - ela fica no `Set pending` do módulo `warmup.js`;
  - na próxima visita à home (SPA), `warmupsDone()` espera para sempre: a cortina fica presa 8 s (`MAX_WAIT_MS`) e `/#trabalhos` não pousa.
- **Decisão pedida no prompt:** vale blindar.
- **Correção:** `warmup()` corre contra um prazo (~6 s), e o `Set` é limpo quando a home desmonta.
- **✅ Corrigido:**
  - `warmup()` corre contra um teto de 6 s por tarefa; a tarefa segue rodando, só não é mais esperada. Isso já basta, sem limpar o `Set`;
  - verificado no dev: `/#trabalhos` pousa no capítulo e chega ao cartaz (antes não pousava);
  - o erro `isReady` continua no console do dev: vem de dentro do three, quando o StrictMode descarta o material no meio da compilação. É só ruído, não trava mais nada.

### B9 🟠 Travada ao chegar no footer (bug conhecido) — causa medida
- **Passos:** de Trabalhos, rolar com a rodinha até o footer com CPU 4×. Script `footer.mjs 4`.
- **Acontece:** 7 recálculos de estilo do **documento inteiro** (1.423 elementos, até 148 ms cada). Pior quadro de 188 ms, com 7 quadros acima de 100 ms.
- **Causa:** variáveis herdadas escritas na raiz invalidam o estilo de todos os elementos da página:
  - o `Footer.jsx` escreve `--chrome-push` no `<html>` a cada quadro;
  - o `useHeroMarqueeReveal` faz o mesmo com `--dock-t` na transição Hero→Marquee.
- **Prova (A/B, `footer.mjs 4 ab`)** — as mesmas variáveis escritas só no header e na `.marquee`:

  | | Hoje (no `<html>`) | Só no header e na `.marquee` |
  |---|---|---|
  | Recálculos de estilo grandes | 7 | 0 |
  | Maior recálculo | 148 ms | 19 ms |
  | Pior quadro | 188 ms | 73 ms |
  | Quadros acima de 100 ms | 7 | 0 |

- **Correção (sem mudança visual):**
  - escrever as duas variáveis no `header` e na `.marquee`;
  - em `App.css`, trocar `header.menu-open{--chrome-push:0px}` por `!important`, para continuar valendo contra o inline.
- **✅ Corrigido:** `--chrome-push` (Footer.jsx) vai no header e na marquee, e `--dock-t` (useHeroMarqueeReveal) vai no header.

  | Com CPU 4× | Antes | Depois |
  |---|---|---|
  | Recálculos da página inteira | 7 | 0 |
  | Pior quadro | 188 ms | 97 ms |
  | Quadros acima de 100 ms | 7 | 0 |

  Posições do header e da marquee idênticas às da versão anterior, inclusive com o menu aberto no footer.

### B10 🟡 Redimensionar no meio do pin pula de cena
- **Passos:** na seção 3 (y 6050), redimensionar a janela de 1600×900 para 1280×720.
- **Acontece:** a tela vai para a cena "Por isso, em vez de promessas…" (captura `resize-s3.png`).
- **Causa:** o ScrollTrigger refaz as medidas, mas o scroll fica no mesmo px, e o pin agora tem outro comprimento.
- **Correção:** guardar o progresso do pin no `refreshInit` e restaurar depois do `refresh`. Também vale para a rotação de tablet.

### B11 ⚪ Reduced motion: o mesmo destino pousa em lugares diferentes
- `/#trabalhos` pousa em y 16637, e Menu → Trabalhos (da Hero) pousa em y 15123. Falta conferir no olho qual dos dois está certo.

### B12 ⚪ A página de contato espera fontes que não existem mais
- O `ContactPage.jsx` faz `fonts.load` da Roslindale, que foi removida. O gate da cortina não espera a Instrument Serif nem a Fraunces de verdade: em rede lenta, o título pode aparecer na fonte de fallback.
- **Correção:** trocar pelas famílias atuais.
- **✅ Corrigido:** o gate agora espera a Instrument Serif, a JetBrains Mono e a Fraunces.

### B13 ⚪ Aviso no console a cada carga
- `THREE.WebGLProgram … X3595: gradient instruction used in a loop` aparece toda vez.
- Vem de um shader do `manifestoS6GL.js`: um `texture2D` dentro de um laço de tamanho variável. Hoje é inofensivo, mas é ruído no console e pode render errado em alguns drivers.

### B14 ⚪ Mobile: a faixa do botão Pular depende do caminho (achado no teste do B7)
- **Passos (390×844):**
  - rolando com o dedo, o botão continua visível depois de Trabalhos começar;
  - chegando por salto (ex.: y 5800), some antes da hora: Trabalhos ainda está a 1.100 px.
- Igual em PT e EN; não tem relação com a troca de idioma.
- **Causa provável:** as posições da faixa (`mSkipSt`) ficam velhas enquanto o Manifesto empilhado cresce.
- O mobile ainda não tem versão própria: só anotado.

---

## Desempenho em aparelho fraco

### P1 🔴 A carga inicial é pesada demais
| | Página liberada | Tarefas longas | Maior |
|---|---|---|---|
| Desktop sem limite | 4,0 s | 2,7 s somadas | 909 ms |
| CPU 4× + 4G | **14 s** | 10,9 s | 4,0 s |
| CPU 6× + 3G rápido | **29 s** | 23 s | **10 s** (tela congelada) |

O teto de 9 s do `useAppReady` não protege, porque o main thread fica bloqueado e o timer não roda.

Perfil da carga, resolvido até o fonte (`profile.mjs`): criar os **7 contextos WebGL** custa ~600 ms. O `ScrollTrigger.refresh()` repetido custa ~730 ms; dentro dele, o `layout()` do Manifesto leva 660 ms e o `warpBrush` 220 ms, porque refaz o pincel a cada refresh. O `readPixels` do ASCII da Hero leva ~385 ms. A primeira rolagem depois de liberar, com CPU 4×, fica com p50 de 42 ms e pico de 230 ms.

Recomendações, em ordem de custo/benefício:
- **a.** Juntar os `refresh()` da largada num só. Hoje cada um dispara um refresh completo: `fonts.ready`, seção 3 pronta, cursor 3D montado, `s2:tv-ready`, `tv3d:loaded`.
- **b.** Fazer o `pc.measure()` e o `buildPath()`/`warpBrush` pularem quando o tamanho não mudou. Hoje repintam 7 canvases e refazem o pincel a cada refresh.
- **c.** Não renderizar o ASCII da Hero enquanto a tela de carregamento cobre: o `readPixels` sincroniza a GPU no meio dos aquecimentos.
- **d. Estrutural (maior ganho e maior esforço; precisa de decisão):**
  - não montar nem aquecer o PC e a mesa na carga, e sim no ocioso, depois de liberar a página, ou ao chegar perto da seção 5;
  - compartilhar um `WebGLRenderer` entre cenas em vez de ter 7 contextos.

### P2 🟠 Memória e GPU
- A home tem **22 canvases**, 8 deles do tamanho da tela inteira, todos alocados mesmo invisíveis. Em DPR 2 (a maioria dos notebooks) cada um passa de 3200×1800.
- O cursor 3D usa um canvas da tela inteira, com 2 passes por quadro enquanto aparece.
- **Correções sem mudar a aparência:**
  - canvas de cena fora de alcance com tamanho mínimo até chegar perto;
  - cursor 3D num canvas do tamanho do cursor.
- O teto de DPR 1,5 nos canvases de efeito em tela cheia economiza muito, mas **pode** mudar o traço fino: avaliar no olho.

### P3 🟡 Pulo do menu a partir da Hero
- O pulo trava 535 ms: o portal congela no meio da animação. Da seção 3 são só ~60 ms.
- Causa provável: `finishScrubs` mais a primeira pintura de tudo entre a Hero e o PC, no mesmo quadro. Investigar com trace antes de mexer.

### P4 🟡 Fontes
- O CSS do Google Fonts tem **174 KB**, bloqueia a renderização e registra 243 `@font-face`.
- Famílias pedidas e **nunca usadas** nas duas páginas: Inter, Syne, Source Code Pro, Italiana, UnifrakturMaguntia, Space Mono e Just Me Again Down Here.
- Tirá-las não muda nada na tela, junto com o B5.
- Depois: self-host. As licenças web da Roslindale/Droog já saíram de uso.
- **✅ Corrigido em parte:**
  - saíram 8 famílias: as 7 acima e a Great Vibes, que só servia ao `initialPiece()` de `manifestoLineA.js`, uma função que nada chama mais;
  - o CSS caiu de 174 para 155 KB;
  - o resto do peso é a Iansui (CJK, ~100 blocos de `unicode-range`), usada só em `.ms-lead`. Ela pode virar `&text=` com as letras usadas, mas aí precisa acompanhar o texto. Fica para decidir junto com o self-host.

### P5 🟡 JavaScript e assets
- O chunk `HomePage` tem 1,19 MB (392 KB gzip).
- O `manifestoPCDesk.js` usa `import.meta.glob('../assets/*.typeface.json', { eager: true })` e embute as **4** fontes 3D (~85 KB), quando só a `titan-one` é usada. Importar só ela.
- Imagens: `conversa.jpg` (608 KB), `garantia.jpg` (475 KB), `nosso.jpg` (340 KB) e `linha.jpg` (229 KB) cabem em WebP/AVIF com ~60–70% menos, sem diferença visível.
- `myt.glb` (653 KB): compressão meshopt/Draco.

### P6 ⚪ Cursor contextual
- `elementsFromPoint` roda em todo `mousemove`: um mouse de 1000 Hz faz ~16 hit-tests por quadro.
- `left`/`top` são escritos a cada quadro, mesmo com o mouse parado.
- **Correção:** hit-test uma vez por quadro, `transform` no lugar de `left`/`top`, e parar o loop quando o cursor assenta.

### P7 ⚪ Dois relógios de animação
- O Lenis (`autoRaf`) e o ticker do GSAP rodam em loops separados. A integração recomendada é um só: `gsap.ticker` chamando `lenis.raf`.
- Pode tirar 1 quadro de atraso entre o scroll e os scrubs. Risco médio: testar antes.

---

## Melhorias e pendências (sem mudar a aparência)

- **M1 ⚪ Acessibilidade:**
  - o `index.html` tem `<html lang="en">`, mas o conteúdo padrão é PT;
  - o `lang` não acompanha a troca PT/EN, então o leitor de tela lê com a voz errada;
  - **correção:** setar `document.documentElement.lang` no `LanguageProvider`.
- **M2 ⚪ SEO e compartilhamento:**
  - não há `meta description` nem Open Graph;
  - o título da home é "mytigency", em minúsculas;
  - a grafia da marca varia entre MyTigency, MyTIgency e mytigency.
- **M3 🔴 (conteúdo) Footer com links mortos e conteúdo do protótipo:**
  - as redes (LinkedIn, Instagram, YouTube, **"Rome FM"**) e o menu (Work, About, Join us, Latest, Awards) usam `href="#"` com `preventDefault` e estão só em inglês;
  - "Rome FM" é do protótipo de referência (The Romans): **não pode ir ao ar** (autenticidade, `DESIGN.md`);
  - é decisão de vocês, não de código.
- **M4 🔴 (lançamento) O formulário de contato não envia em produção.** É o TODO de backend já conhecido; o estado de erro aparece certo.
- **M5 🔴 (lançamento) Cases de Work ainda são placeholders.** É gap conhecido: não inventar.
- **M6 ⚪ "Carreiras" leva ao footer, que não tem conteúdo de carreiras.** Rótulo e destino a decidir.
- **M7 ⚪ Scrollbar nativa escondida no site todo:**
  - é decisão registrada, só deixo o risco anotado;
  - numa página de ~29.000 px não há indicação de posição;
  - quem não usa rodinha fica sem ter onde arrastar.
- **M8 ⚪ Capítulo com ímã (aprovado; só observação de UX, não mexi):**
  - um "flick" forte não atravessa o capítulo em nenhum sentido: subindo, para em y 20037 e pede outro gesto;
  - chegar em Trabalhos pelo menu, por `/#trabalhos` ou pelo Voltar do navegador são ~9 s de animação com a rodinha engolida.

## O que não reproduziu / está ok
- **Scroll muito rápido**, do topo ao fim e de volta: nada travou. O Lenis não ficou parado, a rodinha continua respondendo e o pior quadro foi de 37 ms (desktop).
- **5 idas e voltas home ↔ contato:** o scroll não travou e a cortina abriu sempre. O único problema é o vazamento do B6.
- **Mobile 390×844:** sem overflow horizontal, página liberada em 1,8 s, e `/#trabalhos` pousa na seção 6 empilhada.
- **Itens já corrigidos** (cursor da seção 6, tela do PC por cima, flicks na transição): não reapareceram nas capturas desta varredura. Não fiz um teste dedicado para cada um.

## Ordem sugerida de correção
1. ✅ **Raízes compartilhadas, mudança pequena:** B1, B2+B3 (o mesmo helper) e B4.
2. ✅ **Estabilidade:** B6, B8 e B9.
3. ✅ **Fontes:** B5 + P4 + B12, um só passe nos dois HTML.
4. ✅ **B7** (troca de idioma por baixo da cortina).
5. **Carga, sem mudança estrutural:** P1 a–c e P5.
6. **Precisam de decisão sua:** P1d, P2 (DPR), P7, M3, M6 e B10.
