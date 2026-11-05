import { Check, Clock3, Navigation, TriangleAlert } from 'lucide-react'

export default function TripStatusIcon({ status }: { status: string }) {
  const Icon = status === 'delayed' ? TriangleAlert : status === 'active' ? Navigation : status === 'planned' || status === 'completed' ? Check : Clock3
  return <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
}
