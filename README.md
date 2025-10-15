# Hive Scheduler

Shift scheduling system for The Hive Makerspace at Georgia Tech.

## Structure

- `apps/` Separate applications. For example, the client and the server.
- `packages/` Shared code between applications.

## Setup

1. Clone the repository,
	```sh
	git clone https://github.com/ECEHive/hive-scheduler
	```
3. Open the repository in the editor of your choice.
    - If you are using VS Code and have Docker installed, you can open the folder in a developer container.
5. Install dependencies,
	```sh
	pnpm install
	```
6. Push the database schema,
	```sh
	cd ./packages/drizzle && pnpm push
	```

7. Setup environmental variables in the `apps/client` and `apps/api` directories by copying the `.env.sample` to `.env` and modifying as needed. Reference each app's READMEs for each variable.

## Running

1. Run the API,
	```
	cd ./apps/api && pnpm start
	```
2. Run the server,
	```
	cd ./apps/server && pnpm dev
	```

> You will receive an HTTPS warning when visiting the client. You can ignore this warning and proceed to the site.

> Safari may have issues when making API requests, so use a Firefox or Chromium based browser when testing.

Both the client and the server must be running for everything to be functional. The client will hot-reload, the server will not.

## Contributing

1. Before you commit, run the required code checks,
	```sh
	pnpm check
	```
2. Create a pull request with your changes.

![Alt](https://repobeats.axiom.co/api/embed/4f681a06b224ae315d44b257b17f52576bc6eefc.svg "Repobeats analytics image")
