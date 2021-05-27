# manylicenses

A `node_modules` license reporting tool for monorepos that use yarn workspaces.

**WARNING**: This tool is a work in progress, please report any bugs! If you need something safe for your production tooling, this probably isn't for you... yet.

## Examples

```
yarn licenses list --json | manylicenses --csv --approve=MIT,zlib --excludePrefix=@thinkmill
```

## LICENSE [MIT](LICENSE)

Copyright (c) 2021 Thinkmill Labs Pty Ltd
