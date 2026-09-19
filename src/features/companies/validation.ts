import type { CompanyInput, CompanyFormState } from './types'

export const isCompanyId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export function validateCompany(form: FormData): { input: CompanyInput; fields: CompanyFormState['fields'] } {
  const fields: NonNullable<CompanyFormState['fields']> = {}
  const read = (key: keyof CompanyInput, max: number) => {
    const raw = form.get(key)
    const value = typeof raw === 'string' ? raw.trim() : ''
    if ((raw !== null && typeof raw !== 'string') || value.length > max) fields[key] = `Use at most ${max} characters.`
    return value || null
  }
  const input: CompanyInput = {
    name: read('name', 200) || '', tax_id: read('tax_id', 200),
    email: read('email', 320), phone: read('phone', 80),
    website: read('website', 2000), address: read('address', 2000),
    industry: read('industry', 200), size: read('size', 200),
  }
  if (!input.name) fields.name = 'Company name is required.'
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) fields.email = 'Enter a valid email address.'
  if (input.website) {
    try {
      const url = new URL(input.website)
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('Invalid website')
    } catch {
      fields.website = 'Enter a valid http:// or https:// website URL without credentials.'
    }
  }
  return { input, fields }
}

// Use the same literal substring escaping as Contacts for PostgREST OR filters.
export function companySearchFilter(search: string) {
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`
  const quoted = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return ['name', 'email', 'phone'].map(field => `${field}.ilike.${quoted}`).join(',')
}
