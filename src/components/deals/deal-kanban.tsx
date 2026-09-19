'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Deal, PipelineOption, StageOption } from '@/features/deals/types'
import { updateDealStageAction } from '@/app/app/deals/actions'

interface DealKanbanProps {
  deals: Deal[]
  pipelines: PipelineOption[]
  activePipeline: PipelineOption | null
  stages: StageOption[]
  canManage: boolean
  canViewContacts: boolean
  canViewCompanies: boolean
}

export function DealKanban({
  deals: initialDeals,
  pipelines,
  activePipeline,
  stages,
  canManage,
  canViewContacts,
  canViewCompanies,
}: DealKanbanProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null)
  const [movingDealId, setMovingDealId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (initialDeals !== deals && !isPending && !movingDealId) {
    setDeals(initialDeals)
  }

  const handlePipelineChange = (pipelineId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('pipeline_id', pipelineId)
    router.push(`/app/deals?${params.toString()}`)
  }

  const handleMoveStage = async (dealId: string, newStageId: string) => {
    const targetDeal = deals.find(d => d.id === dealId)
    if (!targetDeal || targetDeal.stage_id === newStageId) return

    const previousStageId = targetDeal.stage_id

    setDeals(prev =>
      prev.map(d => (d.id === dealId ? { ...d, stage_id: newStageId } : d))
    )
    setMovingDealId(dealId)
    setErrorMsg(null)

    startTransition(async () => {
      const res = await updateDealStageAction(dealId, newStageId)
      setMovingDealId(null)
      if (res.error) {
        setDeals(prev =>
          prev.map(d => (d.id === dealId ? { ...d, stage_id: previousStageId } : d))
        )
        setErrorMsg(res.error)
      }
    })
  }

  const formatAmount = (amount: string, currency: string) => {
    const num = parseFloat(amount)
    if (isNaN(num)) return `${currency} ${amount}`
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(num)
  }

  if (!stages.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
        No stages available for the selected pipeline.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {pipelines.length > 1 && activePipeline && (
        <div className="flex items-center gap-3">
          <label htmlFor="pipeline-select" className="text-sm font-medium text-gray-700">
            Pipeline:
          </label>
          <select
            id="pipeline-select"
            value={activePipeline.id}
            onChange={(e) => handlePipelineChange(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {pipelines.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.is_default ? '(Default)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {stages.map((stage) => {
          const stageDeals = deals.filter(d => d.stage_id === stage.id)
          const totalAmount = stageDeals.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
          const stageCurrency = stageDeals[0]?.currency || 'USD'

          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                if (canManage) e.preventDefault()
              }}
              onDrop={(e) => {
                if (!canManage || !draggedDealId) return
                e.preventDefault()
                handleMoveStage(draggedDealId, stage.id)
                setDraggedDealId(null)
              }}
              className="flex flex-col rounded-lg border border-gray-200 bg-gray-50/80 p-3 transition-colors hover:border-gray-300"
            >
              <div className="mb-3 flex flex-col gap-1 border-b border-gray-200 pb-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                    {stage.name}
                  </h3>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {stageDeals.length}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Total: {formatAmount(totalAmount.toString(), stageCurrency)}
                </div>
              </div>

              <div className="flex-1 space-y-2.5 min-h-[150px]">
                {stageDeals.length === 0 ? (
                  <div className="flex h-24 items-center justify-center rounded border border-dashed border-gray-200 text-xs text-gray-400">
                    No deals
                  </div>
                ) : (
                  stageDeals.map((deal) => {
                    const isMoving = movingDealId === deal.id
                    return (
                      <div
                        key={deal.id}
                        draggable={canManage && !isMoving}
                        onDragStart={() => setDraggedDealId(deal.id)}
                        onDragEnd={() => setDraggedDealId(null)}
                        className={`group relative rounded-md border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md ${
                          canManage ? 'cursor-grab active:cursor-grabbing' : ''
                        } ${isMoving ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/app/deals/${deal.id}`}
                            className="font-medium text-gray-900 hover:text-indigo-600 line-clamp-2 text-sm"
                          >
                            {deal.name}
                          </Link>
                        </div>

                        <div className="mt-2 text-xs font-semibold text-gray-800">
                          {formatAmount(deal.amount, deal.currency)}
                        </div>

                        <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                          {canViewCompanies && deal.company_name && (
                            <div className="truncate flex items-center gap-1">
                              <span className="text-gray-400">🏢</span>
                              <span className="truncate">{deal.company_name}</span>
                            </div>
                          )}
                          {canViewContacts && deal.contact_name && (
                            <div className="truncate flex items-center gap-1">
                              <span className="text-gray-400">👤</span>
                              <span className="truncate">{deal.contact_name}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-[11px] text-gray-400">
                          <span>
                            {deal.expected_close_date
                              ? `Close: ${deal.expected_close_date}`
                              : ''}
                          </span>

                          {canManage && (
                            <select
                              value={deal.stage_id}
                              onChange={(e) => handleMoveStage(deal.id, e.target.value)}
                              disabled={isMoving}
                              className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 text-[11px] text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {stages.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
