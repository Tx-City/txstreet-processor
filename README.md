# processor

Backend monorepo for TxStreet. 

# Requirements

- Mongo Replica Set 4.4
- Redis
- Blockchain Nodes (ETH, BTC, BCH, XMR, LTC)
- Nodejs 16.13.0
- Typescript
- PM2

# Setup Instructions

- Clone repo
- Create and populate .env file
- `npm install`
- `tsc`
- `mkdir -p /mnt/disks/txstreet_storage` (or your chosen storage folder)
- `node ./dist/entry/initial-setup`
- Copy over wiki files into `f/wiki`
- Clone txstreet wiki into `WIKI_DIR`

## Start processes for each coin

Example in shell: `node ./dist/entry/tx-processor --ETH`

Example in pm2: `pm2 start "node ./dist/entry/tx-processor --ETH" --name "ETH Tx Processor"`

Start servers:

`pm2 start "node ./dist/entry/websocket-server" --name "Websocket Server"`

`pm2 start "node ./dist/entry/api" --name "REST API"`

Run for all coins, replacing ETH with ticker:

`pm2 start "node ./dist/entry/tx-processor --ETH" --name "ETH Tx Processor"`

`pm2 start "node ./dist/entry/scheduled-tasks --ETH" --name "ETH Scheduled Tasks"`

`pm2 start "node ./dist/entry/block-processor --ETH" --name "ETH Block Processor"`

`pm2 start "node ./dist/entry/scheduled-tasks2 --ETH" --name "ETH Scheduled Tasks2"`

`pm2 start "node ./dist/entry/node-subscriber --ETH" --name "ETH Node Subscriber"`

`pm2 start "node dist/entry/create-stat-history --chain ETH --interval 5s --expires 1d" --name "ETH Stats 5s"`

# Setup Crontab

`crontab -e` and paste the following lines, with the correct path to processor directory, and correct path to node version

## Stats 5 min

`*/5 * * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain BTC --interval 5m --expires 30d --cron true`

`*/5 * * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain ETH --interval 5m --expires 30d --cron true`

`*/5 * * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain LTC --interval 5m --expires 30d --cron true`

`*/5 * * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain BCH --interval 5m --expires 30d --cron true`

`*/5 * * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain XMR --interval 5m --expires 30d --cron true`

## Stats 1 hour

`0 * * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain LTC --interval 1h --expires 365d --cron true`

`0 * * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain BTC --interval 1h --expires 365d --cron true`

`0 * * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain BCH --interval 1h --expires 365d --cron true`

`0 * * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain XMR --interval 1h --expires 365d --cron true`

`0 * * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain ETH --interval 1h --expires 365d --cron true`


## Stats 1 day

`0 5 * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain ETH --interval 1d --cron true`

`0 5 * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain BTC --interval 1d --cron true`

`0 5 * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain BCH --interval 1d --cron true`

`0 5 * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain LTC --interval 1d --cron true`

`0 5 * * * /home/dev/.nvm/versions/node/v16.13.0/bin/node /home/dev/processor/dist/entry/create-stat-history --chain XMR --interval 1d --cron true`