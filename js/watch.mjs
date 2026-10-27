// All clock comparisons use Paris local time, independently of the device timezone.
export function parisClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, minute: Number(values.hour) * 60 + Number(values.minute) };
}
export function departureMinute(train, day) {
  if (train.expectedDeparture && Number.isFinite(Date.parse(train.expectedDeparture))) {
    const expected = parisClock(new Date(train.expectedDeparture));
    if (expected.date === day) return expected.minute;
  }
  const [hours, minutes] = train.departure.split(':').map(Number);
  return hours * 60 + minutes;
}
export function watchKey(train) {
  return `${train.direction}-${train.number}-${train.departure}`;
}
export function selectWatch(trains, day, now = new Date()) {
  const clock = parisClock(now);
  if (day !== clock.date) return null;
  const candidates = trains.filter(train => !train.cancelled && departureMinute(train, day) >= clock.minute);
  candidates.sort((a, b) => departureMinute(a, day) - departureMinute(b, day) || a.departure.localeCompare(b.departure) || a.number.localeCompare(b.number));
  const train = candidates[0];
  return train ? { train, minutes: departureMinute(train, day) - clock.minute, key: watchKey(train) } : null;
}
