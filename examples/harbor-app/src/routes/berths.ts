import { berthStore } from "../stores/berths";

export async function listBerths() {
  return berthStore.available();
}
