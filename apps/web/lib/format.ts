// Dates render the same on the server and in the browser (no hydration
// mismatch) and match where the business runs.
const timeZone = "Asia/Bangkok"

const dateFormat = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeZone,
})

export function formatDate(iso: string | Date): string {
  return dateFormat.format(new Date(iso))
}
