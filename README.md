# processor


# Crontab

#Stats 5 min
*/5 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain BTC --interval 5m --expires 30d --cron true
*/5 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain ETH --interval 5m --expires 30d --cron true > /home/logs/crontab.log
*/5 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain LTC --interval 5m --expires 30d --cron true
*/5 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain BCH --interval 5m --expires 30d --cron true
*/5 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain XMR --interval 5m --expires 30d --cron true

#Stats 1 hour
0 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain LTC --interval 1h --expires 365d --cron true
0 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain BTC --interval 1h --expires 365d --cron true
0 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain BCH --interval 1h --expires 365d --cron true
0 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain XMR --interval 1h --expires 365d --cron true
0 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain ETH --interval 1h --expires 365d --cron true

#Stats 1 day
0 5 * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain ETH --interval 1d --cron true
0 5 * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain BTC --interval 1d --cron true
0 5 * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain BCH --interval 1d --cron true
0 5 * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain LTC --interval 1d --cron true
0 5 * * * /root/.nvm/versions/node/v16.13.0/bin/node /home/processor/dist/entry/create-stat-history --chain XMR --interval 1d --cron true