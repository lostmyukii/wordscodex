type Dependencies = {
  database: boolean
  cache: boolean
}

type Readiness = {
  ready: boolean
  unavailable: Array<keyof Dependencies>
}

export function getSystemReadiness(dependencies: Dependencies): Readiness {
  const unavailable = (
    Object.entries(dependencies) as Array<[keyof Dependencies, boolean]>
  )
    .filter(([, available]) => !available)
    .map(([name]) => name)

  return {
    ready: unavailable.length === 0,
    unavailable,
  }
}
