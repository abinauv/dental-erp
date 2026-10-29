import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock fns so the vi.mock factories (which hoist above imports) can see them.
const h = vi.hoisted(() => ({
  emailDispatch: vi.fn(),
  smsDispatch: vi.fn(),
  runAllTriggers: vi.fn(),
  queueAdd: vi.fn(),
  queueClose: vi.fn(),
  workerOn: vi.fn(),
  workerClose: vi.fn(),
  redisQuit: vi.fn(),
  QueueCtor: vi.fn(),
  WorkerCtor: vi.fn(),
  RedisCtor: vi.fn(),
}))

vi.mock('@/lib/services/email.service', () => ({
  emailService: { dispatchLog: h.emailDispatch },
}))
vi.mock('@/lib/services/sms.service', () => ({
  smsService: { dispatchLog: h.smsDispatch },
}))
vi.mock('@/lib/services/communication-triggers.service', () => ({
  communicationTriggersService: { runAllTriggers: h.runAllTriggers },
}))
vi.mock('bullmq', () => ({
  Queue: h.QueueCtor,
  Worker: h.WorkerCtor,
}))
vi.mock('ioredis', () => ({
  default: h.RedisCtor,
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.unstubAllEnvs()

  h.queueAdd.mockResolvedValue({ id: 'job-1' })
  h.queueClose.mockResolvedValue(undefined)
  h.redisQuit.mockResolvedValue(undefined)
  // Regular functions, not arrows — these are invoked with `new`.
  h.QueueCtor.mockImplementation(function () {
    return { add: h.queueAdd, close: h.queueClose }
  })
  h.WorkerCtor.mockImplementation(function () {
    return { on: h.workerOn, close: h.workerClose }
  })
  h.RedisCtor.mockImplementation(function () {
    return { quit: h.redisQuit }
  })
})

describe('queue — inline fallback (no REDIS_URL)', () => {
  it('reports the queue as disabled', async () => {
    vi.stubEnv('REDIS_URL', '')
    const { isQueueEnabled } = await import('@/lib/queue')
    expect(isQueueEnabled()).toBe(false)
  })

  it('runs the send-email handler inline and returns its result', async () => {
    vi.stubEnv('REDIS_URL', '')
    h.emailDispatch.mockResolvedValue('ok')
    const { enqueue } = await import('@/lib/queue')

    const payload = { to: 'a@b.com', subject: 's', body: 'b' }
    const res = await enqueue('send-email', { emailLogId: 'e1', payload })

    expect(res.queued).toBe(false)
    expect(h.emailDispatch).toHaveBeenCalledWith('e1', payload)
    expect(h.QueueCtor).not.toHaveBeenCalled()
  })

  it('runs the send-sms handler inline', async () => {
    vi.stubEnv('REDIS_URL', '')
    h.smsDispatch.mockResolvedValue(undefined)
    const { enqueue } = await import('@/lib/queue')

    const payload = { phone: '9876543210', message: 'hi' }
    await enqueue('send-sms', { smsLogId: 's1', payload })

    expect(h.smsDispatch).toHaveBeenCalledWith('s1', payload)
  })

  it('runs the communication-triggers handler inline', async () => {
    vi.stubEnv('REDIS_URL', '')
    h.runAllTriggers.mockResolvedValue(undefined)
    const { enqueue } = await import('@/lib/queue')

    await enqueue('run-communication-triggers', {})

    expect(h.runAllTriggers).toHaveBeenCalledTimes(1)
  })

  it('propagates handler errors (so callers surface them exactly as before)', async () => {
    vi.stubEnv('REDIS_URL', '')
    h.smsDispatch.mockRejectedValue(new Error('gateway down'))
    const { enqueue } = await import('@/lib/queue')

    await expect(
      enqueue('send-sms', { smsLogId: 's1', payload: { phone: '9876543210', message: 'm' } })
    ).rejects.toThrow('gateway down')
  })
})

describe('queue — BullMQ path (REDIS_URL set)', () => {
  it('reports the queue as enabled', async () => {
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379')
    const { isQueueEnabled } = await import('@/lib/queue')
    expect(isQueueEnabled()).toBe(true)
  })

  it('adds the job to BullMQ and does not run the handler', async () => {
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379')
    const { enqueue } = await import('@/lib/queue')

    const payload = { to: 'a@b.com', subject: 's', body: 'b' }
    const res = await enqueue(
      'send-email',
      { emailLogId: 'e1', payload },
      { jobId: 'email:e1', delayMs: 1000 }
    )

    expect(res.queued).toBe(true)
    expect(h.emailDispatch).not.toHaveBeenCalled()
    expect(h.queueAdd).toHaveBeenCalledWith(
      'send-email',
      { emailLogId: 'e1', payload },
      expect.objectContaining({ jobId: 'email:e1', delay: 1000, attempts: 5 })
    )
  })

  it('reuses one Queue instance across enqueues', async () => {
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379')
    const { enqueue } = await import('@/lib/queue')

    await enqueue('run-communication-triggers', {})
    await enqueue('run-communication-triggers', {})

    expect(h.QueueCtor).toHaveBeenCalledTimes(1)
    expect(h.queueAdd).toHaveBeenCalledTimes(2)
  })
})

describe('queue worker', () => {
  it('startWorker returns null when REDIS_URL is unset', async () => {
    vi.stubEnv('REDIS_URL', '')
    const { startWorker } = await import('@/lib/queue/worker')
    expect(await startWorker()).toBeNull()
    expect(h.WorkerCtor).not.toHaveBeenCalled()
  })

  it('startWorker creates a BullMQ worker when REDIS_URL is set', async () => {
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379')
    const { startWorker } = await import('@/lib/queue/worker')

    const worker = await startWorker()

    expect(worker).not.toBeNull()
    expect(h.WorkerCtor).toHaveBeenCalledTimes(1)
    // completed + failed listeners wired for visibility.
    expect(h.workerOn).toHaveBeenCalledWith('completed', expect.any(Function))
    expect(h.workerOn).toHaveBeenCalledWith('failed', expect.any(Function))
  })
})
