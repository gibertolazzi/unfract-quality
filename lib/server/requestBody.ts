/**
 * Il corpo JSON di una richiesta, come oggetto da controllare campo per campo.
 *
 * `null` se non è JSON leggibile. Un JSON che non è un oggetto (un numero,
 * una lista) vale come oggetto vuoto: i campi mancano e li respinge il
 * controllo della route, come prima.
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}
