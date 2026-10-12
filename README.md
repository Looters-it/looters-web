# looters-web

The interface: React and TypeScript with Vite, Tailwind and shadcn/ui, with a MapLibre map. In Italian and English, ready for other languages.

It is part of [Looters](https://github.com/Looters-it/looters), an online multiplayer conquest game played on real municipalities. This repository is not used on its own: it is cloned inside the root repository, which holds `docker-compose.yml`, the documentation and the instructions.

```sh
git clone https://github.com/Looters-it/looters.git && cd looters
git clone https://github.com/Looters-it/looters-web.git web
```

- Running, testing and commands: [README of the root repository](https://github.com/Looters-it/looters#readme)
- Contract between the services: [`docs/ARCHITECTURE.md`](https://github.com/Looters-it/looters/blob/main/docs/ARCHITECTURE.md)
- Rules of the game: [`docs/SPEC.md`](https://github.com/Looters-it/looters/blob/main/docs/SPEC.md)

Local checks: `pnpm lint && pnpm typecheck && pnpm test`.
