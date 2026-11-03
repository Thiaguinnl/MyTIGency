import { useEffect, useState } from 'react'

// Posição no documento pela cadeia de offsetTop: imune a transforms. Um
// IntersectionObserver aqui errava depois de qualquer salto (âncora, menu,
// pular, voltar do contato): a Hero é fixa e a seção 1 do Manifesto anda de
// lado no pin, então nenhuma seção "entrava" na faixa e o rótulo ficava velho.
const docTop = (el) => {
  let y = 0
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop
  return y
}

export function useActiveSection(ids) {
  const [activeId, setActiveId] = useState(ids[0])
  const idsKey = ids.join(',')

  useEffect(() => {
    const elements = idsKey.split(',').map((id) => document.getElementById(id)).filter(Boolean)
    if (elements.length === 0) return undefined

    // ativa = a última seção cujo início já passou por baixo do header. As posições
    // só são medidas quando o layout muda (resize, pins mudando a altura da
    // página); no scroll é só comparar números, sem ler layout
    let starts = []
    let current = null
    function update() {
      const y = window.scrollY
      let id = elements[0].id
      for (const [sid, start] of starts) if (start <= y) id = sid
      if (id !== current) setActiveId((current = id))
    }
    function measure() {
      // a base do header encaixado embaixo da marquee (sem marquee — reduced motion — só o header)
      const cs = getComputedStyle(document.documentElement)
      const line = (parseFloat(cs.getPropertyValue('--marquee-h')) || 0) + (parseFloat(cs.getPropertyValue('--header-h')) || 0) + 1
      // (a última seção pode ser mais baixa que a tela: vale no fim do scroll)
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      starts = elements.map((el) => [el.id, Math.min(docTop(el) - line, maxScroll)])
      update()
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', update, { passive: true })

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', update)
    }
  }, [idsKey])

  return activeId
}
