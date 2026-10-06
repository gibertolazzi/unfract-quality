import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Indirizzi che il server può visitare per conto di un utente.
 *
 * Il lettore di siti dei prospect scarica pagine il cui indirizzo lo decide
 * l'utente. Senza controlli si poteva chiedere `127.0.0.1:8080`, l'indirizzo
 * dei metadati del cloud (`169.254.169.254`) o un dominio che fa redirect lì:
 * il server avrebbe letto per noi indirizzi interni che da fuori non si
 * raggiungono (SSRF, segnalazione S18).
 *
 * Qui si accettano solo domini (niente IP scritti a mano), solo http e https,
 * solo le porte 80 e 443, e solo se **tutti** gli indirizzi a cui il dominio
 * risolve sono pubblici. Il controllo va ripetuto a ogni redirect.
 *
 * Resta un caso che questo controllo non copre: un DNS che risponde in modo
 * diverso fra il controllo e la connessione (DNS rebinding). Chiuderlo
 * richiede di connettersi all'indirizzo già verificato.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

type Lookup = (hostname: string) => Promise<string[]>;

const defaultLookup: Lookup = async hostname =>
  (await dnsLookup(hostname, { all: true, verbatim: true })).map(entry => entry.address);

// Reti IPv4 non pubbliche: RFC 6890 e seguenti.
const IPV4_BLOCKED: Array<[string, number]> = [
  ['0.0.0.0', 8],        // "questa" rete
  ['10.0.0.0', 8],       // privata
  ['100.64.0.0', 10],    // CGNAT
  ['127.0.0.0', 8],      // loopback
  ['169.254.0.0', 16],   // link-local, metadati del cloud
  ['172.16.0.0', 12],    // privata
  ['192.0.0.0', 24],     // IETF
  ['192.0.2.0', 24],     // documentazione
  ['192.168.0.0', 16],   // privata
  ['198.18.0.0', 15],    // benchmark
  ['198.51.100.0', 24],  // documentazione
  ['203.0.113.0', 24],   // documentazione
  ['224.0.0.0', 4],      // multicast
  ['240.0.0.0', 4],      // riservata e broadcast
];

function ipv4ToNumber(address: string): number {
  return address.split('.').reduce((total, part) => total * 256 + Number(part), 0);
}

function isPublicIpv4(address: string): boolean {
  const value = ipv4ToNumber(address);
  return !IPV4_BLOCKED.some(([network, bits]) => {
    const size = 2 ** (32 - bits);
    const start = ipv4ToNumber(network);
    return value >= start && value < start + size;
  });
}

/** Le otto parole da 16 bit di un indirizzo IPv6, o `null` se non si legge. */
function ipv6Words(address: string): number[] | null {
  let text = address.split('%')[0].toLowerCase();
  // Coda in forma IPv4 (::ffff:10.0.0.1): diventa due parole.
  const v4 = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    if (isIP(v4[1]) !== 4) return null;
    const value = ipv4ToNumber(v4[1]);
    text = text.slice(0, -v4[1].length) + `${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const words = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail]
    .map(word => parseInt(word, 16));
  return words.length === 8 && words.every(word => word >= 0 && word <= 0xffff) ? words : null;
}

function isPublicIpv6(address: string): boolean {
  const words = ipv6Words(address);
  if (!words) return false;
  // Solo unicast globale (2000::/3). Tutto il resto, IPv4 mappati compresi,
  // non serve per leggere il sito di un'azienda.
  if ((words[0] & 0xe000) !== 0x2000) return false;
  if (words[0] === 0x2001 && words[1] === 0x0db8) return false; // documentazione
  if (words[0] === 0x2001 && words[1] === 0x0000) return false; // Teredo
  if (words[0] === 0x2002) return false;                        // 6to4, incapsula IPv4
  return true;
}

export function isPublicIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);
  return false;
}

/**
 * Restituisce l'URL se il server può visitarlo, altrimenti `UnsafeUrlError`.
 * Un errore del DNS passa così com'è: è un problema di rete, non un abuso.
 */
export async function assertPublicUrl(raw: string, lookup: Lookup = defaultLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Indirizzo non valido.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeUrlError('Sono ammessi solo indirizzi http e https.');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('L’indirizzo non può contenere credenziali.');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new UnsafeUrlError('Sono ammesse solo le porte 80 e 443.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) {
    throw new UnsafeUrlError('Serve un dominio, non un indirizzo IP.');
  }
  if (!hostname.includes('.')) {
    throw new UnsafeUrlError('Serve un dominio pubblico.');
  }

  const addresses = await lookup(hostname);
  if (addresses.length === 0 || addresses.some(address => !isPublicIp(address))) {
    throw new UnsafeUrlError(`${hostname} punta a un indirizzo non pubblico.`);
  }
  return url;
}
