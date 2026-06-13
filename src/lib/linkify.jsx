const URL_RE = /(https?:\/\/[^\s]+)/g

export function linkify(text) {
  if (!text) return null

  const parts = text.split(URL_RE)
  const result = []

  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      // URL (split의 캡처 그룹 → 홀수 인덱스)
      result.push(
        <a
          key={`u${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-warm-brown underline break-all"
        >
          {part}
        </a>
      )
    } else {
      // 일반 텍스트 — \n을 <br/>로 변환
      part.split('\n').forEach((line, j, arr) => {
        if (line) result.push(line)
        if (j < arr.length - 1) result.push(<br key={`b${i}-${j}`} />)
      })
    }
  })

  return result.length > 0 ? result : null
}
