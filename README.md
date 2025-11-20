<p align="center">
  <h1 align="center">HUMS</h1>
  <h3 align="center">Hive User Management System</h3>

  <p align="center">
    User management system for The Hive Makerspace at Georgia Tech.
  </p>
</p>

<p align="center">
   <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/ECEHive/hums?style=flat&color=yellow">
   <img alt="GitHub License" src="https://img.shields.io/github/license/ECEHive/hums">
	<img alt="GitHub top language" src="https://img.shields.io/github/languages/top/ECEHive/hums">
</p>

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
	git clone https://github.com/ECEHive/hums.git
	cd hums
	```

2. If you are able to use development containers, setup and enter the development container as is appropriate for your IDE. If you are unable to use development containers, you will need to manually setup a Postgres instance.

3. Install dependencies for the whole workspace:

	```sh
	pnpm install
	```

4. Generate database and apply migrations:

	```sh
	cd packages/prisma
	pnpm generate && pnpm migrate
	```

5. Create environment files for each app that needs them (examples are provided):

	```sh
	cp apps/client/.env.sample apps/client/.env
	cp apps/kiosk/.env.sample apps/kiosk/.env
	cp apps/server/.env.sample apps/server/.env
	# then edit the .env files to suit your local environment
	```

Refer to each app's README for required variables.

## Development

To start server, client, and kiosk with hot-reload, run the following in the workspace root,

```sh
pnpm run -r dev
```

You can then access the client at https://localhost:44831/.

The kiosk is accessible at https://localhost:44832/ and the server is accessible at http://localhost:44830/.

Notes:
- You may get an HTTPS warning in the browser when using the local dev servers. You can accept/bypass the warning to continue.

## License

See [LICENSE](./LICENSE) for license details.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing (branching, commits, pull requests, and reviews). Also read and follow our [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) to help keep the community respectful and collaborative.

![Alt](https://repobeats.axiom.co/api/embed/e340dcbcd1c8721fa10e52301b8825cd1e253ac2.svg "Repobeats analytics image (dev branch)")
