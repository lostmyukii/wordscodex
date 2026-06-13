/* global self */

self.addEventListener('sync', (event) => {
  if (
    event.tag !== 'wordscodex-analytics-flush' &&
    event.tag !== 'wordscodex-offline-review-sync'
  ) {
    return
  }

  event.waitUntil(notifyWordscodexClients(event.tag))
})

async function notifyWordscodexClients(tag) {
  const clients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window',
  })

  await Promise.all(
    clients.map((client) =>
      client.postMessage({
        type: 'WORDSCODEX_BACKGROUND_SYNC',
        tag,
      }),
    ),
  )
}
