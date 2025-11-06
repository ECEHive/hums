# Hive Scheduler

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ECEHive/scheduler/code-quality.yaml?label=quality)
![GitHub Repo stars](https://img.shields.io/github/stars/ECEHive/scheduler?style=flat)

Shift scheduling system for The Hive Makerspace at Georgia Tech.

## Structure

This project has a monorepo structure. The `apps/` directory contains applications (e.g. client, server) while the `packages/` directory contains shared libraries and tools (e.g. prisma, trpc)

## Prerequisites

- Node.js (v18+ recommended)
- pnpm (workspace-aware package manager)
- Docker (optional, useful for devcontainers)

Check your versions:

```sh
node -v
pnpm -v
```

## Setup

1. Clone the repository:

	```sh
	git clone https://github.com/ECEHive/hive-scheduler.git
	cd hive-scheduler
	```

2. If you are able to use development containers, setup and enter the development container as is appropriate for your IDE. If you are unable to use development containers, you will need to manually setup a Postgres instance.

3. Install dependencies for the whole workspace:

	```sh
	pnpm install
	```

4. Apply database migrations:

	```sh
	cd packages/prisma
	pnpm migrate
	```

5. Create environment files for each app that needs them (examples are provided):

	```sh
	cp apps/client/.env.sample apps/client/.env
	cp apps/server/.env.sample apps/server/.env
	# then edit the .env files to suit your local environment
	```

Refer to each app's README for required variables.

## Development

To start server and client with hot-reload, run the following in the workspace root,

```sh
pnpm run -r dev
```

You can then access the application at https://localhost:4483/.

Notes:
- You may get an HTTPS warning in the browser when using the local dev server. You can accept/bypass the warning to continue.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing (branching, commits, pull requests, and reviews). Also read and follow our [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) to help keep the community respectful and collaborative.

## License

See [LICENSE](./LICENSE) for license details.

---

![Alt](https://repobeats.axiom.co/api/embed/3834aafc611c93e7601ae61b25dfc6e8cde6b986.svg "Repobeats analytics image")
