const { ConfigWatcher } = require('../dist/src/ConfigWatcher');

const watcher = new ConfigWatcher({
  db: {
    user: 'bitcapital',
    database: 'core_api',
    password: 'bitcapital',
    host: 'localhost'
  }
});

(async function() {
  await watcher.initialize();
})();