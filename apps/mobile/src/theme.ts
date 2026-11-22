export const colors = {
  maroon: "#961826",
  maroonDark: "#730F1B",
  maroonDeep: "#560B14",
  maroonSoft: "#F6E4E6",
  cream: "#FFF8F1",
  creamDeep: "#F7EDE1",
  sand: "#F1E3D2",
  surface: "#FFFFFF",
  ink: "#2B1619",
  inkSoft: "#4A3034",
  muted: "#80696B",
  line: "#EADCCD",
  lineStrong: "#DCC7B0",
  gold: "#D8A24A",
  goldSoft: "#FBEFD9",
  green: "#1F7A5C",
  greenSoft: "#E3F4EC",
  amber: "#A96A13",
  amberSoft: "#FCEFD8",
  red: "#B4232C",
  redSoft: "#FBE7E8",
  white: "#FFFFFF",
  black: "#160A0C",
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#3A1A1E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  raised: {
    shadowColor: "#3A1A1E",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
};

export const fonts = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  heavy: "800" as const,
};

export const statusMeta = {
  submitted_to_demo_system: { label: "Terkirim", color: colors.amber, bg: colors.amberSoft },
  under_review: { label: "Ditinjau", color: "#2C5E8A", bg: "#E6EFF8" },
  resolved: { label: "Selesai", color: colors.green, bg: colors.greenSoft },
  closed: { label: "Ditutup", color: colors.muted, bg: colors.creamDeep },
} as const;

export const priorityMeta = {
  low: { label: "Rendah", color: colors.green, bg: colors.greenSoft },
  medium: { label: "Sedang", color: colors.amber, bg: colors.amberSoft },
  high: { label: "Tinggi", color: colors.red, bg: colors.redSoft },
} as const;

export const categoryLabels = {
  lost_and_found: "Barang tertinggal",
  ticket_issue: "Masalah tiket",
  boarding_issue: "Proses boarding",
  station_facility: "Fasilitas stasiun",
  train_service: "Layanan kereta",
  other: "Lainnya",
} as const;
