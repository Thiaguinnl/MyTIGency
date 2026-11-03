export const strings = {
  pt: {
    header: {
      home: 'Home',
      manifesto: 'Manifesto',
      work: 'Trabalhos',
      careers: 'Carreiras',
      cta: 'Fale conosco →',
      langAria: 'idioma',
      menuOpen: 'Menu',
      menuClose: 'Fechar',
      menuAria: 'Menu de navegação',
      contact: 'Contato',
    },
    loading: {
      label: 'Carregando...',
      ariaLabel: 'Carregando o site',
    },
    hero: {
      eyebrow: 'MyTigency — studio de produto digital, desde 2026',
      headline: ['FUNCIONAR', 'É COMUM.', 'VENCER', 'É RARO.'],
      p1: [
        { text: 'Produto que funciona é o mínimo. ' },
        { text: 'Produto que vence', bold: true },
        { text: ' é o que muda o número no fim do trimestre — e isso não acontece por acidente.' },
      ],
      p2: [
        { text: 'Somos a ' },
        { text: 'MyTigency', bold: true },
        { text: ': um time de design, engenharia e produto. A gente não entrega só um produto que funciona — entrega a ' },
        { text: 'experiência inteira', bold: true },
        { text: ' ao redor dele.' },
      ],
    },
    services: {
      eyebrow: 'O que fazemos',
      headingAccent: 'Duas',
      headingLine1: 'pessoas.',
      headingLine2: 'Um único time.',
      cards: [
        { num: '01', title: 'Design', desc: '[Placeholder] Identidade visual, produto e interface — decisões de design que carregam a marca em cada pixel.' },
        { num: '02', title: 'Engenharia', desc: '[Placeholder] Front-end, back-end e infraestrutura construídos para durar — sem gambiarra, sem dívida técnica escondida.' },
        { num: '03', title: 'Produto', desc: '[Placeholder] Estratégia e priorização — o que construir, na ordem certa, com o motivo certo.' },
      ],
    },
    // fim do Manifesto: o PC, o cartaz e a mesa (utils/manifestoPC.js, manifestoPCDesk.js)
    pc: {
      word: 'Trabalhos', // a palavra gigante atrás do PC (a próxima seção)
      caption: 'MyTigency ®',
      scroll: 'role para abrir ↓',
      end: 'fim do manifesto',
      next: 'trabalhos',
      sticker: 'FEITO À MÃO · POR 2 PESSOAS · COM CAFÉ ·', // o texto em volta do adesivo
      icons: ['Meu computador', 'Lixeira', 'Trabalhos', 'manifesto.txt', 'Prompt'],
      alert: ['Alerta', 'Alerta de site bom demais.', ['Fechar', 'Continuar']], // [título, texto, botões]
      notice: ['Aviso', 'Feche esse pop-up.', ['OK']],
      txt: ['manifesto.txt', 'Este pop-up foi posicionado exatamente aqui.', ['OK']],
      opening: ['Trabalhos', 'Abrindo trabalhos…'],
      floppy: 'trabalhos', // a etiqueta do disquete na mesa
      notes: [['2 pessoas', '+ café'], ['cada linha', 'foi escrita', 'aqui']], // os bilhetes na mesa
      locale: 'pt-BR', // o relógio da barra de tarefas
    },
    work: {
      eyebrow: 'Trabalhos selecionados',
      heading: 'Alguns dos produtos que ajudamos a vencer.',
      cases: [
        { thumb: '[ CASE 01 ]', tag: 'Placeholder', title: '[Nome do projeto]', desc: '[Placeholder] Descrição curta do case — problema, abordagem e resultado.' },
        { thumb: '[ CASE 02 ]', tag: 'Placeholder', title: '[Nome do projeto]', desc: '[Placeholder] Descrição curta do case — problema, abordagem e resultado.' },
        { thumb: '[ CASE 03 ]', tag: 'Placeholder', title: '[Nome do projeto]', desc: '[Placeholder] Descrição curta do case — problema, abordagem e resultado.' },
      ],
      ctaPre: 'Vamos construir algo que ',
      ctaAccent: 'vence?',
      ctaButton: 'Fale conosco →',
    },
    tech: {
      eyebrow: 'Tecnologias',
      heading: 'As ferramentas por trás do que entregamos.',
      sub: 'Só o que usamos de verdade, no dia a dia.',
      tools: [
        { name: 'Figma', desc: 'Você vê e aprova cada tela antes de uma linha de código.' },
        { name: 'Illustrator', desc: 'Logos, ícones e ilustrações em vetor, nítidos em qualquer tamanho.' },
        { name: 'After Effects', desc: 'Animações e vídeos do seu produto, quadro a quadro.' },
        { name: 'Blender', desc: 'Onde modelamos do zero os objetos 3D do seu site.' },
        { name: 'VS Code', desc: 'Onde escrevemos o código que você recebe no final.' },
        { name: 'React', desc: 'A base do site: rápido de navegar e fácil de crescer depois.' },
      ],
    },
    marquee: {
      phrases: [
        'Não tem "time de suporte". Somos nós dois e o café.',
        'A gente só solta o mouse quando fica bom de verdade.',
        'Cada bug que você não viu, a gente brigou com ele primeiro.',
        'Se não ficou bom, a gente refaz — sem cobrar de novo.',
        'Respondemos rápido porque ansiedade também é combustível.',
        'Não ficamos satisfeitos até você parar de mandar "só mais um ajuste".',
      ],
    },
    // botão de pular o Manifesto (components/ManifestoSkip.jsx)
    skip: {
      skip: 'Pular manifesto',
      toWork: 'Ir para trabalhos',
      back: 'Voltar ao início',
      hint: 'Com pressa? Dá pra pular.',
      landing: 'Trabalhos',
      announce: 'Manifesto pulado. Você está em Trabalhos.',
      announceBack: 'De volta ao início do manifesto.',
    },
    manifesto: {
      label: 'Ethos',
      // 3 linhas fixas do Figma; role: brand (elipse), highlight (fundo
      // vermelho), lead (CONDUZ). Decorações são ancoradas por linha no
      // componente, então o texto pode mudar sem reposicionar nada à mão.
      statement: [
        [{ text: 'Na ' }, { text: 'MyTIgency,', role: 'brand' }, { text: ' acreditamos que um' }],
        [{ text: 'site não se ' }, { text: 'apresenta.', role: 'highlight' }, { text: ' Ele' }],
        [{ text: 'conduz.', role: 'lead' }],
      ],
      // Seção 2: "Sem" = S (Great Vibes) + em (Just Me Again Down Here).
      // Grupo da esquerda da seção 2 (ManifestoNos): "NÓS / conversamos e
      // resolvemos tudo.", a prova miúda "Sem …" e a conversa direta.
      without: {
        big: 'Nós',
        lines: ['conversamos', 'e resolvemos', 'tudo.'],
        no: 'Sem',
        items: ['Gerente de conta', 'Terceirizar', 'Intermediários'],
        sentence: 'Nós conversamos e resolvemos tudo. Sem gerente de conta, sem terceirizar, sem intermediários.',
        cue: 'continue rolando',
        chat: {
          head: 'MYT',
          placeholder: 'mensagem',
          now: 'agora',
          seen: 'visto',
          // [quem, texto]: in = cliente, out = nós
          messages: [
            ['in', 'não sei bem o que eu quero ainda'],
            ['out', 'normal! me conta do seu negócio que a gente descobre junto.'],
            ['in', 'sério? simples assim?'],
            ['out', 'é a parte que a gente mais gosta.'],
          ],
        },
      },
      // Seção 3: "quem conversa com você · é quem DESENHA / e quem PROGRAMA"
      // (utils/manifestoSplit.js). title = a frase inteira, para leitores de tela.
      who: {
        mark: 'quem conversa com você',
        kickA: 'é quem',
        wordA: 'Desenha',
        kickB: 'e quem',
        wordB: 'Programa',
        tag: 'nós dois',
        note: 'quem conversa com você é quem desenha e quem programa.',
        title: 'Quem conversa com você é quem desenha e quem programa.',
        // régua do trajeto do cursor (pin lateral): saída da busca, onde pega o traço, chegada
        ruler: ['busca', 'traço', 'quem'],
      },
      // Segundo ato (fundo #141414, utils/manifestoAct2.js) · cena A. Cada
      // linha é uma lista de trechos [texto, papel?]: 'strike' = o marcador
      // risca e a palavra fica oca; 'show' = a caneta circula e acende;
      // grafismos (sem texto): 'flower', 'eye' (pixel), 'arrow'.
      // sentence = a frase inteira (leitores de tela).
      act2: {
        a: {
          eyebrow: '( Em vez de falar, fazer )',
          sentence: 'Por isso, em vez de promessas, preferimos mostrar.',
          lines: [
            [['Por isso,'], ['', 'flower'], ['em vez de']],
            [['promessas', 'strike'], [','], ['', 'eye']],
            [['preferimos'], ['mostrar', 'show'], ['.'], ['', 'arrow']],
          ],
        },
        // Seção 5 (depois da faixa; utils/manifestoS5.js): frase 1 | régua | frase 2.
        // Cada linha é uma lista de palavras [texto, papel?]. Papéis: 'serif'
        // (Instrument Serif itálica), 'wide' (Archivo larga e leve), 'heavy'
        // (condensada e pesada), 'staff' (a palavra na pauta, letras = notas),
        // 'pixel' (os pixels do punho montam a palavra), 'clock' (o relógio
        // entra no lugar do que está entre parênteses). Letras entre colchetes
        // ficam em itálico. sentence = a frase inteira (leitores de tela).
        b: {
          sentence: 'Repare no ritmo desta página. Nada surge antes da hora.',
          before: [[['Repare'], ['no', 'serif'], ['ritmo', 'staff']], [['desta', 'wide'], ['p[á]gin[a].']]],
          after: [[['Nada', 'heavy'], ['surge', 'pixel']], [['antes', 'serif'], ['da', 'wide'], ['h(o)ra.', 'clock']]],
          // fio de cima = cabeçalho de partitura; fio de baixo = player
          score: ['partitura nº 05 ·', 'ritmo desta página', 'música e letra: miguel & thiago'],
          player: { playing: 'tocando', paused: 'pausa', held: 'fermata', track: 'faixa 05' },
          hint: ['role para tocar ↓', 'a tempo ↓'],
        },
        // Seção 6 (depois da seção 5, no mesmo pin; utils/manifestoS6.js): o
        // editor. Uma linha por item, sempre 10 (o papel de cada uma é fixo
        // pela posição: digitada, arrastada, marcada — o círculo abraça a 1ª
        // palavra —, riscada, larga, a que cresce). '@ruler' = o vão onde a
        // régua vira a "linha"; '@line' (quadrada, o "+" da linha) e '@ours' =
        // fotos entre as palavras; '@key' = a tecla ENTER.
        c: {
          sentence: 'Cada linha foi escrita e posicionada exatamente assim. Você não está lendo sobre o nosso trabalho. Você está vivenciando.',
          lines: [['Cada', '@ruler', 'linha'], ['foi escrita ', '@key'], ['@line', 'e posicionada'], ['exatamente assim.'], ['Você não está'],
            ['lendo'], ['sobre o ', '@ours', ' nosso'], ['trabalho.'], ['Você está'], ['vivenciando.']],
          tags: { ours: '2 pessoas + café', hand: 'feito à mão', scale: 'escala' },
        },
      },
      lines: [
        'Na MyTigency, acreditamos que um site não se apresenta. Ele conduz.',
        'Sem gerente de conta, sem terceirizar, sem intermediários: quem conversa com você é quem desenha e quem programa.',
        'Por isso, em vez de promessas, preferimos mostrar.',
        'Repare no ritmo desta página. Nada surge antes da hora.',
        'Cada linha foi escrita e posicionada exatamente assim.',
        'Você não está lendo sobre o nosso trabalho.',
        'Você está vivenciando.',
      ],
    },
    // Página de contato (V2 em linha, escolhida no laboratório lab/contato).
    contact: {
      // título C1 "colagem": partes separadas porque "construir" vira uma
      // pílula em mono, há uma estrela depois de "incrível" e as fotos
      // depois de "juntos" (ver Contact.jsx → Title)
      title: { a: 'Vamos', code: 'construir', b: 'algo', c: 'incrível', d: 'juntos', full: 'Vamos construir algo incrível juntos.' },
      hello: 'Ou só bater um papo.',
      aside: 'Escreva direto pra gente — quem lê somos nós dois.',
      fill: 'Preencha',
      optional: '(opcional)',
      both: '(um ou os dois)',
      name: { label: 'Como a gente te chama?', placeholder: 'seu nome' },
      business: { label: 'Negócio', placeholder: '[nome do estabelecimento], [localização]' },
      channel: {
        label: 'Como quer entrar em contato?',
        options: { email: 'email', whatsapp: 'whatsapp' },
        fields: { email: 'ex.: seunome@gmail.com', whatsapp: '(31) 9 0000-0000' },
        aria: { email: 'Seu e-mail', whatsapp: 'Seu WhatsApp' },
        names: { email: 'e-mail', whatsapp: 'WhatsApp' },
      },
      emailHelp: { complete: 'Completar:', typo: 'Quis dizer', typoEnd: '?' },
      budget: { label: 'Investimento', placeholder: 'R$ [aproximado]' },
      // "1 a 2": o hífen entre números foi lido como "12" no teste com usuário
      deadline: {
        label: 'Tem prazos?',
        options: { none: 'Sem pressa', weeks: '1 a 2 semanas', months: '1 a 2 meses', urgent: 'É urgente' },
      },
      need: {
        label: 'O que você está buscando?',
        options: { site: 'Site novo', store: 'Loja online', redo: 'Refazer meu site', identity: 'Identidade visual', unsure: 'Ainda não sei' },
        // frase que cada opção escreve na caixa (vermelha enquanto intacta)
        phrases: {
          site: '[Quero um site novo para o meu negócio.]',
          store: '[Quero uma loja online para vender meus produtos.]',
          redo: '[Quero refazer o site que já tenho.]',
          identity: '[Preciso de uma identidade visual (logo, cores, estilo).]',
          unsure: '[Ainda não sei bem o que preciso, quero conversar.]',
        },
        placeholder: 'Conte do seu jeito, sem precisar de termo técnico.',
      },
      privacy: 'Utilizamos seus dados somente para responder este contato.',
      privacyLink: 'Política de privacidade',
      whoReads: ['Quem lê somos nós: ', 'Thiago', ' e ', 'Miguel', '. Respondemos em até ', '1 dia útil.'],
      submit: 'Enviar',
      sending: 'Enviando…',
      // o que falta, com nome (não só "Faltam N campos")
      missing: {
        name: 'seu nome',
        channel: 'como responder (e-mail ou WhatsApp)',
        email: 'completar o e-mail (ex.: @gmail.com)',
        whatsapp: 'completar o WhatsApp (DDD + número)',
        deadline: 'o prazo',
        need: 'o que você busca',
      },
      missingPrefix: 'Falta: ',
      and: ' e ',
      error: 'Não conseguimos enviar agora. Tente de novo ou escreva para ',
      success: (name, channel) => `Recebido, ${name}. Respondemos em até 1 dia útil pelo ${channel}.`,
      channelsOr: ' ou ',
      closeSeal: 'Fechar',
      copied: 'copiado!',
      copyAria: 'Copiar',
    },
    footer: {
      contactTitle: 'opções de contato',
      labels: { general: 'Assuntos gerais', projects: 'Novos projetos' },
      copied: 'email copiado',
      copiedAnnounce: 'copiado',
      copyAria: 'Copiar',
      writeAria: 'Escrever para',
      reply: 'respondemos em até 24h',
      talk: "Let's talk",
      tagline: 'Feito com café e commits tardios',
      credits: 'Créditos',
      infoLabel: 'Como a MyT trabalha',
      details: 'Detalhes',
      // Ordem pensada no comprimento dos nomes (grande → pequeno → grande)
      info: [
        { key: 'talk', name: 'Conversa', lines: ['Fazemos calls com você ou sua equipe ao longo de todo o projeto — ou por texto, se preferir.', 'Cada etapa é alinhada com o que você quer antes de seguir.'] },
        { key: 'yours', name: 'É seu', lines: ['Código, domínio, hospedagem e acessos ficam no seu nome.', 'Você recebe o repositório e a documentação — sem ficar preso a nós.'] },
        { key: 'betim', name: 'Betim', lines: ['Rua Afro Domingos, 301', 'Bairro Filadélfia', 'Betim — MG'], note: 'Atendimento on-line. Se você é da região, vamos até o seu local de trabalho para uma reunião.' },
        { key: 'changes', name: 'Ajustes', lines: ['6 meses após a entrega para mudanças no que foi entregue, inclusive as complexas.', 'Funcionalidade nova é orçada à parte, com sua aprovação antes.'] },
        { key: 'warranty', name: 'Garantia', lines: ['1 ano de manutenção em problemas estruturais: o que entregamos e não funcionar como combinado é corrigido sem custo.', 'Contado a partir do aceite da entrega.'] },
      ],
    },
  },
  en: {
    header: {
      home: 'Home',
      manifesto: 'Manifesto',
      work: 'Work',
      careers: 'Careers',
      cta: 'Get in touch →',
      langAria: 'language',
      menuOpen: 'Menu',
      menuClose: 'Close',
      menuAria: 'Navigation menu',
      contact: 'Contact',
    },
    loading: {
      label: 'Loading...',
      ariaLabel: 'Loading the site',
    },
    hero: {
      eyebrow: 'MyTigency — digital product studio, since 2026',
      headline: ['WORKING', 'IS COMMON.', 'WINNING', 'IS RARE.'],
      p1: [
        { text: 'A product that works is the bare minimum. ' },
        { text: 'A product that wins', bold: true },
        { text: " is the one that moves the number at the end of the quarter — and that doesn't happen by accident." },
      ],
      p2: [
        { text: "We're " },
        { text: 'MyTigency', bold: true },
        { text: ": a team of design, engineering and product. We don't just ship a product that works — we build the " },
        { text: 'entire experience', bold: true },
        { text: ' around it.' },
      ],
    },
    services: {
      eyebrow: 'What we do',
      headingAccent: 'Two',
      headingLine1: 'people.',
      headingLine2: 'One single team.',
      cards: [
        { num: '01', title: 'Design', desc: '[Placeholder] Visual identity, product and interface — design decisions that carry the brand in every pixel.' },
        { num: '02', title: 'Engineering', desc: '[Placeholder] Front-end, back-end and infrastructure built to last — no shortcuts, no hidden technical debt.' },
        { num: '03', title: 'Product', desc: '[Placeholder] Strategy and prioritization — what to build, in the right order, for the right reason.' },
      ],
    },
    pc: {
      word: 'Our Work', // duas palavras: uma de cada lado do monitor
      caption: 'MyTigency ®',
      scroll: 'scroll to open ↓',
      end: 'end of manifesto',
      next: 'work',
      sticker: 'MADE BY HAND · BY 2 PEOPLE · WITH COFFEE ·',
      icons: ['My Computer', 'Recycle Bin', 'Work', 'manifesto.txt', 'Prompt'],
      alert: ['Alert', 'Warning: this site is too good.', ['Close', 'Continue']],
      notice: ['Notice', 'Close this pop-up.', ['OK']],
      txt: ['manifesto.txt', 'This pop-up was placed exactly here.', ['OK']],
      opening: ['Work', 'Opening work…'],
      floppy: 'work',
      notes: [['2 people', '+ coffee'], ['every line', 'was written', 'here']],
      locale: 'en-US',
    },
    work: {
      eyebrow: 'Selected work',
      heading: "Some of the products we've helped win.",
      cases: [
        { thumb: '[ CASE 01 ]', tag: 'Placeholder', title: '[Project name]', desc: '[Placeholder] Short case description — problem, approach and result.' },
        { thumb: '[ CASE 02 ]', tag: 'Placeholder', title: '[Project name]', desc: '[Placeholder] Short case description — problem, approach and result.' },
        { thumb: '[ CASE 03 ]', tag: 'Placeholder', title: '[Project name]', desc: '[Placeholder] Short case description — problem, approach and result.' },
      ],
      ctaPre: "Let's build something that ",
      ctaAccent: 'wins?',
      ctaButton: 'Get in touch →',
    },
    tech: {
      eyebrow: 'Technologies',
      heading: 'The tools behind what we ship.',
      sub: 'Only what we actually use, day to day.',
      tools: [
        { name: 'Figma', desc: 'You see and approve every screen before a single line of code.' },
        { name: 'Illustrator', desc: 'Logos, icons and vector illustrations, sharp at any size.' },
        { name: 'After Effects', desc: 'Motion and video for your product, frame by frame.' },
        { name: 'Blender', desc: "Where we model your site's 3D objects from scratch." },
        { name: 'VS Code', desc: 'Where we write the code you get at the end.' },
        { name: 'React', desc: "The site's foundation: fast to browse, easy to grow later." },
      ],
    },
    marquee: {
      phrases: [
        'There\'s no "support team." Just the two of us and coffee.',
        "We don't let go of the mouse until it's actually good.",
        'Every bug you never saw, we fought it first.',
        "If it's not good, we redo it — no extra charge.",
        'We reply fast because anxiety is fuel too.',
        'We\'re not satisfied until you stop sending "just one more tweak."',
      ],
    },
    skip: {
      skip: 'Skip manifesto',
      toWork: 'Go to work',
      back: 'Back to start',
      hint: 'In a hurry? You can skip.',
      landing: 'Work',
      announce: 'Manifesto skipped. You are at Work.',
      announceBack: 'Back to the start of the manifesto.',
    },
    manifesto: {
      label: 'Ethos',
      statement: [
        [{ text: 'At ' }, { text: 'MyTIgency,', role: 'brand' }, { text: ' we believe a site' }],
        [{ text: 'never ' }, { text: 'introduces', role: 'highlight' }, { text: ' itself. It' }],
        [{ text: 'leads.', role: 'lead' }],
      ],
      without: {
        big: 'We',
        lines: ['talk it', 'through and', 'solve it.'],
        no: 'No',
        items: ['Account manager', 'Outsourcing', 'Middlemen'],
        sentence: 'We talk it through and solve it. No account manager, no outsourcing, no middlemen.',
        cue: 'keep scrolling',
        chat: {
          head: 'MYT',
          placeholder: 'message',
          now: 'now',
          seen: 'seen',
          messages: [
            ['in', "i'm not sure what i want yet"],
            ['out', "that's normal! tell me about your business and we'll figure it out together."],
            ['in', 'really? that simple?'],
            ['out', "it's our favorite part."],
          ],
        },
      },
      who: {
        mark: 'who talks to you',
        kickA: 'who',
        wordA: 'Designs',
        kickB: 'and who',
        wordB: 'Codes',
        tag: 'the two of us',
        note: 'the one who talks to you is the one who designs and who codes.',
        title: 'The one who talks to you is the one who designs and who codes.',
        ruler: ['search', 'line', 'who'],
      },
      act2: {
        a: {
          eyebrow: '( Less telling, more doing )',
          sentence: "So instead of promises, we'd rather show you.",
          lines: [
            [['So,'], ['', 'flower'], ['instead of']],
            [['promises', 'strike'], [','], ['', 'eye']],
            [["we'd rather"], ['show', 'show'], ['you.'], ['', 'arrow']],
          ],
        },
        b: {
          sentence: 'Notice the pace of this page. Nothing appears before its time.',
          before: [[['Notice'], ['the', 'serif'], ['pace', 'staff']], [['of this', 'wide'], ['p[a]ge.']]],
          // "time" não tem O: o relógio entra no lugar do ponto final
          after: [[['Nothing', 'heavy'], ['appears', 'pixel']], [['before', 'serif'], ['its', 'wide'], ['time(.)', 'clock']]],
          score: ['score no. 05 ·', 'the pace of this page', 'music & lyrics: miguel & thiago'],
          player: { playing: 'playing', paused: 'paused', held: 'fermata', track: 'track 05' },
          hint: ['scroll to play ↓', 'a tempo ↓'],
        },
        c: {
          sentence: "Every line was written and placed exactly like this. You're not reading about our work. You're living it.",
          lines: [['Every', '@ruler', 'line'], ['was written ', '@key'], ['@line', 'and placed'], ['exactly like this.'], ["You're not"],
            ['reading'], ['about ', '@ours', ' our'], ['work.'], ["You're"], ['living it.']],
          tags: { ours: '2 people + coffee', hand: 'handmade', scale: 'scale' },
        },
      },
      lines: [
        "At MyTigency, we believe a website doesn't introduce itself. It leads.",
        'No account manager, no outsourcing, no middlemen: the person talking to you is the person designing and building it.',
        "So instead of promises, we'd rather show you.",
        'Notice the pace of this page. Nothing appears before its time.',
        'Every line was written and placed exactly like this, on purpose.',
        "You're not reading about our work.",
        "You're living it.",
      ],
    },
    contact: {
      title: { a: "Let's", code: 'build', b: 'something', c: 'great', d: 'together', full: "Let's build something great together." },
      hello: 'Or just say hello.',
      aside: 'Write to us directly — the two of us read everything.',
      fill: 'Fill in',
      optional: '(optional)',
      both: '(one or both)',
      name: { label: 'What should we call you?', placeholder: 'your name' },
      business: { label: 'Business', placeholder: '[business name], [location]' },
      channel: {
        label: 'How do you want us to reach you?',
        options: { email: 'email', whatsapp: 'whatsapp' },
        fields: { email: 'e.g. yourname@gmail.com', whatsapp: '+1 555 000 0000' },
        aria: { email: 'Your email', whatsapp: 'Your WhatsApp' },
        names: { email: 'email', whatsapp: 'WhatsApp' },
      },
      emailHelp: { complete: 'Complete:', typo: 'Did you mean', typoEnd: '?' },
      budget: { label: 'Budget', placeholder: '$ [approximate]' },
      deadline: {
        label: 'Any deadline?',
        options: { none: 'No rush', weeks: '1 to 2 weeks', months: '1 to 2 months', urgent: "It's urgent" },
      },
      need: {
        label: 'What are you looking for?',
        options: { site: 'New website', store: 'Online store', redo: 'Redo my site', identity: 'Visual identity', unsure: 'Not sure yet' },
        phrases: {
          site: '[I want a new website for my business.]',
          store: '[I want an online store to sell my products.]',
          redo: '[I want to redo the site I already have.]',
          identity: '[I need a visual identity (logo, colors, style).]',
          unsure: "[I'm not sure what I need yet, let's talk.]",
        },
        placeholder: 'Tell us in your own words, no tech jargon needed.',
      },
      privacy: 'We only use your data to reply to this message.',
      privacyLink: 'Privacy policy',
      whoReads: ['Who reads this: ', 'Thiago', ' and ', 'Miguel', '. We reply within ', '1 business day.'],
      submit: 'Send',
      sending: 'Sending…',
      missing: {
        name: 'your name',
        channel: 'how to reply (email or WhatsApp)',
        email: 'complete the email (e.g. @gmail.com)',
        whatsapp: 'complete the WhatsApp number',
        deadline: 'the deadline',
        need: 'what you need',
      },
      missingPrefix: 'Missing: ',
      and: ' and ',
      error: "We couldn't send it right now. Try again or write to ",
      success: (name, channel) => `Got it, ${name}. We'll reply within 1 business day via ${channel}.`,
      channelsOr: ' or ',
      closeSeal: 'Close',
      copied: 'copied!',
      copyAria: 'Copy',
    },
    footer: {
      contactTitle: 'contact options',
      labels: { general: 'General inquiries', projects: 'New projects' },
      copied: 'Email copied',
      copiedAnnounce: 'copied',
      copyAria: 'Copy',
      writeAria: 'Email',
      reply: 'we reply within 24h',
      talk: "Let's talk",
      tagline: 'Made with coffee and late-night commits',
      credits: 'Credits',
      infoLabel: 'How MyT works',
      details: 'Details',
      // Ordered by name length (long → short → long)
      info: [
        { key: 'talk', name: 'Check-ins', lines: ['We hold calls with you or your team throughout the whole project — or by text, if you prefer.', 'Every stage is aligned with what you want before we move on.'] },
        { key: 'yours', name: 'Yours', lines: ['Code, domain, hosting and access stay in your name.', 'You get the repository and the documentation — no lock-in.'] },
        { key: 'betim', name: 'Betim', lines: ['Rua Afro Domingos, 301', 'Bairro Filadélfia', 'Betim — MG, Brazil'], note: "We work online. If you're nearby, we'll come to your workplace for a meeting." },
        { key: 'changes', name: 'Changes', lines: ['6 months after delivery for changes to what we delivered, complex ones included.', 'New features are quoted separately, with your approval first.'] },
        { key: 'warranty', name: 'Warranty', lines: ['1 year of maintenance for structural issues: anything we delivered that doesn’t work as agreed is fixed at no cost.', 'Counted from sign-off on delivery.'] },
      ],
    },
  },
}
