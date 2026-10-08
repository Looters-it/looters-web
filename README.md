# looters-web

L'interfaccia: React e TypeScript con Vite, Tailwind e shadcn/ui, mappa con MapLibre. In italiano, predisposta per altre lingue.

Fa parte di [Looters](https://github.com/Looters-it/looters), un gioco di conquista multigiocatore sui comuni italiani. Questo repository non si usa da solo: va clonato dentro il repository radice, che contiene `docker-compose.yml`, documentazione e istruzioni.

```sh
git clone https://github.com/Looters-it/looters.git && cd looters
git clone https://github.com/Looters-it/looters-web.git web
```

- Avvio, test e comandi: [README del repository radice](https://github.com/Looters-it/looters#readme)
- Contratto tra i servizi: [`docs/ARCHITECTURE.md`](https://github.com/Looters-it/looters/blob/main/docs/ARCHITECTURE.md)
- Regole del gioco: [`docs/SPEC.md`](https://github.com/Looters-it/looters/blob/main/docs/SPEC.md)

Controlli in locale: `pnpm lint && pnpm typecheck && pnpm test`.
