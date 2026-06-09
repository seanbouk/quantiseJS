// Runs colour grading + quantisation off the main thread so the UI never
// blocks during heavy work (tile-reduction k-means, blue-noise generation).

import { applyGrade, type Grade } from './grade'
import { quantise, type QuantiseOptions, type QuantiseResult } from './quantise'

export interface WorkerRequest {
  id: number
  imageData: ImageData
  grade: Grade
  opts: QuantiseOptions
}

export interface WorkerResponse {
  id: number
  imageData: ImageData
  palettes: QuantiseResult['palettes']
  stats: QuantiseResult['stats']
  exportData?: QuantiseResult['exportData']
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (msg: WorkerResponse) => void
}

ctx.onmessage = (e) => {
  const { id, imageData, grade, opts } = e.data
  const graded = applyGrade(imageData, grade)
  const res = quantise(graded, opts)
  ctx.postMessage({
    id,
    imageData: res.imageData,
    palettes: res.palettes,
    stats: res.stats,
    exportData: res.exportData,
  })
}
