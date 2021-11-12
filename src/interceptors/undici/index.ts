import { getGlobalDispatcher, setGlobalDispatcher } from 'undici'
import { Interceptor } from '../../createInterceptor'
import MockAgent from './MockAgent'

const debug = require('debug')('undici')

export const interceptUndiciRequest: Interceptor = (observer, resolver) => {
  const pureAgent = getGlobalDispatcher()

  const mockAgent = new MockAgent({ agent: pureAgent, observer, resolver })
  setGlobalDispatcher(mockAgent)

  return () => {
    debug('restoring modules...')
    setGlobalDispatcher(pureAgent)
  }
}
