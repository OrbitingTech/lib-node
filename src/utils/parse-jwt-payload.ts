// https://stackoverflow.com/a/38552302
export function parseJwtPayload(token: string) {
    const payload = token.split('.')[1]
    if (!payload) {
        return null
    }

    return JSON.parse(Buffer.from(payload, 'base64').toString())
}
