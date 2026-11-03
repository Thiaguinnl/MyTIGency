import { useReveal } from '../hooks/useReveal'
import { useLanguage } from '../context/LanguageContext'

import figma from '../assets/tech/figma.svg'
import illustrator from '../assets/tech/illustrator.svg'
import afterEffects from '../assets/tech/after-effects.svg'
import blender from '../assets/tech/blender.svg'
import vscode from '../assets/tech/vscode.svg'
import react from '../assets/tech/react.svg'

// Logo por nome da ferramenta (strings.js → tech.tools). Sem SVG, a célula mostra o nome.
const LOGOS = {
  Figma: figma,
  Illustrator: illustrator,
  'After Effects': afterEffects,
  Blender: blender,
  'VS Code': vscode,
  React: react,
}

// Tecnologias: parede de ferramentas (técnica da parede de logos do basement_clone —
// moldura de 1px pelo gap, quinas marcadas, hover que apaga as vizinhas via :has()).
// Só ferramentas que usamos de verdade; a frase diz o que cada uma entrega ao cliente.
export function Tech(){
  const { t } = useLanguage()
  useReveal()

  return (
    <section className="tech" id="tecnologias">
      <div className="section-head reveal">
        <span className="eyebrow">{t.tech.eyebrow}</span>
        <h2>{t.tech.heading}</h2>
        <p className="tech-sub">{t.tech.sub}</p>
      </div>
      <ul className="tech-wall reveal">
        {t.tech.tools.map((tool, i) => (
          <li className="tech-cell" key={tool.name}>
            <span className="tech-idx">{String(i + 1).padStart(2, '0')}</span>
            <span className="tech-logo">
              {LOGOS[tool.name] && <img src={LOGOS[tool.name]} alt="" />}
              <span className="tech-name">{tool.name}</span>
            </span>
            <p className="tech-desc">{tool.desc}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
