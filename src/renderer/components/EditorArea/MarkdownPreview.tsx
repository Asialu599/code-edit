function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inCode = false
  let inList = false
  let codeLang = ''

  const closeList = () => {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }

  for (const line of lines) {
    const codeMatch = line.match(/^```(\w+)?\s*$/)
    if (codeMatch) {
      closeList()
      if (inCode) {
        html.push('</code></pre>')
        inCode = false
        codeLang = ''
      } else {
        inCode = true
        codeLang = codeMatch[1] || ''
        html.push(`<pre><span class="md-code-lang">${escapeHtml(codeLang)}</span><code>`)
      }
      continue
    }

    if (inCode) {
      html.push(`${escapeHtml(line)}\n`)
      continue
    }

    if (!line.trim()) {
      closeList()
      html.push('')
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      closeList()
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }

    const listItem = line.match(/^\s*[-*+]\s+(.+)$/)
    if (listItem) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${renderInline(listItem[1])}</li>`)
      continue
    }

    const quote = line.match(/^>\s?(.+)$/)
    if (quote) {
      closeList()
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`)
      continue
    }

    closeList()
    html.push(`<p>${renderInline(line)}</p>`)
  }

  closeList()
  if (inCode) html.push('</code></pre>')

  return html.join('\n')
}

interface Props {
  content: string
}

export default function MarkdownPreview({ content }: Props) {
  return (
    <div
      className="markdown-preview"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  )
}
