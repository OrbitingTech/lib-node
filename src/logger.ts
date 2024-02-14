import debug from 'debug'

export const log = debug('orbiting:client')

// this is the whole file... yup, better than messing with the dependency tree
export const websocketLog = log.extend('ws')
