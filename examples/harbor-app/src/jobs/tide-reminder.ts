import { listBerths } from "../routes/berths";

export async function sendTideReminder() {
  return listBerths();
}
