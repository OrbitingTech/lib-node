// import { WebSocket } from 'ws'

// export class WebSocketHandler {
//     /**
//      * @type {NodeJS.Timeout | null}
//      */
//     heartbeatInterval = null

//     /**
//      * @param {string} url The URL to connect to
//      * @param {string} token The token to use for authentication
//      */
//     constructor(url, token) {
//         this.url = url
//         this.ws = new WebSocket(url)
//         this.token = token

//         this.init()
//     }

//     init() {
//         this.ws.on('open', () => {
//             // immediately send the identify packet upon connection
//             this.sendPacket('identify', { token: this.token })

//             this.ws.once('message', data => {})
//         })

//         this.ws.on('message', data => {
//             console.log('Received:', data)
//         })

//         this.ws.on('close', () => {
//             console.log('Disconnected from', this.url)
//         })
//     }

//     onHello() {
//         this.sendPacket('heartbeat', {})

//         this.heartbeatInterval = setInterval(() => {
//             this.sendPacket('heartbeat', {})
//         }, 1000 * 60)
//     }

//     /**
//      * @param {'identify' | 'schema' | 'heartbeat'} type The type of packet
//      * @param {any} data The data to send
//      */
//     sendPacket(type, data) {
//         this.ws.send(JSON.stringify({ type, data }))
//     }
// }
