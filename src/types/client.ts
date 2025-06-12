export interface ClientDevice {
  id: string;
  wolf_client_id?: string;
  friendly_name: string;
  pair_secret: string; // Store the original pairing secret for duplicate detection
}
