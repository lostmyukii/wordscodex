import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

const adapter = new PrismaPg({
  connectionString,
})
const prisma = new PrismaClient({ adapter })

await prisma.systemMetadata.upsert({
  where: { key: 'schema_version' },
  update: { value: 'stage-0' },
  create: {
    key: 'schema_version',
    value: 'stage-0',
  },
})

await prisma.$disconnect()
