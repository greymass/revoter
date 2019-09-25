import * as assert from 'assert'
import * as config from 'config'
import {logger} from './common'
import refreshVotes from './refresh'
import version from './version'

export async function main() {
    logger.info({version}, 'starting')
    const updateInterval = parseInt(config.get('update_interval'), 10) * 1000
    assert(isFinite(updateInterval), 'Invalid update interval')
    const update = async () => {
        try {
            await refreshVotes()
        } catch (error) {
            logger.error(error, 'Unable to refresh votes')
        }
    }
    update()
    setInterval(update, updateInterval)
}

function exit(code = 0, timeout = 1000) {
    setTimeout(() => { process.exit(code) }, timeout)
}

if (module === require.main) {
    process.on('unhandledRejection', (error) => {
        logger.fatal(error, 'unhandled rejection')
        exit(1)
    })
    process.on('uncaughtException', (error) => {
        logger.fatal(error, 'uncaught exception')
        exit(1)
    })
    main().catch((error) => {
        logger.fatal(error, 'Unable to start application')
        exit(1)
    })
}
