# Voter Count

This repository contains the **Voter Count** plugin.

## Introduction

At the time of writing, the Core API offers no way to easily retrieve the voter count of each delegate, other than querying the `delegates/{id}/voters` endpoint and read the total count from the returned meta data. This plugin stores the voter count as a wallet attribute and includes it directly in the delegate data returned by the `delegates` and `delegates/{id}` endpoints.

```json
{
    "data": {
        "username": "ddated",
        "address": "DT9QA8WDTpkiUDCYjDfo4GkPCmyyQ8NWVA",
        "publicKey": "02c0382d6a5531b47d7545b3347d6e3b5e7833a13dbf9665e35afc70202e123178",
        "votes": "147505035",
        "rank": 109,
        "isResigned": false,
        "blocks": {
            "produced": 0
        },
        "production": {
            "approval": 0
        },
        "forged": {
            "fees": "0",
            "rewards": "0",
            "total": "0"
        },
        "voterCount": 1 // <-- yay
    }
}
```

## Installation

The plugin can be installed by executing the following command:

```sh
ark plugin:install @dpos-info/core-voter-count
```

Enable the plugin by adding the following entry after the Core API plugin in the `core` or `relay` section of your `app.json` file:

```json
{
    "package": "@dpos-info/core-voter-count"
}
```

> Please note: if you are using the `@alessiodf/rocket-boot` plugin please stop your Core processes and delete the saved state files by executing `ark rocket:purge` in order for the state to be generated correctly when you start the node with the `@dpos-info/core-voter-count` plugin for the first time.

## Credits

-   [All Contributors](../../contributors)

## License

[MIT](LICENSE) © [Edgar Goetzendorff](https://github.com/dpos-info)
