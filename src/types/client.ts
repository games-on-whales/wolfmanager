export interface ClientDevice {
  id: string;
  friendly_name: string;
  pair_secret: string; // Store the original pairing secret for duplicate detection
}
