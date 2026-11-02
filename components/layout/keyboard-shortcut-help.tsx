'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useHotkey } from '@/hooks/use-keyboard-shortcuts'

// Keys are literal; section/description text is resolved from the catalogue
// (layout.shortcuts.section.* / .desc.*).
const SHORTCUTS = [
  {
    sectionKey: 'navigation',
    items: [
      { keys: ['/'], descKey: 'openSearch' },
      { keys: ['?'], descKey: 'showShortcuts' },
    ],
  },
  {
    sectionKey: 'quickActions',
    items: [
      { keys: ['n', 'p'], descKey: 'newPatient' },
      { keys: ['n', 'a'], descKey: 'newAppointment' },
      { keys: ['n', 'i'], descKey: 'newInvoice' },
    ],
  },
  {
    sectionKey: 'general',
    items: [
      { keys: ['Esc'], descKey: 'closeDialog' },
      { keys: ['Ctrl', 'K'], descKey: 'openCommandBar' },
    ],
  },
]

export function KeyboardShortcutHelp() {
  const t = useTranslations('layout.shortcuts')
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useHotkey('?', () => setOpen(true))

  // Navigation shortcuts
  useHotkey('n', () => {
    // Wait for next key
    const handler = (e: KeyboardEvent) => {
      window.removeEventListener('keydown', handler)
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      switch (e.key.toLowerCase()) {
        case 'p':
          e.preventDefault()
          router.push('/patients/new')
          break
        case 'a':
          e.preventDefault()
          router.push('/appointments/new')
          break
        case 'i':
          e.preventDefault()
          router.push('/billing/invoices/new')
          break
      }
    }
    window.addEventListener('keydown', handler)
    // Auto-cleanup after 1.5s if no follow-up key
    setTimeout(() => window.removeEventListener('keydown', handler), 1500)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {SHORTCUTS.map((section) => (
            <div key={section.sectionKey}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                {t(`section.${section.sectionKey}`)}
              </h4>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.descKey} className="flex items-center justify-between text-sm">
                    <span>{t(`desc.${item.descKey}`)}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && (
                            <span className="text-muted-foreground mx-0.5">{t('then')}</span>
                          )}
                          <kbd className="px-2 py-0.5 bg-muted rounded border text-xs font-mono">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
