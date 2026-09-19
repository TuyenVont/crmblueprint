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

const validation = load('src/features/deals/deal-items-validation.ts')
const workspace = '11111111-1111-1111-1111-111111111111'
const dealId = '22222222-2222-2222-2222-222222222222'
const productId = '33333333-3333-3333-3333-333333333333'
const dealItemId = '44444444-4444-4444-4444-444444444444'

const sampleDeal = { id: dealId, workspace_id: workspace, name: 'Big Contract', currency: 'VND' }
const sampleProduct = { id: productId, workspace_id: workspace, name: 'Enterprise License', price: '5000000.00', is_active: true }
const sampleItem = {
  id: dealItemId,
  workspace_id: workspace,
  deal_id: dealId,
  product_id: productId,
  name_snapshot: 'Enterprise License',
  price: '5000000.00',
  quantity: '2.0000',
  discount: '0.00',
  tax: '0.00',
  total: '10000000.00',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function service(permissions = ['DEALS_VIEW', 'PRODUCTS_VIEW'], results = []) {
  const calls = []
  let index = 0
  const context = {
    workspaceId: workspace,
    permissions: new Set(permissions),
    supabase: {
      from: (table) => {
        calls.push(['from', table])
        const result = results[index++] || { data: [], count: 0, error: null }
        const chain = { then: (resolve) => Promise.resolve(result).then(resolve) }
        for (const method of ['select', 'eq', 'in', 'order', 'range', 'or', 'maybeSingle', 'insert', 'update', 'delete']) {
          chain[method] = (...args) => {
            calls.push([method, ...args])
            return chain
          }
        }
        return chain
      },
    },
  }
  const api = load('src/server/deal-items.ts', {
    'server-only': {},
    'next/navigation': {
      notFound: () => {
        throw Error('NOT_FOUND')
      },
    },
    '@/server/app-context': { getAppContext: async () => context },
    '@/features/deals/validation': { isDealId: (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) },
    '@/features/deals/deal-items-validation': validation,
  })
  return { calls, ...api }
}

function itemForm() {
  const form = new FormData()
  form.set('product_id', productId)
  form.set('quantity', '2')
  form.set('price', '5000000')
  form.set('discount', '0')
  form.set('tax', '0')
  return form
}

test('DEALS_VIEW is required for reading deal items and product options', async () => {
  for (const p of [[], ['DEALS_MANAGE']]) {
    const s = service(p)
    await assert.rejects(s.getDealItems(dealId), /NOT_FOUND/)
    await assert.rejects(s.getDealProductOptions(), /NOT_FOUND/)
  }
  const sNoProd = service(['DEALS_VIEW'])
  assert.deepEqual(await sNoProd.getDealProductOptions(), [])
})

test('DEALS_MANAGE is required for create/update/delete', async () => {
  for (const p of [[], ['DEALS_VIEW']]) {
    const s = service(p)
    await assert.rejects(s.createDealItem(dealId, itemForm()), /NOT_FOUND/)
    await assert.rejects(s.updateDealItem(dealId, dealItemId, itemForm()), /NOT_FOUND/)
    await assert.rejects(s.deleteDealItem(dealId, dealItemId), /NOT_FOUND/)
  }
})

test('workspace_id is strictly server-derived on insert', async () => {
  const form = itemForm()
  form.set('workspace_id', 'forged')
  form.set('id', 'forged')
  form.set('total', '99999999')
  const s = service(
    ['DEALS_VIEW', 'DEALS_MANAGE', 'PRODUCTS_VIEW'],
    [
      { data: sampleDeal, error: null }, // deal check
      { data: sampleProduct, error: null }, // product check
      { data: { id: dealItemId }, error: null }, // insert result
    ]
  )
  const res = await s.createDealItem(dealId, form)
  assert.equal(res.success, true)
  const payload = s.calls.find((c) => c[0] === 'insert')[1]
  assert.equal(payload.workspace_id, workspace)
  assert.equal(payload.deal_id, dealId)
  assert.ok(!('id' in payload))
  assert.ok(!('total' in payload))
})

test('foreign workspace Deal is rejected', async () => {
  const s = service(['DEALS_VIEW', 'DEALS_MANAGE', 'PRODUCTS_VIEW'], [{ data: null, error: null }])
  const res = await s.createDealItem(dealId, itemForm())
  assert.equal(res.error, 'Deal not found or unavailable.')
  assert.ok(!s.calls.some((c) => c[0] === 'insert'))
})

test('foreign workspace Product is rejected', async () => {
  const s = service(
    ['DEALS_VIEW', 'DEALS_MANAGE', 'PRODUCTS_VIEW'],
    [
      { data: sampleDeal, error: null },
      { data: null, error: null }, // product not found in workspace
    ]
  )
  const res = await s.createDealItem(dealId, itemForm())
  assert.equal(res.fields.product_id, 'Select an available active product.')
  assert.ok(!s.calls.some((c) => c[0] === 'insert'))
})

test('foreign Deal Item update and delete are rejected', async () => {
  const sUpdate = service(['DEALS_VIEW', 'DEALS_MANAGE'], [{ data: null, error: null }])
  const resUpdate = await sUpdate.updateDealItem(dealId, dealItemId, itemForm())
  assert.equal(resUpdate.error, 'Deal item not found or unavailable.')
  assert.ok(!sUpdate.calls.some((c) => c[0] === 'update'))

  const sDelete = service(['DEALS_VIEW', 'DEALS_MANAGE'], [{ data: null, error: null }])
  const resDelete = await sDelete.deleteDealItem(dealId, dealItemId)
  assert.equal(resDelete.error, 'Deal item not found or unavailable.')
  assert.ok(!sDelete.calls.some((c) => c[0] === 'delete'))
})

test('name_snapshot and initial price are server-derived from product', async () => {
  const form = new FormData()
  form.set('product_id', productId)
  form.set('quantity', '3')
  form.set('price', '1')
  const s = service(
    ['DEALS_VIEW', 'DEALS_MANAGE', 'PRODUCTS_VIEW'],
    [
      { data: sampleDeal, error: null },
      { data: { id: productId, name: 'Original Name', price: '2500000.00' }, error: null },
      { data: { id: dealItemId }, error: null },
    ]
  )
  await s.createDealItem(dealId, form)
  const payload = s.calls.find((c) => c[0] === 'insert')[1]
  assert.equal(payload.name_snapshot, 'Original Name')
  assert.equal(payload.price, '2500000.00')
})

test('later Product changes do not alter Deal Item snapshot behavior', async () => {
  const s = service(
    ['DEALS_VIEW', 'DEALS_MANAGE', 'PRODUCTS_VIEW'],
    [
      { data: { id: dealItemId, deal_id: dealId, name_snapshot: 'Original Name' }, error: null },
      { data: { id: dealItemId }, error: null },
    ]
  )
  const form = itemForm()
  form.set('price', '3000000') // custom price edit on existing item
  await s.updateDealItem(dealId, dealItemId, form)
  const payload = s.calls.find((c) => c[0] === 'update')[1]
  assert.ok(!('name_snapshot' in payload)) // name_snapshot remains intact
  assert.equal(payload.price, '3000000')
})

test('total is generated by database and not writable', async () => {
  const form = itemForm()
  form.set('total', '999999')
  const s = service(
    ['DEALS_VIEW', 'DEALS_MANAGE', 'PRODUCTS_VIEW'],
    [
      { data: sampleDeal, error: null },
      { data: sampleProduct, error: null },
      { data: { id: dealItemId }, error: null },
    ]
  )
  await s.createDealItem(dealId, form)
  const insertPayload = s.calls.find((c) => c[0] === 'insert')[1]
  assert.ok(!('total' in insertPayload))

  const sEdit = service(['DEALS_VIEW', 'DEALS_MANAGE'], [{ data: sampleItem, error: null }, { data: { id: dealItemId }, error: null }])
  await sEdit.updateDealItem(dealId, dealItemId, form)
  const updatePayload = sEdit.calls.find((c) => c[0] === 'update')[1]
  assert.ok(!('total' in updatePayload))
})

test('quantity > 0 validation rejects zero, negative and non-numeric', () => {
  for (const q of ['0', '-1', 'abc', '']) {
    const f = itemForm()
    f.set('quantity', q)
    const res = validation.validateDealItemInput(f, true)
    assert.ok(res.fields.quantity)
  }
})

test('discount <= server-loaded price * quantity rejects excessive discount', async () => {
  const f = itemForm()
  f.set('price', '999999')
  f.set('quantity', '2')
  f.set('discount', '300')
  const s = service(
    ['DEALS_VIEW', 'DEALS_MANAGE', 'PRODUCTS_VIEW'],
    [
      { data: sampleDeal, error: null },
      { data: { id: productId, name: 'Product', price: '100.00' }, error: null },
    ]
  )
  const res = await s.createDealItem(dealId, f)
  assert.ok(res.fields.discount)
  assert.ok(!s.calls.some((c) => c[0] === 'insert'))
})

test('protected fields cannot be overwritten on update', async () => {
  const form = itemForm()
  for (const key of ['id', 'workspace_id', 'deal_id', 'name_snapshot', 'product_id', 'created_at']) {
    form.set(key, 'forged')
  }
  const s = service(['DEALS_VIEW', 'DEALS_MANAGE'], [{ data: sampleItem, error: null }, { data: { id: dealItemId }, error: null }])
  await s.updateDealItem(dealId, dealItemId, form)
  const updatePayload = s.calls.find((c) => c[0] === 'update')[1]
  assert.deepEqual(Object.keys(updatePayload).sort(), ['price', 'quantity', 'discount', 'tax'].sort())
})
