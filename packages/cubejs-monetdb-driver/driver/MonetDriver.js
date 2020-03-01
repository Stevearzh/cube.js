const MDB = require('monetdb')();
const SqlString = require('sqlstring');
const genericPool = require('generic-pool');
const { promisify } = require('util');
const BaseDriver = require('@cubejs-backend/query-orchestrator/driver/BaseDriver');

class MonetDriver extends BaseDriver {
  constructor(config) {
    super();

    this.config = {
      host: process.env.CUBEJS_DB_HOST,
      port: process.env.CUBEJS_DB_PORT,
      dbname: process.env.CUBEJS_DB_NAME,
      user: process.env.CUBEJS_DB_USER,
      password: process.env.CUBEJS_DB_PASS,
      ...config
    };

    this.pool = genericPool.createPool({
      create: async () => {
        const conn = new MDB(this.config);

        await conn.connect();
        return conn;
      },
      destroy: (connection) => connection.destroy(),
    }, {
      min: 0,
      max: 8,
      evictionRunIntervalMillis: 10000,
      softIdleTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      testOnBorrow: true,
      acquireTimeoutMillis: 20000
    });
  }

  async testConnection() {
    // eslint-disable-next-line no-underscore-dangle
    const conn = await this.pool._factory.create();
    try {
      return await this.query('SELECT 1', [], conn);
    } finally {
      // eslint-disable-next-line no-underscore-dangle
      await this.pool._factory.destroy(conn);
    }
  }

  async query(query, values) {
    const sql = SqlString.format(query, values || []);
    const conn = await this.pool.acquire();

    try {
      const execResult = await conn.query(sql);
      return execResult;
    } finally {
      this.pool.release(conn);
    }
  }

  async release() {
    await this.pool.drain();
    await this.pool.clear();
  }
}

module.exports = MonetDriver;
