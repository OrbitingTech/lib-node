import fs from 'fs'
import path from 'path'

import { cacheLog } from '../logger.js'

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let objectHash: typeof import('object-hash') | null

try {
    objectHash = (await import('object-hash'))
        .default as unknown as typeof objectHash
} catch (err) {
    objectHash = null
}

const PACKAGE_NAME = 'orbiting'
const MAX_WALK_COUNT = 10

function getNodeModules() {
    let currentDir = path.resolve(import.meta.dirname, '..', '..') // ../../ from src/utils/
    let walkCount = 0 // prevent infinite loops

    while (currentDir !== '/' && walkCount++ < MAX_WALK_COUNT) {
        const nodeModulesPath = path.join(currentDir, 'node_modules')

        if (fs.existsSync(nodeModulesPath)) {
            cacheLog('Found node_modules at:', nodeModulesPath)
            return nodeModulesPath
        }

        const parent = path.resolve(currentDir, '..')
        if (parent === currentDir) {
            break // we've walked back as far as we can go
        }

        currentDir = parent
    }

    cacheLog(
        'Failed to walk up and find node_modules, using ./node_modules as default',
    )

    // boldly assume node_modules is relative to the workdir
    return './node_modules'
}

export function getCacheFolder() {
    const cacheFolder = path.join(getNodeModules(), '.cache', PACKAGE_NAME)

    fs.mkdirSync(cacheFolder, { recursive: true })

    return path.join(getNodeModules(), '.cache', PACKAGE_NAME)
}

export function isNewCacheObject(key: string, obj: object) {
    if (!objectHash) {
        return true
    }

    const hash = objectHash(obj)
    const cacheFile = path.join(getCacheFolder(), `latest-${key}-hash.txt`)

    try {
        const savedHash = fs.readFileSync(cacheFile, { encoding: 'utf-8' })

        // if the hashes are the same then nothing is new, but otherwise save the current one
        if (savedHash === hash) {
            cacheLog(`Cache for ${key} is valid`)
            return false
        }
    } catch (err) {
        cacheLog('Failed to read the cache file:', err)
    }

    try {
        fs.writeFileSync(cacheFile, hash, { encoding: 'utf-8' })
        cacheLog(`Successfully cached new ${key} with hash ${hash}`)
    } catch (err) {
        cacheLog('Failed to write the cache file:', err)
    }

    return true
}
