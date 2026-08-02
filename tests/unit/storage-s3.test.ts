import { describe, it, expect, vi, beforeEach } from 'vitest'

// The AWS SDK is mocked at the module boundary: what matters here is the
// commands the driver builds and how it interprets what comes back. The
// driver is also exercised against a real MinIO in the PR's live verification,
// which is where "does S3 actually behave like this" gets answered.

const mockSend = vi.hoisted(() => vi.fn())
const mockPresign = vi.hoisted(() => vi.fn())

vi.mock('@aws-sdk/client-s3', () => {
  class FakeCommand {
    constructor(public readonly input: Record<string, any>) {}
  }
  return {
    S3Client: class {
      send = mockSend
      constructor(public readonly config: Record<string, any>) {}
    },
    PutObjectCommand: class extends FakeCommand {
      readonly commandName = 'Put'
    },
    GetObjectCommand: class extends FakeCommand {
      readonly commandName = 'Get'
    },
    DeleteObjectCommand: class extends FakeCommand {
      readonly commandName = 'Delete'
    },
    HeadObjectCommand: class extends FakeCommand {
      readonly commandName = 'Head'
    },
  }
})

vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mockPresign }))

const { S3StorageDriver } = await import('@/lib/storage/s3')
const { StorageNotFoundError } = await import('@/lib/storage/types')
const { InvalidStorageKeyError } = await import('@/lib/storage/keys')

function makeDriver(overrides: Record<string, any> = {}) {
  return new S3StorageDriver({
    bucket: 'dental-erp-uploads',
    region: 'us-east-1',
    endpoint: 'http://localhost:9000',
    accessKeyId: 'dentalerp',
    secretAccessKey: 'dentalerp123',
    forcePathStyle: true,
    ...overrides,
  })
}

/** The shape the SDK returns from GetObject. */
function s3Body(content: string, contentType?: string) {
  return {
    ContentType: contentType,
    Body: { transformToByteArray: async () => new TextEncoder().encode(content) },
  }
}

function notFound(name: string) {
  return Object.assign(new Error(name), { name, $metadata: { httpStatusCode: 404 } })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSend.mockReset()
  mockPresign.mockReset()
})

describe('S3StorageDriver — configuration', () => {
  it('reports its driver name', () => {
    expect(makeDriver().name).toBe('s3')
  })

  it('refuses to construct without a bucket', () => {
    expect(() => makeDriver({ bucket: '' })).toThrow(/S3_BUCKET/)
  })

  it('passes endpoint, region and path-style through to the client', async () => {
    const driver = makeDriver()
    mockSend.mockResolvedValue({})
    await driver.put('hosp-1/x.png', Buffer.from('a'))

    const client = mockSend.mock.instances[0] as any
    expect(client.config).toMatchObject({
      region: 'us-east-1',
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
      credentials: { accessKeyId: 'dentalerp', secretAccessKey: 'dentalerp123' },
    })
  })

  it('omits credentials entirely when keys are absent, so an instance role is used', async () => {
    const driver = makeDriver({ accessKeyId: undefined, secretAccessKey: undefined })
    mockSend.mockResolvedValue({})
    await driver.put('hosp-1/x.png', Buffer.from('a'))

    const client = mockSend.mock.instances[0] as any
    expect(client.config.credentials).toBeUndefined()
  })

  it('supplies a region for implementations that ignore it but demand one', async () => {
    const driver = makeDriver({ region: undefined })
    mockSend.mockResolvedValue({})
    await driver.put('hosp-1/x.png', Buffer.from('a'))

    const client = mockSend.mock.instances[0] as any
    expect(client.config.region).toBe('us-east-1')
  })

  it('omits the endpoint for real AWS rather than sending an empty one', async () => {
    const driver = makeDriver({ endpoint: undefined, forcePathStyle: false })
    mockSend.mockResolvedValue({})
    await driver.put('hosp-1/x.png', Buffer.from('a'))

    const client = mockSend.mock.instances[0] as any
    expect(client.config).not.toHaveProperty('endpoint')
    expect(client.config).not.toHaveProperty('forcePathStyle')
  })

  it('reuses one client across calls instead of building a pool per request', async () => {
    const driver = makeDriver()
    mockSend.mockResolvedValue({})
    await driver.put('hosp-1/a.png', Buffer.from('a'))
    await driver.put('hosp-1/b.png', Buffer.from('b'))
    expect(new Set(mockSend.mock.instances).size).toBe(1)
  })
})

describe('S3StorageDriver — put', () => {
  it('writes to the bucket under the canonical key', async () => {
    mockSend.mockResolvedValue({})
    await makeDriver().put('hosp-1/documents/x.png', Buffer.from('bytes'), {
      contentType: 'image/png',
    })

    const command = mockSend.mock.calls[0][0]
    expect(command.commandName).toBe('Put')
    expect(command.input).toMatchObject({
      Bucket: 'dental-erp-uploads',
      Key: 'hosp-1/documents/x.png',
      ContentType: 'image/png',
    })
    expect(Buffer.from(command.input.Body).toString()).toBe('bytes')
  })

  it('normalises a legacy path into the canonical key', async () => {
    mockSend.mockResolvedValue({})
    await makeDriver().put('/uploads/hosp-1/documents/x.png', Buffer.from('b'))
    expect(mockSend.mock.calls[0][0].input.Key).toBe('hosp-1/documents/x.png')
  })

  it('falls back to the extension when no content type is supplied', async () => {
    mockSend.mockResolvedValue({})
    await makeDriver().put('hosp-1/x.pdf', Buffer.from('%PDF'))
    expect(mockSend.mock.calls[0][0].input.ContentType).toBe('application/pdf')
  })

  it('rejects a traversing key before it reaches the bucket', async () => {
    await expect(
      makeDriver().put('hosp-1/../hosp-2/x.png', Buffer.from('a'))
    ).rejects.toBeInstanceOf(InvalidStorageKeyError)
    expect(mockSend).not.toHaveBeenCalled()
  })
})

describe('S3StorageDriver — get', () => {
  it('buffers the stream and reports the recorded content type', async () => {
    mockSend.mockResolvedValue(s3Body('hello', 'image/png'))
    const object = await makeDriver().get('hosp-1/x.png')

    expect(object.body.toString()).toBe('hello')
    expect(object.size).toBe(5)
    expect(object.contentType).toBe('image/png')
  })

  it('prefers the extension when the store returns a generic octet-stream', async () => {
    // Uploads made before this driver existed carry no ContentType, and some
    // implementations substitute octet-stream. Serving a PDF as octet-stream
    // makes a browser download it instead of displaying it.
    mockSend.mockResolvedValue(s3Body('%PDF', 'application/octet-stream'))
    expect((await makeDriver().get('hosp-1/x.pdf')).contentType).toBe('application/pdf')
  })

  it('derives the content type when none is recorded at all', async () => {
    mockSend.mockResolvedValue(s3Body('x', undefined))
    expect((await makeDriver().get('hosp-1/x.jpg')).contentType).toBe('image/jpeg')
  })

  it('translates NoSuchKey into StorageNotFoundError', async () => {
    mockSend.mockRejectedValue(notFound('NoSuchKey'))
    await expect(makeDriver().get('hosp-1/missing.png')).rejects.toBeInstanceOf(
      StorageNotFoundError
    )
  })

  it('translates a bare 404 with an unhelpful name', async () => {
    mockSend.mockRejectedValue(
      Object.assign(new Error('nope'), { name: 'Error', $metadata: { httpStatusCode: 404 } })
    )
    await expect(makeDriver().get('hosp-1/missing.png')).rejects.toBeInstanceOf(
      StorageNotFoundError
    )
  })

  it('lets a real failure through rather than reporting it as missing', async () => {
    // A 500 or a credentials problem is not "no such file". Collapsing them
    // would turn an outage into silent, permanent data loss in the UI.
    mockSend.mockRejectedValue(
      Object.assign(new Error('AccessDenied'), {
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      })
    )
    await expect(makeDriver().get('hosp-1/x.png')).rejects.toThrow('AccessDenied')
  })

  it('treats an empty body as missing', async () => {
    mockSend.mockResolvedValue({ Body: undefined })
    await expect(makeDriver().get('hosp-1/x.png')).rejects.toBeInstanceOf(StorageNotFoundError)
  })
})

describe('S3StorageDriver — delete and exists', () => {
  it('deletes by key', async () => {
    mockSend.mockResolvedValue({})
    await makeDriver().delete('hosp-1/x.png')

    const command = mockSend.mock.calls[0][0]
    expect(command.commandName).toBe('Delete')
    expect(command.input).toMatchObject({ Bucket: 'dental-erp-uploads', Key: 'hosp-1/x.png' })
  })

  it('reports existence via HeadObject', async () => {
    mockSend.mockResolvedValue({ ContentLength: 5 })
    expect(await makeDriver().exists('hosp-1/x.png')).toBe(true)
    expect(mockSend.mock.calls[0][0].commandName).toBe('Head')
  })

  it('answers false for a missing key', async () => {
    mockSend.mockRejectedValue(notFound('NotFound'))
    expect(await makeDriver().exists('hosp-1/x.png')).toBe(false)
  })

  it('does not swallow a real error as "does not exist"', async () => {
    mockSend.mockRejectedValue(
      Object.assign(new Error('boom'), {
        name: 'ServiceUnavailable',
        $metadata: { httpStatusCode: 503 },
      })
    )
    await expect(makeDriver().exists('hosp-1/x.png')).rejects.toThrow('boom')
  })
})

describe('S3StorageDriver — getSignedUrl', () => {
  it('presigns a GET with a default lifetime', async () => {
    mockPresign.mockResolvedValue('https://signed.example/x')
    const url = await makeDriver().getSignedUrl('hosp-1/x.png')

    expect(url).toBe('https://signed.example/x')
    const [, command, options] = mockPresign.mock.calls[0]
    expect(command.commandName).toBe('Get')
    expect(command.input).toMatchObject({ Bucket: 'dental-erp-uploads', Key: 'hosp-1/x.png' })
    expect(options).toEqual({ expiresIn: 300 })
  })

  it('honours an explicit expiry', async () => {
    mockPresign.mockResolvedValue('https://signed.example/x')
    await makeDriver().getSignedUrl('hosp-1/x.png', 60)
    expect(mockPresign.mock.calls[0][2]).toEqual({ expiresIn: 60 })
  })
})
