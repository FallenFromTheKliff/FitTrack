export function maskAuthDestination(destination: string): string {
  if (!destination) return "";
  if (destination.includes("@")) {
    const [localPart, domain] = destination.split("@");
    if (!domain) return destination;
    if (localPart.length <= 2) return `${localPart[0] ?? ""}***@${domain}`;
    return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
  }
  if (destination.length < 7) return destination;
  return `${destination.slice(0, 4)}***${destination.slice(-4)}`;
}
