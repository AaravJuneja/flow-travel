import { Link } from '@tanstack/react-router'

export default function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Flow by Velo AI home">
      <img className="brand-mark" src="/assets/figma/flow-mark.svg" width="31" height="31" alt="" />
      <span className="brand-name">flow</span>
      <span className="brand-byline">by Velo AI</span>
    </Link>
  )
}
