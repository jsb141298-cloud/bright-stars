// Edit this file to change prices, availability, travel charge or exam date. No other code needs touching.
export default {
  standalone: { 1: 25, 2: 42 },                 // standalone bookings (pounds)
  packages: { 6: 117, 12: 228, 24: 444, 36: 648 }, // fixed package prices (pounds)
  minRate: 18,                                   // no hour may cost less than this
  availability: {
    oneToOne: "Spaces available for one-to-one tuition",
    group: "Group tuition is currently fully booked. Ask to join the waiting list."
  },
  travelCharge: null,        // e.g. { amount: 5, note: "per visit outside Hayes" }. null = not shown
  satsExamDate: null,        // e.g. "2027-05-10". null = assume 12 or more weeks remain
  whatsapp: "447810814257",
  email: "info@brightstarslearning.co.uk"
};
