export function agendaBookingSignal(companyId: string) {
  return `agenda:public-booking:${companyId}`;
}

export function announcePublicBooking(companyId: string, appointmentId: string) {
  const signal = agendaBookingSignal(companyId);
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(signal);
      try {
        channel.postMessage(appointmentId);
      } finally {
        channel.close();
      }
    } catch {
      // Storage and polling can still propagate the confirmation.
    }
  }
  try {
    window.localStorage.setItem(signal, appointmentId);
  } catch {
    // Booking confirmation also works when browser storage is unavailable.
  }
}
