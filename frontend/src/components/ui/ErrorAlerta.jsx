import { CircleAlert } from 'lucide-react'

function ErrorAlerta({ mensaje = '', className = '' }) {
  if (!mensaje) return null

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/60 dark:bg-red-500/15 dark:text-red-300 ${className}`}
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{mensaje}</span>
    </div>
  )
}

export default ErrorAlerta