import {
  Headers,
  headersToObject,
  flattenHeadersObject,
} from 'headers-utils'
import { Agent, Dispatcher, errors } from 'undici'

import {
  IsomorphicRequest,
  Observer,
  Resolver,
} from '../../createInterceptor'
import { uuidv4 } from '../../utils/uuid'

const debug = require('debug')('undici')

function generateKeyValues (data: Record<string, string>): string[] {
  return Object.entries(data).reduce((keyValuePairs: string[], [key, value]) => [...keyValuePairs, key, value], [])
}

export default class MockAgent extends Dispatcher {
  private agent: Dispatcher
  private resolver: Resolver
  private observer: Observer

  constructor (opts: { agent: Dispatcher, observer: any, resolver: any }) {
    super()
    const { agent, observer, resolver } = opts

    if (!(agent && typeof agent.dispatch === 'function')) {
      throw new errors.InvalidArgumentError('Argument opts.agent must implement Agent')
    }
    this.agent = agent
    this.observer = observer
    this.resolver = resolver
  }

  dispatch(opts: Agent.DispatchOptions, handler: Dispatcher.DispatchHandlers): boolean {
    const url = opts.origin + opts.path
    const method = opts.method || 'GET'
    debug('[%s] %s', method, url)

    ;(async () => {
      try {
        const isoRequest: IsomorphicRequest = {
          id: uuidv4(),
          url: new URL(url, opts.origin),
          method: method,
          // @ts-ignore TODO: string[] to HeadersInit | HeadersObject | HeadersList | undefined
          headers: new Headers(opts.headers || {}),
          credentials: 'omit',
          // @ts-ignore TODO: parse string | Buffer | Uint8Array | internal.Readable | null | undefined to string
          body: opts.body,
        }
        debug('isomorphic request', isoRequest)
        this.observer.emit('request', isoRequest)

        debug('awaiting for the mocked response...')
        const response = await this.resolver(isoRequest, handler)
        debug('mocked response', response)

        if (response && handler.onHeaders && handler.onData && handler.onComplete) {
          const statusCode = response.status || 200
          const headers = generateKeyValues(response.headers ? flattenHeadersObject(response.headers) : {})
          const resume = () => {}
          handler.onHeaders(statusCode, headers, resume);
          if (response.body) {
            handler.onData(Buffer.from(response.body));
          }
          const trailers = null
          handler.onComplete(trailers);
          return;
        }

        this.agent.dispatch(opts, handler)
      } catch (err) {
        console.error(err)
      }
    })()
    
    return true;
  }

  async close(): Promise<void> {
    await this.agent.close()
  }
}