// Colours, type sizes and spacing used across the app.
// Brand: the black Lion Rock mark on warm off-white, with one gold accent.
export const colors = {
  bg: '#F6F5F2',
  card: '#FFFFFF',
  text: '#15171A',
  muted: '#6B7078',
  faint: '#9AA0A8',
  border: '#E7E5E0',
  primary: '#15171A',
  primaryText: '#FFFFFF',
  accent: '#B8862B',
  accentBg: '#FBF3E1',
  danger: '#C8322B',
  pending: '#A16207',
  pendingBg: '#FEF6D8',
  uploading: '#1D4ED8',
  uploadingBg: '#E0EAFF',
  synced: '#15803D',
  syncedBg: '#DDF7E5',
  failed: '#C8322B',
  failedBg: '#FDE4E2',
  needsDetails: '#6D28D9',
  needsDetailsBg: '#EEE8FE',
  offlineBg: '#FEF3C7',
  offlineText: '#7C4A03',
  overlay: 'rgba(21, 23, 26, 0.55)',
};

/** Left-edge colour of a card, by receipt Type. */
export const typeColors = {
  emerald: '#10B981',
  amber: '#F59E0B',
  indigo: '#6366F1',
  slate: '#64748B',
} as const;

/** Soft colours per receipt Type, the same ones the office screen uses for its rows and filters. */
export const typeTints = {
  emerald: { bg: '#D1FAE5', border: '#6EE7B7', text: '#047857', solid: '#10B981' },
  amber: { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', solid: '#D97706' },
  indigo: { bg: '#E0E7FF', border: '#A5B4FC', text: '#3730A3', solid: '#4F46E5' },
  slate: { bg: '#F1F5F9', border: '#CBD5E1', text: '#334155', solid: '#64748B' },
} as const;

export const space ={ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = 16;
export const radiusSmall = 10;

/** Soft elevation for cards and raised buttons. */
export const shadow = { boxShadow: '0 1px 2px rgba(21, 23, 26, 0.05), 0 6px 16px rgba(21, 23, 26, 0.06)' } as const;

export const type = {
  hero: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2, color: colors.text },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, lineHeight: 21, color: colors.text },
  small: { fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.faint },
} as const;
