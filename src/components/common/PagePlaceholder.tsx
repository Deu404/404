type PagePlaceholderProps = {
  title: string
  description: string
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="placeholder-card" aria-labelledby="page-placeholder-title">
      <div className="placeholder-icon" aria-hidden="true">○</div>
      <div>
        <p className="eyebrow">초기 화면</p>
        <h2 id="page-placeholder-title">{title}</h2>
        <p className="placeholder-description">{description}</p>
        <p className="placeholder-note">분석 데이터가 연결되면 이 화면에서 상세 정보를 확인할 수 있습니다.</p>
      </div>
    </section>
  )
}
