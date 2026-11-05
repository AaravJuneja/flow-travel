import { Link } from '@tanstack/react-router'

export default function Brand({ to = '/' }: { to?: '/' | '/home' }) {
  return (
    <Link to={to} className="brand" aria-label="Flow by Velo AI home">
      <img className="brand-mark" src="/assets/flow-mark.svg" alt="" />
      <span className="brand-name">flow</span>
      <span className="brand-byline">by Velo AI</span>
    </Link>
  )
}
