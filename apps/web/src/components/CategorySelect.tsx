import type { SelectHTMLAttributes } from 'react'
import type { CategoryCatalogue } from '../lib/categories'
import { Select } from './ui/Field'

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  catalogue: CategoryCatalogue | undefined
  placeholder?: string
}

export function CategorySelect({ catalogue, placeholder = 'Choose a category…', ...rest }: Props) {
  return (
    <Select {...rest} disabled={rest.disabled || !catalogue}>
      <option value="">{catalogue ? placeholder : 'Loading categories…'}</option>
      {catalogue?.groups.map((g) => (
        <optgroup key={g.primary} label={g.label}>
          {g.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  )
}
