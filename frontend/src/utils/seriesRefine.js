import { buildCliffReport } from './cliffReport'

const round = (value) => Math.round((Number(value) || 0) * 100) / 100

function dedupeSorted(points) {
  if (!points.length) return points
  const out = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    if (Math.round(points[i].earned_income) !== Math.round(out[out.length - 1].earned_income)) {
      out.push(points[i])
    }
  }
  return out
}

// Build cliff drivers between two adjacent refined points using the per-program
// benefit values the backend spreads onto each point, plus the lumped tax total.
// Mirrors uk_cliff_watch.calculator._build_cliff_drivers.
function buildCliffDriversLocal(prev, point, programs) {
  const drivers = []
  programs.forEach((program) => {
    const change = round((Number(point?.[program.key]) || 0) - (Number(prev?.[program.key]) || 0))
    if (change < 0) {
      drivers.push({
        key: program.key,
        label: program.label,
        kind: 'benefit_loss',
        resource_effect_annual: change,
        resource_effect_monthly: round(change / 12),
      })
    }
  })
  const taxChange = round((Number(point?.taxes) || 0) - (Number(prev?.taxes) || 0))
  if (taxChange > 0) {
    drivers.push({
      key: 'taxes',
      label: 'Higher taxes',
      kind: 'tax_increase',
      resource_effect_annual: round(-taxChange),
      resource_effect_monthly: round(-taxChange / 12),
    })
  }
  return drivers.sort((a, b) => a.resource_effect_annual - b.resource_effect_annual)
}

function recomputeDeltas(sortedData, programs) {
  return sortedData.map((point, index) => {
    if (index === 0) {
      return {
        ...point,
        net_change_annual: 0,
        cliff_drop_annual: 0,
        is_cliff: false,
        cliff_drivers: [],
        has_previous_point: false,
      }
    }

    const prev = sortedData[index - 1]
    const netChange = round(point.net_resources - prev.net_resources)
    const stepAnnual = round(point.earned_income - prev.earned_income)
    const isCliff = netChange < 0
    const cliffDrop = isCliff ? -netChange : 0

    return {
      ...point,
      net_change_annual: netChange,
      step_annual: stepAnnual,
      cliff_drop_annual: cliffDrop,
      is_cliff: isCliff,
      cliff_drivers: isCliff ? buildCliffDriversLocal(prev, point, programs) : [],
      has_previous_point: true,
    }
  })
}

export async function refineCliffZones({
  coarseSeries,
  inputs,
  metadata,
  calculateSeriesFn,
  refineStep = 250,
  isCancelled = () => false,
}) {
  if (!coarseSeries?.data?.length) return coarseSeries

  const coarseStep = Number(coarseSeries.step_annual) || 0
  // The UK backend already samples at a fine step (£500) across the whole
  // range, so cliffs are resolved without a second client-side refinement pass.
  if (coarseStep <= 500 || coarseStep <= refineStep) return coarseSeries

  const report = buildCliffReport(coarseSeries.data)
  if (!report.zones?.length) return coarseSeries

  const programs = metadata?.programs || []

  const refinementJobs = report.zones.map(async (zone) => {
    const margin = Math.max(coarseStep / 2, refineStep)
    const start = Math.max(0, zone.startIncomeAnnual - margin)
    const end = zone.endIncomeAnnual + margin
    try {
      const refined = await calculateSeriesFn(inputs, metadata, {
        minEarnedIncome: start,
        maxEarnedIncome: end,
        step: refineStep,
      })
      return refined?.data || []
    } catch (err) {
      console.error('Cliff refinement failed', err)
      return []
    }
  })

  const refinedBatches = await Promise.all(refinementJobs)
  if (isCancelled()) return coarseSeries

  const ranges = refinedBatches
    .map((batch) => {
      if (!batch.length) return null
      const first = batch[0].earned_income
      const last = batch[batch.length - 1].earned_income
      return { min: first, max: last, points: batch }
    })
    .filter(Boolean)

  if (!ranges.length) return coarseSeries

  const keptCoarse = coarseSeries.data.filter((point) => {
    const income = point.earned_income
    return !ranges.some((range) => income >= range.min && income <= range.max)
  })

  const mergedRaw = [...keptCoarse, ...ranges.flatMap((range) => range.points)]
    .sort((a, b) => a.earned_income - b.earned_income)

  const deduped = dedupeSorted(mergedRaw)
  const withDeltas = recomputeDeltas(deduped, programs)

  return {
    ...coarseSeries,
    data: withDeltas,
    point_count: withDeltas.length,
    max_net_resources: Math.max(
      ...withDeltas.map((p) => Number(p.net_resources) || 0),
      0,
    ),
    refined_zone_count: ranges.length,
    refined_step_annual: refineStep,
  }
}
