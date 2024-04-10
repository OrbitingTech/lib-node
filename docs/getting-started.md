# Getting Started with Orbiting Library

## Client Settings

There are few options when creating an Orbiting client in order to better tailor it to your use-case.

| Name        | Description                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `token`     | The authorization token used in all requests to Orbiting.                                                             |
| `baseURL`   | The API URL to Orbiting's servers. This is mainly for development purposes.                                           |
| `fetchOnly` | Boolean to disable the websocket functionality and fetch once. Default is `false`. [Read more](#usage-of-fetch-mode). |
| `websocket` | Options regarding the websocket connection. See [websocket options](#websocket-options).                              |

### Websocket Options

These are the options you can provide to the websocket.

| Name                | Description                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `reconnectDelayMS`  | Delay in milliseconds to attempt reconnections. Default is `5000`.                                                      |
| `reconnectAttempts` | The max amount of times reconnecting should be attempted. Zero or negative values will assume infinite. Default is `5`. |
| `timeoutMS`         | How long in milliseconds until a connection is considered worthless upon connection. Default is `5000`.                 |

## Usage of Fetch Mode

If your app isn't meant to be run for long periods of time then it's likely you won't find much use for the live updates the websocket connection will provide. This is where fetch mode comes in, which can be enabled like so:

```js
const orb = createClient({
    token: process.env.ORB_APP_TOKEN,
    fetchOnly: true, // here
}).schema({
    /* ... */
})

// the difference with this now, is that it will not try to initialize
// a websocket connection, and instead will call a method: OrbitingClient#fetchConfig
// (this is a public function so you can call it at your discretion as well)
await orb.init()
```

## Setting Layouts

You've probably been wondering now why schema is specified through a whole new function. This is because there are features planned in the future, and features now, that will benefit from the builder code style. One of these features is **layouts**.

Layouts are your way to better configure your control panel's look and feel. By making use of a layout, you can group controls together, provide titles, descriptions, etc. A layout can be set as you'd expect:

```js
createClient({
    /* ... */
})
    .schema({
        maxSignUps: {
            type: 'number',
            default: 10,
        },
    })
    .layout([
        {
            title: 'Accounts',
            description: 'All your controls to manage your accounts.',a
            controls: [{ for: 'maxSignUps' }],
        },
    ])
```

> [!NOTE]
> For more advanced usage of layouts, please check out the [full guide here](layout.md).

## Client Events API

**Todo...**

## Debugging

Remember currently Orbiting is in its beta stage and things will likely break or behave unexpectedly. Before submitting a bug report please make sure it's not something on your end. In order to check the library for anything wrong you can check its debug output by setting `DEBUG=orbiting:*` in your environment variables to see what's going on in more detail.
