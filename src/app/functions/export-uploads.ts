import { PassThrough, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { db, pg } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { uploadFileToStorage } from '@/infra/storage/upload-file-to-storage'
import { type Either, makeRight } from '@/shared/either'
import { stringify } from 'csv-stringify'
import { ilike } from 'drizzle-orm'
import { z } from 'zod'

const exportUploadsInput = z.object({
  searchQuery: z.string().optional(),
})

type ExportUploadsInput = z.input<typeof exportUploadsInput>
type ExportUploadsOutput = {
  reportUrl: string
}
type ExportUploadsError = never

export async function exportUploads(
  input: ExportUploadsInput
): Promise<Either<ExportUploadsError, ExportUploadsOutput>> {
  const { searchQuery } = exportUploadsInput.parse(input)

  const { sql, params } = db
    .select({
      id: schema.uploads.id,
      name: schema.uploads.name,
      remoteUrl: schema.uploads.remoteUrl,
      createdAt: schema.uploads.createdAt,
    })
    .from(schema.uploads)
    .where(
      searchQuery ? ilike(schema.uploads.name, `%${searchQuery}%`) : undefined // ilike is used for case-insensitive search
    )
    .toSQL()

  const cursor = pg.unsafe(sql, params as string[]).cursor(2)

  // const csv

  // for await (const row of cursor) {
  //   console.log(row)
  // }

  const csv = stringify({
    // Transform the cursor to a CSV stream
    delimiter: ',',
    header: true,
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Name' },
      { key: 'remote_url', header: 'Remote URL' },
      { key: 'created_at', header: 'Created At' },
    ],
  })

  const uploadToStorageStream = new PassThrough() // PassTrough stream to pipe the CSV data to the storage

  const convertToCSVPipeline = pipeline(
    cursor,
    new Transform({
      // Transform stream to convert the cursor data to CSV format
      objectMode: true, // Enable object mode to process objects
      transform(chunks: unknown[], enconding, callback) {
        for (const chunk of chunks) {
          this.push(chunk) // Push each chunk to the stream
        }

        callback() // Call the callback to signal that the transformation is complete
      },
    }),
    csv,
    uploadToStorageStream // Pipe the cursor to the CSV stream and then to the uploadToStorage stream
  )

  const uploadToStorage = uploadFileToStorage({
    fileName: `${new Date().toISOString()}-uploads.csv`,
    contentType: 'text/csv',
    folder: 'downloads',
    contentStream: uploadToStorageStream,
  })

  const [{ url }] = await Promise.all([uploadToStorage, convertToCSVPipeline]) // Wait for both streams to finish

  return makeRight({ reportUrl: url }) // Return the URL of the uploaded file
}
