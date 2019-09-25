import * as assert from 'assert'
import * as config from 'config'
import { apiClient, logger, signatureProvider } from './common'

export default async function refresh() {
    logger.debug('refreshing votes')
    const keys = signatureProvider.availableKeys
    logger.info({keys}, 'keys')
}
