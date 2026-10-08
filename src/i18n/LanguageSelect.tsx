import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { availableLanguages, languageName, setLanguage } from '.'

/** Chooses the language of the interface. Nothing is shown while there is only one. */
export function LanguageSelect() {
  const { t, i18n } = useTranslation()
  const id = useId()
  const languages = availableLanguages()
  if (languages.length < 2) return null

  return (
    <div className="flex flex-col gap-1 pt-3">
      <Label htmlFor={id}>{t('nav.language')}</Label>
      <Select value={i18n.language} onValueChange={(code) => void setLanguage(code)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {languages.map((code) => (
            // Each language under its own name and marked as such, so that it is read properly.
            <SelectItem key={code} value={code} lang={code}>
              {languageName(code)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
