const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])

// Host header without its port; IPv6 literals keep their brackets.
function hostname(host: string): string {
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]!
  return name.toLowerCase()
}

// A page from another site can point its own domain to 127.0.0.1 (DNS rebinding) and then
// read the board as if it were same-origin; its requests still carry that domain as Host.
export function isAllowedHost(
  host: string | undefined,
  listenHost = process.env.NITRO_HOST,
  extraHosts = process.env.BOARD_ALLOWED_HOSTS,
): boolean {
  if (!host) return false
  const name = hostname(host)
  if (LOOPBACK.has(name)) return true
  // 0.0.0.0 and :: listen everywhere and name no host.
  const allowed = [listenHost, ...(extraHosts ?? '').split(',')]
    .map((h) => hostname((h ?? '').trim()))
    .filter((h) => h && h !== '0.0.0.0' && h !== '[::]')
  return allowed.includes(name)
}
