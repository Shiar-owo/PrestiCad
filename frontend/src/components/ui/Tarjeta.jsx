function Tarjeta({ children, className = '', ...rest }) {
  return (
    <div
      className={`rounded-xl border border-borde bg-white shadow-sm dark:bg-superficie ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export default Tarjeta