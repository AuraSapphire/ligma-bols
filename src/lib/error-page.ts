export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PokéForge Studio — Error</title>
  </head>
  <body>
    <main>
      <h1>PokéForge Studio could not load</h1>
      <p>Try refreshing the page. If the problem continues, check the browser console.</p>
    </main>
  </body>
</html>`;
}
