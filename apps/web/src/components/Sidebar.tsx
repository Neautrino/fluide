import { Link, useMatchRoute } from '@tanstack/react-router'
import { AppSidebar, NAV, NAV_LINK, NAV_LINK_ACTIVE, NAV_LINK_INACTIVE } from '@repo/ui/shell'
import { useReviewCount } from '../lib/queries'

export function Sidebar() {
  const reviewCount = useReviewCount()
  const matchRoute = useMatchRoute()
  const current = NAV.find((item) => matchRoute({ to: item.to, fuzzy: item.to !== '/' }))?.label ?? 'Menu'

  return (
    <AppSidebar
      items={NAV}
      reviewCount={reviewCount}
      currentLabel={current}
      renderLink={(item, children, onNavigate) => (
        <Link
          to={item.to}
          onClick={onNavigate}
          activeOptions={{ exact: item.to === '/' }}
          className={NAV_LINK}
          activeProps={{ className: NAV_LINK_ACTIVE }}
          inactiveProps={{ className: NAV_LINK_INACTIVE }}
        >
          {children}
        </Link>
      )}
    />
  )
}
