export class OrbitingError extends Error {
    override name = 'OrbitingError'

    constructor(public override readonly message: string) {
        super(message)
    }
}

export class WebSocketError extends OrbitingError {
    override name = 'WebSocketError'

    constructor(public override readonly message: string) {
        super(message)
    }
}
