const { MongoMemoryReplSet } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');

async function start() {
  console.log('Starting MongoDB Memory Server (v4.4.24) with replica set...');
  
  const dbPath = path.join(__dirname, 'mongodb_data');
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  const replSet = await MongoMemoryReplSet.create({
    binary: {
      version: '4.4.24',
    },
    replSet: {
      name: 'rs0',
      dbName: 'quiz_class',
      count: 1,
      storageEngine: 'wiredTiger',
    },
    instanceOpts: [
      {
        port: 27017,
        dbPath: dbPath,
      }
    ]
  });

  const uri = replSet.getUri();
  console.log(`🚀 MongoDB replica set started successfully!`);
  console.log(`URI: ${uri}`);
  console.log(`Port: 27017`);
  console.log(`Database folder: ${dbPath}`);

  // Keep process alive
  process.on('SIGINT', async () => {
    console.log('Stopping MongoDB...');
    await replSet.stop();
    process.exit(0);
  });
}

start().catch(err => {
  console.error('Failed to start MongoDB:', err);
});
