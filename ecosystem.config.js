module.exports = {
  apps: [
    {
      name: "webmaker",
      cwd: "/home/ubuntu/webmaker-agent/webmaker",
      script: "npm",
      args: "run dev",
      env: {
        WEBMAKER_HERMES_PATH: "/home/ubuntu/webmaker-agent/hermes-agent",
        WEBMAKER_HERMES_PYTHON:
          "/home/ubuntu/webmaker-agent/hermes-agent/.venv/bin/python",
      },
    },
  ],
};
