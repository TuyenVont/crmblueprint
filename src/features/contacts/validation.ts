import type { ContactInput, ContactFormState } from './types'

export const isContactId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export function validateContact(form: FormData): { input: ContactInput; fields: ContactFormState['fields'] } {
  const fields: NonNullable<ContactFormState['fields']> = {}
  const read = (key: keyof ContactInput, max: number) => {
    const raw = form.get(key)
    const value = typeof raw === 'string' ? raw.trim() : ''
    if ((raw !== null && typeof raw !== 'string') || value.length > max) fields[key] = `Use at most ${max} characters.`
    return value || null
  }
  const input: ContactInput = {
    first_name: read('first_name', 200) || '', last_name: read('last_name', 200),
    email: read('email', 320), phone: read('phone', 80), birthday: read('birthday', 10),
    address: read('address', 2000), notes: read('notes', 10000),
  }
  if (!input.first_name) fields.first_name = 'First name is required.'
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) fields.email = 'Enter a valid email address.'
  if (input.birthday && (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthday) || !Number.isFinite(Date.parse(input.birthday)) || new Date(input.birthday).toISOString().slice(0, 10) !== input.birthday)) fields.birthday = 'Enter a valid date.'
  return { input, fields }
}

// Quote PostgREST filter values and escape LIKE wildcards for literal substring search.
export function contactSearchFilter(search: string) {
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`
  const quoted = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return ['first_name', 'last_name', 'email', 'phone'].map(field => `${field}.ilike.${quoted}`).join(',')
}
