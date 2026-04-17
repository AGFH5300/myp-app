export const adsConfig = {
  enabled: process.env.NEXT_PUBLIC_ADS_ENABLED === 'true',
  provider: process.env.NEXT_PUBLIC_AD_PROVIDER ?? 'placeholder',
  clientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID,
}

export const adSlots = {
  landingInline: process.env.NEXT_PUBLIC_AD_SLOT_LANDING_INLINE ?? 'atlas-landing-inline',
  dashboardSidebar: process.env.NEXT_PUBLIC_AD_SLOT_DASHBOARD_SIDEBAR ?? 'atlas-dashboard-sidebar',
  listFooter: process.env.NEXT_PUBLIC_AD_SLOT_LIST_FOOTER ?? 'atlas-list-footer',
} as const
