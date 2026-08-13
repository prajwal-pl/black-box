module.exports = {
  apps: [
    {
      name: "api",
      script: "index.ts",
      interpreter: "bun",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "workers",
      script: "workers/all-workers.ts",
      interpreter: "bun",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
