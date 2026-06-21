import { useState, useRef, useCallback } from 'react'
import { createWorker } from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

// ── regex pattern lists ──────────────────────────────────────────
const PATTERNS = {
  electricity: [
    /(\d+[\.,]?\d*)\s*(?:kWh|KWH|kwh)\b/,
    /(?:units?\s+consumed|total\s+units?|energy\s+consumed|consumption|unit)[:\s]+(\d+[\.,]?\d*)/i,
    /(\d+[\.,]?\d*)\s*(?:units?|UNITS?)\b/,
    /(?:Billed\s+Units?|Consumed\s+Units?)[:\-\s]+(\d+[\.,]?\d*)/i,
  ],
  lpg: [
    /(\d+)\s*(?:cylinders?|cyl\.?)\b/i,
    /(?:no\.?\s*of\s+cylinders?|qty|quantity)[:\s]+(\d+)/i,
    /(?:booking(?:\s+for)?)[:\s]+(\d+)/i,
    /refill.*?(\d+)/i,
    /(?:Quantity\s*\(?Cylinders?\)?|Qty)[:\-\s]+(\d+)/i,
  ],
}

function extractValue(text, fieldType) {
  for (const pattern of PATTERNS[fieldType]) {
    const m = text.match(pattern)
    if (m) {
      const val = m[1] ?? m[2]
      if (val) return val.replace(',', '.')
    }
  }
  return null
}

async function pdfFirstPageToBlob(file) {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2.5 })
  const canvas = document.createElement('canvas')
  canvas.width  = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

const STATUS_CFG = {
  found:     { color: '#16a34a', label: 'Value extracted and filled' },
  uncertain: { color: '#f59e0b', label: 'Possible value detected — please verify' },
  notFound:  { color: '#ef4444', label: 'Could not extract value from bill' },
}

const ACCEPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'])

export default function BillUpload({ fieldType, label, onValueExtracted }) {
  const [status,   setStatus]   = useState('idle')   // idle | loading | found | uncertain | notFound
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const processFile = useCallback(async (file) => {
    if (!file) return
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (!ACCEPT_TYPES.has(file.type) && !isPdf) return

    setStatus('loading')
    try {
      const imageSource = isPdf ? await pdfFirstPageToBlob(file) : file

      const worker = await createWorker('eng')
      const { data } = await worker.recognize(imageSource)
      await worker.terminate()

      const { text, confidence } = data
      const value = extractValue(text, fieldType)

      if (value !== null) {
        setStatus(confidence >= 65 ? 'found' : 'uncertain')
        onValueExtracted(value)
      } else {
        setStatus('notFound')
      }
    } catch (err) {
      console.error('OCR error:', err)
      setStatus('notFound')
    }
  }, [fieldType, onValueExtracted])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    processFile(e.dataTransfer.files[0])
  }

  const cfg = STATUS_CFG[status]

  return (
    <div className="bill-upload">
      {/* dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label} (JPG, PNG or PDF) for automatic value extraction`}
        aria-busy={status === 'loading'}
        className={[
          'dropzone',
          dragOver        ? 'dropzone--over'      : '',
          status === 'found'     ? 'dropzone--found'     : '',
          status === 'uncertain' ? 'dropzone--uncertain' : '',
          status === 'notFound'  ? 'dropzone--not-found' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
      >
        {/* hidden real input */}
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="sr-only"
          aria-label={`Choose ${label} file for OCR scan`}
          onChange={e => processFile(e.target.files?.[0])}
        />

        {status === 'loading' ? (
          <div className="dropzone-loading" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <span>Scanning bill…</span>
          </div>
        ) : (
          <div className="dropzone-content">
            <span className="dropzone-icon" aria-hidden="true">📄</span>
            <span className="dropzone-main-text">
              {status === 'idle' ? `Upload ${label}` : 'Upload another'}
            </span>
            <span className="dropzone-sub-text">JPG · PNG · PDF — drag or click</span>
          </div>
        )}
      </div>

      {/* confidence indicator */}
      {cfg && status !== 'idle' && status !== 'loading' && (
        <p
          className="ocr-status"
          role="status"
          aria-live="polite"
          aria-label={cfg.label}
          style={{ color: cfg.color }}
        >
          <span className="ocr-dot" style={{ background: cfg.color }} aria-hidden="true" />
          {cfg.label}
        </p>
      )}
    </div>
  )
}
