# Prompt — varredura geral de bugs (colar num chat novo)

> Sugestão de configuração: Opus 5.5, esforço **high** (xhigh se quiser a varredura mais funda). Respostas resumidas.

---

Boa tarde. Quero uma **varredura geral de bugs** no site da MyTigency (este repositório). Siga o `CLAUDE.md` do projeto (workflow, menor mudança possível, nada de refactor fora do escopo, nada de inventar conteúdo) e use os skills `myt-*` só quando a causa do bug tocar neles. Respostas resumidas.

## Como trabalhar (nesta ordem)

1. **Antes de corrigir qualquer coisa**, crie `docs/bugs.md` com cada bug: passos exatos para reproduzir, o que se espera, o que acontece, viewport, idioma (PT/EN) e a hipótese de causa. Me mostre a lista e espere meu ok para corrigir.
2. **Reproduza com Playwright** (já instalado; Chrome real: `channel: 'chrome'`, flags `--ignore-gpu-blocklist --use-angle=d3d11`). Já existem scripts de exemplo em `docs/debug-transicao-pc/scripts/`. Monte uma **matriz de caminhos de entrada × estado das cenas**:
   - carregar a home do topo; carregar direto em `/#trabalhos`; ir de `/contato` para "Trabalhos" pelo menu; voltar de Trabalhos para `/contato` e de novo para a home;
   - botão "Pular Manifesto" / "Voltar ao início"; menu → Trabalhos de vários pontos (Hero, seção 3, seção 6, já em Trabalhos);
   - scroll lento, scroll rápido (rodinha forte / trackpad com inércia), voltar no meio das cenas fixas (pins), redimensionar a janela no meio, trocar PT/EN;
   - `prefers-reduced-motion: reduce`; larguras 1280, 1440, 1920 e ≤ 700 (mobile ainda não tem versão própria — só anote o que quebrar, não redesenhe).
3. **Hipótese principal** (confirme ou descarte com evidência): vários bugs vêm da mesma raiz — o estado das cenas não é refeito quando a página é aberta por um caminho que não é o scroll linear (volta SPA de `/contato` via `src/utils/pageTransition.js`, pulo do Manifesto, "voltar ao início", scroll rápido). Corrija na função compartilhada, não em cada sintoma.
4. **Corrija um bug por vez**: causa-raiz → correção mínima → rode o script de reprodução de novo → `npm run lint`. Não toque no que não está quebrado.
5. No fim, rode `/code-review high` sobre o diff e um passe de `myt-visual-qa` nas áreas tocadas.

## Bugs já conhecidos (comece por eles)

- **Rótulo do header errado**: o header mostra "HOME" ou "MANIFESTO" estando em Trabalhos/Serviços. Acontece em caminhos específicos, por exemplo vindo de `/contato` para Trabalhos. O rótulo vem de `sectionLabels[activeId]` em `src/components/Header.jsx`.
- **Travamento no footer**: a página/header dá uma travada estranha ao chegar no footer.
- **Chegada por `/#trabalhos` em `npm run dev`**: a página não se posiciona. Causa já medida: o StrictMode (dev) monta duas vezes, o `renderer.compileAsync` da 1ª montagem joga `TypeError: ... reading 'isReady'` (material descartado no meio da compilação), o `warmupsDone()` nunca resolve e o `landOnHash` (`src/hooks/useAppReady.js`) nunca roda. No build de produção funciona (`.claude/launch.json` → `preview-build`, porta 4173). Decida se vale blindar o aquecimento (`src/utils/warmup.js`) contra tarefa que nunca termina.
- **Erro `isReady` no console** em dev (mesma causa acima).
- Itens já corrigidos que **não devem voltar**: cursor da seção 6 sumindo e voltando depois do "apresentar"; a tela do PC ficando por cima de outros conteúdos; flicks na transição para o PC.

## Contexto que economiza tempo

- **Scroll**: o Lenis é a autoridade (`src/components/SmoothScroll.jsx`). `window.scrollTo` no teste briga com ele — use rodinha real (`page.mouse.wheel`) para testar comportamento, e `scrollTo` só para posicionar. `scrollNow / scrollSet / scrollSmooth / freezeScroll` ficam em `src/utils/pageTransition.js`.
- **Manifesto**: tudo num pin do GSAP (`src/hooks/useManifestoHorizontal.js`, `scrub: 1.2`). A transição seção 6 → PC → Trabalhos é um **capítulo com ímã** (ref.: shader.se): do clique no "apresentar" até o cartaz, um gesto leva o scroll sozinho pelo caminho `PATH` (`snapTick/snapGo`), engolindo a rodinha no mesmo sentido e invertendo no sentido contrário. O pulo/menu/chegada cai no tranco do degauss (`cartazY` + `pc.kick()`) e toca o capítulo (`snapChain`). Isso foi aprovado — não mude o comportamento, só corrija se algo quebrar.
- **Cena do PC**: `src/utils/manifestoPC.js` (o rig, a tela, a lâmpada, o degauss) e `src/utils/manifestoPCDesk.js` (mesa 3D, cartaz, a palavra 3D "TRABALHOS"/"OUR WORK" desenhada numa textura própria e composta antes da mesa).
- **Posições úteis no headless 1600×900**: o capítulo vai de ~20037 (logo antes do "apresentar") até ~24078 (cartaz completo); mudam com a viewport.
- **Painel de navegador do app**: o rAF cai para 1–4 fps nesta página; animação por tempo parece travada ali. Verifique no Chrome real (Playwright), não no painel.
- **Memória do projeto** (`~/.claude/projects/.../memory/`): `project_bug-sweep-plan.md`, `project_manifesto-section6.md`, `project_pc-transition-raster-churn.md` têm o histórico e as decisões travadas.
- **Não instale nada** sem me perguntar (ex.: Chrome DevTools MCP para analisar o travamento do footer — pode sugerir, eu aprovo).
- Código órfão conhecido (`PrismSection`, `BackgroundBoxes`, `useAsciiDonut`, `utils/asciiDonut.js`, `manifestoS3.js`) não é bug — não apague.

## Entrega

- `docs/bugs.md` com a lista, a causa de cada um, o status (corrigido / pendente / não reproduz) e como verifiquei.
- Um resumo curto no chat: o que foi corrigido, o que ficou pendente e por quê.
- Não faça commit sem eu pedir.
