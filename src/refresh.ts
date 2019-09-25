import * as config from 'config'
import { convertLegacyPublicKey } from 'eosjs/dist/eosjs-numeric'
import { apiClient, logger, signatureProvider } from './common'

// name of the voting permission accounts should setup to allow producerupdate
const VotingPermissionName = config.get('eosio_perm') as string

interface AccountPermission {
    perm_name: string
    parent: string
    required_auth: {
        threshold: number
        keys: Array<{key: string, weight: number}>
        accounts: string[]
        waits: any[]
    }
}

interface Account {
    account_name: string
    permissions: AccountPermission[]
    voter_info: {
        owner: string
        proxy: string
        producers: string[]
        staked: number
        last_vote_weight: string
        proxied_vote_weight: string
        is_proxy: number
        flags1: number
    }
}

function hasPermission(publicKey: string, account: Account) {
    const permissions = account.permissions.filter((perm) => {
        return perm.required_auth.keys.find(({key, weight}) => {
            return convertLegacyPublicKey(key) === publicKey && weight >= perm.required_auth.threshold
        })
    }).map(({perm_name}) => perm_name)
    return permissions.includes(VotingPermissionName)
}

/**
 * Calculate voter decay for given account.
 * @returns fraction representing vote decay for account, 0 = no vote decay, 1 = full decay
 */
function getDecay(account: Account) {
    const {staked, last_vote_weight, proxied_vote_weight} = account.voter_info
    const secondsSince2000 = (Date.now() / 1000) - 946684800
    const secondsPerWeek = 604800
    const weight = Math.floor(secondsSince2000 / secondsPerWeek) / 52
    const lastVoteWeight = Number(last_vote_weight) - Number(proxied_vote_weight)
    const currentVoteWeight = Math.pow(2, weight) * Number(staked)
    return 1 - (lastVoteWeight / currentVoteWeight)
}

async function refreshVote(publicKey: string, account: Account) {
    let log = logger.child({account: account.account_name})
    if (!hasPermission(publicKey, account)) {
        log.debug('skipping, account has invalid permission')
        return
    }
    const staked = Number(account.voter_info.staked)
    if (staked <= 0) {
        log.debug('skipping, account has no stake')
        return
    }
    const {producers, proxy} = account.voter_info
    if (producers.length === 0 && account.voter_info.proxy === '') {
        log.debug('skipping, no producers or proxy set')
        return
    }
    const decay = getDecay(account) * 100
    log = log.child({stake: staked / 100000, decay})
    if (decay > 0) {
        log.info('account decay above treshold, refreshing votes')
        const vote = {
            account: 'eosio',
            name: 'voteproducer',
            authorization: [{
                actor: account.account_name,
                permission: VotingPermissionName,
            }],
            data: {
                voter: account.account_name,
                proxy,
                producers,
            }
        }
        const {transaction_id} = await apiClient.transact(
            {actions: [vote]},
            {blocksBehind: 3, expireSeconds: 30}
        )
        log.info({transaction_id}, 'votes updated')
    } else {
        log.debug('no action needed')
    }
}

export default async function refresh() {
    const keys = signatureProvider.availableKeys
    for (const key of keys) {
        logger.debug('refreshing votes using %s', key)
        const {account_names} = await apiClient.rpc.history_get_key_accounts(key)
        logger.debug('fetching account info for %d account(s)', account_names.length)
        const accounts: Account[] = await Promise.all(
            account_names.map((name: string) => apiClient.rpc.get_account(name))
        )
        for (const account of accounts) {
            try {
                await refreshVote(key, account)
            } catch (error) {
                logger.error(error, 'error when refreshing vote for %s', account.account_name)
            }
        }
    }
}
