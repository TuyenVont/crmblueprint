import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  new Function('require', 'exports', code)((name) => {
    if (!(name in imports)) throw Error(`Unexpected import ${name}`)
    return imports[name]
  }, exports)
  return exports
}

const validation = load('src/features/products/validation.ts')
const workspace = '11111111-1111-1111-1111-111111111111'
const productId = '22222222-2222-2222-2222-222222222222'

const sampleProduct = {
  id: productId,
  workspace_id: workspace,
  name: 'Widget A',
  sku: 'SKU-001',
  unit: 'pcs',
  price: '100.00',
  currency: 'VND',
  image_url: 'https://example.com/widget.jpg',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function service(permissions = ['PRODUCTS_VIEW'], results = [{ data: sampleProduct, error: null }]) {
  const calls = []
  let index = 0
  const context = {
    workspaceId: workspace,
    permissions: new Set(permissions),
    supabase: {
      storage: {
        from: (bucket) => ({
          upload: async (path, file, options) => {
            calls.push(['storage.upload', bucket, path, options])
            return { data: { path }, error: null }
          },
          getPublicUrl: (path) => {
            calls.push(['storage.getPublicUrl', bucket, path])
            return { data: { publicUrl: `https://example.com/storage/${path}` } }
          },
        }),
      },
      from: (table) => {
        calls.push(['from', table])
        const result = results[index++] || { data: [], count: 0, error: null }
        const chain = { then: (resolve) => Promise.resolve(result).then(resolve) }
        for (const method of ['select', 'eq', 'order', 'range', 'or', 'maybeSingle', 'insert', 'update']) {
          chain[method] = (...args) => {
            calls.push([method, ...args])
            return chain
          }
        }
        return chain
      },
    },
  }
  const api = load('src/server/products.ts', {
    'server-only': {},
    'next/navigation': {
      notFound: () => {
        throw Error('NOT_FOUND')
      },
    },
    '@/server/app-context': { getAppContext: async () => context },
    '@/features/products/validation': validation,
  })
  return { calls, ...api }
}

function productForm(price = '100.00') {
  const form = new FormData()
  form.set('name', ' Widget A ')
  form.set('sku', ' SKU-001 ')
  form.set('unit', ' pcs ')
  form.set('price', price)
  form.set('currency', ' VND ')
  form.set('image_url', 'https://example.com/widget.jpg')
  form.set('is_active', 'true')
  return form
}

test('PRODUCTS_VIEW is required before all reads', async () => {
  for (const p of [[], ['PRODUCTS_MANAGE']]) {
    const s = service(p)
    await assert.rejects(s.getProducts(1), /NOT_FOUND/)
    await assert.rejects(s.getProductById(productId), /NOT_FOUND/)
    assert.equal(s.calls.length, 0)
  }
})

test('PRODUCTS_MANAGE is required for create/edit', async () => {
  for (const p of [[], ['PRODUCTS_VIEW']]) {
    const s = service(p)
    await assert.rejects(s.createProduct(productForm()), /NOT_FOUND/)
    await assert.rejects(s.getProductForEdit(productId), /NOT_FOUND/)
    await assert.rejects(s.updateProduct(productId, productForm()), /NOT_FOUND/)
    assert.equal(s.calls.length, 0)
  }
})

test('workspace_id is strictly server-derived and protected fields cannot be overwritten', async () => {
  const form = productForm()
  for (const key of ['id', 'workspace_id', 'created_at', 'updated_at']) form.set(key, 'forged')
  const s = service(['PRODUCTS_VIEW', 'PRODUCTS_MANAGE'], [{ data: { id: productId }, error: null }])
  await s.createProduct(form)
  const insertPayload = s.calls.find((c) => c[0] === 'insert')[1]
  assert.equal(insertPayload.workspace_id, workspace)
  assert.equal(insertPayload.name, 'Widget A')
  assert.ok(!('id' in insertPayload))
  assert.ok(!('created_at' in insertPayload))
})

test('foreign workspace product cannot be read/updated and reveals no existence', async () => {
  const s = service(['PRODUCTS_VIEW'], [{ data: null, error: null }])
  await assert.rejects(s.getProductById(productId), /NOT_FOUND/)
  assert.ok(s.calls.some((c) => c[0] === 'eq' && c[1] === 'workspace_id' && c[2] === workspace))

  const sEdit = service(['PRODUCTS_VIEW', 'PRODUCTS_MANAGE'], [{ data: null, error: null }])
  const result = await sEdit.updateProduct(productId, productForm())
  assert.equal(result.error, 'Product not found or unavailable.')
  assert.ok(!sEdit.calls.some((c) => c[0] === 'update'))
})

test('duplicate SKU error is handled safely and cleanly', async () => {
  const duplicateError = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "products_workspace_id_sku_idx"' } }
  const s = service(['PRODUCTS_VIEW', 'PRODUCTS_MANAGE'], [duplicateError])
  const result = await s.createProduct(productForm())
  assert.equal(result.fields.sku, 'A product with this SKU already exists.')
  assert.equal(result.error, 'Please correct the highlighted fields.')
})

test('price validation rejects negative values and invalid numbers', async () => {
  for (const badPrice of ['-1', '-10.50', 'abc', '']) {
    const s = service(['PRODUCTS_VIEW', 'PRODUCTS_MANAGE'])
    const res = await s.createProduct(productForm(badPrice))
    assert.equal(res.fields.price, 'Enter a non-negative decimal value.')
    assert.ok(!s.calls.some((c) => c[0] === 'insert'))
  }
})

test('update respects protected-field allowlist', async () => {
  const form = productForm()
  form.set('id', 'forged')
  form.set('workspace_id', 'forged')
  const s = service(['PRODUCTS_VIEW', 'PRODUCTS_MANAGE'], [{ data: { id: productId }, error: null }, { data: { id: productId }, error: null }])
  const res = await s.updateProduct(productId, form)
  assert.deepEqual(res, { id: productId })
  const updatePayload = s.calls.find((c) => c[0] === 'update')[1]
  assert.deepEqual(Object.keys(updatePayload).sort(), ['name', 'sku', 'unit', 'price', 'currency', 'image_url', 'is_active'].sort())
})

test('product navigation uses PRODUCTS_VIEW permission', () => {
  const { filterNavigation } = load('src/components/app-shell/navigation.ts')
  assert.ok(filterNavigation(new Set(['PRODUCTS_VIEW'])).mainItems.some((i) => i.href === '/app/products'))
  assert.ok(!filterNavigation(new Set(['PRODUCTS_MANAGE'])).mainItems.some((i) => i.href === '/app/products'))
})

test('product image file validation rejects invalid MIME types and large files', () => {
  const badMime = { type: 'text/plain', size: 100 }
  const badSize = { type: 'image/png', size: 6 * 1024 * 1024 }
  const goodFile = { type: 'image/webp', size: 2 * 1024 * 1024 }

  assert.equal(validation.validateProductImage(badMime).valid, false)
  assert.equal(validation.validateProductImage(badSize).valid, false)
  assert.equal(validation.validateProductImage(goodFile).valid, true)
})
