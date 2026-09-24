import type { SelectHTMLAttributes } from 'react'
import type { CategoryCatalogue } from '../lib/categories'
import { Select } from './ui/Field'

/** SOURCE OF TRUTH: the category picker.
 * WHAT: a <select> of every category, grouped by its `primary` family
 * ("Food & drink" › "Groceries"), showing labels, valued by category id.
 * WHERE: used by recategorize controls and the add-rule form.
 */

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
