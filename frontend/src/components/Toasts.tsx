import { Toast } from '@base-ui/react/toast'

/** Renders toasts added via Toast.useToastManager().add(...). Must be inside <Toast.Provider>. */
export function Toasts() {
  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed top-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            toast={t}
            className={`relative rounded-lg border p-3 pr-8 shadow-lg ${
              t.type === 'error' ? 'border-red-900 bg-red-950 text-red-100' : 'border-neutral-700 bg-neutral-900'
            }`}
          >
            <Toast.Title className="text-sm font-medium" />
            <Toast.Description className="mt-0.5 text-xs text-neutral-400" />
            <Toast.Close aria-label="Dismiss" className="absolute top-2 right-2 cursor-pointer text-neutral-500 hover:text-white">
              ×
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
