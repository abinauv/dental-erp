'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getRegions } from '@/lib/geo/regions'

interface RegionFieldProps {
  /** Clinic country (ISO 3166-1 alpha-2) that drives the region list. */
  country: string | null | undefined
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

/**
 * State/province field driven by the clinic's country: a dropdown of that
 * country's regions when a list is known (lib/geo/regions), otherwise a plain
 * text input so clinics in unlisted countries are never blocked. Controlled via
 * value/onChange so it drops into either react-hook-form (setValue/watch) or a
 * useState form.
 */
export function RegionField({
  country,
  value,
  onChange,
  id,
  placeholder,
  disabled,
  required,
  className,
}: RegionFieldProps) {
  const regions = getRegions(country)

  if (regions.length === 0) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={className}
      />
    )
  }

  // Keep a pre-existing free-typed value selectable even if it is not in the
  // list (e.g. an address captured before the dropdown existed).
  const options = value && !regions.includes(value) ? [value, ...regions] : regions

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((region) => (
          <SelectItem key={region} value={region}>
            {region}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
