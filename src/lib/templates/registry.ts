import type { IndustryTemplate } from "./types";

export const TEMPLATES: Record<IndustryTemplate["key"], IndustryTemplate> = {
  generic: {
    key: "generic",
    labels: {
      providerLabel: "Provider",
      providersLabelPlural: "Providers",
      serviceLabel: "Service",
      servicesLabelPlural: "Services",
      customerLabel: "Client",
      customersLabelPlural: "Clients",
      bookingNoun: "Booking",
    },
    bookingCopy: {
      heroTitle: "Book an appointment",
      heroSubtitle: "Choose a service and pick a time that suits you.",
      microcopy: ["You'll get a link to manage your booking."],
    },
    ui: {
      ctaConfirm: "Confirm booking",
      scheduleTitle: "Schedule",
      accentColorDefault: "#111827",
    },
  },

  barber: {
    key: "barber",
    labels: {
      providerLabel: "Barber",
      providersLabelPlural: "Barbers",
      serviceLabel: "Service",
      servicesLabelPlural: "Services",
      customerLabel: "Customer",
      customersLabelPlural: "Customers",
      bookingNoun: "Booking",
    },
    bookingCopy: {
      heroTitle: "Book your haircut in minutes",
      heroSubtitle: "Choose a service, pick your barber, select a time.",
      microcopy: [
        "No payment required.",
        "Manage your booking from the link we'll send you.",
      ],
    },
    ui: {
      ctaConfirm: "Confirm booking",
      scheduleTitle: "Today's schedule",
      accentColorDefault: "#111827",
    },
  },

  dental: {
    key: "dental",
    labels: {
      providerLabel: "Dentist",
      providersLabelPlural: "Dentists",
      serviceLabel: "Treatment",
      servicesLabelPlural: "Treatments",
      customerLabel: "Patient",
      customersLabelPlural: "Patients",
      bookingNoun: "Appointment",
    },
    bookingCopy: {
      heroTitle: "Book a dental appointment",
      heroSubtitle:
        "Select a treatment and choose a time that works for you.",
      microcopy: [
        "For urgent cases, call the clinic.",
        "You'll receive a link to reschedule or cancel.",
      ],
    },
    ui: {
      ctaConfirm: "Book appointment",
      scheduleTitle: "Today's appointments",
      accentColorDefault: "#111827",
    },
  },
};
