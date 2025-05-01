import { randomUUID } from 'node:crypto'
import * as upload from '@/infra/storage/upload-file-to-storage'
import { isRight, unwrapEither } from '@/shared/either'
import { makeUpload } from '@/test/factories/make-upload'
import { describe, expect, it, vi } from 'vitest'
import { exportUploads } from './export-uploads'

describe('export uploads', () => {
  it('should be able to export uploads', async () => {
    const uploadStub = vi // stub is a test double that replaces the original function with a mock implementation
      .spyOn(upload, 'uploadFileToStorage')
      .mockImplementationOnce(async () => {
        return {
          key: `${randomUUID()}.csv`,
          url: 'https://storage.com/report.csv',
        }
      })

    const namePattern = randomUUID()

    const upload1 = await makeUpload({ name: `${namePattern}.jpg` })
    const upload2 = await makeUpload({ name: `${namePattern}.jpg` })
    const upload3 = await makeUpload({ name: `${namePattern}.jpg` })
    const upload4 = await makeUpload({ name: `${namePattern}.jpg` })
    const upload5 = await makeUpload({ name: `${namePattern}.jpg` })

    const sut = await exportUploads({
      searchQuery: namePattern,
    })

    const generatedCSVStream = uploadStub.mock.calls[0][0].contentStream

    const csvAsString = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = []

      generatedCSVStream
        .on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })
        .on('error', error => {
          reject(error)
        })
        .on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf-8'))
        })
    })

    const csvAsArray = csvAsString
      .trim()
      .split('\n')
      .map(line => line.split(','))

    expect(isRight(sut)).toBe(true)
    expect(unwrapEither(sut)).toEqual({
      reportUrl: 'https://storage.com/report.csv',
    })
    expect(csvAsArray).toEqual([
      ['ID', 'Name', 'Remote URL', 'Created At'],
      [
        upload1.id.toString(),
        upload1.name,
        upload1.remoteUrl,
        expect.any(String),
      ],
      [
        upload2.id.toString(),
        upload2.name,
        upload2.remoteUrl,
        expect.any(String),
      ],
      [
        upload3.id.toString(),
        upload3.name,
        upload3.remoteUrl,
        expect.any(String),
      ],
      [
        upload4.id.toString(),
        upload4.name,
        upload4.remoteUrl,
        expect.any(String),
      ],
      [
        upload5.id.toString(),
        upload5.name,
        upload5.remoteUrl,
        expect.any(String),
      ],
    ])
  })
})
