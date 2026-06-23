import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import InputPanel from './components/InputPanel'
// Lazy-load the chart-heavy ResultsPanel (and its recharts dependencies) so
// the initial JS bundle is small. The panel is only mounted after the user
// hits "Find cliffs," so this defers ~hundreds of KB of chart code.
const ResultsPanel = lazy(() => import('./components/ResultsPanel'))
import {
  calculateSeries,
  createInitialInputs,
  hasCompleteRequiredInputs,
  loadMetadata,
} from './dataLookup'
import { decodeInputs, syncUrlToInputs } from './utils/urlState'
import { refineCliffZones } from './utils/seriesRefine'

// Capture the URL query exactly as the page was loaded, before any
// syncUrlToInputs() rewrite. Otherwise the app's own round-tripped state would
// be misread as a shared/deep link (e.g. under React's dev double-invoke).
const INITIAL_SEARCH = typeof window !== 'undefined' ? window.location.search : ''

function cleanSeriesErrorMessage(error) {
  const message = error?.message?.trim()
  if (!message) {
    return 'The cliff chart is unavailable right now.'
  }

  if (message.startsWith('Calculation failed:')) {
    return message
  }

  return `Chart calculation failed: ${message}`
}

function App() {
  const [metadata, setMetadata] = useState(null)
  const [inputs, setInputs] = useState(null)
  const [seriesData, setSeriesData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [hasCalculated, setHasCalculated] = useState(false)
  const [deepLinked, setDeepLinked] = useState(false)
  const [error, setError] = useState(null)
  const [seriesError, setSeriesError] = useState(null)
  const resultsRef = useRef(null)
  const requestVersionRef = useRef(0)
  const handleCalculateRef = useRef(null)
  const autoCalculateRef = useRef(null)

  useEffect(() => {
    loadMetadata()
      .then((meta) => {
        setMetadata(meta)
        const fromUrl = decodeInputs(INITIAL_SEARCH)
        const initial = createInitialInputs(meta)
        if (fromUrl) {
          // Merge URL-decoded fields over the metadata defaults
          const seeded = { ...initial, ...fromUrl }
          // Ensure people come from URL if present, else keep defaults
          setInputs(seeded)
          syncUrlToInputs(seeded)
          autoCalculateRef.current = seeded
          // Shared link: skip the quick-start / manual gate and show the wizard.
          setDeepLinked(true)
        } else {
          setInputs(initial)
        }
      })
      .catch((err) => setError(err.message || 'Failed to load app metadata.'))
  }, [])

  useEffect(() => {
    if (inputs && metadata) {
      syncUrlToInputs(inputs)
    }
  }, [inputs, metadata])

  useEffect(() => {
    if (metadata && autoCalculateRef.current && handleCalculateRef.current) {
      const pending = autoCalculateRef.current
      autoCalculateRef.current = null
      handleCalculateRef.current(pending)
    }
  })

  const clearResults = () => {
    requestVersionRef.current += 1
    setSeriesData(null)
    setSeriesLoading(false)
    setLoading(false)
    setHasCalculated(false)
    setError(null)
    setSeriesError(null)
  }

  const handleInputsChange = (nextInputs) => {
    setInputs(nextInputs)
    clearResults()
  }

  const handleReset = () => {
    if (!metadata) return
    setInputs(createInitialInputs(metadata))
    clearResults()
  }

  const runSeries = async (
    nextInputs,
    requestVersion = requestVersionRef.current,
  ) => {
    if (requestVersion !== requestVersionRef.current) return
    setSeriesLoading(true)
    setSeriesData(null)
    setSeriesError(null)

    const defaultStep = metadata?.defaults?.series_step || 500
    const fallbackStep = Math.max(defaultStep, 2500)
    const isCancelled = () => requestVersion !== requestVersionRef.current

    let primary = null
    let primaryError = null
    try {
      primary = await calculateSeries(nextInputs, metadata, { step: defaultStep })
    } catch (err) {
      primaryError = err
      console.error(err)
    }

    if (isCancelled()) return

    if (!primary) {
      let fallbackError = null
      try {
        primary = await calculateSeries(nextInputs, metadata, { step: fallbackStep })
        if (isCancelled()) return
        setSeriesError('Sampled coarsely for speed; refining around detected cliffs.')
      } catch (err) {
        fallbackError = err
        console.error(err)
        if (isCancelled()) return
        setSeriesError(cleanSeriesErrorMessage(fallbackError || primaryError))
        setSeriesLoading(false)
        return
      }
    }

    setSeriesData(primary)
    setSeriesLoading(false)

    const refineStep = Math.max(100, Math.floor((primary?.step_annual || defaultStep) / 5))
    try {
      const refined = await refineCliffZones({
        coarseSeries: primary,
        inputs: nextInputs,
        metadata,
        refineStep,
        calculateSeriesFn: calculateSeries,
        isCancelled,
      })
      if (isCancelled()) return
      if (refined !== primary) {
        setSeriesData(refined)
      }
    } catch (err) {
      console.error('Refinement error', err)
    }
  }

  const handleCalculate = async (nextInputs = inputs) => {
    if (!metadata || !nextInputs || !hasCompleteRequiredInputs(nextInputs)) return

    const requestVersion = requestVersionRef.current + 1
    requestVersionRef.current = requestVersion
    setSeriesData(null)
    setSeriesError(null)
    setLoading(true)
    setHasCalculated(true)
    setError(null)
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)

    try {
      await runSeries(nextInputs, requestVersion)
      if (requestVersion !== requestVersionRef.current) return
      setLoading(false)
    } catch (err) {
      if (requestVersion !== requestVersionRef.current) return
      setError(err.message || 'Calculation failed. Please try again.')
      setLoading(false)
    }
  }

  useEffect(() => {
    handleCalculateRef.current = handleCalculate
  })

  return (
    <div className="app-shell">
      <header className="app-hero">
        <div className="app-hero-inner">
          <h1>CliffWatch</h1>
          <p>See where Universal Credit withdrawal, the High-Income Child Benefit Charge and taxes create cliffs and high marginal rates as earnings rise.</p>
        </div>
      </header>

      <main className="app">
        <InputPanel
          metadata={metadata}
          inputs={inputs}
          loading={loading}
          onCalculate={handleCalculate}
          onInputsChange={handleInputsChange}
          onReset={handleReset}
          deepLinked={deepLinked}
        />

        <div ref={resultsRef} />
        <Suspense
          fallback={
            <div
              className="results-panel-loading"
              style={{ padding: '32px 16px', textAlign: 'center', color: '#475569' }}
            >
              Loading cliff chart…
            </div>
          }
        >
          <ResultsPanel
            metadata={metadata}
            inputs={inputs}
            seriesData={seriesData}
            loading={loading}
            seriesLoading={seriesLoading}
            hasCalculated={hasCalculated}
            error={error}
            seriesError={seriesError}
          />
        </Suspense>
      </main>
    </div>
  )
}

export default App
