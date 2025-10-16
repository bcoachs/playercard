import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ScoreMap } from './scoring'

async function readCsvFile(relativePath: string): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), 'public', relativePath)
    return await fs.readFile(filePath, 'utf8')
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function readFirstAvailable(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const content = await readCsvFile(candidate)
    if (content !== null) return content
  }
  return null
}

function parseSemicolonCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(';').map(entry => entry.trim()))
}

function normalizeNumber(value: string | undefined): number | null {
  if (!value) return null
  const normalized = Number(value.replace(',', '.'))
  return Number.isFinite(normalized) ? normalized : null
}

export async function loadS1ScoreMap(gender: 'male' | 'female'): Promise<ScoreMap | null> {
  const candidates =
    gender === 'male'
      ? ['config/s1_male.csv', 'config/S1_Beweglichkeit_m.csv', 'config/s1.csv']
      : ['config/s1_female.csv', 'config/S1_Beweglichkeit_w.csv', 'config/s1.csv']

  const csv = await readFirstAvailable(candidates)
  if (csv === null) return null

  const rows = parseSemicolonCsv(csv)
  if (rows.length < 2) return null

  const header = rows[0]
  const ageColumns = header.slice(1)
  const map: ScoreMap = {}
  for (const age of ageColumns) {
    map[age] = []
  }

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    for (let columnIndex = 1; columnIndex < cols.length; columnIndex++) {
      const age = ageColumns[columnIndex - 1]
      const value = normalizeNumber(cols[columnIndex])
      if (value !== null) {
        map[age].push(value)
      }
    }
  }

  if (Object.keys(map).length === 0) return null
  return map
}

export async function loadS6ScoreMap(gender: 'male' | 'female'): Promise<ScoreMap | null> {
  const file = gender === 'male' ? 'config/s6_male.csv' : 'config/s6_female.csv'
  const csv = await readCsvFile(file)
  if (csv === null) return null

  const rows = parseSemicolonCsv(csv)
  if (rows.length < 2) return null

  const header = rows[0]
  const ageColumns = header.slice(1)
  const map: ScoreMap = {}
  for (const age of ageColumns) {
    map[age] = []
  }

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    for (let columnIndex = 1; columnIndex < cols.length; columnIndex++) {
      const age = ageColumns[columnIndex - 1]
      const value = normalizeNumber(cols[columnIndex])
      if (value !== null) {
        map[age].push(value)
      }
    }
  }

  if (Object.keys(map).length === 0) return null
  return map
}

export async function loadS4ScoreMap(): Promise<ScoreMap | null> {
  const csv = await readCsvFile('config/s4.csv')
  if (csv === null) return null

  const rows = parseSemicolonCsv(csv)
  if (rows.length < 3) return null

  const header = rows[0]
  const ageColumns = header.slice(1)
  const map: ScoreMap = {}
  for (const age of ageColumns) {
    map[age] = []
  }

  for (let i = 2; i < rows.length; i++) {
    const cols = rows[i]
    for (let columnIndex = 1; columnIndex < cols.length; columnIndex++) {
      const age = ageColumns[columnIndex - 1]
      const value = normalizeNumber(cols[columnIndex])
      if (value !== null) {
        map[age].push(value)
      }
    }
  }

  if (Object.keys(map).length === 0) return null
  return map
}
