function Contenido({ children, clase = '' }) {
  return (
    <main className={`mx-auto w-full max-w-6xl px-4 py-8 ${clase}`}>
      {children}
    </main>
  )
}

export default Contenido