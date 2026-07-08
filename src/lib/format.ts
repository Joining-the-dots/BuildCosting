export const gbp = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

export const gbpSigned = (n: number) => (n >= 0 ? `+${gbp(n)}` : `−${gbp(Math.abs(n))}`);

export const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

export const FLOOR_LABEL: Record<string, string> = {
  ground: "Ground Floor",
  first: "First Floor",
  second: "Second Floor",
  all: "Whole House",
};
